"""Seeds the NEW role-based schema (Patient / Care Team / Doctor).

Per the approved migration strategy: extend the existing rich Sarah
Jenkins demo content into the new tables rather than write fresh
throwaway data, and reuse `demo@maternasync.app` as Dr. Eleanor Vance so
existing credentials keep working. Idempotent — safe to run every startup.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from . import models
from .security import hash_password

SEED_JSON = Path(__file__).resolve().parent.parent / "seed_mock_patients.json"

PASSWORDS = {
    "demo@maternasync.app": "MaternaDemo123!",          # reused: Dr. Eleanor Vance (doctor)
    "sarah.jenkins@maternasync.app": "SarahDemo123!",     # patient
    "brenda.miller@maternasync.app": "BrendaDemo123!",     # care_team
    "dr.chen@maternasync.app": "ChenDemo123!",               # second doctor, isolation demo
    "lin.park@maternasync.app": "LinDemo123!",                # second care_team
    "elena.rostova@maternasync.app": "ElenaDemo123!",           # patient (Dr. Chen's)
    "amara.okafor@maternasync.app": "AmaraDemo123!",              # patient (Dr. Vance's 2nd)
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _get_or_create_user(db: Session, email: str, full_name: str, role: str, title: str | None = None) -> models.User:
    user = db.query(models.User).filter(models.User.email == email).first()
    if user:
        user.role = role
        if title:
            user.title = title
        return user
    user = models.User(
        full_name=full_name,
        email=email,
        password_hash=hash_password(PASSWORDS[email]),
        role=role,
        title=title,
    )
    db.add(user)
    db.flush()
    return user


def _build_episode(db: Session, ep_json: dict, patient_user: models.User, doctor_user: models.User, care_team_user: models.User) -> models.PregnancyEpisode:
    episode = models.PregnancyEpisode(
        patient_user_id=patient_user.id,
        patient_name=ep_json["patientName"],
        mrn=ep_json.get("mrn"),
        age=ep_json.get("age"),
        dob=ep_json.get("dob"),
        edd=ep_json["edd"],
        gestational_age_weeks=ep_json.get("gestationalAgeWeeks", 0),
        gestational_age_days=ep_json.get("gestationalAgeDays", 0),
        gravida_para=ep_json.get("gravidaPara", "Not documented"),
        blood_type=ep_json.get("bloodType", "Not documented"),
        allergies=ep_json.get("allergies", []),
        risk_category=ep_json.get("riskCategory", "routine"),
        risk_notes=ep_json.get("riskNotes", ""),
        facility=ep_json.get("facility", "Not documented"),
        is_ready_for_today_brief=True,
    )
    db.add(episode)
    db.flush()

    db.add(models.PatientDoctorAssignment(episode_id=episode.id, doctor_user_id=doctor_user.id, is_primary=True))
    db.add(models.PatientCareTeamAssignment(episode_id=episode.id, care_team_user_id=care_team_user.id, role_on_case=care_team_user.title or "Care Coordinator"))

    for r in ep_json.get("records", []):
        is_verified = r.get("verificationStatus") in ("verified", "ready_for_context")
        doc = models.MedicalDocument(
            episode_id=episode.id,
            uploaded_by_user_id=patient_user.id,
            uploaded_by_role="patient",
            filename=r.get("sourceId", r["title"]),
            file_path="",  # historical seed record, no real file on disk
            document_date=r["timestamp"][:10],
            status="VERIFIED" if is_verified else "NEEDS_REVIEW",
            uploaded_at=_parse_dt(r["timestamp"]) or _now(),
        )
        db.add(doc)
        db.flush()

        db.add(models.DocumentExtraction(
            document_id=doc.id,
            raw_text=r.get("fullContent", ""),
            record_type=r.get("title"),
            event_date=r["timestamp"][:10],
            facility=r.get("facility"),
            provider=r.get("author"),
            gestational_age=f"{r.get('gestationalAgeWeeks', 0)} weeks {r.get('gestationalAgeDays', 0)} days",
            field_status={"recordType": {"value": r.get("title"), "status": "extracted"}},
        ))

        if is_verified:
            db.add(models.DocumentReview(
                document_id=doc.id, reviewer_user_id=care_team_user.id, reviewer_role="care_team",
                action="VERIFY", reviewed_at=_parse_dt(r.get("verifiedAt")) or _now(),
            ))
            db.add(models.JourneyEvent(
                episode_id=episode.id, event_type="document", source_document_id=doc.id,
                title=r["title"], summary=r.get("summaryText", ""), event_date=r["timestamp"][:10],
                gestational_age_weeks=r.get("gestationalAgeWeeks", 0), gestational_age_days=r.get("gestationalAgeDays", 0),
            ))

    for w in ep_json.get("workflowItems", []):
        wtype = w["type"]
        created_at = _parse_dt(w.get("dateCreated")) or _now()
        if wtype == "unanswered_question":
            db.add(models.PatientQuestion(
                episode_id=episode.id, asked_by_user_id=patient_user.id,
                question_text=w["description"], status="ASSIGNED", is_clinical=True,
                assigned_to_user_id=doctor_user.id, created_at=created_at,
            ))
        elif wtype == "pending_referral":
            db.add(models.Referral(
                episode_id=episode.id, title=w["title"], description=w["description"],
                referred_to=w.get("assignee"), status="SENT",
                owner_user_id=care_team_user.id, created_by_user_id=doctor_user.id,
                due_date=w.get("dueDate"), created_at=created_at,
            ))
        else:  # required_document | follow_up_needed
            db.add(models.Task(
                episode_id=episode.id, title=w["title"], description=w["description"],
                owner_user_id=care_team_user.id, created_by_user_id=doctor_user.id,
                due_date=w.get("dueDate"), priority=w.get("priority", "routine"),
                status="COMPLETED" if w.get("status") == "completed" else "OPEN",
                source_type="manual", created_at=created_at,
            ))

    db.add(models.Handover(
        episode_id=episode.id,
        context=f"GA {episode.gestational_age_weeks}w{episode.gestational_age_days}d, risk: {episode.risk_category}.",
        what_happened="Most recent verified consultation and documented events (see journey).",
        what_remains="See open tasks and referrals for this patient.",
        who_owns_it=f"{care_team_user.full_name} (coordination), {doctor_user.full_name} (clinical).",
        what_to_discuss="Any pending patient questions routed for clinical response.",
        status="DRAFT", generated_by_ai=True, created_by_user_id=care_team_user.id,
    ))

    db.add(models.Appointment(
        episode_id=episode.id, scheduled_at=_now().replace(hour=10, minute=0, second=0, microsecond=0),
        appointment_type="consultation", location=episode.facility, status="scheduled",
    ))

    db.add(models.Notification(
        recipient_user_id=doctor_user.id, episode_id=episode.id, type="brief_ready",
        title=f"Today's Brief ready for {episode.patient_name}", body="Context prepared from verified records.",
    ))
    db.add(models.Notification(
        recipient_user_id=patient_user.id, episode_id=episode.id, type="document_verified",
        title="Your care team reviewed your uploaded documents", body="Your journey has been updated.",
    ))

    db.add(models.AuditLog(
        episode_id=episode.id, actor_user_id=care_team_user.id, actor_role="care_team",
        actor_display_name=care_team_user.full_name, action="episode_seeded",
        title=f"Demo episode prepared for {episode.patient_name}",
        details="Seeded from existing clinician-app demo content.",
        object_type="PregnancyEpisode", object_id=episode.id,
    ))

    return episode


def run_seed_role_data(db: Session) -> None:
    if db.query(models.User).filter(models.User.email == "sarah.jenkins@maternasync.app").first():
        return  # already seeded

    if not SEED_JSON.exists():
        return

    episodes = {e["id"]: e for e in json.loads(SEED_JSON.read_text(encoding="utf-8"))}

    dr_vance = _get_or_create_user(db, "demo@maternasync.app", "Dr. Eleanor Vance", "doctor", title="Attending Obstetrician")
    brenda = _get_or_create_user(db, "brenda.miller@maternasync.app", "Brenda Miller", "care_team", title="Obstetric Triage Nurse")
    dr_chen = _get_or_create_user(db, "dr.chen@maternasync.app", "Dr. David Chen", "doctor", title="Attending Obstetrician")
    lin = _get_or_create_user(db, "lin.park@maternasync.app", "Lin Park", "care_team", title="Care Coordinator")

    sarah = _get_or_create_user(db, "sarah.jenkins@maternasync.app", "Sarah Jenkins", "patient")
    db.add(models.PatientProfile(user_id=sarah.id, date_of_birth=episodes["EP-2026-8891"].get("dob"), mrn=episodes["EP-2026-8891"].get("mrn")))

    elena = _get_or_create_user(db, "elena.rostova@maternasync.app", "Elena Rostova", "patient")
    db.add(models.PatientProfile(user_id=elena.id, date_of_birth=episodes["EP-2026-4412"].get("dob"), mrn=episodes["EP-2026-4412"].get("mrn")))

    amara = _get_or_create_user(db, "amara.okafor@maternasync.app", "Amara Okafor", "patient")
    db.add(models.PatientProfile(user_id=amara.id, date_of_birth=episodes["EP-2026-9930"].get("dob"), mrn=episodes["EP-2026-9930"].get("mrn")))

    db.flush()

    # Sarah + Amara -> Dr. Vance / Brenda (same care team: proves a doctor/care-team
    # member can have multiple assigned patients).
    _build_episode(db, episodes["EP-2026-8891"], sarah, dr_vance, brenda)
    _build_episode(db, episodes["EP-2026-9930"], amara, dr_vance, brenda)

    # Elena -> Dr. Chen / Lin (entirely separate pairing: proves isolation —
    # Dr. Vance/Brenda must never see Elena, Dr. Chen/Lin must never see Sarah/Amara).
    _build_episode(db, episodes["EP-2026-4412"], elena, dr_chen, lin)

    db.commit()
    print("Seeded role-based demo data: 3 patients, 2 doctors, 2 care-team members.")
    print("Patient logins: sarah.jenkins@maternasync.app / SarahDemo123!  "
          "(+ elena.rostova@.../ElenaDemo123!, amara.okafor@.../AmaraDemo123!)")
    print("Doctor logins: demo@maternasync.app / MaternaDemo123!  (+ dr.chen@.../ChenDemo123!)")
    print("Care team logins: brenda.miller@maternasync.app / BrendaDemo123!  (+ lin.park@.../LinDemo123!)")


def ensure_patient_portal_demo_data(db: Session) -> None:
    """Runs independently of the idempotency gate above, so it fills in
    even on a database that was already seeded before this demo data
    existed. Adds one answered question (with an approved, patient-visible
    response) for Sarah Jenkins, so the Patient Portal's "My Questions"
    view has a real answered example to render — per the instruction to
    add minimal synthetic demo data rather than hardcode fake UI values."""
    sarah = db.query(models.User).filter(models.User.email == "sarah.jenkins@maternasync.app").first()
    if sarah is None:
        return

    episode = db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.patient_user_id == sarah.id).first()
    if episode is None:
        return

    already = db.query(models.PatientQuestion).filter(
        models.PatientQuestion.episode_id == episode.id,
        models.PatientQuestion.status == "ANSWERED",
    ).first()
    if already:
        return

    dr_vance = db.query(models.User).filter(models.User.email == "demo@maternasync.app").first()

    answered_question = models.PatientQuestion(
        episode_id=episode.id, asked_by_user_id=sarah.id,
        question_text="Is it normal to feel more tired in the second trimester?",
        status="ANSWERED", is_clinical=True,
        assigned_to_user_id=dr_vance.id if dr_vance else None,
    )
    db.add(answered_question)
    db.flush()

    db.add(models.QuestionResponse(
        question_id=answered_question.id,
        responder_user_id=dr_vance.id if dr_vance else sarah.id,
        responder_role="doctor" if dr_vance else "care_team",
        response_text=(
            "Yes, increased tiredness is common in the second trimester as your body "
            "supports your pregnancy. Rest when you can, and mention it at your next "
            "visit if it feels severe."
        ),
        status="APPROVED",
        approved_by_user_id=dr_vance.id if dr_vance else None,
        approved_at=_now(),
        visible_to_patient=True,
    ))

    db.commit()
    print("Seeded one answered patient question (with approved response) for Sarah Jenkins.")
