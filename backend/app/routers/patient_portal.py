"""Patient-facing API for the new role-based system.

Every route here resolves "my episode" server-side from the authenticated
user's id (see deps.get_my_patient_episode) rather than from any
client-supplied id — there is no episode/patient id in these URLs for a
patient to tamper with. The one sub-resource with its own id (document
file download) re-derives the episode the same way and scopes its query
to it, so a cross-patient id simply doesn't match (404), never 200s.
"""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .. import extraction, models, schemas_v2
from ..config import UPLOAD_DIR
from ..database import get_db
from ..deps import get_current_user, get_my_patient_episode, require_role

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
    )


def _to_question_out(question: models.PatientQuestion) -> schemas_v2.PatientQuestionOut:
    visible_responses = [r for r in question.responses if r.status == "APPROVED" and r.visible_to_patient]
    return schemas_v2.PatientQuestionOut(
        id=question.id,
        question_text=question.question_text,
        status=question.status,
        created_at=question.created_at,
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
    return doctor.full_name if doctor else None


# ---------- Dashboard ----------

@router.get("/dashboard", response_model=schemas_v2.PatientDashboardOut)
def get_my_dashboard(
    episode: models.PregnancyEpisode = Depends(get_my_patient_episode),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    next_appt = (
        db.query(models.Appointment)
        .filter(models.Appointment.episode_id == episode.id, models.Appointment.status == "scheduled")
        .order_by(models.Appointment.scheduled_at.asc())
        .first()
    )
    doctor_name = _primary_doctor_name(db, episode.id)
    next_appointment_out = None
    if next_appt:
        next_appointment_out = schemas_v2.AppointmentOut(
            id=next_appt.id, scheduled_at=next_appt.scheduled_at, appointment_type=next_appt.appointment_type,
            location=next_appt.location, status=next_appt.status, doctor_name=doctor_name,
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
    episode: models.PregnancyEpisode = Depends(get_my_patient_episode),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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

    question = models.PatientQuestion(
        episode_id=episode.id, asked_by_user_id=current_user.id, question_text=text, status="NEW",
    )
    db.add(question)
    db.flush()

    db.add(models.AuditLog(
        episode_id=episode.id, actor_user_id=current_user.id, actor_role=current_user.role,
        actor_display_name=current_user.full_name, action="question_asked",
        title=f"{current_user.full_name} submitted a question",
        details=text[:200], object_type="PatientQuestion", object_id=question.id,
    ))

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
            location=a.location, status=a.status, doctor_name=doctor_name,
        )
        for a in appointments
    ]


# ---------- Journey ----------

@router.get("/journey", response_model=list[schemas_v2.JourneyEventOut])
def list_my_journey(
    episode: models.PregnancyEpisode = Depends(get_my_patient_episode),
    db: Session = Depends(get_db),
):
    events = (
        db.query(models.JourneyEvent)
        .filter(models.JourneyEvent.episode_id == episode.id)
        .order_by(models.JourneyEvent.event_date.desc())
        .all()
    )
    return [schemas_v2.JourneyEventOut.model_validate(e) for e in events]


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
    return [schemas_v2.NotificationOut.model_validate(n) for n in notifications]


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
    return schemas_v2.NotificationOut.model_validate(notification)


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
