"""Doctor screens for Consultations and Patient Questions that need their own data.

- the clinic's approved note layouts a doctor can choose before she starts a note;
- the last approved visit of a patient, shown on the consultation card (read-only: it is the note a doctor already approved);
- a doctor's own saved replies (written by her, kept for her alone, never sent by themselves);
- closing a question that was dealt with by phone or in the clinic: a private note, a fixed message to the person who asked, and an audit entry.

Every route is doctor-only. A doctor can only reach a patient she is assigned to (the same checks the rest of the doctor portal uses), and a
saved reply is found only through its owner. Nothing here is written by a model.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy.orm import Session

from .. import models, schemas_v2, server_text
from ..continuity_schemas import Input
from ..continuity_service import audit, current_resource, name, now, utc
from ..database import get_db
from ..deps import get_current_user, require_episode_access, require_role
from .doctor_portal import _complete_open_tasks_for, _get_assigned_question, _log, _to_question_out

router = APIRouter(prefix="/api/v2/doctor", tags=["doctor-consultations-questions"], dependencies=[Depends(require_role("doctor"))])

MOST_SNIPPETS = 50
STANDARD_SECTIONS = ("visitContext", "documentedDiscussion", "relevantInformation", "followUpNextSteps")


# ---------------------------------------------------------------- note layouts and the last approved visit
@router.get("/note-layouts")
def note_layouts(db: Session = Depends(get_db)):
    """The clinic's APPROVED, current note layouts (the same ones Document studio offers under "Approved note layout")."""
    resources = db.query(models.ClinicalResource).filter_by(kind="template", status="APPROVED").order_by(models.ClinicalResource.title, models.ClinicalResource.version.desc()).all()
    return [
        {"id": r.id, "title": r.title, "version": r.version, "fields": [str(f) for f in (r.configuration or {}).get("fields", [])], "default": bool((r.configuration or {}).get("default"))}
        for r in resources if current_resource(r)
    ]


@router.get("/episodes/{episode_id}/last-approved-visit")
def last_approved_visit(episode: models.PregnancyEpisode = Depends(require_episode_access), db: Session = Depends(get_db)):
    """The note the doctor approved most recently for this patient, as written (nothing is added or summarised), or null if none."""
    approved = (
        db.query(models.ApprovedConsultation)
        .join(models.Consultation, models.ApprovedConsultation.consultation_id == models.Consultation.id)
        .filter(models.Consultation.episode_id == episode.id)
        .order_by(models.ApprovedConsultation.approved_at.desc()).first()
    )
    if approved is None:
        return None
    content = approved.final_content or {}
    sections = [{"key": key, "heading": None, "text": str(content[key])} for key in STANDARD_SECTIONS if str(content.get(key) or "").strip()]
    sections += [{"key": "layout", "heading": heading, "text": str(text)} for heading, text in (content.get("layoutSections") or {}).items() if str(text).strip()]
    return {
        "consultationId": approved.consultation_id, "approvedAt": utc(approved.approved_at).isoformat(),
        "approvedByName": name(db, approved.approved_by_user_id), "layoutTitle": (content.get("layout") or {}).get("title"), "sections": sections,
    }


# ---------------------------------------------------------------- a doctor's own saved replies
class SnippetIn(Input):
    title: str = Field(min_length=2, max_length=80)
    text: str = Field(min_length=2, max_length=2000)


def _snippet_out(snippet: models.ReplySnippet) -> dict:
    return {"id": snippet.id, "title": snippet.title, "text": snippet.text, "updatedAt": utc(snippet.updated_at).isoformat()}


def _own_snippet(db: Session, user: models.User, snippet_id: str) -> models.ReplySnippet:
    snippet = db.get(models.ReplySnippet, snippet_id)
    if snippet is None or snippet.doctor_user_id != user.id:
        raise HTTPException(404, "Saved reply not found.")  # another doctor's snippet is simply not there for this one
    return snippet


@router.get("/reply-snippets")
def list_snippets(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(models.ReplySnippet).filter_by(doctor_user_id=user.id).order_by(models.ReplySnippet.title).all()
    return [_snippet_out(s) for s in rows]


@router.post("/reply-snippets")
def add_snippet(payload: SnippetIn, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if db.query(models.ReplySnippet).filter_by(doctor_user_id=user.id).count() >= MOST_SNIPPETS:
        raise HTTPException(409, f"You can keep up to {MOST_SNIPPETS} saved replies. Delete one first.")
    snippet = models.ReplySnippet(doctor_user_id=user.id, title=payload.title, text=payload.text)
    db.add(snippet)
    db.flush()
    audit(db, user, "reply_snippet_added", snippet, details=f"Title: {snippet.title}")
    db.commit()
    return _snippet_out(snippet)


@router.patch("/reply-snippets/{snippet_id}")
def change_snippet(snippet_id: str, payload: SnippetIn, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    snippet = _own_snippet(db, user, snippet_id)
    snippet.title, snippet.text, snippet.updated_at = payload.title, payload.text, now()
    audit(db, user, "reply_snippet_changed", snippet, details=f"Title: {snippet.title}")
    db.commit()
    return _snippet_out(snippet)


@router.delete("/reply-snippets/{snippet_id}")
def delete_snippet(snippet_id: str, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    snippet = _own_snippet(db, user, snippet_id)
    audit(db, user, "reply_snippet_deleted", snippet, details=f"Title: {snippet.title}")
    db.delete(snippet)
    db.commit()
    return {"deleted": snippet_id}


# ---------------------------------------------------------------- "handled by phone or in clinic"
class CloseHandledIn(Input):
    note: str = Field(min_length=3, max_length=1000)


@router.post("/questions/{question_id}/close-handled", response_model=schemas_v2.CareTeamQuestionOut)
def close_handled(question_id: str, payload: CloseHandledIn, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Closes a question that the doctor dealt with outside the app. There is no written reply: the private note is for doctors, the person who
    asked gets one fixed message, and everything the assistant had open for the question is closed so nothing is left waiting."""
    question = _get_assigned_question(db, user, question_id)
    if question.status in ("ANSWERED", "CLOSED"):
        raise HTTPException(409, "This question has already been answered or closed.")
    question.status = "CLOSED"
    question.closed_how, question.closed_note = "phone_or_clinic", payload.note
    question.closed_by_user_id, question.closed_at = user.id, datetime.now(timezone.utc)
    # The same open work a written reply would complete.
    _complete_open_tasks_for(db, "question_response", question.id)
    _complete_open_tasks_for(db, "question_triage", question.id)
    # A proposal the assistant had waiting for this question can no longer be carried out (its tool refuses a closed question): record that the doctor set it aside.
    for item in db.query(models.ExceptionItem).filter(models.ExceptionItem.source_id == question.id, models.ExceptionItem.status == "OPEN").all():
        item.status, item.decided_by_user_id, item.decided_at = "DISMISSED", user.id, datetime.now(timezone.utc)
        item.decision_note = "The doctor handled this question by phone or at the clinic."
    server_text.notify_key(db, question.asked_by_user_id, "question_handled_offline", episode_id=question.episode_id, type_="question_answered",
                           related_entity_type="PatientQuestion", related_entity_id=question.id)
    _log(db, question.episode_id, user, "question_closed_offline", f"{user.full_name} closed a question handled by phone or at the clinic", payload.note[:200], "PatientQuestion", question.id)
    db.commit()
    db.refresh(question)
    return _to_question_out(db, question)
