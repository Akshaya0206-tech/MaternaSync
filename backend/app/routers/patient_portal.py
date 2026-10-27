"""Patient-facing API for the new role-based system.

Every route here resolves "my episode" server-side from the authenticated
user's id (see deps.get_my_patient_episode) rather than from any
client-supplied id — there is no episode/patient id in these URLs for a
patient to tamper with. The one sub-resource with its own id (document
file download) re-derives the episode the same way and scopes its query
to it, so a cross-patient id simply doesn't match (404), never 200s.
"""

import uuid
from datetime import timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .. import automation, doctor_names, doctor_notices, extraction, models, schemas_v2, server_text, visit_changes
from ..config import UPLOAD_DIR
from ..continuity_service import now, utc
from ..database import get_db
from ..document_types import DOCUMENT_TYPES
from ..deps import get_current_user, get_my_patient_episode, require_role
from ..plain_language import explain_terms

router = APIRouter(prefix="/api/v2/patient", tags=["patient-portal"])

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}


def _to_document_out(document: models.MedicalDocument) -> schemas_v2.PatientDocumentOut:
    return schemas_v2.PatientDocumentOut(
        id=document.id,
        filename=document.filename,
        status=document.status,
        status_label=schemas_v2.DOCUMENT_STATUS_LABELS.get(document.status, document.status),
        document_date=document.document_date,
        description=document.description,
        uploaded_at=document.uploaded_at,
        document_type=document.document_type,
    )


def _change_request_out(appointment: models.Appointment) -> schemas_v2.ChangeRequestOut | None:
    """Her request to cancel or move a visit, while the visit is still confirmed and the request is still open."""
    if not appointment.change_kind or appointment.status != "scheduled":
        return None
    return schemas_v2.ChangeRequestOut(
        kind=appointment.change_kind, note=appointment.change_note or None,
        preferred_at=appointment.change_preferred_at, requested_at=appointment.change_requested_at,
    )


def _to_question_out(question: models.PatientQuestion) -> schemas_v2.PatientQuestionOut:
    visible_responses = [r for r in question.responses if r.status == "APPROVED" and r.visible_to_patient]
    earlier = question.follow_up_of
    return schemas_v2.PatientQuestionOut(
        id=question.id,
        question_text=question.question_text,
        status=question.status,
        created_at=question.created_at,
        attachments=[schemas_v2.AttachmentOut(id=a.document_id, filename=a.document.filename) for a in question.attachments if a.document],
        follow_up_of_id=earlier.id if earlier else None,
        follow_up_of_text=earlier.question_text[:200] if earlier else None,
        responses=[
            schemas_v2.QuestionResponseOut(
                id=r.id, response_text=r.response_text, responder_role=r.responder_role, created_at=r.created_at,
            )
            for r in visible_responses
        ],
    )


def _primary_doctor_name(db: Session, episode_id: str) -> str | None:
    assignment = (
        db.query(models.PatientDoctorAssignment)
        .filter(models.PatientDoctorAssignment.episode_id == episode_id, models.PatientDoctorAssignment.is_primary == True)  # noqa: E712
        .first()
    )
    if not assignment:
        return None
    doctor = db.query(models.User).filter(models.User.id == assignment.doctor_user_id).first()
    return doctor_names.shown_name(db, doctor)  # patients see the title and name the doctor chose to show them


# ---------- Dashboard ----------

@router.get("/dashboard", response_model=schemas_v2.PatientDashboardOut)
def get_my_dashboard(
    # Minutes her clock is behind UTC, as JavaScript's getTimezoneOffset() gives it (India is -330). It decides where "today" starts.
    tz_offset: int = Query(0, ge=-840, le=840),
    episode: models.PregnancyEpisode = Depends(get_my_patient_episode),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current = now()
    day_start = ((current - timedelta(minutes=tz_offset)).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(minutes=tz_offset)).replace(tzinfo=None)
    day_end = day_start + timedelta(days=1)

    # Only a visit that has not happened yet can be "next": a booked time that has passed is not an upcoming appointment.
    ahead = [
        a for a in db.query(models.Appointment)
        .filter(models.Appointment.episode_id == episode.id, models.Appointment.status.in_(["scheduled", "requested"]))
        .order_by(models.Appointment.scheduled_at.asc()).all()
        if utc(a.scheduled_at) > current
    ]
    next_appt = next((a for a in ahead if a.status == "scheduled"), None)
    requested_appt = next((a for a in ahead if a.status == "requested"), None)
    doctor_name = _primary_doctor_name(db, episode.id)

    def appointment_out(appt):
        return schemas_v2.AppointmentOut(
            id=appt.id, scheduled_at=appt.scheduled_at, appointment_type=appt.appointment_type,
            location=appt.location, status=appt.status, doctor_name=doctor_name,
        ) if appt else None

    next_appointment_out = appointment_out(next_appt)
    visit_request_out = appointment_out(requested_appt)

    # The "Today" card: what she has done today and what is waiting for her. These are counts of her own entries and her doctor's
    # replies; nothing here reads or judges a value.
    todays_logs = db.query(models.DailyLog.skipped).filter(
        models.DailyLog.episode_id == episode.id, models.DailyLog.recorded_at >= day_start, models.DailyLog.recorded_at < day_end,
    ).all()
    check_in_today = "none" if not todays_logs else ("recorded" if any(not skipped for (skipped,) in todays_logs) else "skipped")
    due_reminders = (
        db.query(models.CareReminder)
        .filter(models.CareReminder.episode_id == episode.id, models.CareReminder.status == "pending", models.CareReminder.scheduled_at < day_end)
        .order_by(models.CareReminder.scheduled_at.asc()).all()
    )
    last_week = current - timedelta(days=7)
    answered_recently = sum(
        1 for q in db.query(models.PatientQuestion).filter(models.PatientQuestion.episode_id == episode.id, models.PatientQuestion.asked_by_user_id == current_user.id).all()
        if any(r.status == "APPROVED" and r.visible_to_patient and utc(r.created_at) >= last_week for r in q.responses)
    )

    open_questions_count = (
        db.query(models.PatientQuestion)
        .filter(
            models.PatientQuestion.episode_id == episode.id,
            models.PatientQuestion.asked_by_user_id == current_user.id,
            models.PatientQuestion.status.in_(["NEW", "ASSIGNED", "WAITING_FOR_RESPONSE"]),
        )
        .count()
    )

    recent_event = (
        db.query(models.JourneyEvent)
        .filter(models.JourneyEvent.episode_id == episode.id)
        .order_by(models.JourneyEvent.event_date.desc())
        .first()
    )

    document_count = db.query(models.MedicalDocument).filter(models.MedicalDocument.episode_id == episode.id).count()
    appointment_count = db.query(models.Appointment).filter(models.Appointment.episode_id == episode.id).count()

    action_needed = None
    if document_count == 0:
        action_needed = "Upload your medical records to help your care team prepare for your visit."
    elif appointment_count == 0:
        action_needed = "No upcoming appointment has been recorded. Contact your care team to schedule one."

    return schemas_v2.PatientDashboardOut(
        full_name=current_user.full_name,
        gestational_age_weeks=episode.gestational_age_weeks,
        gestational_age_days=episode.gestational_age_days,
        edd=episode.edd,
        next_appointment=next_appointment_out,
        action_needed=action_needed,
        open_questions_count=open_questions_count,
        recent_care_title=recent_event.title if recent_event else None,
        recent_care_date=recent_event.event_date if recent_event else None,
        visit_request=visit_request_out,
        check_in_today=check_in_today,
        reminders_due_count=len(due_reminders),
        reminders_due=[r.title for r in due_reminders[:3]],
        answered_recently_count=answered_recently,
    )


# ---------- Documents ----------

@router.get("/documents", response_model=list[schemas_v2.PatientDocumentOut])
def list_my_documents(
    episode: models.PregnancyEpisode = Depends(get_my_patient_episode),
    db: Session = Depends(get_db),
):
    documents = (
        db.query(models.MedicalDocument)
        .filter(models.MedicalDocument.episode_id == episode.id)
        .order_by(models.MedicalDocument.uploaded_at.desc())
        .all()
    )
    return [_to_document_out(d) for d in documents]


@router.post("/documents", response_model=schemas_v2.DocumentUploadOut)
async def upload_my_document(
    file: UploadFile = File(...),
    description: str | None = Form(None),
    document_date: str | None = Form(None),
    document_type: str | None = Form(None),
    episode: models.PregnancyEpisode = Depends(get_my_patient_episode),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if document_type and document_type not in DOCUMENT_TYPES:
        raise HTTPException(status_code=400, detail="Choose what kind of document this is from the list.")
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type. Please upload a PDF, JPG, or PNG.")

    stored_name = f"{uuid.uuid4().hex}{suffix}"
    dest_path = UPLOAD_DIR / stored_name
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    dest_path.write_bytes(contents)

    try:
        text, _used_ocr, _ocr_unavailable = extraction.extract_text(dest_path)
        result = extraction.extract_structured_fields(text, file.filename or stored_name)
    except Exception:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="We couldn't process this document. Please try a different file.")

    fields = result["fields"]
    derived = result["derived"]

    document = models.MedicalDocument(
        episode_id=episode.id,
        uploaded_by_user_id=current_user.id,
        uploaded_by_role=current_user.role,
        filename=file.filename or stored_name,
        file_path=stored_name,
        document_date=document_date or None,
        description=description or None,
        document_type=document_type or None,
        status="NEEDS_REVIEW",
    )
    db.add(document)
    db.flush()

    db.add(models.DocumentExtraction(
        document_id=document.id,
        raw_text=text[:20000],
        record_type=fields["recordType"]["value"] or derived["title"],
        visit_type=fields["visitType"]["value"],
        event_date=document_date or derived["timestamp"],
        facility=fields["facility"]["value"],
        provider=fields["responsibleDoctor"]["value"],
        patient_name_found=fields["patientName"]["value"],
        mrn_found=fields["mrn"]["value"],
        gestational_age=fields["gestationalAge"]["value"],
        field_status={key: value["status"] for key, value in fields.items()},
    ))

    db.add(models.AuditLog(
        episode_id=episode.id, actor_user_id=current_user.id, actor_role=current_user.role,
        actor_display_name=current_user.full_name, action="document_uploaded",
        title=f"{current_user.full_name} uploaded a document",
        details=f"Filename: {file.filename}",
        object_type="MedicalDocument", object_id=document.id,
    ))

    automation.dispatch_event(
        db, automation.events.DOCUMENT_UPLOADED, episode_id=episode.id, actor_user_id=current_user.id,
        source_type="MedicalDocument", source_id=document.id, payload={"filename": document.filename},
    )

    db.commit()
    db.refresh(document)

    return schemas_v2.DocumentUploadOut(
        document=_to_document_out(document),
        message="Your document has been uploaded and is being reviewed.",
    )


@router.get("/documents/{document_id}/file")
def get_my_document_file(
    document_id: str,
    episode: models.PregnancyEpisode = Depends(get_my_patient_episode),
    db: Session = Depends(get_db),
):
    document = (
        db.query(models.MedicalDocument)
        .filter(models.MedicalDocument.id == document_id, models.MedicalDocument.episode_id == episode.id)
        .first()
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")

    file_path = UPLOAD_DIR / document.file_path
    if not document.file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Source file not found on server.")

    return FileResponse(file_path, filename=document.filename)


# ---------- Questions ----------

@router.get("/questions", response_model=list[schemas_v2.PatientQuestionOut])
def list_my_questions(
    episode: models.PregnancyEpisode = Depends(get_my_patient_episode),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    questions = (
        db.query(models.PatientQuestion)
        .filter(models.PatientQuestion.episode_id == episode.id, models.PatientQuestion.asked_by_user_id == current_user.id)
        .order_by(models.PatientQuestion.created_at.desc())
        .all()
    )
    return [_to_question_out(q) for q in questions]


@router.post("/questions", response_model=schemas_v2.PatientQuestionOut)
def create_my_question(
    payload: schemas_v2.QuestionCreateIn,
    episode: models.PregnancyEpisode = Depends(get_my_patient_episode),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    text = payload.question_text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Please write your question before submitting.")

    earlier = None
    if payload.follow_up_of:
        earlier = db.get(models.PatientQuestion, payload.follow_up_of)
        if earlier is None or earlier.episode_id != episode.id or earlier.asked_by_user_id != current_user.id:
            raise HTTPException(status_code=404, detail="The question you are following up on was not found.")

    question = models.PatientQuestion(
        episode_id=episode.id, asked_by_user_id=current_user.id, question_text=text, status="NEW",
        follow_up_of_id=earlier.id if earlier else None,
    )
    db.add(question)
    db.flush()

    db.add(models.AuditLog(
        episode_id=episode.id, actor_user_id=current_user.id, actor_role=current_user.role,
        actor_display_name=current_user.full_name, action="question_asked",
        title=f"{current_user.full_name} submitted a question",
        details=text[:200], object_type="PatientQuestion", object_id=question.id,
    ))

    automation.dispatch_event(
        db, automation.events.PATIENT_QUESTION_CREATED, episode_id=episode.id, actor_user_id=current_user.id,
        source_type="PatientQuestion", source_id=question.id, payload={"questionText": text},
    )
    if earlier is not None:
        # The note says she asked a follow-up, not what she wrote.
        doctor_notices.tell_doctors(db, episode, "question_followup", related_type="PatientQuestion", related_id=question.id)

    db.commit()
    db.refresh(question)
    return _to_question_out(question)


# ---------- Appointments ----------

@router.get("/appointments", response_model=list[schemas_v2.AppointmentOut])
def list_my_appointments(
    episode: models.PregnancyEpisode = Depends(get_my_patient_episode),
    db: Session = Depends(get_db),
):
    doctor_name = _primary_doctor_name(db, episode.id)
    appointments = (
        db.query(models.Appointment)
        .filter(models.Appointment.episode_id == episode.id)
        .order_by(models.Appointment.scheduled_at.asc())
        .all()
    )
    return [
        schemas_v2.AppointmentOut(
            id=a.id, scheduled_at=a.scheduled_at, appointment_type=a.appointment_type,
            location=a.location, status=a.status, doctor_name=doctor_name, change_request=_change_request_out(a),
        )
        for a in appointments
        if not (a.status == "cancelled" and (a.notes or "").endswith(visit_changes.WITHDRAWN_MARK))  # her own withdrawn request for a new time
    ]


# ---------- Journey ----------

@router.get("/journey", response_model=list[schemas_v2.JourneyEventOut])
def list_my_journey(
    episode: models.PregnancyEpisode = Depends(get_my_patient_episode),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # A journey entry exists only because a doctor (or the assistant, after the doctor approved it) verified a document, approved a note or
    # released a document: see models/journey.py. Nothing here reads a draft.
    events = (
        db.query(models.JourneyEvent)
        .filter(models.JourneyEvent.episode_id == episode.id)
        .order_by(models.JourneyEvent.event_date.desc())
        .all()
    )
    language = server_text.language_of(db, current_user.id)
    entries = []
    for event in events:
        entry = schemas_v2.JourneyEventOut.model_validate(event)
        # Only what the shorthand stands for, from the reviewed glossary: never what a result means for her.
        _, used = explain_terms(f"{event.title}\n{event.summary or ''}", language)
        entry.words = [schemas_v2.WordMeaningOut(term=term, meaning=meaning) for term, meaning in used]
        entries.append(entry)
    return entries


# ---------- Updates (notifications) ----------

@router.get("/updates", response_model=list[schemas_v2.NotificationOut])
def list_my_updates(
    current_user: models.User = Depends(require_role("patient")),
    db: Session = Depends(get_db),
):
    notifications = (
        db.query(models.Notification)
        .filter(models.Notification.recipient_user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .all()
    )
    return [server_text.notification_out(db, current_user, n) for n in notifications]


@router.patch("/updates/{notification_id}/read", response_model=schemas_v2.NotificationOut)
def mark_my_update_read(
    notification_id: str,
    current_user: models.User = Depends(require_role("patient")),
    db: Session = Depends(get_db),
):
    notification = (
        db.query(models.Notification)
        .filter(models.Notification.id == notification_id, models.Notification.recipient_user_id == current_user.id)
        .first()
    )
    if notification is None:
        raise HTTPException(status_code=404, detail="Update not found.")
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return server_text.notification_out(db, current_user, notification)


# ---------- Profile ----------

@router.get("/profile", response_model=schemas_v2.PatientProfileOut)
def get_my_patient_profile(
    current_user: models.User = Depends(require_role("patient")),
    db: Session = Depends(get_db),
):
    profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == current_user.id).first()
    return schemas_v2.PatientProfileOut(
        full_name=current_user.full_name,
        email=current_user.email,
        date_of_birth=profile.date_of_birth if profile else None,
        mrn=profile.mrn if profile else None,
        phone=profile.phone if profile else None,
    )


@router.patch("/profile", response_model=schemas_v2.PatientProfileOut)
def update_my_patient_profile(
    payload: schemas_v2.PatientProfileUpdateIn,
    current_user: models.User = Depends(require_role("patient")),
    db: Session = Depends(get_db),
):
    profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == current_user.id).first()
    if profile is None:
        profile = models.PatientProfile(user_id=current_user.id)
        db.add(profile)

    if payload.full_name is not None and payload.full_name.strip():
        current_user.full_name = payload.full_name.strip()
    if payload.phone is not None:
        profile.phone = payload.phone.strip() or None
    if payload.date_of_birth is not None:
        profile.date_of_birth = payload.date_of_birth.strip() or None

    db.commit()
    db.refresh(current_user)
    db.refresh(profile)

    return schemas_v2.PatientProfileOut(
        full_name=current_user.full_name,
        email=current_user.email,
        date_of_birth=profile.date_of_birth,
        mrn=profile.mrn,
        phone=profile.phone,
    )
