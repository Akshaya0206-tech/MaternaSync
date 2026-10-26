"""Extras for the patient's My Questions and Appointments pages:

- a photo or report attached to a question (an ordinary document, so it is reviewed like any other record she uploads),
- the "usual reply time" a doctor sets for the clinic, which My Questions shows,
- her requests to cancel or move a confirmed visit (they only ask: nothing changes until a doctor acts).
"""
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import Field, model_validator
from sqlalchemy.orm import Session

from .. import automation, extraction, models, schemas_v2, server_text, visit_changes
from ..ai_coordinator import orchestrator, scheduling
from ..config import UPLOAD_DIR
from ..continuity_schemas import Input
from ..continuity_service import now, utc
from ..database import get_db
from ..deps import get_my_patient_episode, require_role
from .patient_portal import ALLOWED_EXTENSIONS, _change_request_out, _primary_doctor_name

router = APIRouter(tags=["question-extras"])
patient = require_role("patient")
doctor = require_role("doctor")

MOST_ATTACHMENTS = 3
MOST_BYTES = 10 * 1024 * 1024
REPLY_TIME_KEY = "reply_time"
MOST_REPLY_TIME_CHARS = 100


# ---------------------------------------------------------------- a file attached to a question
@router.post("/api/v2/patient/questions/{question_id}/attachments", response_model=schemas_v2.AttachmentOut)
async def attach_to_question(
    question_id: str,
    file: UploadFile = File(...),
    episode: models.PregnancyEpisode = Depends(get_my_patient_episode),
    current_user: models.User = Depends(patient),
    db: Session = Depends(get_db),
):
    question = db.get(models.PatientQuestion, question_id)
    if question is None or question.episode_id != episode.id or question.asked_by_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Question not found.")
    if len(question.attachments) >= MOST_ATTACHMENTS:
        raise HTTPException(status_code=400, detail=f"A question can have up to {MOST_ATTACHMENTS} files.")
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type. Please attach a PDF, JPG, or PNG.")
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="The attached file is empty.")
    if len(contents) > MOST_BYTES:
        raise HTTPException(status_code=400, detail="The attached file is too large (the limit is 10 MB).")

    stored_name = f"{uuid.uuid4().hex}{suffix}"
    dest_path = UPLOAD_DIR / stored_name
    dest_path.write_bytes(contents)
    try:
        text, _used_ocr, _ocr_unavailable = extraction.extract_text(dest_path)
        result = extraction.extract_structured_fields(text, file.filename or stored_name)
    except Exception:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="We couldn't process this file. Please try a different one.")
    fields, derived = result["fields"], result["derived"]

    document = models.MedicalDocument(
        episode_id=episode.id, uploaded_by_user_id=current_user.id, uploaded_by_role=current_user.role,
        filename=file.filename or stored_name, file_path=stored_name, description="Attached to a question", status="NEEDS_REVIEW",
    )
    db.add(document)
    db.flush()
    db.add(models.DocumentExtraction(
        document_id=document.id, raw_text=text[:20000], record_type=fields["recordType"]["value"] or derived["title"],
        visit_type=fields["visitType"]["value"], event_date=derived["timestamp"], facility=fields["facility"]["value"],
        provider=fields["responsibleDoctor"]["value"], patient_name_found=fields["patientName"]["value"], mrn_found=fields["mrn"]["value"],
        gestational_age=fields["gestationalAge"]["value"], field_status={key: value["status"] for key, value in fields.items()},
    ))
    db.add(models.QuestionAttachment(question_id=question.id, document_id=document.id))
    db.add(models.AuditLog(
        episode_id=episode.id, actor_user_id=current_user.id, actor_role=current_user.role, actor_display_name=current_user.full_name,
        action="question_file_attached", title=f"{current_user.full_name} attached a file to a question",
        details=f"Filename: {file.filename}", object_type="PatientQuestion", object_id=question.id,
    ))
    automation.dispatch_event(
        db, automation.events.DOCUMENT_UPLOADED, episode_id=episode.id, actor_user_id=current_user.id,
        source_type="MedicalDocument", source_id=document.id, payload={"filename": document.filename},
    )
    db.commit()
    return schemas_v2.AttachmentOut(id=document.id, filename=document.filename)


# ---------------------------------------------------------------- the clinic's usual reply time
def reply_time(db: Session) -> str:
    row = db.get(models.AssistantSetting, REPLY_TIME_KEY)
    return row.value if row is not None and isinstance(row.value, str) else ""


class ReplyTimeIn(Input):
    text: str = Field("", max_length=MOST_REPLY_TIME_CHARS)


@router.get("/api/v2/patient/questions-info")
def question_info(current_user: models.User = Depends(patient), db: Session = Depends(get_db)):
    """What My Questions says about when a reply usually comes. Empty until a doctor sets it."""
    return {"replyTime": reply_time(db)}


@router.get("/api/v2/assistant/reply-time")
def get_reply_time(user: models.User = Depends(doctor), db: Session = Depends(get_db)):
    return {"text": reply_time(db), "mostChars": MOST_REPLY_TIME_CHARS}


@router.put("/api/v2/assistant/reply-time")
def set_reply_time(payload: ReplyTimeIn, user: models.User = Depends(doctor), db: Session = Depends(get_db)):
    """The clinic's usual reply time, for example "within 1 working day". Patients see it on My Questions; it promises nothing."""
    text = payload.text.strip()
    row = db.get(models.AssistantSetting, REPLY_TIME_KEY)
    if row is None:
        row = models.AssistantSetting(key=REPLY_TIME_KEY)
        db.add(row)
    row.value, row.updated_by_user_id, row.updated_at = text, user.id, datetime.now(timezone.utc)
    db.add(models.AuditLog(
        episode_id=None, actor_user_id=user.id, actor_role=user.role, actor_display_name=user.full_name,
        action="reply_time_changed", title="Changed the clinic's usual reply time" if text else "Cleared the clinic's usual reply time",
        details=text[:500], object_type="AssistantSetting", object_id=REPLY_TIME_KEY,
    ))
    db.commit()
    return {"text": text, "mostChars": MOST_REPLY_TIME_CHARS}


# ---------------------------------------------------------------- asking to cancel or move a confirmed visit
class ChangeRequestIn(Input):
    kind: Literal["reschedule", "cancel"]
    preferred_at: datetime | None = None
    note: str = Field("", max_length=500)

    @model_validator(mode="after")
    def check(self):
        if self.kind == "reschedule":
            if self.preferred_at is None or self.preferred_at.tzinfo is None:
                raise ValueError("Choose the time you would like instead.")
            if self.preferred_at <= datetime.now(timezone.utc):
                raise ValueError("Choose a time that is still ahead.")
        else:
            self.preferred_at = None
        return self


def _mine(db: Session, episode: models.PregnancyEpisode, appointment_id: str) -> models.Appointment:
    appointment = db.get(models.Appointment, appointment_id)
    if appointment is None or appointment.episode_id != episode.id:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    return appointment


def _out(db: Session, appointment: models.Appointment) -> schemas_v2.AppointmentOut:
    return schemas_v2.AppointmentOut(
        id=appointment.id, scheduled_at=appointment.scheduled_at, appointment_type=appointment.appointment_type, location=appointment.location,
        status=appointment.status, doctor_name=_primary_doctor_name(db, appointment.episode_id), change_request=_change_request_out(appointment),
    )


def _audit(db: Session, user: models.User, episode_id: str, appointment_id: str, action: str, title: str, details: str = "") -> None:
    db.add(models.AuditLog(
        episode_id=episode_id, actor_user_id=user.id, actor_role=user.role, actor_display_name=user.full_name,
        action=action, title=title, details=details[:500], object_type="Appointment", object_id=appointment_id,
    ))


@router.post("/api/v2/patient/appointments/{appointment_id}/change-request", response_model=schemas_v2.AppointmentOut)
def ask_to_change_a_visit(
    appointment_id: str,
    payload: ChangeRequestIn,
    episode: models.PregnancyEpisode = Depends(get_my_patient_episode),
    current_user: models.User = Depends(patient),
    db: Session = Depends(get_db),
):
    appointment = _mine(db, episode, appointment_id)
    if appointment.status != "scheduled":
        raise HTTPException(status_code=409, detail="Only a confirmed visit can be changed.")
    if utc(appointment.scheduled_at) <= now():
        raise HTTPException(status_code=409, detail="This visit has already passed.")
    if appointment.change_kind:
        raise HTTPException(status_code=409, detail="You have already asked about this visit. Withdraw that request first.")

    rules = scheduling.rules(db)
    when = scheduling.local_text(appointment.scheduled_at, rules)
    note = payload.note.strip()
    owner = visit_changes.doctor_for(db, episode.id)
    moving = payload.kind == "reschedule"
    new_when = scheduling.local_text(payload.preferred_at, rules) if moving else ""

    new_visit = None
    if moving:
        # The time she asked for goes through the same booking check as any visit request (the Care Assistant proposes; a doctor confirms).
        new_visit = models.Appointment(
            episode_id=episode.id, scheduled_at=utc(payload.preferred_at).replace(tzinfo=None), appointment_type=appointment.appointment_type,
            location=appointment.location, status="requested",
            notes=f"She asks to move the visit of {when} to this time." + (f" Her note: {note}" if note else ""),
        )
        db.add(new_visit)
        db.flush()
        orchestrator.enqueue(db, "appointment_request", episode_id=episode.id, source_type="Appointment", source_id=new_visit.id)

    what = f"{episode.patient_name} asks to {'move the visit on ' + when + ' to ' + new_when if moving else 'cancel the visit on ' + when}."
    description = (
        f"{what} Nothing has been changed: the visit is still confirmed. "
        + ("A visit request for the new time was also made; confirm or offer other times from the Care Assistant page or the visit list, "
           "then cancel the old visit. " if moving else "To cancel it, set the visit's status to Cancelled under Connected Care, Tasks, visits & outcomes. ")
        + (f"Her note: {note}" if note else "")
    ).strip()
    task = models.Task(
        episode_id=episode.id, title=f"Visit change requested: {'move' if moving else 'cancel'} the visit on {when}", description=description,
        owner_user_id=owner, created_by_user_id=current_user.id, due_date=now().date().isoformat(), source_type="appointment_change", source_id=appointment.id,
    )
    db.add(task)
    db.flush()

    appointment.change_kind = payload.kind
    appointment.change_note = note or None
    appointment.change_preferred_at = utc(payload.preferred_at).replace(tzinfo=None) if moving else None
    appointment.change_requested_at = now().replace(tzinfo=None)
    appointment.change_new_appointment_id = new_visit.id if new_visit else None
    appointment.change_task_id = task.id

    if owner:
        server_text.notify_key(db, owner, "visit_change_requested", episode_id=episode.id, params={"what": what},
                               related_entity_type="Appointment", related_entity_id=appointment.id)
    server_text.notify_key(db, current_user.id, "visit_change_sent", episode_id=episode.id,
                           related_entity_type="Appointment", related_entity_id=appointment.id)
    _audit(db, current_user, episode.id, appointment.id, "visit_change_requested", f"{current_user.full_name} asked to {'move' if moving else 'cancel'} a visit", what)
    db.commit()
    db.refresh(appointment)
    return _out(db, appointment)


@router.delete("/api/v2/patient/appointments/{appointment_id}/change-request", response_model=schemas_v2.AppointmentOut)
def withdraw_a_visit_change(
    appointment_id: str,
    episode: models.PregnancyEpisode = Depends(get_my_patient_episode),
    current_user: models.User = Depends(patient),
    db: Session = Depends(get_db),
):
    appointment = _mine(db, episode, appointment_id)
    if not appointment.change_kind or appointment.status != "scheduled":
        raise HTTPException(status_code=409, detail="There is no open request about this visit.")
    when = scheduling.local_text(appointment.scheduled_at, scheduling.rules(db))
    if appointment.change_new_appointment_id:
        new_visit = db.get(models.Appointment, appointment.change_new_appointment_id)
        if new_visit is not None and new_visit.status == "requested":
            new_visit.status = "cancelled"  # her own request for the new time, withdrawn by her
            new_visit.notes = f"{new_visit.notes or ''} {visit_changes.WITHDRAWN_MARK}".strip()
    owner = visit_changes.doctor_for(db, episode.id)
    what = f"{episode.patient_name} withdrew the request about the visit on {when}. The visit stays as it is."
    visit_changes.close_request(db, appointment, "Withdrawn by the patient.")
    if owner:
        server_text.notify_key(db, owner, "visit_change_withdrawn", episode_id=episode.id, params={"what": what},
                               related_entity_type="Appointment", related_entity_id=appointment.id)
    _audit(db, current_user, episode.id, appointment.id, "visit_change_withdrawn", f"{current_user.full_name} withdrew a request about a visit", what)
    db.commit()
    db.refresh(appointment)
    return _out(db, appointment)
