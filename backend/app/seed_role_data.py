"""Seeds the NEW role-based schema (Patient / Care Team / Doctor).

Per the approved migration strategy: extend the existing rich Sarah
Jenkins demo content into the new tables rather than write fresh
throwaway data, and reuse `demo@maternasync.app` as Dr. Eleanor Vance so
existing credentials keep working. Idempotent — safe to run every startup.
"""

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from . import models
from .referral_communication import ReferralCommunicationService
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
    # Second batch, added on request (see ensure_additional_demo_accounts below)
    "priya.sharma@maternasync.app": "PriyaDemo123!",             # patient (James/Eleanor Vance II)
    "ananya.kumar@maternasync.app": "AnanyaDemo123!",             # patient (Kavya/Arjun Menon)
    "meera.raj@maternasync.app": "MeeraDemo123!",                  # patient (Brenda/Eleanor Vance II)
    "james.wilson@maternasync.app": "JamesDemo123!",                # care_team
    "kavya.narayanan@maternasync.app": "KavyaDemo123!",              # care_team
    "eleanor.vance@maternasync.app": "EleanorDemo123!",               # doctor — NOTE: shares a display
                                                                        # name with demo@maternasync.app's
                                                                        # "Dr. Eleanor Vance"; kept as a
                                                                        # distinct account/email per request,
                                                                        # differentiated only by title.
    "arjun.menon@maternasync.app": "ArjunDemo123!",                     # doctor
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _next_reference_code(db: Session) -> str:
    """Same numbering scheme as ReferralCommunicationService — every
    referral gets one, seeded or created at runtime, so none are missing
    the id the External Hospital Simulator and UI key off of."""
    year = _now().year
    count = db.query(models.Referral).filter(models.Referral.reference_code.isnot(None)).count()
    return f"REF-{year}-{count + 1:05d}"


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
            # The work item describes the message ("Patient sent portal message at 07:15 today: "..."); the question is what she wrote.
            sent = re.match(r'^Patient sent portal message at [^"]*?:\s*"(.*)"\s*$', w["description"], re.S)
            db.add(models.PatientQuestion(
                episode_id=episode.id, asked_by_user_id=patient_user.id,
                question_text=sent.group(1) if sent else w["description"], status="ASSIGNED", is_clinical=True,
                assigned_to_user_id=doctor_user.id, created_at=created_at,
            ))
        elif wtype == "pending_referral":
            db.add(models.Referral(
                episode_id=episode.id, reference_code=_next_reference_code(db),
                title=w["title"], description=w["description"],
                referred_to=w.get("assignee"), destination=w.get("assignee") or "External Specialist",
                status="SENT", sent_at=created_at, sent_by_user_id=care_team_user.id,
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
        context=f"GA {episode.gestational_age_weeks}w{episode.gestational_age_days}d.",
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


def ensure_additional_demo_accounts(db: Session) -> None:
    """Second batch of synthetic demo accounts, added on request after the
    original 3-patient / 2-doctor / 2-care-team seed above. Runs on every
    startup independently of `run_seed_role_data`'s one-time gate, so it
    backfills cleanly on a database that was already seeded before this
    batch existed. User creation is idempotent via `_get_or_create_user`;
    episode/workflow creation is additionally guarded by an
    already-has-an-episode check per patient, so re-running this never
    duplicates episodes, assignments, tasks, or referrals."""
    james = _get_or_create_user(db, "james.wilson@maternasync.app", "James Wilson", "care_team", title="Care Coordinator")
    kavya = _get_or_create_user(db, "kavya.narayanan@maternasync.app", "Kavya Narayanan", "care_team", title="Obstetric Triage Nurse")
    dr_vance2 = _get_or_create_user(db, "eleanor.vance@maternasync.app", "Dr. Eleanor Vance", "doctor", title="Maternal-Fetal Medicine Specialist")
    dr_menon = _get_or_create_user(db, "arjun.menon@maternasync.app", "Dr. Arjun Menon", "doctor", title="Attending Obstetrician")
    brenda = db.query(models.User).filter(models.User.email == "brenda.miller@maternasync.app").first()

    priya = _get_or_create_user(db, "priya.sharma@maternasync.app", "Priya Sharma", "patient")
    ananya = _get_or_create_user(db, "ananya.kumar@maternasync.app", "Ananya Kumar", "patient")
    meera = _get_or_create_user(db, "meera.raj@maternasync.app", "Meera Raj", "patient")
    db.flush()

    if not db.query(models.PatientProfile).filter(models.PatientProfile.user_id == priya.id).first():
        db.add(models.PatientProfile(user_id=priya.id, date_of_birth="1997-03-14", mrn="MRN-10234"))
    if not db.query(models.PatientProfile).filter(models.PatientProfile.user_id == ananya.id).first():
        db.add(models.PatientProfile(user_id=ananya.id, date_of_birth="1993-07-22", mrn="MRN-10578"))
    if not db.query(models.PatientProfile).filter(models.PatientProfile.user_id == meera.id).first():
        db.add(models.PatientProfile(user_id=meera.id, date_of_birth="2000-01-05", mrn="MRN-10812"))
    db.flush()

    if db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.patient_user_id == priya.id).first():
        db.commit()  # persist any role/profile backfill above even if episodes already exist
        return

    if brenda is None:
        db.commit()
        return  # original batch hasn't seeded yet; this will retry on the next startup

    today = _now()

    # --- Priya Sharma -> James Wilson (care team) / Dr. Eleanor Vance II (doctor) ---
    priya_episode = models.PregnancyEpisode(
        patient_user_id=priya.id, patient_name="Priya Sharma", mrn="MRN-10234", age=29,
        dob="1997-03-14", edd=(today + timedelta(weeks=16)).strftime("%Y-%m-%d"),
        gestational_age_weeks=24, gestational_age_days=2, gravida_para="G2P1", blood_type="O+",
        allergies=[], risk_category="routine", risk_notes="No complications noted.",
        facility="Riverside Maternity Center", is_ready_for_today_brief=True,
    )
    db.add(priya_episode)
    db.flush()
    db.add(models.PatientDoctorAssignment(episode_id=priya_episode.id, doctor_user_id=dr_vance2.id, is_primary=True))
    db.add(models.PatientCareTeamAssignment(episode_id=priya_episode.id, care_team_user_id=james.id, role_on_case=james.title))

    priya_doc = models.MedicalDocument(
        episode_id=priya_episode.id, uploaded_by_user_id=priya.id, uploaded_by_role="patient",
        filename="20-week-anatomy-scan.pdf", file_path="",
        document_date=(today - timedelta(days=3)).strftime("%Y-%m-%d"), status="VERIFIED",
        uploaded_at=today - timedelta(days=3),
    )
    db.add(priya_doc)
    db.flush()
    db.add(models.DocumentExtraction(
        document_id=priya_doc.id, raw_text="Anatomy scan: fetal growth on track, anatomy survey normal.",
        record_type="Ultrasound", event_date=(today - timedelta(days=3)).strftime("%Y-%m-%d"),
        facility="Riverside Maternity Center", provider=dr_vance2.full_name,
        gestational_age="24 weeks 0 days", field_status={"recordType": {"value": "Ultrasound", "status": "extracted"}},
    ))
    db.add(models.DocumentReview(document_id=priya_doc.id, reviewer_user_id=james.id, reviewer_role="care_team", action="VERIFY", reviewed_at=today - timedelta(days=2)))
    db.add(models.JourneyEvent(
        episode_id=priya_episode.id, event_type="document", source_document_id=priya_doc.id,
        title="20-Week Anatomy Scan", summary="Anatomy survey normal; fetal growth on track.",
        event_date=(today - timedelta(days=3)).strftime("%Y-%m-%d"),
        gestational_age_weeks=24, gestational_age_days=0, actor_label=james.full_name,
    ))

    db.add(models.PatientQuestion(
        episode_id=priya_episode.id, asked_by_user_id=priya.id,
        question_text="Is it safe to travel by air at 24 weeks?", status="NEW", is_clinical=True,
    ))

    db.add(models.Task(
        episode_id=priya_episode.id, title="Schedule glucose tolerance test",
        description="Routine 24-28 week glucose screening.", owner_user_id=james.id,
        created_by_user_id=dr_vance2.id, due_date=(today + timedelta(days=10)).strftime("%Y-%m-%d"),
        priority="routine", status="OPEN", source_type="manual",
    ))

    db.add(models.Appointment(
        episode_id=priya_episode.id,
        scheduled_at=(today + timedelta(days=14)).replace(hour=10, minute=30, second=0, microsecond=0),
        appointment_type="consultation", location="Riverside Maternity Center", status="scheduled",
    ))

    db.add(models.Handover(
        episode_id=priya_episode.id, context="GA 24w2d.",
        what_happened="20-week anatomy scan reviewed and verified.",
        what_remains="Glucose tolerance test to be scheduled; air travel question awaiting response.",
        who_owns_it=f"{james.full_name} (coordination), {dr_vance2.full_name} (clinical).",
        what_to_discuss="Patient question on air travel safety at 24 weeks.",
        status="DRAFT", generated_by_ai=True, created_by_user_id=james.id,
    ))

    db.add(models.Notification(recipient_user_id=dr_vance2.id, episode_id=priya_episode.id, type="brief_ready",
                                title="Today's Brief ready for Priya Sharma", body="Context prepared from verified records."))
    db.add(models.Notification(recipient_user_id=priya.id, episode_id=priya_episode.id, type="document_verified",
                                title="Your care team reviewed your uploaded documents", body="Your journey has been updated."))
    db.add(models.AuditLog(episode_id=priya_episode.id, actor_user_id=james.id, actor_role="care_team",
                            actor_display_name=james.full_name, action="episode_seeded",
                            title="Demo episode prepared for Priya Sharma", details="Seeded synthetic demo content.",
                            object_type="PregnancyEpisode", object_id=priya_episode.id))

    # --- Ananya Kumar -> Kavya Narayanan (care team) / Dr. Arjun Menon (doctor) ---
    ananya_episode = models.PregnancyEpisode(
        patient_user_id=ananya.id, patient_name="Ananya Kumar", mrn="MRN-10578", age=33,
        dob="1993-07-22", edd=(today + timedelta(weeks=10)).strftime("%Y-%m-%d"),
        gestational_age_weeks=30, gestational_age_days=0, gravida_para="G1P0", blood_type="A+",
        allergies=["Penicillin"], risk_category="high_risk",
        risk_notes="Gestational diabetes diagnosed at 28 weeks; referred for specialist review.",
        facility="Westfield Women's Hospital", is_ready_for_today_brief=True,
    )
    db.add(ananya_episode)
    db.flush()
    db.add(models.PatientDoctorAssignment(episode_id=ananya_episode.id, doctor_user_id=dr_menon.id, is_primary=True))
    db.add(models.PatientCareTeamAssignment(episode_id=ananya_episode.id, care_team_user_id=kavya.id, role_on_case=kavya.title))

    ananya_doc = models.MedicalDocument(
        episode_id=ananya_episode.id, uploaded_by_user_id=ananya.id, uploaded_by_role="patient",
        filename="glucose-tolerance-test-results.pdf", file_path="",
        document_date=(today - timedelta(days=1)).strftime("%Y-%m-%d"), status="NEEDS_REVIEW",
        uploaded_at=today - timedelta(days=1),
    )
    db.add(ananya_doc)
    db.flush()
    db.add(models.DocumentExtraction(
        document_id=ananya_doc.id,
        raw_text="3-hour GTT: fasting 98, 1hr 192, 2hr 168, 3hr 142 — consistent with gestational diabetes.",
        record_type="Lab Result", event_date=(today - timedelta(days=1)).strftime("%Y-%m-%d"),
        facility="Westfield Women's Hospital", provider=dr_menon.full_name,
        gestational_age="30 weeks 0 days", field_status={"recordType": {"value": "Lab Result", "status": "extracted"}},
    ))

    db.add(models.Appointment(
        episode_id=ananya_episode.id,
        scheduled_at=(today + timedelta(days=7)).replace(hour=9, minute=0, second=0, microsecond=0),
        appointment_type="consultation", location="Westfield Women's Hospital", status="scheduled",
    ))

    db.add(models.Handover(
        episode_id=ananya_episode.id, context="GA 30w0d.",
        what_happened="Glucose tolerance test results pending care team review.",
        what_remains="Maternal-fetal medicine referral in progress; pending test review.",
        who_owns_it=f"{kavya.full_name} (coordination), {dr_menon.full_name} (clinical).",
        what_to_discuss="Specialist referral status and glucose management plan.",
        status="DRAFT", generated_by_ai=True, created_by_user_id=kavya.id,
    ))

    db.add(models.Notification(recipient_user_id=dr_menon.id, episode_id=ananya_episode.id, type="brief_ready",
                                title="Today's Brief ready for Ananya Kumar", body="Context prepared from verified records."))
    db.add(models.Notification(recipient_user_id=kavya.id, episode_id=ananya_episode.id, type="document_needs_review",
                                title="New document needs review", body="Ananya Kumar uploaded glucose tolerance test results."))
    db.add(models.AuditLog(episode_id=ananya_episode.id, actor_user_id=kavya.id, actor_role="care_team",
                            actor_display_name=kavya.full_name, action="episode_seeded",
                            title="Demo episode prepared for Ananya Kumar", details="Seeded synthetic demo content.",
                            object_type="PregnancyEpisode", object_id=ananya_episode.id))

    db.flush()  # assignments must be queryable before the referral service looks them up

    referral_service = ReferralCommunicationService(db)
    referral = referral_service.create_referral(
        episode=ananya_episode, doctor_user=dr_menon,
        title="Maternal-Fetal Medicine Consultation for Gestational Diabetes",
        description="Specialist review requested following GTT results consistent with gestational diabetes.",
        destination="Maternal-Fetal Medicine Specialist Center", referred_to="MFM Specialist",
        due_date=(today + timedelta(days=14)).strftime("%Y-%m-%d"),
    )
    # The session has autoflush=False, and _sync_task finds-or-updates its
    # tracking task by querying for it — without this flush, send_referral's
    # query wouldn't see the task create_referral just added (still pending),
    # so it would insert a second task instead of updating the first.
    db.flush()
    referral_service.send_referral(referral, kavya)

    # --- Meera Raj -> Brenda Miller (existing care team) / Dr. Eleanor Vance II (doctor) ---
    meera_episode = models.PregnancyEpisode(
        patient_user_id=meera.id, patient_name="Meera Raj", mrn="MRN-10812", age=26,
        dob="2000-01-05", edd=(today + timedelta(weeks=21)).strftime("%Y-%m-%d"),
        gestational_age_weeks=18, gestational_age_days=5, gravida_para="G1P0", blood_type="B+",
        allergies=[], risk_category="routine", risk_notes="Uncomplicated pregnancy to date.",
        facility="Riverside Maternity Center", is_ready_for_today_brief=True,
    )
    db.add(meera_episode)
    db.flush()
    db.add(models.PatientDoctorAssignment(episode_id=meera_episode.id, doctor_user_id=dr_vance2.id, is_primary=True))
    db.add(models.PatientCareTeamAssignment(episode_id=meera_episode.id, care_team_user_id=brenda.id, role_on_case=brenda.title or "Care Coordinator"))

    meera_doc = models.MedicalDocument(
        episode_id=meera_episode.id, uploaded_by_user_id=meera.id, uploaded_by_role="patient",
        filename="first-trimester-screening.pdf", file_path="",
        document_date=(today - timedelta(days=30)).strftime("%Y-%m-%d"), status="VERIFIED",
        uploaded_at=today - timedelta(days=30),
    )
    db.add(meera_doc)
    db.flush()
    db.add(models.DocumentExtraction(
        document_id=meera_doc.id, raw_text="First trimester combined screening: low risk for aneuploidy.",
        record_type="Lab Result", event_date=(today - timedelta(days=30)).strftime("%Y-%m-%d"),
        facility="Riverside Maternity Center", provider=dr_vance2.full_name,
        gestational_age="12 weeks 0 days", field_status={"recordType": {"value": "Lab Result", "status": "extracted"}},
    ))
    db.add(models.DocumentReview(document_id=meera_doc.id, reviewer_user_id=brenda.id, reviewer_role="care_team", action="VERIFY", reviewed_at=today - timedelta(days=29)))
    db.add(models.JourneyEvent(
        episode_id=meera_episode.id, event_type="document", source_document_id=meera_doc.id,
        title="First Trimester Screening", summary="Low risk for aneuploidy.",
        event_date=(today - timedelta(days=30)).strftime("%Y-%m-%d"),
        gestational_age_weeks=12, gestational_age_days=0, actor_label=brenda.full_name,
    ))

    meera_question = models.PatientQuestion(
        episode_id=meera_episode.id, asked_by_user_id=meera.id,
        question_text="Is it normal to still have mild nausea at 18 weeks?", status="ANSWERED",
        is_clinical=True, assigned_to_user_id=dr_vance2.id,
    )
    db.add(meera_question)
    db.flush()
    db.add(models.QuestionResponse(
        question_id=meera_question.id, responder_user_id=dr_vance2.id, responder_role="doctor",
        response_text=(
            "Yes, mild nausea can persist into the second trimester for some patients. "
            "It should continue to improve; mention it at your next visit if it worsens."
        ),
        status="APPROVED", approved_by_user_id=dr_vance2.id, approved_at=today, visible_to_patient=True,
    ))

    db.add(models.Task(
        episode_id=meera_episode.id, title="Confirm anatomy scan appointment",
        description="Follow up to confirm the patient's upcoming 20-week scan.", owner_user_id=brenda.id,
        created_by_user_id=brenda.id, status="COMPLETED", source_type="manual",
    ))

    db.add(models.Appointment(
        episode_id=meera_episode.id,
        scheduled_at=(today + timedelta(days=21)).replace(hour=11, minute=0, second=0, microsecond=0),
        appointment_type="consultation", location="Riverside Maternity Center", status="scheduled",
    ))

    db.add(models.Handover(
        episode_id=meera_episode.id, context="GA 18w5d.",
        what_happened="First trimester screening reviewed and verified; nausea question answered.",
        what_remains="20-week anatomy scan appointment confirmed.",
        who_owns_it=f"{brenda.full_name} (coordination), {dr_vance2.full_name} (clinical).",
        what_to_discuss="None pending.",
        status="DRAFT", generated_by_ai=True, created_by_user_id=brenda.id,
    ))

    db.add(models.Notification(recipient_user_id=dr_vance2.id, episode_id=meera_episode.id, type="brief_ready",
                                title="Today's Brief ready for Meera Raj", body="Context prepared from verified records."))
    db.add(models.Notification(recipient_user_id=meera.id, episode_id=meera_episode.id, type="document_verified",
                                title="Your care team reviewed your uploaded documents", body="Your journey has been updated."))
    db.add(models.AuditLog(episode_id=meera_episode.id, actor_user_id=brenda.id, actor_role="care_team",
                            actor_display_name=brenda.full_name, action="episode_seeded",
                            title="Demo episode prepared for Meera Raj", details="Seeded synthetic demo content.",
                            object_type="PregnancyEpisode", object_id=meera_episode.id))

    db.commit()
    print("Seeded additional demo accounts: 3 patients, 2 doctors, 2 care-team members.")
    print("Patient logins: priya.sharma@maternasync.app/PriyaDemo123!, "
          "ananya.kumar@maternasync.app/AnanyaDemo123!, meera.raj@maternasync.app/MeeraDemo123!")
    print("Doctor logins: eleanor.vance@maternasync.app/EleanorDemo123!, arjun.menon@maternasync.app/ArjunDemo123!")
    print("Care team logins: james.wilson@maternasync.app/JamesDemo123!, kavya.narayanan@maternasync.app/KavyaDemo123!")
