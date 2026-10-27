"""The doctor's Dashboard: what is still to be set up in the clinic, and what is waiting for the doctor.

Both are read-only and plain: yes/no and counts for the checklist, and a list ordered ONLY by how long each item has waited (oldest first).
Nothing here looks at anything clinical, so nobody is moved up or down a list because of their health.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models
from ..ai_coordinator import controls
from ..continuity_service import FOLLOW_UP_METRICS, current_resource, utc
from ..database import get_db
from ..deps import require_role
from ..plain_language import LAB_NOTE_PREFIX
from .doctor_portal import OPEN_QUESTION_STATUSES, _assigned_episode_ids

doctor = require_role("doctor")
router = APIRouter(prefix="/api/v2/doctor", tags=["doctor-dashboard"])

# The checklist, in the order the card shows it.
SETUP_KEYS = ("clinic_contact", "booking_rules", "reply_time", "followup_rules", "hospitals", "education")
MOST_ROWS = 100


def _text(value) -> str:
    return value.strip() if isinstance(value, str) else ""


@router.get("/setup-status")
def setup_status(user: models.User = Depends(doctor), db: Session = Depends(get_db)):
    """Which parts of the clinic's own setup are still empty. Counts and yes/no only; nothing about any patient."""
    contact = db.get(models.ClinicContact, "clinic")
    reply = db.get(models.AssistantSetting, "reply_time")
    follow_up_rules = [r for r in db.query(models.ClinicalResource).filter_by(kind="rule", status="APPROVED").all()
                       if current_resource(r) and (r.configuration or {}).get("metric") in FOLLOW_UP_METRICS]
    # The same notes the patients' Care Companion can show: approved, still in date, and not the lab-test notes (those belong to signed explanations).
    education = {r.family_id for r in db.query(models.ClinicalResource).filter_by(kind="education", status="APPROVED").all()
                 if current_resource(r) and not r.family_id.startswith(LAB_NOTE_PREFIX)}
    hospitals = db.query(models.ClinicHospital).count()
    done = {
        "clinic_contact": {"done": bool(contact and _text(contact.clinic_name) and _text(contact.clinic_phone))},
        # Rules that were never saved are only the built-in defaults, so they do not count as set up.
        "booking_rules": {"done": bool(controls.load_scheduling(db))},
        "reply_time": {"done": bool(reply is not None and _text(reply.value))},
        "followup_rules": {"done": bool(follow_up_rules), "count": len(follow_up_rules)},
        "hospitals": {"done": hospitals > 0, "count": hospitals},
        "education": {"done": bool(education), "count": len(education)},
    }
    items = [{"key": key, **done[key]} for key in SETUP_KEYS]
    return {"items": items, "done": sum(1 for item in items if item["done"]), "total": len(items)}


def _iso(value: datetime) -> str:
    return utc(value).isoformat()


@router.get("/needs-you")
def needs_you(user: models.User = Depends(doctor), db: Session = Depends(get_db)):
    """What is waiting for this doctor, oldest first. The order is the time each item has waited and nothing else."""
    ids = _assigned_episode_ids(db, user)
    if not ids:
        return {"items": [], "total": 0}
    names = {e.id: e.patient_name for e in db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.id.in_(ids)).all()}
    rows = []

    def add(kind: str, episode_id: str, title: str, since: datetime | None, to: str):
        if since is not None:
            rows.append({"kind": kind, "episodeId": episode_id, "patientName": names.get(episode_id, ""), "title": title[:140], "waitingSince": _iso(since), "to": to})

    for q in db.query(models.PatientQuestion).filter(models.PatientQuestion.assigned_to_user_id == user.id, models.PatientQuestion.status.in_(OPEN_QUESTION_STATUSES)).all():
        add("question", q.episode_id, q.question_text, q.created_at, "/doctor/questions")
    for d in db.query(models.MedicalDocument).filter(models.MedicalDocument.episode_id.in_(ids), models.MedicalDocument.status == "NEEDS_REVIEW").all():
        add("document", d.episode_id, _text(d.description) or d.filename, d.uploaded_at, f"/doctor/patients/{d.episode_id}?tab=documents")
    drafts = (db.query(models.ConsultationDraft, models.Consultation)
              .join(models.Consultation, models.Consultation.id == models.ConsultationDraft.consultation_id)
              .filter(models.Consultation.doctor_user_id == user.id, models.ConsultationDraft.status == "DRAFT").all())
    for draft, consultation in drafts:
        add("draft", consultation.episode_id, "Consultation note", draft.created_at, "/doctor/consultations?tab=history")
    for o in db.query(models.ClinicalOutput).filter(models.ClinicalOutput.episode_id.in_(ids), models.ClinicalOutput.status == "DRAFT").all():
        add("document_draft", o.episode_id, o.title or "Document", o.created_at, f"/doctor/draft-studio?episodeId={o.episode_id}")
    for item in db.query(models.ExceptionItem).filter(models.ExceptionItem.episode_id.in_(ids), models.ExceptionItem.status == "OPEN").all():
        add("proposal", item.episode_id, item.title, item.created_at, "/doctor/assistant")

    rows.sort(key=lambda row: row["waitingSince"])
    return {"items": rows[:MOST_ROWS], "total": len(rows)}
