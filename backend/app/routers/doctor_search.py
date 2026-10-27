"""One search across a doctor's own patients, the questions waiting with her and the documents of her patients.

Privacy:
- Only patients the doctor is assigned to are searched, and a question only when it is on her own Patient Questions list (the same rule as that list).
- A result carries a short label and a few plain fields (the patient's name, a date, which field matched), never more of a question than a
  120-character label, and never the inside of a document.
- What is typed may be a patient's name, so it is not written to the audit log and it is kept out of the access log: the screens send it in the
  body of a POST, and for the GET form (used by tools and tests) the access-log line is rewritten so the query is not in it.
"""
import logging
import re
import unicodedata
from datetime import timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import require_role

router = APIRouter(prefix="/api/v2/doctor", tags=["doctor-search"], dependencies=[Depends(require_role("doctor"))])

MIN_QUERY = 2          # fewer characters is not searched (the answer is empty, not an error)
MAX_QUERY = 100        # longer is refused: the cost of a search is bounded by the length of what is typed
LABEL_LIMIT = 120      # the most of a question a result may carry
SCAN_CAP = 2000        # the most rows of each kind looked at (newest first)
PER_GROUP_MAX = 50


class _HideSearchQuery(logging.Filter):
    """The access log line of a GET search would carry what was typed; keep it out."""

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        if isinstance(args, tuple) and len(args) >= 3 and isinstance(args[2], str) and args[2].startswith("/api/v2/doctor/search?"):
            record.args = (args[0], args[1], "/api/v2/doctor/search?q=<hidden>", *args[3:])
        return True


logging.getLogger("uvicorn.access").addFilter(_HideSearchQuery())

# What a patient can say a document is, in the four languages, so a doctor typing "लैब" or "scan" finds it (the keys are backend/app/document_types.py).
KIND_LABELS = {
    "lab_report": ("Lab report", "लैब रिपोर्ट", "ஆய்வக அறிக்கை", "ల్యాబ్ రిపోర్ట్"),
    "scan": ("Scan or ultrasound", "स्कैन या अल्ट्रासाउंड", "ஸ்கேன் அல்லது அல்ட்ராசவுண்ட்", "స్కాన్ లేదా అల్ట్రాసౌండ్"),
    "prescription": ("Prescription", "प्रिस्क्रिप्शन", "மருந்துச் சீட்டு", "ప్రిస్క్రిప్షన్"),
    "discharge_summary": ("Discharge summary", "डिस्चार्ज सारांश", "டிஸ்சார்ஜ் சுருக்கம்", "డిశ్చార్జ్ సారాంశం"),
    "vaccination_card": ("Vaccination card", "टीकाकरण कार्ड", "தடுப்பூசி அட்டை", "టీకా కార్డు"),
    "visit_note": ("Visit note", "मुलाक़ात का नोट", "வருகைக் குறிப்பு", "సందర్శన గమనిక"),
    "other": ("Other", "अन्य", "மற்றவை", "ఇతర"),
}

_MARKS = re.compile("[̀-ͯ]")


def fold(text: str | None) -> str:
    """For comparing: lower case and without Latin accents. Hindi, Tamil and Telugu vowel signs are NOT combining accents in this sense (they are
    outside the block removed), so those scripts are compared exactly as written."""
    return _MARKS.sub("", unicodedata.normalize("NFD", text or "")).casefold()


def _iso(value) -> str | None:
    if value is None:
        return None
    return (value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)).isoformat()


def _short(text: str) -> str:
    one_line = " ".join((text or "").split())
    return one_line if len(one_line) <= LABEL_LIMIT else one_line[: LABEL_LIMIT - 1].rstrip() + "…"


def _document_label(document: models.MedicalDocument) -> str:
    """The title the patient's own My Records page would show (English here; the screen words it again in the doctor's language)."""
    description = (document.description or "").strip()
    if description:
        return description
    kind = KIND_LABELS.get(document.document_type or "")
    if kind:
        return f"{kind[0]} · {document.document_date}" if document.document_date else kind[0]
    return document.filename


def _assigned_episodes(db: Session, doctor: models.User) -> list[models.PregnancyEpisode]:
    ids = [row[0] for row in db.query(models.PatientDoctorAssignment.episode_id).filter(models.PatientDoctorAssignment.doctor_user_id == doctor.id).all()]
    if not ids:
        return []
    return db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.id.in_(ids)).all()


def _group(items: list[dict], limit: int) -> dict:
    return {"total": len(items), "items": items[:limit]}


def run_search(db: Session, doctor: models.User, query: str, limit: int) -> dict:
    empty = {"total": 0, "items": []}
    text = " ".join((query or "").split())
    if len(text) < MIN_QUERY:
        return {"patients": dict(empty), "questions": dict(empty), "documents": dict(empty)}
    needle = fold(text)
    digits = re.sub(r"[\s\-()+]", "", text)
    phone_digits = digits if digits.isdigit() and len(digits) >= 3 else ""

    episodes = _assigned_episodes(db, doctor)
    by_id = {episode.id: episode for episode in episodes}
    profiles = {}
    if episodes:
        profiles = {p.user_id: p for p in db.query(models.PatientProfile).filter(models.PatientProfile.user_id.in_([e.patient_user_id for e in episodes])).all()}

    # ---- patients: name, record number, phone
    patients = []
    for episode in episodes:
        profile = profiles.get(episode.patient_user_id)
        name_fold = fold(episode.patient_name)
        matched, detail = None, None
        if needle in name_fold:
            matched = "name"
        else:
            for number in (episode.mrn, profile.mrn if profile else None):
                if number and needle in fold(number):
                    matched, detail = "mrn", number
                    break
            if matched is None and phone_digits and profile and profile.phone and phone_digits in re.sub(r"\D", "", profile.phone):
                matched, detail = "phone", profile.phone
        if matched:
            patients.append({"id": episode.id, "label": episode.patient_name, "patientName": episode.patient_name, "date": None, "matchedOn": matched,
                             "detail": detail, "link": f"/doctor/patients/{episode.id}", "_rank": (0 if name_fold.startswith(needle) else 1, name_fold)})
    patients.sort(key=lambda item: item["_rank"])
    for item in patients:
        item.pop("_rank")

    # ---- questions that are on her own list
    questions = []
    if by_id:
        rows = (db.query(models.PatientQuestion)
                .filter(models.PatientQuestion.assigned_to_user_id == doctor.id, models.PatientQuestion.episode_id.in_(list(by_id)))
                .order_by(models.PatientQuestion.created_at.desc()).limit(SCAN_CAP).all())
        for question in rows:
            patient_name = by_id[question.episode_id].patient_name
            earlier = question.follow_up_of
            matched = None
            if needle in fold(question.question_text):
                matched = "text"
            elif needle in fold(patient_name):
                matched = "patient"
            elif earlier is not None and needle in fold(earlier.question_text):
                matched = "earlier"
            if matched:
                status = question.status
                state = ("handled" if getattr(question, "closed_how", None) == "phone_or_clinic" else "closed" if status == "CLOSED"
                         else "answered" if status == "ANSWERED" else "needs_reply")
                questions.append({"id": question.id, "label": _short(question.question_text), "patientName": patient_name, "date": _iso(question.created_at),
                                  "state": state, "matchedOn": matched, "link": f"/doctor/questions?question={question.id}"})

    # ---- documents of her patients
    documents = []
    if by_id:
        rows = (db.query(models.MedicalDocument).filter(models.MedicalDocument.episode_id.in_(list(by_id)))
                .order_by(models.MedicalDocument.uploaded_at.desc()).limit(SCAN_CAP).all())
        for document in rows:
            patient_name = by_id[document.episode_id].patient_name
            label = _document_label(document)
            kind = KIND_LABELS.get(document.document_type or "", ())
            matched = None
            if needle in fold(label) or needle in fold(document.description):
                matched = "title"
            elif needle in fold(document.filename):
                matched = "filename"
            elif any(needle in fold(word) for word in kind) or needle in fold(document.document_type):
                matched = "kind"
            elif needle in fold(patient_name):
                matched = "patient"
            if matched:
                documents.append({"id": document.id, "label": label, "patientName": patient_name, "date": document.document_date or _iso(document.uploaded_at),
                                  "description": document.description, "documentType": document.document_type, "documentDate": document.document_date,
                                  "filename": document.filename, "matchedOn": matched, "detail": document.filename if matched == "filename" and label != document.filename else None,
                                  "link": f"/doctor/patients/{document.episode_id}?tab=documents"})

    return {"patients": _group(patients, limit), "questions": _group(questions, limit), "documents": _group(documents, limit)}


class SearchIn(BaseModel):
    q: str = Field("", max_length=MAX_QUERY)
    limit: int = Field(5, ge=1, le=PER_GROUP_MAX)


@router.post("/search")
def search_post(payload: SearchIn, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    """What the screens use: the query travels in the body, so it is not in any URL log."""
    return run_search(db, current_user, payload.q, payload.limit)


@router.get("/search")
def search_get(q: str = Query("", max_length=MAX_QUERY), limit: int = Query(5, ge=1, le=PER_GROUP_MAX),
               current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    return run_search(db, current_user, q, limit)
