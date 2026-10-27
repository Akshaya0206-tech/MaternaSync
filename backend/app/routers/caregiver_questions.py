"""Questions for a trusted person: a photo or report on a question, "I still have a question" on an answered one, and the clinic's usual reply time.

Same rules as her own My Questions (the file rules are the very same function). A trusted person can only add to the questions they asked
themselves, only while she allows questions, and never opens her documents: the list shows file names only. She is told whenever they act.
"""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import Field
from sqlalchemy.orm import Session

from .. import automation, doctor_notices, models, schemas_v2
from ..continuity_schemas import Input
from ..database import get_db
from .caregiver import _record, _tell_her, access, caregiver
from .question_extras import reply_time, store_attachment

router = APIRouter(prefix="/api/v2/caregiver", tags=["caregiver-questions"])


class FollowUpIn(Input):
    question_text: str = Field(min_length=1, max_length=2000)


def _own_question(db: Session, link: models.CaregiverLink, user: models.User, question_id: str) -> models.PatientQuestion:
    """One of this person's own questions about this woman. Anyone else's (hers, another helper's, another woman's) is "not found"."""
    question = db.get(models.PatientQuestion, question_id)
    if question is None or question.episode_id != link.episode_id or question.asked_by_user_id != user.id:
        raise HTTPException(404, "Question not found.")
    return question


@router.get("/{link_id}/questions/info")
def question_info(link: models.CaregiverLink = Depends(access("questions")), db: Session = Depends(get_db)):
    """The clinic's usual reply time, as its doctor wrote it. Empty until one is set. It promises nothing."""
    return {"replyTime": reply_time(db)}


@router.post("/{link_id}/questions/{question_id}/attachments", response_model=schemas_v2.AttachmentOut)
async def attach(question_id: str, file: UploadFile = File(...), link: models.CaregiverLink = Depends(access("questions")),
                 user: models.User = Depends(caregiver), db: Session = Depends(get_db)):
    question = _own_question(db, link, user, question_id)
    episode = db.get(models.PregnancyEpisode, link.episode_id)
    out = await store_attachment(db, episode, question, user, file, commit=False)  # the same type, size and count rules as her own questions
    _record(db, user, link, "caregiver_question_file_attached", "A trusted person attached a file to a question", file.filename or "")
    _tell_her(db, link, "caregiver_acted_attachment")
    db.commit()
    return out


@router.post("/{link_id}/questions/{question_id}/follow-up")
def follow_up(question_id: str, payload: FollowUpIn, link: models.CaregiverLink = Depends(access("questions")), user: models.User = Depends(caregiver),
              db: Session = Depends(get_db)):
    """"I still have a question": a new question that follows an earlier one of theirs, as it does on her own My Questions."""
    earlier = _own_question(db, link, user, question_id)
    text = payload.question_text.strip()
    if not text:
        raise HTTPException(400, "Please write the question first.")
    question = models.PatientQuestion(episode_id=link.episode_id, asked_by_user_id=user.id, question_text=text, status="NEW", follow_up_of_id=earlier.id)
    db.add(question)
    db.flush()
    _record(db, user, link, "caregiver_question_followup", "A trusted person asked a follow-up question", text[:200])
    _tell_her(db, link, "caregiver_acted_question")
    automation.dispatch_event(db, automation.events.PATIENT_QUESTION_CREATED, episode_id=link.episode_id, actor_user_id=user.id,
                              source_type="PatientQuestion", source_id=question.id, payload={"questionText": text})
    # The doctor's note says a follow-up was asked, not what it says.
    doctor_notices.tell_doctors(db, db.get(models.PregnancyEpisode, link.episode_id), "question_followup", related_type="PatientQuestion", related_id=question.id)
    db.commit()
    return {"id": question.id, "status": question.status}
