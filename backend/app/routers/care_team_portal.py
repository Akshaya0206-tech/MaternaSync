"""Care-team-facing API for the new role-based system.

The Care Team operates across MULTIPLE assigned patients (unlike the
Patient Portal's single "my own episode" model), so the security pattern
here is: every list/aggregate query is filtered to
`_assigned_episode_ids()` (re-derived server-side from
PatientCareTeamAssignment on every request), and every single-resource
route re-checks the fetched object's episode_id against that same set
before returning anything. A client-supplied episode_id/document_id/etc.
that doesn't belong to an assigned episode is rejected (403/404), never
silently trusted — this is what Step 5's IDOR tests exercise directly.

Care Team never resolves a clinical question or approves a document on
its own clinical merit beyond coordination-level verification; clinical
judgment routes to the assigned doctor (send-to-doctor / assign-doctor),
consistent with the rest of the system's AI/role governance.
"""

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .. import extraction, models, schemas_v2
from ..config import UPLOAD_DIR
from ..database import get_db
from ..deps import get_current_user, require_episode_access, require_role
from ..referral_communication import ReferralCommunicationService, ReferralTransitionError

router = APIRouter(prefix="/api/v2/care-team", tags=["care-team-portal"])

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".bmp"}
OPEN_TASK_STATUSES = ("OPEN", "IN_PROGRESS", "WAITING")
OPEN_QUESTION_STATUSES = ("NEW", "ASSIGNED", "WAITING_FOR_RESPONSE")
OPEN_REFERRAL_STATUSES = ("DRAFT", "SENT", "ACKNOWLEDGED", "APPOINTMENT_SCHEDULED", "RESPONSE_RECEIVED")


# ---------- shared helpers ----------

def _assigned_episode_ids(db: Session, current_user: models.User) -> list[str]:
    rows = (
        db.query(models.PatientCareTeamAssignment.episode_id)
        .filter(models.PatientCareTeamAssignment.care_team_user_id == current_user.id)
        .all()
    )
    return [r[0] for r in rows]


def _require_assigned_episode(db: Session, current_user: models.User, episode_id: str) -> models.PregnancyEpisode:
    episode = db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.id == episode_id).first()
    if episode is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    assigned = db.query(models.PatientCareTeamAssignment).filter(
        models.PatientCareTeamAssignment.episode_id == episode_id,
        models.PatientCareTeamAssignment.care_team_user_id == current_user.id,
    ).first()
    if assigned is None:
        raise HTTPException(status_code=403, detail="You are not assigned to this patient.")
    return episode


def _primary_doctor(db: Session, episode_id: str) -> models.User | None:
    assignment = db.query(models.PatientDoctorAssignment).filter(
        models.PatientDoctorAssignment.episode_id == episode_id,
        models.PatientDoctorAssignment.is_primary == True,  # noqa: E712
    ).first()
    if not assignment:
        return None
    return db.query(models.User).filter(models.User.id == assignment.doctor_user_id).first()


def _user_name(db: Session, user_id: str | None) -> str | None:
    if not user_id:
        return None
    user = db.query(models.User).filter(models.User.id == user_id).first()
    return user.full_name if user else None


def _episode_name(db: Session, episode_id: str) -> str:
    episode = db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.id == episode_id).first()
    return episode.patient_name if episode else "Unknown Patient"


def _log(db: Session, episode_id: str, current_user: models.User, action: str, title: str, details: str,
          object_type: str, object_id: str) -> None:
    db.add(models.AuditLog(
        episode_id=episode_id, actor_user_id=current_user.id, actor_role=current_user.role,
        actor_display_name=current_user.full_name, action=action, title=title, details=details,
        object_type=object_type, object_id=object_id,
    ))


# ---------- documents ----------

def _extraction_out(ext: models.DocumentExtraction | None) -> schemas_v2.ExtractionOut | None:
    if ext is None:
        return None
    nf = schemas_v2.NOT_FOUND
    return schemas_v2.ExtractionOut(
        record_type=ext.record_type or nf,
        visit_type=ext.visit_type or nf,
        event_date=ext.event_date or nf,
        facility=ext.facility or nf,
        provider=ext.provider or nf,
        department=ext.department or nf,
        patient_name_found=ext.patient_name_found or nf,
        mrn_found=ext.mrn_found or nf,
        gestational_age=ext.gestational_age or nf,
        field_status=ext.field_status or {},
    )


def _document_out(db: Session, doc: models.MedicalDocument) -> schemas_v2.CareTeamDocumentOut:
    uploader = db.query(models.User).filter(models.User.id == doc.uploaded_by_user_id).first()
    reviews = db.query(models.DocumentReview).filter(models.DocumentReview.document_id == doc.id).order_by(models.DocumentReview.reviewed_at.asc()).all()
    return schemas_v2.CareTeamDocumentOut(
        id=doc.id, episode_id=doc.episode_id, patient_name=_episode_name(db, doc.episode_id),
        filename=doc.filename, description=doc.description, document_date=doc.document_date,
        uploaded_by_name=uploader.full_name if uploader else "Unknown",
        uploaded_by_role=doc.uploaded_by_role, uploaded_at=doc.uploaded_at,
        status=doc.status, status_label=schemas_v2.DOCUMENT_STATUS_LABELS.get(doc.status, doc.status),
        extraction=_extraction_out(doc.extraction),
        reviews=[
            schemas_v2.DocumentReviewOut(
                id=r.id, action=r.action, reviewer_name=_user_name(db, r.reviewer_user_id) or "Unknown",
                reviewer_role=r.reviewer_role, notes=r.notes, reviewed_at=r.reviewed_at,
            )
            for r in reviews
        ],
    )


@router.get("/documents", response_model=list[schemas_v2.CareTeamDocumentOut])
def list_documents(
    episode_id: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    current_user: models.User = Depends(require_role("care_team")),
    db: Session = Depends(get_db),
):
    assigned_ids = _assigned_episode_ids(db, current_user)
    if episode_id:
        if episode_id not in assigned_ids:
            raise HTTPException(status_code=403, detail="You are not assigned to this patient.")
        assigned_ids = [episode_id]
    if not assigned_ids:
        return []

    q = db.query(models.MedicalDocument).filter(models.MedicalDocument.episode_id.in_(assigned_ids))
    if status_filter:
        q = q.filter(models.MedicalDocument.status == status_filter)
    documents = q.order_by(models.MedicalDocument.uploaded_at.desc()).all()
    return [_document_out(db, d) for d in documents]


def _get_assigned_document(db: Session, current_user: models.User, document_id: str) -> models.MedicalDocument:
    document = db.query(models.MedicalDocument).filter(models.MedicalDocument.id == document_id).first()
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    if document.episode_id not in _assigned_episode_ids(db, current_user):
        raise HTTPException(status_code=403, detail="You are not assigned to this patient.")
    return document


@router.get("/documents/{document_id}", response_model=schemas_v2.CareTeamDocumentOut)
def get_document(document_id: str, current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db)):
    document = _get_assigned_document(db, current_user, document_id)
    return _document_out(db, document)


@router.get("/documents/{document_id}/file")
def get_document_file(document_id: str, current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db)):
    document = _get_assigned_document(db, current_user, document_id)
    file_path = UPLOAD_DIR / document.file_path
    if not document.file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Source file not found on server.")
    return FileResponse(file_path, filename=document.filename)


@router.patch("/documents/{document_id}", response_model=schemas_v2.CareTeamDocumentOut)
def edit_document(
    document_id: str, payload: schemas_v2.DocumentEditIn,
    current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db),
):
    document = _get_assigned_document(db, current_user, document_id)
    if payload.description is not None:
        document.description = payload.description.strip() or None
    if payload.document_date is not None:
        document.document_date = payload.document_date.strip() or None

    ext = document.extraction
    if ext is not None:
        for field in ("record_type", "visit_type", "event_date", "facility", "provider", "department", "patient_name_found", "mrn_found", "gestational_age"):
            value = getattr(payload, field)
            if value is not None:
                setattr(ext, field, value.strip() or None)

    db.add(models.DocumentReview(
        document_id=document.id, reviewer_user_id=current_user.id, reviewer_role=current_user.role,
        action="EDIT", reviewed_at=datetime.now(timezone.utc),
    ))
    _log(db, document.episode_id, current_user, "document_edited", f"Document \"{document.filename}\" edited",
          "Care team corrected or completed extracted fields.", "MedicalDocument", document.id)
    db.commit()
    db.refresh(document)
    return _document_out(db, document)


@router.post("/documents/{document_id}/verify", response_model=schemas_v2.CareTeamDocumentOut)
def verify_document(
    document_id: str, payload: schemas_v2.ReviewNoteIn = schemas_v2.ReviewNoteIn(),
    current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db),
):
    document = _get_assigned_document(db, current_user, document_id)
    episode = db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.id == document.episode_id).first()
    document.status = "VERIFIED"

    db.add(models.DocumentReview(
        document_id=document.id, reviewer_user_id=current_user.id, reviewer_role=current_user.role,
        action="VERIFY", notes=payload.notes, reviewed_at=datetime.now(timezone.utc),
    ))

    ext = document.extraction
    db.add(models.JourneyEvent(
        episode_id=document.episode_id, event_type="document", source_document_id=document.id,
        title=(ext.record_type if ext and ext.record_type else document.filename),
        summary=document.description or "",
        event_date=document.document_date or (ext.event_date if ext else None) or datetime.now(timezone.utc).date().isoformat(),
        gestational_age_weeks=episode.gestational_age_weeks if episode else 0,
        gestational_age_days=episode.gestational_age_days if episode else 0,
    ))

    db.add(models.Notification(
        recipient_user_id=document.uploaded_by_user_id, episode_id=document.episode_id, type="document_verified",
        title="Your care team reviewed your uploaded documents", body="Your journey has been updated.",
        related_entity_type="MedicalDocument", related_entity_id=document.id,
    ))

    _log(db, document.episode_id, current_user, "document_verified", f"Document \"{document.filename}\" verified",
          "Added to the patient's journey.", "MedicalDocument", document.id)
    db.commit()
    db.refresh(document)
    return _document_out(db, document)


@router.post("/documents/{document_id}/reject", response_model=schemas_v2.CareTeamDocumentOut)
def reject_document(
    document_id: str, payload: schemas_v2.ReviewNoteIn = schemas_v2.ReviewNoteIn(),
    current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db),
):
    document = _get_assigned_document(db, current_user, document_id)
    document.status = "REJECTED"
    db.add(models.DocumentReview(
        document_id=document.id, reviewer_user_id=current_user.id, reviewer_role=current_user.role,
        action="REJECT", notes=payload.notes, reviewed_at=datetime.now(timezone.utc),
    ))
    _log(db, document.episode_id, current_user, "document_rejected", f"Document \"{document.filename}\" rejected",
          payload.notes or "Rejected by care team review.", "MedicalDocument", document.id)
    db.commit()
    db.refresh(document)
    return _document_out(db, document)


@router.post("/documents/{document_id}/send-to-doctor", response_model=schemas_v2.CareTeamDocumentOut)
def send_document_to_doctor(
    document_id: str, payload: schemas_v2.ReviewNoteIn = schemas_v2.ReviewNoteIn(),
    current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db),
):
    document = _get_assigned_document(db, current_user, document_id)
    db.add(models.DocumentReview(
        document_id=document.id, reviewer_user_id=current_user.id, reviewer_role=current_user.role,
        action="SEND_TO_DOCTOR", notes=payload.notes, reviewed_at=datetime.now(timezone.utc),
    ))

    doctor = _primary_doctor(db, document.episode_id)
    if doctor:
        db.add(models.Notification(
            recipient_user_id=doctor.id, episode_id=document.episode_id, type="document_needs_clinical_review",
            title=f"Document needs clinical review: {document.filename}",
            body=payload.notes or "Care team routed this document for your review.",
            related_entity_type="MedicalDocument", related_entity_id=document.id,
        ))

    _log(db, document.episode_id, current_user, "document_sent_to_doctor", f"Document \"{document.filename}\" sent to doctor",
          payload.notes or "Routed for clinical review.", "MedicalDocument", document.id)
    db.commit()
    db.refresh(document)
    return _document_out(db, document)


@router.post("/episodes/{episode_id}/documents", response_model=schemas_v2.CareTeamDocumentOut)
async def upload_document_fallback(
    episode_id: str,
    file: UploadFile = File(...),
    description: str | None = Form(None),
    document_date: str | None = Form(None),
    episode: models.PregnancyEpisode = Depends(require_episode_access),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "care_team":
        raise HTTPException(status_code=403, detail="Only care team members can use this fallback upload.")

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
        episode_id=episode.id, uploaded_by_user_id=current_user.id, uploaded_by_role=current_user.role,
        filename=file.filename or stored_name, file_path=stored_name,
        document_date=document_date or None, description=description or "Uploaded by care team (received outside the patient portal).",
        status="NEEDS_REVIEW",
    )
    db.add(document)
    db.flush()

    db.add(models.DocumentExtraction(
        document_id=document.id, raw_text=text[:20000],
        record_type=fields["recordType"]["value"] or derived["title"],
        visit_type=fields["visitType"]["value"], event_date=document_date or derived["timestamp"],
        facility=fields["facility"]["value"], provider=fields["responsibleDoctor"]["value"],
        patient_name_found=fields["patientName"]["value"], mrn_found=fields["mrn"]["value"],
        gestational_age=fields["gestationalAge"]["value"],
        field_status={key: value["status"] for key, value in fields.items()},
    ))

    _log(db, episode.id, current_user, "document_uploaded", f"{current_user.full_name} uploaded a document (fallback)",
          f"Filename: {file.filename}. Patient is the primary uploader; this is a fallback path.", "MedicalDocument", document.id)
    db.commit()
    db.refresh(document)
    return _document_out(db, document)


# ---------- patients ----------

@router.get("/patients", response_model=list[schemas_v2.CareTeamPatientRowOut])
def list_patients(current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db)):
    assigned_ids = _assigned_episode_ids(db, current_user)
    if not assigned_ids:
        return []
    episodes = db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.id.in_(assigned_ids)).all()

    rows = []
    for ep in episodes:
        last_activity = (
            db.query(models.AuditLog.timestamp)
            .filter(models.AuditLog.episode_id == ep.id)
            .order_by(models.AuditLog.timestamp.desc())
            .first()
        )
        open_tasks = db.query(models.Task).filter(models.Task.episode_id == ep.id, models.Task.status.in_(OPEN_TASK_STATUSES)).count()
        open_questions = db.query(models.PatientQuestion).filter(models.PatientQuestion.episode_id == ep.id, models.PatientQuestion.status.in_(OPEN_QUESTION_STATUSES)).count()
        docs_needing_review = db.query(models.MedicalDocument).filter(models.MedicalDocument.episode_id == ep.id, models.MedicalDocument.status == "NEEDS_REVIEW").count()

        rows.append(schemas_v2.CareTeamPatientRowOut(
            episode_id=ep.id, patient_name=ep.patient_name, age=ep.age, edd=ep.edd,
            last_activity=last_activity[0] if last_activity else None,
            open_tasks=open_tasks, open_questions=open_questions, documents_needing_review=docs_needing_review,
        ))

    rows.sort(key=lambda r: r.patient_name)
    return rows


@router.get("/episodes/{episode_id}/journey", response_model=list[schemas_v2.JourneyEventOut])
def episode_journey(episode: models.PregnancyEpisode = Depends(require_episode_access), db: Session = Depends(get_db)):
    events = db.query(models.JourneyEvent).filter(models.JourneyEvent.episode_id == episode.id).order_by(models.JourneyEvent.event_date.desc()).all()
    return [schemas_v2.JourneyEventOut.model_validate(e) for e in events]


@router.get("/episodes/{episode_id}/appointments", response_model=list[schemas_v2.AppointmentOut])
def episode_appointments(episode: models.PregnancyEpisode = Depends(require_episode_access), db: Session = Depends(get_db)):
    doctor = _primary_doctor_user(db, episode.id)
    appointments = db.query(models.Appointment).filter(models.Appointment.episode_id == episode.id).order_by(models.Appointment.scheduled_at.asc()).all()
    return [
        schemas_v2.AppointmentOut(
            id=a.id, scheduled_at=a.scheduled_at, appointment_type=a.appointment_type,
            location=a.location, status=a.status, doctor_name=doctor.full_name if doctor else None,
        )
        for a in appointments
    ]


def _primary_doctor_user(db: Session, episode_id: str) -> models.User | None:
    return _primary_doctor(db, episode_id)


# ---------- questions ----------

def _question_out(db: Session, q: models.PatientQuestion) -> schemas_v2.CareTeamQuestionOut:
    return schemas_v2.CareTeamQuestionOut(
        id=q.id, episode_id=q.episode_id, patient_name=_episode_name(db, q.episode_id),
        question_text=q.question_text, status=q.status, is_clinical=q.is_clinical,
        assigned_to_name=_user_name(db, q.assigned_to_user_id), created_at=q.created_at,
        responses=[
            schemas_v2.QuestionResponseOut(id=r.id, response_text=r.response_text, responder_role=r.responder_role, created_at=r.created_at)
            for r in q.responses
        ],
    )


def _get_assigned_question(db: Session, current_user: models.User, question_id: str) -> models.PatientQuestion:
    question = db.query(models.PatientQuestion).filter(models.PatientQuestion.id == question_id).first()
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found.")
    if question.episode_id not in _assigned_episode_ids(db, current_user):
        raise HTTPException(status_code=403, detail="You are not assigned to this patient.")
    return question


@router.get("/questions", response_model=list[schemas_v2.CareTeamQuestionOut])
def list_questions(
    episode_id: str | None = Query(None),
    current_user: models.User = Depends(require_role("care_team")),
    db: Session = Depends(get_db),
):
    assigned_ids = _assigned_episode_ids(db, current_user)
    if episode_id:
        if episode_id not in assigned_ids:
            raise HTTPException(status_code=403, detail="You are not assigned to this patient.")
        assigned_ids = [episode_id]
    if not assigned_ids:
        return []
    questions = db.query(models.PatientQuestion).filter(models.PatientQuestion.episode_id.in_(assigned_ids)).order_by(models.PatientQuestion.created_at.desc()).all()
    return [_question_out(db, q) for q in questions]


@router.post("/episodes/{episode_id}/questions", response_model=schemas_v2.CareTeamQuestionOut)
def log_question_on_behalf_of_patient(
    payload: schemas_v2.QuestionCreateIn,
    episode: models.PregnancyEpisode = Depends(require_episode_access),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Care team logging a question the patient asked outside the portal
    (phone call, in person). Recorded as the patient's question — the
    episode's own patient_user_id, never anything client-supplied — with
    an audit trail noting who actually logged it."""
    if current_user.role != "care_team":
        raise HTTPException(status_code=403, detail="Only care team members can log a question this way.")

    text = payload.question_text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Please write the question before submitting.")

    question = models.PatientQuestion(
        episode_id=episode.id, asked_by_user_id=episode.patient_user_id, question_text=text, status="NEW",
    )
    db.add(question)
    db.flush()
    _log(db, episode.id, current_user, "question_logged", f"{current_user.full_name} logged a question on the patient's behalf",
          text[:200], "PatientQuestion", question.id)
    db.commit()
    db.refresh(question)
    return _question_out(db, question)


@router.post("/questions/{question_id}/respond", response_model=schemas_v2.CareTeamQuestionOut)
def respond_to_question(
    question_id: str, payload: schemas_v2.QuestionRespondIn,
    current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db),
):
    question = _get_assigned_question(db, current_user, question_id)
    text = payload.response_text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Please write a response before submitting.")

    db.add(models.QuestionResponse(
        question_id=question.id, responder_user_id=current_user.id, responder_role=current_user.role,
        response_text=text, status="APPROVED", approved_by_user_id=current_user.id,
        approved_at=datetime.now(timezone.utc), visible_to_patient=True,
    ))
    question.status = "ANSWERED"

    db.add(models.Notification(
        recipient_user_id=question.asked_by_user_id, episode_id=question.episode_id, type="question_answered",
        title="Your care team answered your question", body=text[:200],
        related_entity_type="PatientQuestion", related_entity_id=question.id,
    ))
    _log(db, question.episode_id, current_user, "question_answered", "Care team responded to a patient question",
          text[:200], "PatientQuestion", question.id)
    db.commit()
    db.refresh(question)
    return _question_out(db, question)


@router.post("/questions/{question_id}/assign-doctor", response_model=schemas_v2.CareTeamQuestionOut)
def assign_question_to_doctor(
    question_id: str, current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db),
):
    question = _get_assigned_question(db, current_user, question_id)
    doctor = _primary_doctor(db, question.episode_id)
    if doctor is None:
        raise HTTPException(status_code=422, detail="No doctor is assigned to this patient yet.")

    question.status = "ASSIGNED"
    question.is_clinical = True
    question.assigned_to_user_id = doctor.id

    db.add(models.Notification(
        recipient_user_id=doctor.id, episode_id=question.episode_id, type="clinical_question_assigned",
        title="A clinical question needs your response", body=question.question_text[:200],
        related_entity_type="PatientQuestion", related_entity_id=question.id,
    ))
    _log(db, question.episode_id, current_user, "question_assigned", "Clinical question routed to doctor",
          question.question_text[:200], "PatientQuestion", question.id)
    db.commit()
    db.refresh(question)
    return _question_out(db, question)


@router.post("/questions/{question_id}/close", response_model=schemas_v2.CareTeamQuestionOut)
def close_question(question_id: str, current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db)):
    question = _get_assigned_question(db, current_user, question_id)
    question.status = "CLOSED"
    _log(db, question.episode_id, current_user, "question_closed", "Question closed", question.question_text[:200], "PatientQuestion", question.id)
    db.commit()
    db.refresh(question)
    return _question_out(db, question)


# ---------- tasks ----------

def _task_out(db: Session, t: models.Task) -> schemas_v2.TaskOut:
    return schemas_v2.TaskOut(
        id=t.id, episode_id=t.episode_id, patient_name=_episode_name(db, t.episode_id),
        title=t.title, description=t.description or "", owner_name=_user_name(db, t.owner_user_id),
        created_by_name=_user_name(db, t.created_by_user_id) or "Unknown",
        due_date=t.due_date, priority=t.priority, status=t.status, source_type=t.source_type, source_id=t.source_id,
        waiting_for=t.waiting_for, waiting_since=t.waiting_since, created_at=t.created_at,
    )


def _get_assigned_task(db: Session, current_user: models.User, task_id: str) -> models.Task:
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found.")
    if task.episode_id not in _assigned_episode_ids(db, current_user):
        raise HTTPException(status_code=403, detail="You are not assigned to this patient.")
    return task


@router.get("/tasks", response_model=list[schemas_v2.TaskOut])
def list_tasks(
    episode_id: str | None = Query(None), status_filter: str | None = Query(None, alias="status"),
    current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db),
):
    assigned_ids = _assigned_episode_ids(db, current_user)
    if episode_id:
        if episode_id not in assigned_ids:
            raise HTTPException(status_code=403, detail="You are not assigned to this patient.")
        assigned_ids = [episode_id]
    if not assigned_ids:
        return []
    q = db.query(models.Task).filter(models.Task.episode_id.in_(assigned_ids))
    if status_filter:
        q = q.filter(models.Task.status == status_filter)
    tasks = q.order_by(models.Task.created_at.desc()).all()
    return [_task_out(db, t) for t in tasks]


@router.post("/tasks", response_model=schemas_v2.TaskOut)
def create_task(payload: schemas_v2.TaskCreateIn, current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db)):
    _require_assigned_episode(db, current_user, payload.episode_id)
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Please give the task a title.")

    existing = db.query(models.Task).filter(
        models.Task.episode_id == payload.episode_id, models.Task.title == title,
        models.Task.status.in_(OPEN_TASK_STATUSES),
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="An open task with this title already exists for this patient.")

    task = models.Task(
        episode_id=payload.episode_id, title=title, description=(payload.description or "").strip(),
        owner_user_id=payload.owner_user_id, created_by_user_id=current_user.id,
        due_date=payload.due_date, priority=payload.priority or "routine", status="OPEN", source_type="manual",
    )
    db.add(task)
    db.flush()
    if payload.owner_user_id:
        db.add(models.TaskAssignment(task_id=task.id, assigned_to_user_id=payload.owner_user_id, assigned_by_user_id=current_user.id))

    _log(db, task.episode_id, current_user, "task_created", f"Task created: {title}", payload.description or "", "Task", task.id)
    db.commit()
    db.refresh(task)
    return _task_out(db, task)


@router.patch("/tasks/{task_id}", response_model=schemas_v2.TaskOut)
def update_task(task_id: str, payload: schemas_v2.TaskUpdateIn, current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db)):
    task = _get_assigned_task(db, current_user, task_id)

    if payload.title is not None and payload.title.strip():
        task.title = payload.title.strip()
    if payload.description is not None:
        task.description = payload.description
    if payload.due_date is not None:
        task.due_date = payload.due_date or None
    if payload.priority is not None:
        task.priority = payload.priority
    if payload.owner_user_id is not None and payload.owner_user_id != task.owner_user_id:
        task.owner_user_id = payload.owner_user_id or None
        if payload.owner_user_id:
            db.add(models.TaskAssignment(task_id=task.id, assigned_to_user_id=payload.owner_user_id, assigned_by_user_id=current_user.id))
        _log(db, task.episode_id, current_user, "task_assigned", f"Task reassigned: {task.title}", "", "Task", task.id)
    if payload.status is not None and payload.status != task.status:
        task.status = payload.status
        _log(db, task.episode_id, current_user, "task_status_changed", f"Task \"{task.title}\" set to {payload.status}", "", "Task", task.id)

    task.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)
    return _task_out(db, task)


# ---------- referrals ----------
# Referrals are created by the assigned Doctor (see routers/doctor_portal.py)
# — Care Team coordinates an existing referral through its lifecycle, it
# does not originate one. Every status transition below goes through
# ReferralCommunicationService, never a raw status write, so the state
# machine/task automation/notifications/audit trail stay consistent with
# what the External Hospital Simulator produces.

def _referral_out(db: Session, r: models.Referral) -> schemas_v2.ReferralOut:
    task = db.query(models.Task).filter(models.Task.source_type == "referral", models.Task.source_id == r.id).first()
    return schemas_v2.ReferralOut(
        id=r.id, reference_code=r.reference_code, episode_id=r.episode_id, patient_name=_episode_name(db, r.episode_id),
        title=r.title, description=r.description or "", referred_to=r.referred_to, destination=r.destination,
        status=r.status, owner_name=_user_name(db, r.owner_user_id), due_date=r.due_date,
        waiting_for=task.waiting_for if task else None, waiting_since=task.waiting_since if task else None,
        sent_at=r.sent_at, acknowledged_at=r.acknowledged_at, appointment_date=r.appointment_date,
        appointment_time=r.appointment_time, external_provider=r.external_provider,
        response_received_at=r.response_received_at, doctor_reviewed_at=r.doctor_reviewed_at, created_at=r.created_at,
    )


def _referral_detail_out(db: Session, r: models.Referral) -> schemas_v2.ReferralDetailOut:
    task = db.query(models.Task).filter(models.Task.source_type == "referral", models.Task.source_id == r.id).first()
    events = db.query(models.ReferralEvent).filter(models.ReferralEvent.referral_id == r.id).order_by(models.ReferralEvent.created_at.asc()).all()
    comms = db.query(models.Communication).filter(models.Communication.related_referral_id == r.id).order_by(models.Communication.created_at.asc()).all()
    documents = db.query(models.MedicalDocument).filter(models.MedicalDocument.referral_id == r.id).order_by(models.MedicalDocument.uploaded_at.desc()).all()
    return schemas_v2.ReferralDetailOut(
        referral=_referral_out(db, r),
        events=[
            schemas_v2.ReferralEventOut(id=e.id, from_status=e.from_status, to_status=e.to_status, note=e.note,
                                         actor_name=_user_name(db, e.actor_user_id), actor_source=e.actor_source or "MANUAL_ENTRY",
                                         created_at=e.created_at)
            for e in events
        ],
        communications=[
            schemas_v2.CommunicationEventOut(id=c.id, type=c.type, direction=c.direction, sender_label=c.sender_label,
                                              recipient_label=c.recipient_label, subject=c.subject, content=c.content,
                                              status=c.status, source=c.source, external_reference=c.external_reference,
                                              created_at=c.created_at, received_at=c.received_at)
            for c in comms
        ],
        related_task=_task_out(db, task) if task else None,
        documents=[
            schemas_v2.PatientDocumentOut(id=d.id, filename=d.filename, status=d.status,
                                           status_label=schemas_v2.DOCUMENT_STATUS_LABELS.get(d.status, d.status),
                                           document_date=d.document_date, description=d.description, uploaded_at=d.uploaded_at)
            for d in documents
        ],
    )


def _get_assigned_referral(db: Session, current_user: models.User, referral_id: str) -> models.Referral:
    referral = db.query(models.Referral).filter(models.Referral.id == referral_id).first()
    if referral is None:
        raise HTTPException(status_code=404, detail="Referral not found.")
    if referral.episode_id not in _assigned_episode_ids(db, current_user):
        raise HTTPException(status_code=403, detail="You are not assigned to this patient.")
    return referral


@router.get("/referrals", response_model=list[schemas_v2.ReferralOut])
def list_referrals(
    episode_id: str | None = Query(None), status_filter: str | None = Query(None, alias="status"),
    current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db),
):
    assigned_ids = _assigned_episode_ids(db, current_user)
    if episode_id:
        if episode_id not in assigned_ids:
            raise HTTPException(status_code=403, detail="You are not assigned to this patient.")
        assigned_ids = [episode_id]
    if not assigned_ids:
        return []
    q = db.query(models.Referral).filter(models.Referral.episode_id.in_(assigned_ids))
    if status_filter:
        q = q.filter(models.Referral.status == status_filter)
    referrals = q.order_by(models.Referral.created_at.desc()).all()
    return [_referral_out(db, r) for r in referrals]


@router.get("/referrals/{referral_id}", response_model=schemas_v2.ReferralDetailOut)
def get_referral(referral_id: str, current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db)):
    referral = _get_assigned_referral(db, current_user, referral_id)
    return _referral_detail_out(db, referral)


@router.patch("/referrals/{referral_id}", response_model=schemas_v2.ReferralOut)
def update_referral(referral_id: str, payload: schemas_v2.ReferralUpdateIn, current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db)):
    referral = _get_assigned_referral(db, current_user, referral_id)

    if payload.title is not None and payload.title.strip():
        referral.title = payload.title.strip()
    if payload.description is not None:
        referral.description = payload.description
    if payload.referred_to is not None:
        referral.referred_to = payload.referred_to or None
    if payload.owner_user_id is not None:
        referral.owner_user_id = payload.owner_user_id or None
    if payload.due_date is not None:
        referral.due_date = payload.due_date or None

    db.commit()
    db.refresh(referral)
    return _referral_out(db, referral)


@router.post("/referrals/{referral_id}/send", response_model=schemas_v2.ReferralOut)
def send_referral(referral_id: str, current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db)):
    referral = _get_assigned_referral(db, current_user, referral_id)
    try:
        ReferralCommunicationService(db).send_referral(referral, current_user)
    except ReferralTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    db.commit()
    db.refresh(referral)
    return _referral_out(db, referral)


@router.post("/referrals/{referral_id}/acknowledge", response_model=schemas_v2.ReferralOut)
def acknowledge_referral(referral_id: str, payload: schemas_v2.AcknowledgeReferralIn, current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db)):
    referral = _get_assigned_referral(db, current_user, referral_id)
    try:
        ReferralCommunicationService(db).acknowledge(referral, source="MANUAL_ENTRY", actor=current_user,
                                                       external_reference=payload.external_reference, note=payload.note)
    except ReferralTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    db.commit()
    db.refresh(referral)
    return _referral_out(db, referral)


@router.post("/referrals/{referral_id}/appointment", response_model=schemas_v2.ReferralOut)
def record_referral_appointment(referral_id: str, payload: schemas_v2.RecordAppointmentIn, current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db)):
    referral = _get_assigned_referral(db, current_user, referral_id)
    try:
        ReferralCommunicationService(db).record_appointment(
            referral, payload.appointment_date, payload.appointment_time, payload.external_provider,
            source="MANUAL_ENTRY", actor=current_user,
        )
    except ReferralTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    db.commit()
    db.refresh(referral)
    return _referral_out(db, referral)


@router.post("/referrals/{referral_id}/response", response_model=schemas_v2.ReferralOut)
def record_referral_response(referral_id: str, payload: schemas_v2.RecordResponseIn, current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db)):
    referral = _get_assigned_referral(db, current_user, referral_id)
    text = payload.response_text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Please enter the response text.")
    try:
        ReferralCommunicationService(db).record_response(referral, text, source="MANUAL_ENTRY", actor=current_user)
    except ReferralTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    db.commit()
    db.refresh(referral)
    return _referral_out(db, referral)


@router.post("/referrals/{referral_id}/documents", response_model=schemas_v2.CareTeamDocumentOut)
async def upload_referral_document(
    referral_id: str, file: UploadFile = File(...), description: str | None = Form(None),
    current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db),
):
    referral = _get_assigned_referral(db, current_user, referral_id)
    episode = db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.id == referral.episode_id).first()

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
    document = models.MedicalDocument(
        episode_id=episode.id, uploaded_by_user_id=current_user.id, uploaded_by_role=current_user.role,
        filename=file.filename or stored_name, file_path=stored_name,
        description=description or f"Response document for referral {referral.reference_code}",
        status="NEEDS_REVIEW", referral_id=referral.id,
    )
    db.add(document)
    db.flush()
    db.add(models.DocumentExtraction(
        document_id=document.id, raw_text=text[:20000], record_type=fields["recordType"]["value"],
        field_status={key: value["status"] for key, value in fields.items()},
    ))
    _log(db, episode.id, current_user, "referral_document_attached",
          f"Response document attached to referral {referral.reference_code}", f"Filename: {file.filename}",
          "MedicalDocument", document.id)
    db.commit()
    db.refresh(document)
    return _document_out(db, document)


# ---------- handover ----------

def _handover_out(db: Session, h: models.Handover) -> schemas_v2.HandoverOut:
    return schemas_v2.HandoverOut(
        id=h.id, episode_id=h.episode_id, patient_name=_episode_name(db, h.episode_id),
        context=h.context, what_happened=h.what_happened, what_remains=h.what_remains,
        who_owns_it=h.who_owns_it, what_to_discuss=h.what_to_discuss, status=h.status,
        generated_by_ai=h.generated_by_ai, created_at=h.created_at,
    )


@router.get("/handover/{episode_id}", response_model=schemas_v2.HandoverOut | None)
def get_handover(episode: models.PregnancyEpisode = Depends(require_episode_access), db: Session = Depends(get_db)):
    handover = db.query(models.Handover).filter(models.Handover.episode_id == episode.id).order_by(models.Handover.created_at.desc()).first()
    return _handover_out(db, handover) if handover else None


@router.post("/handover/{episode_id}/generate", response_model=schemas_v2.HandoverOut)
def generate_handover(
    episode: models.PregnancyEpisode = Depends(require_episode_access),
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db),
):
    if current_user.role != "care_team":
        raise HTTPException(status_code=403, detail="Only care team members can generate a handover draft.")

    doctor = _primary_doctor(db, episode.id)

    recent_event = db.query(models.JourneyEvent).filter(models.JourneyEvent.episode_id == episode.id).order_by(models.JourneyEvent.event_date.desc()).first()
    what_happened = f"{recent_event.title} ({recent_event.event_date})." if recent_event else "No recent recorded activity."

    open_tasks = db.query(models.Task).filter(models.Task.episode_id == episode.id, models.Task.status.in_(OPEN_TASK_STATUSES)).count()
    open_referrals = db.query(models.Referral).filter(models.Referral.episode_id == episode.id, models.Referral.status.in_(OPEN_REFERRAL_STATUSES)).count()
    if open_tasks or open_referrals:
        what_remains = f"{open_tasks} open task(s), {open_referrals} pending referral(s)."
    else:
        what_remains = "Nothing outstanding."

    open_questions = db.query(models.PatientQuestion).filter(models.PatientQuestion.episode_id == episode.id, models.PatientQuestion.status.in_(OPEN_QUESTION_STATUSES)).count()
    what_to_discuss = f"{open_questions} patient question(s) pending response." if open_questions else "No pending patient questions."

    who_owns_it = f"{current_user.full_name} (coordination)" + (f", {doctor.full_name} (clinical)." if doctor else ".")

    handover = models.Handover(
        episode_id=episode.id,
        context=f"GA {episode.gestational_age_weeks}w{episode.gestational_age_days}d, risk: {episode.risk_category}.",
        what_happened=what_happened, what_remains=what_remains, who_owns_it=who_owns_it, what_to_discuss=what_to_discuss,
        status="DRAFT", generated_by_ai=True, created_by_user_id=current_user.id,
    )
    db.add(handover)
    db.flush()
    _log(db, episode.id, current_user, "handover_created", "Handover draft generated", "AI-assisted draft, pending review.", "Handover", handover.id)
    db.commit()
    db.refresh(handover)
    return _handover_out(db, handover)


@router.patch("/handover/{handover_id}", response_model=schemas_v2.HandoverOut)
def update_handover(handover_id: str, payload: schemas_v2.HandoverUpdateIn, current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db)):
    handover = db.query(models.Handover).filter(models.Handover.id == handover_id).first()
    if handover is None:
        raise HTTPException(status_code=404, detail="Handover not found.")
    if handover.episode_id not in _assigned_episode_ids(db, current_user):
        raise HTTPException(status_code=403, detail="You are not assigned to this patient.")

    for field in ("context", "what_happened", "what_remains", "who_owns_it", "what_to_discuss"):
        value = getattr(payload, field)
        if value is not None:
            setattr(handover, field, value)

    db.commit()
    db.refresh(handover)
    return _handover_out(db, handover)


@router.post("/handover/{handover_id}/share", response_model=schemas_v2.HandoverOut)
def share_handover(handover_id: str, current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db)):
    handover = db.query(models.Handover).filter(models.Handover.id == handover_id).first()
    if handover is None:
        raise HTTPException(status_code=404, detail="Handover not found.")
    if handover.episode_id not in _assigned_episode_ids(db, current_user):
        raise HTTPException(status_code=403, detail="You are not assigned to this patient.")

    handover.status = "FINAL"
    handover.approved_by_user_id = current_user.id
    handover.approved_at = datetime.now(timezone.utc)
    _log(db, handover.episode_id, current_user, "handover_shared", "Handover shared internally", "Visible to the care team and doctor.", "Handover", handover.id)
    db.commit()
    db.refresh(handover)
    return _handover_out(db, handover)


# ---------- updates (notifications) ----------

@router.get("/updates", response_model=list[schemas_v2.NotificationOut])
def list_updates(current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db)):
    notifications = db.query(models.Notification).filter(models.Notification.recipient_user_id == current_user.id).order_by(models.Notification.created_at.desc()).all()
    return [schemas_v2.NotificationOut.model_validate(n) for n in notifications]


@router.patch("/updates/{notification_id}/read", response_model=schemas_v2.NotificationOut)
def mark_update_read(notification_id: str, current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db)):
    notification = db.query(models.Notification).filter(
        models.Notification.id == notification_id, models.Notification.recipient_user_id == current_user.id,
    ).first()
    if notification is None:
        raise HTTPException(status_code=404, detail="Update not found.")
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return schemas_v2.NotificationOut.model_validate(notification)


# ---------- profile ----------

@router.get("/profile", response_model=schemas_v2.CareTeamProfileOut)
def get_profile(current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db)):
    profile = db.query(models.CareTeamProfile).filter(models.CareTeamProfile.user_id == current_user.id).first()
    return schemas_v2.CareTeamProfileOut(
        full_name=current_user.full_name, email=current_user.email, role=current_user.role,
        title=profile.title if profile else None, facility=profile.facility if profile else None,
    )


@router.patch("/profile", response_model=schemas_v2.CareTeamProfileOut)
def update_profile(payload: schemas_v2.CareTeamProfileUpdateIn, current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db)):
    profile = db.query(models.CareTeamProfile).filter(models.CareTeamProfile.user_id == current_user.id).first()
    if profile is None:
        profile = models.CareTeamProfile(user_id=current_user.id)
        db.add(profile)

    if payload.full_name is not None and payload.full_name.strip():
        current_user.full_name = payload.full_name.strip()
    if payload.title is not None:
        profile.title = payload.title.strip() or None
    if payload.facility is not None:
        profile.facility = payload.facility.strip() or None

    db.commit()
    db.refresh(current_user)
    db.refresh(profile)
    return schemas_v2.CareTeamProfileOut(
        full_name=current_user.full_name, email=current_user.email, role=current_user.role,
        title=profile.title, facility=profile.facility,
    )


# ---------- dashboard ----------

@router.get("/dashboard", response_model=schemas_v2.CareTeamDashboardOut)
def get_dashboard(current_user: models.User = Depends(require_role("care_team")), db: Session = Depends(get_db)):
    assigned_ids = _assigned_episode_ids(db, current_user)

    if not assigned_ids:
        return schemas_v2.CareTeamDashboardOut(
            full_name=current_user.full_name, active_patients=0, documents_to_review=0,
            patient_questions=0, open_tasks=0, pending_referrals=0, needs_attention=[],
        )

    documents_to_review = db.query(models.MedicalDocument).filter(
        models.MedicalDocument.episode_id.in_(assigned_ids), models.MedicalDocument.status == "NEEDS_REVIEW",
    ).order_by(models.MedicalDocument.uploaded_at.desc()).all()

    open_questions = db.query(models.PatientQuestion).filter(
        models.PatientQuestion.episode_id.in_(assigned_ids), models.PatientQuestion.status.in_(OPEN_QUESTION_STATUSES),
    ).order_by(models.PatientQuestion.created_at.desc()).all()

    open_tasks_q = db.query(models.Task).filter(models.Task.episode_id.in_(assigned_ids), models.Task.status.in_(OPEN_TASK_STATUSES))
    open_tasks = open_tasks_q.all()

    pending_referrals = db.query(models.Referral).filter(
        models.Referral.episode_id.in_(assigned_ids), models.Referral.status == "SENT",
    ).order_by(models.Referral.created_at.desc()).all()

    all_pending_referrals_count = db.query(models.Referral).filter(
        models.Referral.episode_id.in_(assigned_ids), models.Referral.status.in_(OPEN_REFERRAL_STATUSES),
    ).count()

    needs_attention: list[schemas_v2.NeedsAttentionItem] = []
    for d in documents_to_review[:5]:
        needs_attention.append(schemas_v2.NeedsAttentionItem(
            type="document", title=f"Document awaiting verification: {d.filename}",
            patient_name=_episode_name(db, d.episode_id), link="/care-team/documents", created_at=d.uploaded_at,
        ))
    for q in open_questions[:5]:
        needs_attention.append(schemas_v2.NeedsAttentionItem(
            type="question", title="Patient question awaiting response",
            patient_name=_episode_name(db, q.episode_id), link="/care-team/questions", created_at=q.created_at,
        ))
    for r in pending_referrals[:5]:
        needs_attention.append(schemas_v2.NeedsAttentionItem(
            type="referral", title=f"Referral awaiting response: {r.title}",
            patient_name=_episode_name(db, r.episode_id), link="/care-team/referrals", created_at=r.created_at,
        ))

    today = datetime.now(timezone.utc).date()
    for t in open_tasks:
        if not t.due_date:
            continue
        try:
            due = datetime.fromisoformat(t.due_date).date()
        except ValueError:
            continue
        if (due - today).days <= 3:
            needs_attention.append(schemas_v2.NeedsAttentionItem(
                type="task", title=f"Follow-up approaching due date: {t.title}",
                patient_name=_episode_name(db, t.episode_id), link="/care-team/tasks", created_at=t.created_at,
            ))

    needs_attention.sort(key=lambda item: item.created_at, reverse=True)

    return schemas_v2.CareTeamDashboardOut(
        full_name=current_user.full_name,
        active_patients=len(assigned_ids),
        documents_to_review=len(documents_to_review),
        patient_questions=len(open_questions),
        open_tasks=len(open_tasks),
        pending_referrals=all_pending_referrals_count,
        needs_attention=needs_attention[:8],
    )
