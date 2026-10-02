"""One-time seed: loads the original MaternaSync demo patients (previously
hardcoded in the frontend's mockPatients.ts) into the database under a demo
account, so Phases 2-5 keep working exactly as before out of the box.

New users who register get an empty patient list, as intended.
"""

import json
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from . import models
from .security import hash_password

SEED_JSON = Path(__file__).resolve().parent.parent / "seed_mock_patients.json"

DEMO_EMAIL = "demo@maternasync.app"
DEMO_PASSWORD = "MaternaDemo123!"


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def run_seed(db: Session) -> None:
    existing = db.query(models.User).filter(models.User.email == DEMO_EMAIL).first()
    if existing is not None:
        return  # already seeded

    if not SEED_JSON.exists():
        return

    demo_user = models.User(
        full_name="Dr. Eleanor Vance",
        email=DEMO_EMAIL,
        password_hash=hash_password(DEMO_PASSWORD),
        role="doctor",
    )
    db.add(demo_user)
    db.flush()

    episodes = json.loads(SEED_JSON.read_text(encoding="utf-8"))

    for ep in episodes:
        patient = models.Patient(
            id=ep["id"],
            owner_user_id=demo_user.id,
            patient_name=ep["patientName"],
            mrn=ep.get("mrn"),
            age=ep.get("age"),
            dob=ep.get("dob"),
            edd=ep["edd"],
            gestational_age_weeks=ep.get("gestationalAgeWeeks", 0),
            gestational_age_days=ep.get("gestationalAgeDays", 0),
            gravida_para=ep.get("gravidaPara", "Not documented"),
            blood_type=ep.get("bloodType", "Not documented"),
            allergies=ep.get("allergies", []),
            primary_clinician=ep.get("primaryClinician", "Not assigned"),
            episode_start_date=ep.get("episodeStartDate", ""),
            risk_category=ep.get("riskCategory", "routine"),
            risk_notes=ep.get("riskNotes", ""),
            facility=ep.get("facility", "Not documented"),
            is_ready_for_today_brief=ep.get("isReadyForTodayBrief", False),
            handoff_timestamp=_parse_dt(ep.get("handoffTimestamp")),
            handoff_notes=ep.get("handoffNotes"),
            next_visit_prepared_at=_parse_dt(ep.get("nextVisitPreparedAt")),
        )
        db.add(patient)

        for r in ep.get("records", []):
            vitals = r.get("vitalSnapshot") or {}
            db.add(models.Record(
                id=r["id"],
                patient_id=patient.id,
                title=r["title"],
                category=r["category"],
                timestamp=r["timestamp"],
                gestational_age_weeks=r.get("gestationalAgeWeeks", 0),
                gestational_age_days=r.get("gestationalAgeDays", 0),
                trimester=r.get("trimester", 1),
                author=r.get("author", "Not found in source"),
                author_role=r.get("authorRole", ""),
                facility=r.get("facility", "Not found in source"),
                modality=r.get("modality", ""),
                source_type=r.get("sourceType", ""),
                summary_text=r.get("summaryText", ""),
                full_content=r.get("fullContent", ""),
                source_id=r.get("sourceId", ""),
                tags=r.get("tags", []),
                is_ai_structured_only=r.get("isAiStructuredOnly", False),
                verification_status=r.get("verificationStatus") or "raw",
                verified_by=r.get("verifiedBy"),
                verified_at=_parse_dt(r.get("verifiedAt")),
                raw_payload_snippet=r.get("rawPayloadSnippet"),
                extraction_status={},
                vital_bp=vitals.get("bp"),
                vital_weight_lbs=vitals.get("weightLbs"),
                vital_fhr_bpm=vitals.get("fetalHeartRateBpm"),
                vital_fundal_height_cm=vitals.get("fundalHeightCm"),
            ))

        for w in ep.get("workflowItems", []):
            db.add(models.WorkflowItem(
                id=w["id"],
                patient_id=patient.id,
                record_id=w.get("recordId"),
                type=w["type"],
                title=w["title"],
                description=w.get("description", ""),
                due_date=w.get("dueDate"),
                priority=w.get("priority", "routine"),
                status=w.get("status", "pending"),
                assignee=w.get("assignee"),
                assigned_role=w.get("assignedRole"),
                source_context=w.get("sourceContext", ""),
                date_created=_parse_dt(w.get("dateCreated")) or datetime.utcnow(),
                last_updated_at=_parse_dt(w.get("lastUpdatedAt")) or _parse_dt(w.get("dateCreated")) or datetime.utcnow(),
                verification_status=w.get("verificationStatus"),
            ))

        for a in ep.get("activityLogs", []):
            db.add(models.ActivityLog(
                id=a["id"],
                patient_id=patient.id,
                record_id=a.get("recordId"),
                action=a["action"],
                title=a["title"],
                details=a.get("details", ""),
                user=a.get("user", ""),
                role=a.get("role", ""),
                timestamp=_parse_dt(a.get("timestamp")) or datetime.utcnow(),
            ))

        for d in ep.get("administrativeDocs", []):
            db.add(models.AdminDoc(
                id=d["id"],
                patient_id=patient.id,
                title=d["title"],
                category=d.get("category", "intake"),
                status=d.get("status", "missing"),
                required_by_stage=d.get("requiredByStage", ""),
                last_updated=_parse_dt(d.get("lastUpdated")) or datetime.utcnow(),
                notes=d.get("notes"),
            ))

    db.commit()
    print(f"Seeded demo account ({DEMO_EMAIL} / {DEMO_PASSWORD}) with {len(episodes)} patient episode(s).")
