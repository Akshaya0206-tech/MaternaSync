"""The one place referral state transitions happen. Every caller — the
Care Team UI, the Doctor UI, and the External Hospital Simulator — goes
through this service rather than writing to `Referral.status` directly,
so the state machine, task automation, notifications, journey updates,
and audit trail stay consistent regardless of who or what triggered the
change.

IMPLEMENTED vs SIMULATED vs FUTURE INTEGRATION:
  - IMPLEMENTED: the state machine, task automation, notifications,
    journey updates, audit trail, and the Communication event log below
    are all real and persisted.
  - SIMULATED: nothing actually contacts a real hospital. The "external"
    side of a referral is driven entirely by the External Hospital
    Simulator UI (routers/external_simulator.py), which a person operates
    by hand to stand in for a real hospital's system.
  - FUTURE INTEGRATION: `source` on Communication/ReferralEvent already
    supports SECURE_EMAIL / API / EHR_INTEGRATION alongside
    SYSTEM_SIMULATOR and MANUAL_ENTRY. A real integration would call the
    same `acknowledge` / `record_appointment` / `record_response` methods
    with one of those source values instead of SYSTEM_SIMULATOR — no
    change to the state machine or anything downstream of it.
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from . import models

OPEN_TASK_STATUSES = ("OPEN", "IN_PROGRESS", "WAITING")

# Only these transitions are ever allowed. Anything else is rejected —
# see Step 7 item 3: "Do not allow arbitrary status changes."
VALID_TRANSITIONS = {
    "DRAFT": {"SENT"},
    "SENT": {"ACKNOWLEDGED"},
    "ACKNOWLEDGED": {"APPOINTMENT_SCHEDULED"},
    "APPOINTMENT_SCHEDULED": {"RESPONSE_RECEIVED"},
    "RESPONSE_RECEIVED": {"CLOSED"},
    "CLOSED": set(),
}

WAITING_FOR_BY_STATUS = {
    # DRAFT has no entry: nothing external is blocking it yet, so the
    # tracking task starts OPEN ("Care Team can act now"), not WAITING.
    "SENT": "External hospital acknowledgement",
    "ACKNOWLEDGED": "External hospital to schedule an appointment",
    "APPOINTMENT_SCHEDULED": "External hospital referral response",
    "RESPONSE_RECEIVED": "Doctor review",
}

TASK_TITLE_BY_STATUS = {
    "DRAFT": "Send referral",
    "SENT": "Track acknowledgement",
    "ACKNOWLEDGED": "Track appointment",
    "APPOINTMENT_SCHEDULED": "Await referral response",
    "RESPONSE_RECEIVED": "Doctor review required",
}


class ReferralTransitionError(Exception):
    """Raised for an invalid state transition. Routers translate this to 409."""


class ReferralCommunicationService:
    def __init__(self, db: Session):
        self.db = db

    # ---------- shared helpers ----------

    def _episode(self, episode_id: str) -> models.PregnancyEpisode:
        return self.db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.id == episode_id).first()

    def _care_team_user_ids(self, episode_id: str) -> list[str]:
        rows = self.db.query(models.PatientCareTeamAssignment.care_team_user_id).filter(
            models.PatientCareTeamAssignment.episode_id == episode_id
        ).all()
        return [r[0] for r in rows]

    def _primary_doctor_id(self, episode_id: str) -> str | None:
        row = self.db.query(models.PatientDoctorAssignment).filter(
            models.PatientDoctorAssignment.episode_id == episode_id,
            models.PatientDoctorAssignment.is_primary == True,  # noqa: E712
        ).first()
        return row.doctor_user_id if row else None

    def _notify(self, recipient_user_id: str, episode_id: str, type_: str, title: str, body: str,
                related_entity_id: str) -> None:
        self.db.add(models.Notification(
            recipient_user_id=recipient_user_id, episode_id=episode_id, type=type_, title=title, body=body,
            related_entity_type="Referral", related_entity_id=related_entity_id,
        ))

    def _notify_care_team(self, episode_id: str, referral_id: str, type_: str, title: str, body: str) -> None:
        for uid in self._care_team_user_ids(episode_id):
            self._notify(uid, episode_id, type_, title, body, referral_id)

    def _notify_patient(self, episode: models.PregnancyEpisode, referral_id: str, type_: str, title: str, body: str) -> None:
        self._notify(episode.patient_user_id, episode.id, type_, title, body, referral_id)

    def _audit(self, episode_id: str, actor_user_id: str | None, actor_role: str | None, actor_name: str,
               action: str, title: str, details: str, referral_id: str) -> None:
        self.db.add(models.AuditLog(
            episode_id=episode_id, actor_user_id=actor_user_id, actor_role=actor_role,
            actor_display_name=actor_name, action=action, title=title, details=details,
            object_type="Referral", object_id=referral_id,
        ))

    def _journey(self, episode: models.PregnancyEpisode, title: str, summary: str, event_date: str) -> None:
        self.db.add(models.JourneyEvent(
            episode_id=episode.id, event_type="referral", title=title, summary=summary, event_date=event_date,
            gestational_age_weeks=episode.gestational_age_weeks, gestational_age_days=episode.gestational_age_days,
        ))

    def _next_reference_code(self) -> str:
        year = datetime.now(timezone.utc).year
        count = self.db.query(models.Referral).filter(models.Referral.reference_code.isnot(None)).count()
        return f"REF-{year}-{count + 1:05d}"

    def _sync_task(self, referral: models.Referral, status: str, owner_user_id: str | None) -> models.Task:
        task = self.db.query(models.Task).filter(
            models.Task.source_type == "referral", models.Task.source_id == referral.id,
        ).first()
        title = f"{TASK_TITLE_BY_STATUS.get(status, 'Referral')}: {referral.reference_code or referral.title}"
        waiting_for = WAITING_FOR_BY_STATUS.get(status)
        task_status = "COMPLETED" if status == "CLOSED" else ("WAITING" if waiting_for else "OPEN")

        if task is None:
            task = models.Task(
                episode_id=referral.episode_id, title=title, description=referral.description or "",
                owner_user_id=owner_user_id, created_by_user_id=referral.created_by_user_id,
                status=task_status, priority="routine", source_type="referral", source_id=referral.id,
                waiting_for=waiting_for, waiting_since=datetime.now(timezone.utc) if waiting_for else None,
            )
            self.db.add(task)
        else:
            task.title = title
            task.status = task_status
            if owner_user_id:
                task.owner_user_id = owner_user_id
            if waiting_for != task.waiting_for:
                task.waiting_for = waiting_for
                task.waiting_since = datetime.now(timezone.utc) if waiting_for else None
            task.updated_at = datetime.now(timezone.utc)
        return task

    def _require_transition(self, referral: models.Referral, to_status: str) -> None:
        allowed = VALID_TRANSITIONS.get(referral.status, set())
        if to_status not in allowed:
            raise ReferralTransitionError(
                f"Cannot move a referral from {referral.status} to {to_status}."
            )

    def _record_event(self, referral: models.Referral, to_status: str, actor_user_id: str | None,
                       actor_source: str, note: str | None) -> models.ReferralEvent:
        event = models.ReferralEvent(
            referral_id=referral.id, from_status=referral.status, to_status=to_status,
            note=note, actor_user_id=actor_user_id, actor_source=actor_source,
        )
        self.db.add(event)
        referral.status = to_status
        return event

    # ---------- actions ----------

    def create_referral(self, episode: models.PregnancyEpisode, doctor_user: models.User, title: str,
                         description: str, destination: str, referred_to: str | None, due_date: str | None) -> models.Referral:
        care_team_ids = self._care_team_user_ids(episode.id)
        owner_id = care_team_ids[0] if care_team_ids else None

        referral = models.Referral(
            episode_id=episode.id, reference_code=self._next_reference_code(), title=title.strip(),
            description=(description or "").strip(), destination=destination.strip() if destination else None,
            referred_to=referred_to, owner_user_id=owner_id, created_by_user_id=doctor_user.id,
            due_date=due_date, status="DRAFT",
        )
        self.db.add(referral)
        self.db.flush()

        self._sync_task(referral, "DRAFT", owner_id)
        self._audit(episode.id, doctor_user.id, doctor_user.role, doctor_user.full_name,
                    "referral_created", f"{doctor_user.full_name} created referral {referral.reference_code}",
                    f"{title} → {destination or 'destination not yet specified'}", referral.id)
        self._notify_care_team(episode.id, referral.id, "REFERRAL_CREATED", "New referral requires coordination.",
                                f"{episode.patient_name}: {title}")
        return referral

    def send_referral(self, referral: models.Referral, actor: models.User) -> models.Referral:
        self._require_transition(referral, "SENT")
        episode = self._episode(referral.episode_id)
        now = datetime.now(timezone.utc)

        referral.sent_at = now
        referral.sent_by_user_id = actor.id
        self._record_event(referral, "SENT", actor.id, "MANUAL_ENTRY", f"Sent to {referral.destination or 'destination'}.")

        doctor_id = self._primary_doctor_id(episode.id)
        doctor_user = self.db.query(models.User).filter(models.User.id == doctor_id).first() if doctor_id else None
        care_coordinator = self.db.query(models.User).filter(models.User.id == referral.owner_user_id).first() if referral.owner_user_id else None

        self.db.add(models.Communication(
            episode_id=episode.id, related_referral_id=referral.id, type="REFERRAL_OUTBOUND",
            direction="OUTBOUND", sender_label=actor.full_name, recipient_label=referral.destination,
            subject=f"Referral {referral.reference_code}: {referral.title}",
            content=build_external_referral_message(
                referral, episode, doctor_user.full_name if doctor_user else actor.full_name,
                care_coordinator.full_name if care_coordinator else "Not assigned",
            ),
            status="SENT", source="MANUAL_ENTRY", created_by_user_id=actor.id,
        ))

        self._sync_task(referral, "SENT", referral.owner_user_id)
        self._audit(episode.id, actor.id, actor.role, actor.full_name, "referral_sent",
                    f"{actor.full_name} sent referral {referral.reference_code}", f"To {referral.destination}.", referral.id)

        doctor_id = self._primary_doctor_id(episode.id)
        if doctor_id:
            self._notify(doctor_id, episode.id, "REFERRAL_SENT", "Your referral has been sent",
                         f"{episode.patient_name}: {referral.title} sent to {referral.destination}.", referral.id)
        self._notify_patient(episode, referral.id, "REFERRAL_SENT", "Referral update",
                              "Your referral has been sent and is being processed.")
        self._journey(episode, "Referral sent", "Your referral was sent to a specialist.",
                      now.date().isoformat())
        return referral

    def acknowledge(self, referral: models.Referral, source: str, actor: models.User | None = None,
                     external_reference: str | None = None, note: str | None = None) -> models.Referral:
        self._require_transition(referral, "ACKNOWLEDGED")
        episode = self._episode(referral.episode_id)
        now = datetime.now(timezone.utc)

        referral.acknowledged_at = now
        referral.acknowledged_source = source
        self._record_event(referral, "ACKNOWLEDGED", actor.id if actor else None, source,
                            note or "Acknowledgement received.")

        self.db.add(models.Communication(
            episode_id=episode.id, related_referral_id=referral.id, type="REFERRAL_INBOUND",
            direction="INBOUND", sender_label=referral.destination or "External hospital",
            recipient_label="Care Team", subject=f"Referral {referral.reference_code} acknowledged",
            content=note or f"{referral.destination or 'The destination'} acknowledged receipt of this referral.",
            status="RECEIVED", source=source, external_reference=external_reference,
            received_at=now, created_by_user_id=actor.id if actor else None,
        ))

        self._sync_task(referral, "ACKNOWLEDGED", referral.owner_user_id)
        actor_name = actor.full_name if actor else "External Hospital Simulator"
        self._audit(episode.id, actor.id if actor else None, actor.role if actor else None, actor_name,
                    "referral_acknowledged", f"Referral {referral.reference_code} acknowledged",
                    f"Source: {source}.", referral.id)
        self._notify_care_team(episode.id, referral.id, "REFERRAL_ACKNOWLEDGED", "Referral acknowledged",
                                f"{episode.patient_name}: {referral.destination or 'Destination'} acknowledged the referral.")
        return referral

    def record_appointment(self, referral: models.Referral, appointment_date: str, appointment_time: str | None,
                            external_provider: str | None, source: str, actor: models.User | None = None) -> models.Referral:
        self._require_transition(referral, "APPOINTMENT_SCHEDULED")
        episode = self._episode(referral.episode_id)
        now = datetime.now(timezone.utc)

        referral.appointment_date = appointment_date
        referral.appointment_time = appointment_time
        referral.external_provider = external_provider
        referral.appointment_recorded_source = source
        self._record_event(referral, "APPOINTMENT_SCHEDULED", actor.id if actor else None, source,
                            f"Appointment {appointment_date} {appointment_time or ''}".strip())

        self.db.add(models.Communication(
            episode_id=episode.id, related_referral_id=referral.id, type="REFERRAL_INBOUND",
            direction="INBOUND", sender_label=referral.destination or "External hospital",
            recipient_label="Care Team", subject=f"Referral {referral.reference_code} appointment scheduled",
            content=f"Appointment scheduled for {appointment_date} {appointment_time or ''}"
                    f"{f' with {external_provider}' if external_provider else ''}.",
            status="RECEIVED", source=source, received_at=now, created_by_user_id=actor.id if actor else None,
        ))

        self._sync_task(referral, "APPOINTMENT_SCHEDULED", referral.owner_user_id)
        actor_name = actor.full_name if actor else "External Hospital Simulator"
        self._audit(episode.id, actor.id if actor else None, actor.role if actor else None, actor_name,
                    "referral_appointment_recorded", f"Appointment recorded for referral {referral.reference_code}",
                    f"{appointment_date} {appointment_time or ''}", referral.id)
        self._notify_care_team(episode.id, referral.id, "APPOINTMENT_SCHEDULED", "Referral appointment scheduled",
                                f"{episode.patient_name}: appointment on {appointment_date}.")
        self._notify_patient(episode, referral.id, "APPOINTMENT_SCHEDULED", "Referral update",
                              "Your appointment has been scheduled.")
        self._journey(episode, "Referral appointment scheduled", "Your specialist appointment was scheduled.",
                      now.date().isoformat())
        return referral

    def record_response(self, referral: models.Referral, response_text: str, source: str,
                         actor: models.User | None = None) -> models.Referral:
        self._require_transition(referral, "RESPONSE_RECEIVED")
        episode = self._episode(referral.episode_id)
        now = datetime.now(timezone.utc)

        referral.response_text = response_text
        referral.response_received_at = now
        referral.response_source = source
        self._record_event(referral, "RESPONSE_RECEIVED", actor.id if actor else None, source, "Response received.")

        self.db.add(models.Communication(
            episode_id=episode.id, related_referral_id=referral.id, type="REFERRAL_INBOUND",
            direction="INBOUND", sender_label=referral.destination or "External hospital",
            recipient_label="Care Team", subject=f"Referral {referral.reference_code} response received",
            content=response_text, status="RECEIVED", source=source, received_at=now,
            created_by_user_id=actor.id if actor else None,
        ))

        doctor_id = self._primary_doctor_id(episode.id)
        self._sync_task(referral, "RESPONSE_RECEIVED", doctor_id or referral.owner_user_id)
        actor_name = actor.full_name if actor else "External Hospital Simulator"
        self._audit(episode.id, actor.id if actor else None, actor.role if actor else None, actor_name,
                    "referral_response_received", f"Response received for referral {referral.reference_code}",
                    response_text[:200], referral.id)
        self._notify_care_team(episode.id, referral.id, "REFERRAL_RESPONSE_RECEIVED", "Referral response received",
                                f"{episode.patient_name}: response received for {referral.title}.")
        if doctor_id:
            self._notify(doctor_id, episode.id, "DOCTOR_REVIEW_REQUIRED", "Referral response received — review required.",
                         f"{episode.patient_name}: {referral.title}", referral.id)
        self._notify_patient(episode, referral.id, "REFERRAL_RESPONSE_RECEIVED", "Referral update",
                              "Your referral response has been received.")
        self._journey(episode, "Referral response received", "A response was received from your specialist referral.",
                      now.date().isoformat())
        return referral

    def doctor_review_and_close(self, referral: models.Referral, doctor: models.User) -> models.Referral:
        self._require_transition(referral, "CLOSED")
        episode = self._episode(referral.episode_id)
        now = datetime.now(timezone.utc)

        referral.doctor_reviewed_at = now
        referral.doctor_reviewed_by_user_id = doctor.id
        self._record_event(referral, "CLOSED", doctor.id, "MANUAL_ENTRY", "Reviewed and closed by doctor.")

        self._sync_task(referral, "CLOSED", doctor.id)
        self._audit(episode.id, doctor.id, doctor.role, doctor.full_name, "referral_closed",
                    f"{doctor.full_name} reviewed and closed referral {referral.reference_code}", "", referral.id)
        self._notify_care_team(episode.id, referral.id, "DOCTOR_REVIEW_REQUIRED", "Doctor review completed",
                                f"{episode.patient_name}: {referral.title} reviewed and closed.")
        return referral


def build_external_referral_message(referral: models.Referral, episode: models.PregnancyEpisode,
                                     doctor_name: str, care_coordinator_name: str) -> str:
    """The simulated outbound referral message. Deliberately minimal — no
    chart data, no DOB/MRN, no clinical history beyond the referral reason
    itself (see Step 7 item 7/27: never expose unnecessary patient
    information to an external destination)."""
    return (
        "----------------------------------------\n"
        "MATERNASYNC REFERRAL\n"
        "----------------------------------------\n\n"
        f"Referral ID:\n{referral.reference_code}\n\n"
        f"Patient:\n{episode.patient_name}\n\n"
        f"Referral Type:\n{referral.title}\n\n"
        f"From:\n{doctor_name}\n\n"
        f"Care Coordinator:\n{care_coordinator_name}\n\n"
        f"Destination:\n{referral.destination or 'Not specified'}\n\n"
        "Please acknowledge receipt of this referral.\n\n"
        "For a real deployment, this communication channel would be replaced "
        "by an approved secure email/API/referral integration.\n"
        "----------------------------------------"
    )
