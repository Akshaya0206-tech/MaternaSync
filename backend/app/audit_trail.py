"""The doctor's read-only view of the audit log for ONE patient: who saw or changed what, and when.

The log itself is written all over the app (every `audit(...)` call, the assistant's steps, a trusted person's actions). Nothing here writes to it
except the single note that a doctor printed or exported the trail. Nothing can be edited or deleted through this module.

Each action is put in one KIND (the filter's "what kind"), and each actor in one GROUP (the filter's "who"). The English sentence for each action
is on the screen side (src/roles/doctor/auditActions.ts), so it can be translated; a test keeps the two lists in step.
"""
from datetime import date, datetime, timedelta

from sqlalchemy import not_, or_

from . import config, models

KINDS = ("checkins", "documents", "questions", "visits", "consents", "trusted", "approved", "account", "other")
GROUPS = ("patient", "doctor", "trusted_person", "assistant", "other")

# The assistant's own tools, and the kind of record each one is about.
TOOL_KIND = {
    "verify_document": "documents", "reject_document": "documents",
    "answer_question": "questions", "assign_question_to_doctor": "questions",
    "confirm_appointment": "visits", "offer_new_times": "visits", "record_missed_visit": "visits",
    "send_outreach": "consents", "send_caregiver_whatsapp": "consents",
    "prepare_draft": "approved",
    "create_attention": "other", "notify_user": "other", "send_urgent_message": "other", "send_referral": "other", "chase_referral": "other",
}

_EXPLICIT = {
    "checkins": [
        "patient_log_recorded", "patient_log_corrected", "caregiver_checkin_recorded", "monitoring_plan_agreed", "follow_up_flag_confirmed",
        "patient_entries_exported", "checkin_helper_asked", "checkin_helper_cleared", "caregiver_helper_answered",
    ],
    "documents": [
        "document_uploaded", "document_verified", "document_rejected", "document_edited", "document_sent_to_doctor", "referral_document_attached",
        "question_file_attached",
    ],
    "questions": [
        "question_asked", "question_answered", "question_assigned", "question_closed", "question_closed_offline", "question_logged",
        "question_routed_by_rule", "response_approved", "talk_to_a_person", "caregiver_question_asked",
    ],
    "visits": [
        "appointment_requested", "appointment_status_changed", "visit_change_requested", "visit_change_withdrawn", "visit_change_confirmed_new_time",
        "visit_change_other_times_offered", "visit_prep_released", "visit_prep_ticked", "caregiver_visit_prep_ticked", "caregiver_visit_prep_unticked",
        "visit_prep_line_removed", "caregiver_visit_help", "caregiver_visit_help_cleared", "reminder_schedule_approved", "reminder_response_recorded",
        "reminders_checked", "task_created", "task_assigned", "task_reassigned", "task_status_changed", "task_owner_reassigned_login_off",
        "monitoring_owner_reassigned_login_off", "follow_up_task_confirmed", "pathway_confirmed", "outcome_recorded",
    ],
    "consents": [
        "sharing_consent_granted", "sharing_consent_revoked", "outreach_prepared", "whatsapp_link_prepared", "whatsapp_marked_sent", "whatsapp_sent",
        "whatsapp_send_failed", "whatsapp_status", "caregiver_whatsapp_code_sent", "caregiver_whatsapp_on", "caregiver_whatsapp_off",
    ],
    "trusted": [
        "caregiver_invited", "caregiver_invite_accepted", "caregiver_permissions_changed", "caregiver_removed", "caregiver_access_limit_changed",
        "caregiver_code_renewed",
    ],
    "approved": [
        "consultation_started", "transcript_generated", "draft_approved", "draft_edited", "draft_rejected", "ai_draft_generated", "brief_reviewed",
        "clinical_output_drafted", "clinical_output_edited", "clinical_output_approved", "handover_regenerated", "handover_edited", "handover_shared",
    ],
    "account": [
        "password_changed", "other_devices_signed_out", "account_closed", "my_data_downloaded", "language_preference_updated",
    ],
    "other": [
        "referral_created", "referral_sent", "referral_acknowledged", "referral_appointment_recorded", "referral_response_received", "referral_review_doctor",
        "referral_closed", "audit_trail_exported", "continuity_viewed", "companion_query", "clinic_report_viewed", "episode_seeded",
    ],
}

# Opening a page, a search or a routine check is also "who looked", but it would bury everything else: hidden unless asked for.
VIEW_ACTIONS = ("continuity_viewed", "reminders_checked", "companion_query", "clinic_report_viewed")


def _build():
    by_kind = {kind: set(actions) for kind, actions in _EXPLICIT.items()}
    for tool, kind in TOOL_KIND.items():
        by_kind[kind].update({f"assistant_{tool}", f"assistant_undo_{tool}"})
    return by_kind


ACTIONS_BY_KIND = _build()
KIND_OF = {action: kind for kind, actions in ACTIONS_BY_KIND.items() for action in actions}
ASSISTANT_ROLES = ("ai_coordinator", "system")
# Never shown, whatever else is: keys of a before/after state that could hold a secret.
SECRET_WORDS = ("password", "hash", "token", "secret", "code", "invite")


def kind_of(action: str) -> str:
    return KIND_OF.get(action, "other")


def group_of(role: str | None) -> str:
    if role == "patient":
        return "patient"
    if role == "doctor":
        return "doctor"
    if role == "caregiver":
        return "trusted_person"
    if role in ASSISTANT_ROLES or not role:
        return "assistant"
    return "other"


def who_condition(group: str):
    column = models.AuditLog.actor_role
    if group == "patient":
        return column == "patient"
    if group == "doctor":
        return column == "doctor"
    if group == "trusted_person":
        return column == "caregiver"
    if group == "assistant":
        return or_(column.in_(ASSISTANT_ROLES), column.is_(None), column == "")
    return not_(or_(column.in_(("patient", "doctor", "caregiver") + ASSISTANT_ROLES), column.is_(None), column == ""))


def kind_condition(kind: str):
    column = models.AuditLog.action
    if kind == "other":
        mapped = {a for k, actions in ACTIONS_BY_KIND.items() if k != "other" for a in actions}
        return or_(column.in_(ACTIONS_BY_KIND["other"]), not_(column.in_(mapped)))
    return column.in_(ACTIONS_BY_KIND[kind])


def day_start_utc(day: date, tz_offset: int) -> datetime:
    """The start of that calendar day on the doctor's own clock, as a naive UTC time (how the log stores its times). `tz_offset` is JavaScript's
    getTimezoneOffset(): minutes the clock is behind UTC (India is -330)."""
    return datetime(day.year, day.month, day.day) + timedelta(minutes=tz_offset)


def login_is_off(user: models.User | None) -> bool:
    return bool(user and user.role == "care_team" and not config.CARE_TEAM_ENABLED)


def _short(value, limit: int = 80):
    text = value if isinstance(value, str) else str(value)
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def changes(before, after) -> list[dict]:
    """What a before/after state says changed: the field and both values, a few at most, never anything that looks like a secret and never a big value."""
    if not isinstance(before, dict) and not isinstance(after, dict):
        return []
    before = before if isinstance(before, dict) else {}
    after = after if isinstance(after, dict) else {}
    out = []
    for key in sorted(set(before) | set(after)):
        if any(word in key.lower() for word in SECRET_WORDS):
            continue
        old, new = before.get(key), after.get(key)
        if old == new or isinstance(old, (dict, list)) or isinstance(new, (dict, list)):
            continue
        out.append({"field": key, "before": None if old is None else _short(old), "after": None if new is None else _short(new)})
        if len(out) >= 8:
            break
    return out


def _labels(db, wanted: dict[str, set[str]]) -> dict[tuple[str, str], str]:
    """A short, readable name for the things the rows are about (one query per kind of thing, for the whole page)."""
    labels: dict[tuple[str, str], str] = {}

    def put(kind, rows):
        for ident, text in rows:
            if text:
                labels[(kind, ident)] = _short(text)

    if ids := wanted.get("MedicalDocument"):
        put("MedicalDocument", [(d.id, d.description or d.filename) for d in db.query(models.MedicalDocument).filter(models.MedicalDocument.id.in_(ids))])
    if ids := wanted.get("PatientQuestion"):
        put("PatientQuestion", [(q.id, q.question_text) for q in db.query(models.PatientQuestion).filter(models.PatientQuestion.id.in_(ids))])
    if ids := wanted.get("Appointment"):
        put("Appointment", [(a.id, f"{a.appointment_type} · {a.scheduled_at:%d %b %Y}") for a in db.query(models.Appointment).filter(models.Appointment.id.in_(ids))])
    if ids := wanted.get("CareReminder"):
        put("CareReminder", [(r.id, r.title) for r in db.query(models.CareReminder).filter(models.CareReminder.id.in_(ids))])
    if ids := wanted.get("Task"):
        put("Task", [(t.id, t.title) for t in db.query(models.Task).filter(models.Task.id.in_(ids))])
    if ids := wanted.get("DailyLog"):
        put("DailyLog", [(l.id, f"{l.recorded_at:%d %b %Y}") for l in db.query(models.DailyLog).filter(models.DailyLog.id.in_(ids))])
    if ids := wanted.get("ClinicalOutput"):
        put("ClinicalOutput", [(o.id, o.title) for o in db.query(models.ClinicalOutput).filter(models.ClinicalOutput.id.in_(ids))])
    if ids := wanted.get("Consultation"):
        put("Consultation", [(c.id, f"{c.started_at:%d %b %Y}") for c in db.query(models.Consultation).filter(models.Consultation.id.in_(ids)) if c.started_at])
    if ids := wanted.get("SharingConsent"):
        put("SharingConsent", [(c.id, "…" + c.recipient[-4:]) for c in db.query(models.SharingConsent).filter(models.SharingConsent.id.in_(ids)) if c.recipient])
    if ids := wanted.get("CaregiverLink"):
        put("CaregiverLink", [(c.id, c.display_name) for c in db.query(models.CaregiverLink).filter(models.CaregiverLink.id.in_(ids))])
    if ids := wanted.get("Referral"):
        put("Referral", [(r.id, " · ".join(x for x in (r.reference_code, r.title) if x)) for r in db.query(models.Referral).filter(models.Referral.id.in_(ids))])
    return labels


def rows_out(db, rows: list[models.AuditLog]) -> list[dict]:
    wanted: dict[str, set[str]] = {}
    for row in rows:
        if row.object_type and row.object_id:
            wanted.setdefault(row.object_type, set()).add(row.object_id)
    labels = _labels(db, wanted)
    users = {u.id: u for u in db.query(models.User).filter(models.User.id.in_({r.actor_user_id for r in rows if r.actor_user_id}))} if rows else {}
    out = []
    for row in rows:
        actor = users.get(row.actor_user_id)
        group = group_of(row.actor_role)
        out.append({
            "id": row.id,
            "at": row.timestamp.replace(tzinfo=None).isoformat() + "Z" if row.timestamp else None,
            "who": group,
            "whoName": row.actor_display_name or (actor.full_name if actor else None),
            "whoRole": row.actor_role or "system",
            "loginOff": login_is_off(actor) or (row.actor_role == "care_team" and not config.CARE_TEAM_ENABLED),
            "action": row.action,
            "kind": kind_of(row.action),
            "summary": row.title,
            "objectType": row.object_type,
            "objectLabel": labels.get((row.object_type or "", row.object_id or "")),
            "details": (row.details or "")[:500],
            "changes": changes(row.previous_state, row.new_state),
        })
    return out
