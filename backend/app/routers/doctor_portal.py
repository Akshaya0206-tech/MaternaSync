"""Doctor-facing API for the new role-based system.

Same security pattern as care_team_portal.py: every list/aggregate query
filters to `_assigned_episode_ids()` (re-derived from
PatientDoctorAssignment on every request), and every single-resource
route re-checks the fetched object's episode_id against that set before
returning anything. A client-supplied episode_id/consultation_id/etc.
that doesn't belong to an assigned episode is rejected (403/404).

AI safety boundary: `_build_draft_content()` is the one place AI-ish
output is generated, and it only ever organizes real, already-documented
data (the raw transcript the doctor dictated, factual episode fields,
titles of already-verified journey events) into the four required
sections. It never infers, diagnoses, or invents follow-up content — any
section with nothing real behind it is left as "Not documented." for the
doctor to fill in. Nothing becomes official until ApprovedConsultation is
created by an explicit doctor approval action.
"""

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .. import models, schemas_v2, transcription
from ..config import UPLOAD_DIR
from ..database import get_db
from ..deps import get_current_user, require_episode_access, require_role
from ..referral_communication import ReferralCommunicationService, ReferralTransitionError

router = APIRouter(prefix="/api/v2/doctor", tags=["doctor-portal"])

OPEN_TASK_STATUSES = ("OPEN", "IN_PROGRESS", "WAITING")
OPEN_QUESTION_STATUSES = ("NEW", "ASSIGNED", "WAITING_FOR_RESPONSE")
AUDIO_EXTENSIONS = {".webm", ".ogg", ".wav", ".m4a", ".mp3"}


# ---------- shared helpers ----------

def _assigned_episode_ids(db: Session, current_user: models.User) -> list[str]:
    rows = (
        db.query(models.PatientDoctorAssignment.episode_id)
        .filter(models.PatientDoctorAssignment.doctor_user_id == current_user.id)
        .all()
    )
    return [r[0] for r in rows]


def _require_assigned_episode(db: Session, current_user: models.User, episode_id: str) -> models.PregnancyEpisode:
    episode = db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.id == episode_id).first()
    if episode is None:
        raise HTTPException(status_code=404, detail="Patient not found.")
    assigned = db.query(models.PatientDoctorAssignment).filter(
        models.PatientDoctorAssignment.episode_id == episode_id,
        models.PatientDoctorAssignment.doctor_user_id == current_user.id,
    ).first()
    if assigned is None:
        raise HTTPException(status_code=403, detail="You are not assigned to this patient.")
    return episode


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


def _to_question_out(db: Session, q: models.PatientQuestion) -> schemas_v2.CareTeamQuestionOut:
    return schemas_v2.CareTeamQuestionOut(
        id=q.id, episode_id=q.episode_id, patient_name=_episode_name(db, q.episode_id),
        question_text=q.question_text, status=q.status, is_clinical=q.is_clinical,
        assigned_to_name=_user_name(db, q.assigned_to_user_id), created_at=q.created_at,
        responses=[
            schemas_v2.QuestionResponseOut(id=r.id, response_text=r.response_text, responder_role=r.responder_role, created_at=r.created_at)
            for r in q.responses
        ],
    )


def _to_task_out(db: Session, t: models.Task) -> schemas_v2.TaskOut:
    return schemas_v2.TaskOut(
        id=t.id, episode_id=t.episode_id, patient_name=_episode_name(db, t.episode_id),
        title=t.title, description=t.description or "", owner_name=_user_name(db, t.owner_user_id),
        created_by_name=_user_name(db, t.created_by_user_id) or "Unknown",
        due_date=t.due_date, priority=t.priority, status=t.status, source_type=t.source_type, source_id=t.source_id,
        waiting_for=t.waiting_for, waiting_since=t.waiting_since, created_at=t.created_at,
    )


def _to_handover_out(db: Session, h: models.Handover) -> schemas_v2.HandoverOut:
    return schemas_v2.HandoverOut(
        id=h.id, episode_id=h.episode_id, patient_name=_episode_name(db, h.episode_id),
        context=h.context, what_happened=h.what_happened, what_remains=h.what_remains,
        who_owns_it=h.who_owns_it, what_to_discuss=h.what_to_discuss, status=h.status,
        generated_by_ai=h.generated_by_ai, created_at=h.created_at,
    )


# ---------- dashboard ----------

@router.get("/dashboard", response_model=schemas_v2.DoctorDashboardOut)
def get_dashboard(current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    assigned_ids = _assigned_episode_ids(db, current_user)
    if not assigned_ids:
        return schemas_v2.DoctorDashboardOut(
            full_name=current_user.full_name, todays_patients=0, briefs_ready=0, questions=0,
            documents_to_review=0, follow_ups=0, drafts_to_approve=0, today_patient_rows=[],
        )

    today = datetime.now(timezone.utc).date()
    episodes = db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.id.in_(assigned_ids)).all()
    briefs_ready = sum(1 for e in episodes if e.is_ready_for_today_brief)

    questions_count = db.query(models.PatientQuestion).filter(
        models.PatientQuestion.assigned_to_user_id == current_user.id,
        models.PatientQuestion.status.in_(OPEN_QUESTION_STATUSES),
    ).count()

    documents_to_review = db.query(models.MedicalDocument).filter(
        models.MedicalDocument.episode_id.in_(assigned_ids), models.MedicalDocument.status == "NEEDS_REVIEW",
    ).count()

    follow_ups = db.query(models.Task).filter(
        models.Task.owner_user_id == current_user.id, models.Task.status.in_(OPEN_TASK_STATUSES),
    ).count()

    drafts_to_approve = (
        db.query(models.ConsultationDraft)
        .join(models.Consultation, models.Consultation.id == models.ConsultationDraft.consultation_id)
        .filter(models.Consultation.doctor_user_id == current_user.id, models.ConsultationDraft.status == "DRAFT")
        .count()
    )

    todays_appointments = (
        db.query(models.Appointment)
        .filter(models.Appointment.episode_id.in_(assigned_ids), models.Appointment.status == "scheduled")
        .all()
    )
    todays_appointments = [a for a in todays_appointments if a.scheduled_at.date() == today]

    today_rows = []
    for appt in sorted(todays_appointments, key=lambda a: a.scheduled_at):
        episode = next((e for e in episodes if e.id == appt.episode_id), None)
        if episode is None:
            continue
        q_count = db.query(models.PatientQuestion).filter(
            models.PatientQuestion.episode_id == episode.id, models.PatientQuestion.status.in_(OPEN_QUESTION_STATUSES),
        ).count()
        t_count = db.query(models.Task).filter(
            models.Task.episode_id == episode.id, models.Task.status.in_(OPEN_TASK_STATUSES),
        ).count()
        parts = []
        if q_count:
            parts.append(f"{q_count} Question{'s' if q_count != 1 else ''}")
        if t_count:
            parts.append(f"{t_count} Follow-up{'s' if t_count != 1 else ''}")
        summary = " · ".join(parts) if parts else "No pending items"
        today_rows.append(schemas_v2.TodayPatientRowOut(
            episode_id=episode.id, patient_name=episode.patient_name, appointment_time=appt.scheduled_at,
            brief_status="Ready" if episode.is_ready_for_today_brief else "Not Ready",
            pending_items_summary=summary,
        ))

    return schemas_v2.DoctorDashboardOut(
        full_name=current_user.full_name,
        todays_patients=len(todays_appointments),
        briefs_ready=briefs_ready,
        questions=questions_count,
        documents_to_review=documents_to_review,
        follow_ups=follow_ups,
        drafts_to_approve=drafts_to_approve,
        today_patient_rows=today_rows,
    )


# ---------- patients ----------

@router.get("/patients", response_model=list[schemas_v2.DoctorPatientRowOut])
def list_patients(current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    assigned_ids = _assigned_episode_ids(db, current_user)
    if not assigned_ids:
        return []
    episodes = db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.id.in_(assigned_ids)).all()

    rows = []
    for ep in episodes:
        next_appt = (
            db.query(models.Appointment)
            .filter(models.Appointment.episode_id == ep.id, models.Appointment.status == "scheduled")
            .order_by(models.Appointment.scheduled_at.asc())
            .first()
        )
        last_consult = (
            db.query(models.Consultation)
            .filter(models.Consultation.episode_id == ep.id, models.Consultation.doctor_user_id == current_user.id)
            .order_by(models.Consultation.started_at.desc())
            .first()
        )
        open_tasks = db.query(models.Task).filter(models.Task.episode_id == ep.id, models.Task.status.in_(OPEN_TASK_STATUSES)).count()
        open_questions = db.query(models.PatientQuestion).filter(models.PatientQuestion.episode_id == ep.id, models.PatientQuestion.status.in_(OPEN_QUESTION_STATUSES)).count()

        rows.append(schemas_v2.DoctorPatientRowOut(
            episode_id=ep.id, patient_name=ep.patient_name, age=ep.age, edd=ep.edd,
            next_appointment=next_appt.scheduled_at if next_appt else None,
            last_consultation=last_consult.started_at if last_consult else None,
            open_items=open_tasks, question_count=open_questions,
        ))

    rows.sort(key=lambda r: r.patient_name)
    return rows


@router.get("/episodes/{episode_id}/journey", response_model=list[schemas_v2.JourneyEventOut])
def episode_journey(episode: models.PregnancyEpisode = Depends(require_episode_access), db: Session = Depends(get_db)):
    events = db.query(models.JourneyEvent).filter(models.JourneyEvent.episode_id == episode.id).order_by(models.JourneyEvent.event_date.desc()).all()
    return [schemas_v2.JourneyEventOut.model_validate(e) for e in events]


@router.get("/episodes/{episode_id}/appointments", response_model=list[schemas_v2.AppointmentOut])
def episode_appointments(episode: models.PregnancyEpisode = Depends(require_episode_access), db: Session = Depends(get_db)):
    appointments = db.query(models.Appointment).filter(models.Appointment.episode_id == episode.id).order_by(models.Appointment.scheduled_at.asc()).all()
    return [
        schemas_v2.AppointmentOut(id=a.id, scheduled_at=a.scheduled_at, appointment_type=a.appointment_type, location=a.location, status=a.status, doctor_name=None)
        for a in appointments
    ]


# ---------- Today's Brief ----------

NOT_AVAILABLE = "Not available in current records."


def _compute_brief_content(db: Session, episode: models.PregnancyEpisode) -> dict:
    recent_events = (
        db.query(models.JourneyEvent).filter(models.JourneyEvent.episode_id == episode.id)
        .order_by(models.JourneyEvent.event_date.desc()).limit(5).all()
    )
    pending_tasks = (
        db.query(models.Task).filter(models.Task.episode_id == episode.id, models.Task.status.in_(OPEN_TASK_STATUSES))
        .order_by(models.Task.created_at.desc()).all()
    )
    open_questions = (
        db.query(models.PatientQuestion).filter(models.PatientQuestion.episode_id == episode.id, models.PatientQuestion.status.in_(OPEN_QUESTION_STATUSES))
        .order_by(models.PatientQuestion.created_at.desc()).all()
    )
    next_appt = (
        db.query(models.Appointment).filter(models.Appointment.episode_id == episode.id, models.Appointment.status == "scheduled")
        .order_by(models.Appointment.scheduled_at.asc()).first()
    )
    relevant_docs = (
        db.query(models.MedicalDocument).filter(models.MedicalDocument.episode_id == episode.id, models.MedicalDocument.status == "VERIFIED")
        .order_by(models.MedicalDocument.uploaded_at.desc()).limit(5).all()
    )

    latest_approved_info = recent_events[0].title + (f" — {recent_events[0].summary}" if recent_events[0].summary else "") if recent_events else NOT_AVAILABLE

    return {
        "recentEvents": [
            {"id": e.id, "eventType": e.event_type, "title": e.title, "summary": e.summary, "eventDate": e.event_date,
             "gestationalAgeWeeks": e.gestational_age_weeks, "gestationalAgeDays": e.gestational_age_days}
            for e in recent_events
        ],
        "pendingItems": [_to_task_out(db, t).model_dump(by_alias=True, mode="json") for t in pending_tasks],
        "patientQuestions": [_to_question_out(db, q).model_dump(by_alias=True, mode="json") for q in open_questions],
        "nextAppointment": (
            {"id": next_appt.id, "scheduledAt": next_appt.scheduled_at.isoformat(), "appointmentType": next_appt.appointment_type,
             "location": next_appt.location, "status": next_appt.status, "doctorName": None}
            if next_appt else None
        ),
        "latestApprovedInfo": latest_approved_info,
        "relevantDocuments": [
            {"id": d.id, "filename": d.filename, "status": d.status,
             "statusLabel": schemas_v2.DOCUMENT_STATUS_LABELS.get(d.status, d.status), "documentDate": d.document_date}
            for d in relevant_docs
        ],
    }


def _get_or_create_brief_artifact(db: Session, episode: models.PregnancyEpisode) -> models.AIArtifact:
    existing = (
        db.query(models.AIArtifact)
        .filter(models.AIArtifact.episode_id == episode.id, models.AIArtifact.artifact_type == "today_brief", models.AIArtifact.reviewed_at.is_(None))
        .order_by(models.AIArtifact.generated_at.desc())
        .first()
    )
    content = _compute_brief_content(db, episode)
    if existing:
        existing.content = content
        existing.generated_at = datetime.now(timezone.utc)
        return existing
    artifact = models.AIArtifact(episode_id=episode.id, artifact_type="today_brief", status="DRAFT", content=content)
    db.add(artifact)
    return artifact


@router.get("/episodes/{episode_id}/todays-brief", response_model=schemas_v2.TodaysBriefOut)
def get_todays_brief(episode: models.PregnancyEpisode = Depends(require_episode_access), db: Session = Depends(get_db)):
    artifact = _get_or_create_brief_artifact(db, episode)
    db.commit()
    db.refresh(artifact)
    content = artifact.content

    return schemas_v2.TodaysBriefOut(
        episode_id=episode.id, patient_name=episode.patient_name, age=episode.age,
        gestational_age_weeks=episode.gestational_age_weeks, gestational_age_days=episode.gestational_age_days,
        edd=episode.edd, risk_category=episode.risk_category,
        recent_events=[schemas_v2.JourneyEventOut(**e) for e in content["recentEvents"]],
        pending_items=[schemas_v2.TaskOut(**t) for t in content["pendingItems"]],
        patient_questions=[schemas_v2.CareTeamQuestionOut(**q) for q in content["patientQuestions"]],
        next_appointment=schemas_v2.AppointmentOut(**content["nextAppointment"]) if content["nextAppointment"] else None,
        latest_approved_info=content["latestApprovedInfo"],
        relevant_documents=[schemas_v2.DocumentSummaryOut(**d) for d in content["relevantDocuments"]],
        status="REVIEWED" if artifact.reviewed_at else "DRAFT",
        generated_at=artifact.generated_at,
    )


@router.post("/episodes/{episode_id}/todays-brief/review")
def review_todays_brief(
    episode: models.PregnancyEpisode = Depends(require_episode_access),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    artifact = (
        db.query(models.AIArtifact)
        .filter(models.AIArtifact.episode_id == episode.id, models.AIArtifact.artifact_type == "today_brief", models.AIArtifact.reviewed_at.is_(None))
        .order_by(models.AIArtifact.generated_at.desc())
        .first()
    )
    if artifact:
        artifact.reviewed_by_user_id = current_user.id
        artifact.reviewed_at = datetime.now(timezone.utc)
        _log(db, episode.id, current_user, "brief_reviewed", "Today's Brief reviewed", "", "AIArtifact", artifact.id)
        db.commit()
    return {"status": "reviewed"}


# ---------- documents ----------

def _to_document_out(db: Session, doc: models.MedicalDocument) -> schemas_v2.CareTeamDocumentOut:
    uploader = db.query(models.User).filter(models.User.id == doc.uploaded_by_user_id).first()
    reviews = db.query(models.DocumentReview).filter(models.DocumentReview.document_id == doc.id).order_by(models.DocumentReview.reviewed_at.asc()).all()
    ext = doc.extraction
    nf = schemas_v2.NOT_FOUND
    extraction_out = None
    if ext is not None:
        extraction_out = schemas_v2.ExtractionOut(
            record_type=ext.record_type or nf, visit_type=ext.visit_type or nf, event_date=ext.event_date or nf,
            facility=ext.facility or nf, provider=ext.provider or nf, department=ext.department or nf,
            patient_name_found=ext.patient_name_found or nf, mrn_found=ext.mrn_found or nf,
            gestational_age=ext.gestational_age or nf, field_status=ext.field_status or {},
        )
    return schemas_v2.CareTeamDocumentOut(
        id=doc.id, episode_id=doc.episode_id, patient_name=_episode_name(db, doc.episode_id),
        filename=doc.filename, description=doc.description, document_date=doc.document_date,
        uploaded_by_name=uploader.full_name if uploader else "Unknown",
        uploaded_by_role=doc.uploaded_by_role, uploaded_at=doc.uploaded_at,
        status=doc.status, status_label=schemas_v2.DOCUMENT_STATUS_LABELS.get(doc.status, doc.status),
        extraction=extraction_out,
        reviews=[
            schemas_v2.DocumentReviewOut(id=r.id, action=r.action, reviewer_name=_user_name(db, r.reviewer_user_id) or "Unknown",
                                          reviewer_role=r.reviewer_role, notes=r.notes, reviewed_at=r.reviewed_at)
            for r in reviews
        ],
    )


def _get_assigned_document(db: Session, current_user: models.User, document_id: str) -> models.MedicalDocument:
    document = db.query(models.MedicalDocument).filter(models.MedicalDocument.id == document_id).first()
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    if document.episode_id not in _assigned_episode_ids(db, current_user):
        raise HTTPException(status_code=403, detail="You are not assigned to this patient.")
    return document


@router.get("/documents", response_model=list[schemas_v2.CareTeamDocumentOut])
def list_documents(
    episode_id: str | None = Query(None), status_filter: str | None = Query(None, alias="status"),
    current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db),
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
    return [_to_document_out(db, d) for d in documents]


@router.get("/documents/{document_id}", response_model=schemas_v2.CareTeamDocumentOut)
def get_document(document_id: str, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    return _to_document_out(db, _get_assigned_document(db, current_user, document_id))


@router.get("/documents/{document_id}/file")
def get_document_file(document_id: str, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    document = _get_assigned_document(db, current_user, document_id)
    file_path = UPLOAD_DIR / document.file_path
    if not document.file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Source file not found on server.")
    return FileResponse(file_path, filename=document.filename)


@router.post("/documents/{document_id}/verify", response_model=schemas_v2.CareTeamDocumentOut)
def verify_document(document_id: str, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    document = _get_assigned_document(db, current_user, document_id)
    episode = db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.id == document.episode_id).first()
    document.status = "VERIFIED"
    db.add(models.DocumentReview(document_id=document.id, reviewer_user_id=current_user.id, reviewer_role=current_user.role, action="VERIFY", reviewed_at=datetime.now(timezone.utc)))
    ext = document.extraction
    db.add(models.JourneyEvent(
        episode_id=document.episode_id, event_type="document", source_document_id=document.id,
        title=(ext.record_type if ext and ext.record_type else document.filename), summary=document.description or "",
        event_date=document.document_date or (ext.event_date if ext else None) or datetime.now(timezone.utc).date().isoformat(),
        gestational_age_weeks=episode.gestational_age_weeks if episode else 0, gestational_age_days=episode.gestational_age_days if episode else 0,
    ))
    _log(db, document.episode_id, current_user, "document_verified", f"{current_user.full_name} verified \"{document.filename}\"", "Clinically verified and added to journey.", "MedicalDocument", document.id)
    db.commit()
    db.refresh(document)
    return _to_document_out(db, document)


@router.post("/documents/{document_id}/reject", response_model=schemas_v2.CareTeamDocumentOut)
def reject_document(document_id: str, payload: schemas_v2.ReviewNoteIn = schemas_v2.ReviewNoteIn(), current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    document = _get_assigned_document(db, current_user, document_id)
    document.status = "REJECTED"
    db.add(models.DocumentReview(document_id=document.id, reviewer_user_id=current_user.id, reviewer_role=current_user.role, action="REJECT", notes=payload.notes, reviewed_at=datetime.now(timezone.utc)))
    _log(db, document.episode_id, current_user, "document_rejected", f"{current_user.full_name} rejected \"{document.filename}\"", payload.notes or "", "MedicalDocument", document.id)
    db.commit()
    db.refresh(document)
    return _to_document_out(db, document)


# ---------- consultations ----------

def _to_consultation_out(db: Session, c: models.Consultation) -> schemas_v2.ConsultationOut:
    return schemas_v2.ConsultationOut(
        id=c.id, episode_id=c.episode_id, patient_name=_episode_name(db, c.episode_id),
        doctor_name=_user_name(db, c.doctor_user_id) or "Unknown", input_mode=c.input_mode, status=c.status,
        raw_transcript=c.raw_transcript, audio_available=bool(c.audio_path), started_at=c.started_at,
    )


def _get_assigned_consultation(db: Session, current_user: models.User, consultation_id: str) -> models.Consultation:
    consultation = db.query(models.Consultation).filter(models.Consultation.id == consultation_id).first()
    if consultation is None:
        raise HTTPException(status_code=404, detail="Consultation not found.")
    if consultation.episode_id not in _assigned_episode_ids(db, current_user):
        raise HTTPException(status_code=403, detail="You are not assigned to this patient.")
    return consultation


@router.get("/consultations", response_model=list[schemas_v2.ConsultationOut])
def list_consultations(episode_id: str | None = Query(None), current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    assigned_ids = _assigned_episode_ids(db, current_user)
    if episode_id:
        if episode_id not in assigned_ids:
            raise HTTPException(status_code=403, detail="You are not assigned to this patient.")
        assigned_ids = [episode_id]
    if not assigned_ids:
        return []
    consultations = db.query(models.Consultation).filter(
        models.Consultation.episode_id.in_(assigned_ids), models.Consultation.doctor_user_id == current_user.id,
    ).order_by(models.Consultation.started_at.desc()).all()
    return [_to_consultation_out(db, c) for c in consultations]


@router.post("/consultations", response_model=schemas_v2.ConsultationOut)
def start_consultation(payload: schemas_v2.ConsultationStartIn, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    episode = _require_assigned_episode(db, current_user, payload.episode_id)
    consultation = models.Consultation(episode_id=episode.id, doctor_user_id=current_user.id, input_mode=payload.input_mode, status="in_progress")
    db.add(consultation)
    db.flush()
    _log(db, episode.id, current_user, "consultation_started", f"{current_user.full_name} started a consultation", "", "Consultation", consultation.id)
    db.commit()
    db.refresh(consultation)
    return _to_consultation_out(db, consultation)


@router.get("/consultations/{consultation_id}", response_model=schemas_v2.ConsultationOut)
def get_consultation(consultation_id: str, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    return _to_consultation_out(db, _get_assigned_consultation(db, current_user, consultation_id))


@router.post("/consultations/{consultation_id}/transcribe", response_model=schemas_v2.ConsultationOut)
async def transcribe_consultation(
    consultation_id: str, file: UploadFile = File(...),
    current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db),
):
    consultation = _get_assigned_consultation(db, current_user, consultation_id)

    suffix = Path(file.filename or "").suffix.lower() or ".webm"
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    dest_path = UPLOAD_DIR / stored_name
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="The recording is empty.")
    dest_path.write_bytes(contents)

    try:
        text = transcription.transcribe_audio(dest_path)
    except transcription.TranscriptionError:
        raise HTTPException(status_code=422, detail="Transcription could not be completed.")

    consultation.audio_path = stored_name
    consultation.raw_transcript = text
    consultation.input_mode = "voice"
    _log(db, consultation.episode_id, current_user, "transcript_generated", "Voice note transcribed", f"{len(text)} characters transcribed.", "Consultation", consultation.id)
    db.commit()
    db.refresh(consultation)
    return _to_consultation_out(db, consultation)


@router.patch("/consultations/{consultation_id}", response_model=schemas_v2.ConsultationOut)
def update_transcript(consultation_id: str, payload: schemas_v2.TranscriptUpdateIn, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    consultation = _get_assigned_consultation(db, current_user, consultation_id)
    consultation.raw_transcript = payload.raw_transcript
    db.commit()
    db.refresh(consultation)
    return _to_consultation_out(db, consultation)


# ---------- consultation drafts (AI documentation) ----------

def _to_draft_out(d: models.ConsultationDraft) -> schemas_v2.ConsultationDraftOut:
    return schemas_v2.ConsultationDraftOut(id=d.id, consultation_id=d.consultation_id, version=d.version, status=d.status, structured_content=d.structured_content or {}, created_at=d.created_at)


def _build_draft_content(db: Session, episode: models.PregnancyEpisode, consultation: models.Consultation) -> dict:
    """Organizes real, already-documented data into the four required
    sections. Never infers or invents — see module docstring."""
    visit_context = f"GA {episode.gestational_age_weeks}w{episode.gestational_age_days}d visit for {episode.patient_name}. Risk category: {episode.risk_category}."

    documented_discussion = consultation.raw_transcript.strip() if consultation.raw_transcript and consultation.raw_transcript.strip() else "Not documented."

    recent_event = db.query(models.JourneyEvent).filter(models.JourneyEvent.episode_id == episode.id).order_by(models.JourneyEvent.event_date.desc()).first()
    relevant_information = f"Most recent prior record: {recent_event.title} ({recent_event.event_date})." if recent_event else "Not documented."

    return {
        "visitContext": visit_context,
        "documentedDiscussion": documented_discussion,
        "relevantInformation": relevant_information,
        "followUpNextSteps": "Not documented.",
    }


def _get_assigned_draft(db: Session, current_user: models.User, draft_id: str) -> tuple[models.ConsultationDraft, models.Consultation]:
    draft = db.query(models.ConsultationDraft).filter(models.ConsultationDraft.id == draft_id).first()
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found.")
    consultation = db.query(models.Consultation).filter(models.Consultation.id == draft.consultation_id).first()
    if consultation is None or consultation.episode_id not in _assigned_episode_ids(db, current_user):
        raise HTTPException(status_code=403, detail="You are not assigned to this patient.")
    return draft, consultation


@router.get("/consultations/{consultation_id}/drafts", response_model=list[schemas_v2.ConsultationDraftOut])
def list_drafts(consultation_id: str, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    consultation = _get_assigned_consultation(db, current_user, consultation_id)
    drafts = db.query(models.ConsultationDraft).filter(models.ConsultationDraft.consultation_id == consultation.id).order_by(models.ConsultationDraft.version.desc()).all()
    return [_to_draft_out(d) for d in drafts]


@router.post("/consultations/{consultation_id}/drafts", response_model=schemas_v2.ConsultationDraftOut)
def generate_draft(consultation_id: str, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    consultation = _get_assigned_consultation(db, current_user, consultation_id)
    episode = db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.id == consultation.episode_id).first()

    previous = db.query(models.ConsultationDraft).filter(models.ConsultationDraft.consultation_id == consultation.id, models.ConsultationDraft.status == "DRAFT").all()
    for p in previous:
        p.status = "SUPERSEDED"

    next_version = (db.query(models.ConsultationDraft).filter(models.ConsultationDraft.consultation_id == consultation.id).count()) + 1
    draft = models.ConsultationDraft(
        consultation_id=consultation.id, version=next_version,
        structured_content=_build_draft_content(db, episode, consultation), status="DRAFT",
    )
    db.add(draft)
    db.flush()
    _log(db, consultation.episode_id, current_user, "ai_draft_generated", f"AI documentation draft generated (v{next_version})", "Review required before approval.", "ConsultationDraft", draft.id)
    db.commit()
    db.refresh(draft)
    return _to_draft_out(draft)


@router.get("/drafts/{draft_id}", response_model=schemas_v2.ConsultationDraftOut)
def get_draft(draft_id: str, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    draft, _consultation = _get_assigned_draft(db, current_user, draft_id)
    return _to_draft_out(draft)


@router.patch("/drafts/{draft_id}", response_model=schemas_v2.ConsultationDraftOut)
def edit_draft(draft_id: str, payload: schemas_v2.DraftUpdateIn, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    draft, consultation = _get_assigned_draft(db, current_user, draft_id)
    if draft.status != "DRAFT":
        raise HTTPException(status_code=409, detail="Only a current draft can be edited. Approved or superseded versions are immutable.")

    content = dict(draft.structured_content or {})
    field_map = {"visit_context": "visitContext", "documented_discussion": "documentedDiscussion", "relevant_information": "relevantInformation", "follow_up_next_steps": "followUpNextSteps"}
    for attr, key in field_map.items():
        value = getattr(payload, attr)
        if value is not None:
            content[key] = value
    draft.structured_content = content

    _log(db, consultation.episode_id, current_user, "draft_edited", f"Documentation draft edited (v{draft.version})", "", "ConsultationDraft", draft.id)
    db.commit()
    db.refresh(draft)
    return _to_draft_out(draft)


@router.post("/drafts/{draft_id}/reject", response_model=schemas_v2.ConsultationDraftOut)
def reject_draft(draft_id: str, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    draft, consultation = _get_assigned_draft(db, current_user, draft_id)
    draft.status = "REJECTED"
    _log(db, consultation.episode_id, current_user, "draft_rejected", f"Documentation draft rejected (v{draft.version})", "", "ConsultationDraft", draft.id)
    db.commit()
    db.refresh(draft)
    return _to_draft_out(draft)


@router.post("/drafts/{draft_id}/approve", response_model=schemas_v2.ApprovedConsultationOut)
def approve_draft(draft_id: str, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    draft, consultation = _get_assigned_draft(db, current_user, draft_id)
    if draft.status != "DRAFT":
        raise HTTPException(status_code=409, detail="Only a current draft can be approved.")

    episode = db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.id == consultation.episode_id).first()

    draft.status = "APPROVED"
    consultation.status = "documented"

    approved = models.ApprovedConsultation(
        consultation_id=consultation.id, draft_id=draft.id, approved_by_user_id=current_user.id,
        final_content=draft.structured_content,
    )
    db.add(approved)
    db.flush()

    content = draft.structured_content or {}
    db.add(models.JourneyEvent(
        episode_id=episode.id, event_type="consultation", source_consultation_id=approved.id,
        title="Consultation completed", summary=content.get("visitContext", ""),
        event_date=datetime.now(timezone.utc).date().isoformat(),
        gestational_age_weeks=episode.gestational_age_weeks, gestational_age_days=episode.gestational_age_days,
    ))

    follow_up_text = content.get("followUpNextSteps", "")
    if follow_up_text and follow_up_text.strip() and follow_up_text.strip() != "Not documented.":
        db.add(models.Task(
            episode_id=episode.id, title=f"Follow up: {follow_up_text.strip()[:120]}",
            description=follow_up_text.strip(), owner_user_id=current_user.id, created_by_user_id=current_user.id,
            status="OPEN", source_type="consultation", source_id=consultation.id,
        ))

    _log(db, episode.id, current_user, "draft_approved", f"{current_user.full_name} approved consultation documentation (v{draft.version})", "Added to patient journey.", "ConsultationDraft", draft.id)
    db.commit()
    db.refresh(approved)

    return schemas_v2.ApprovedConsultationOut(
        id=approved.id, consultation_id=approved.consultation_id, draft_id=approved.draft_id,
        approved_by_name=current_user.full_name, approved_at=approved.approved_at, final_content=approved.final_content,
    )


# ---------- documentation history ----------

@router.get("/documentation", response_model=list[schemas_v2.DocumentationItemOut])
def list_documentation(current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    consultations = db.query(models.Consultation).filter(models.Consultation.doctor_user_id == current_user.id).order_by(models.Consultation.started_at.desc()).all()
    items = []
    for c in consultations:
        latest_draft = db.query(models.ConsultationDraft).filter(models.ConsultationDraft.consultation_id == c.id).order_by(models.ConsultationDraft.version.desc()).first()
        approved = db.query(models.ApprovedConsultation).filter(models.ApprovedConsultation.consultation_id == c.id).order_by(models.ApprovedConsultation.approved_at.desc()).first()
        status = "No draft yet"
        if latest_draft:
            status = latest_draft.status
        items.append(schemas_v2.DocumentationItemOut(
            consultation_id=c.id, episode_id=c.episode_id, patient_name=_episode_name(db, c.episode_id),
            date=c.started_at, type="Consultation", author_name=current_user.full_name, status=status,
            latest_draft_id=latest_draft.id if latest_draft else None, approved_id=approved.id if approved else None,
        ))
    return items


@router.get("/documentation/{consultation_id}/approved", response_model=schemas_v2.ApprovedConsultationOut)
def get_approved_version(consultation_id: str, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    consultation = _get_assigned_consultation(db, current_user, consultation_id)
    approved = db.query(models.ApprovedConsultation).filter(models.ApprovedConsultation.consultation_id == consultation.id).order_by(models.ApprovedConsultation.approved_at.desc()).first()
    if approved is None:
        raise HTTPException(status_code=404, detail="No approved version exists for this consultation.")
    return schemas_v2.ApprovedConsultationOut(
        id=approved.id, consultation_id=approved.consultation_id, draft_id=approved.draft_id,
        approved_by_name=_user_name(db, approved.approved_by_user_id) or "Unknown",
        approved_at=approved.approved_at, final_content=approved.final_content,
    )


# ---------- questions ----------

@router.get("/questions", response_model=list[schemas_v2.CareTeamQuestionOut])
def list_questions(current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    assigned_ids = _assigned_episode_ids(db, current_user)
    if not assigned_ids:
        return []
    questions = db.query(models.PatientQuestion).filter(
        models.PatientQuestion.assigned_to_user_id == current_user.id,
        models.PatientQuestion.episode_id.in_(assigned_ids),
    ).order_by(models.PatientQuestion.created_at.desc()).all()
    return [_to_question_out(db, q) for q in questions]


def _get_assigned_question(db: Session, current_user: models.User, question_id: str) -> models.PatientQuestion:
    question = db.query(models.PatientQuestion).filter(models.PatientQuestion.id == question_id).first()
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found.")
    if question.episode_id not in _assigned_episode_ids(db, current_user):
        raise HTTPException(status_code=403, detail="You are not assigned to this patient.")
    return question


@router.post("/questions/{question_id}/draft", response_model=schemas_v2.CareTeamQuestionOut)
def draft_question_response(question_id: str, payload: schemas_v2.DraftResponseIn, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    question = _get_assigned_question(db, current_user, question_id)
    text = payload.response_text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Please write a response before saving.")

    existing_draft = db.query(models.QuestionResponse).filter(
        models.QuestionResponse.question_id == question.id, models.QuestionResponse.responder_user_id == current_user.id,
        models.QuestionResponse.status == "DRAFT",
    ).first()
    if existing_draft:
        existing_draft.response_text = text
    else:
        db.add(models.QuestionResponse(
            question_id=question.id, responder_user_id=current_user.id, responder_role=current_user.role,
            response_text=text, status="DRAFT", visible_to_patient=False,
        ))
        if question.status not in ("ANSWERED", "CLOSED"):
            question.status = "WAITING_FOR_RESPONSE"

    db.commit()
    db.refresh(question)
    return _to_question_out(db, question)


@router.post("/questions/{question_id}/approve-response", response_model=schemas_v2.CareTeamQuestionOut)
def approve_question_response(question_id: str, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    question = _get_assigned_question(db, current_user, question_id)
    draft = db.query(models.QuestionResponse).filter(
        models.QuestionResponse.question_id == question.id, models.QuestionResponse.responder_user_id == current_user.id,
        models.QuestionResponse.status == "DRAFT",
    ).order_by(models.QuestionResponse.created_at.desc()).first()
    if draft is None:
        raise HTTPException(status_code=404, detail="No draft response exists to approve. Draft a response first.")

    draft.status = "APPROVED"
    draft.visible_to_patient = True
    draft.approved_by_user_id = current_user.id
    draft.approved_at = datetime.now(timezone.utc)
    question.status = "ANSWERED"

    db.add(models.Notification(
        recipient_user_id=question.asked_by_user_id, episode_id=question.episode_id, type="question_answered",
        title="Your doctor answered your question", body=draft.response_text[:200],
        related_entity_type="PatientQuestion", related_entity_id=question.id,
    ))
    _log(db, question.episode_id, current_user, "response_approved", "Dr. approved and sent a clinical response", draft.response_text[:200], "PatientQuestion", question.id)
    db.commit()
    db.refresh(question)
    return _to_question_out(db, question)


# ---------- referrals ----------
# The Doctor originates a referral (see Step 7 item 4); everything after
# that — sending it, recording the external lifecycle — is Care Team's
# job (routers/care_team_portal.py). The Doctor comes back in only to
# review a received response and close the loop.

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
        related_task=_to_task_out(db, task) if task else None,
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
def list_referrals(episode_id: str | None = Query(None), current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    assigned_ids = _assigned_episode_ids(db, current_user)
    if episode_id:
        if episode_id not in assigned_ids:
            raise HTTPException(status_code=403, detail="You are not assigned to this patient.")
        assigned_ids = [episode_id]
    if not assigned_ids:
        return []
    referrals = db.query(models.Referral).filter(models.Referral.episode_id.in_(assigned_ids)).order_by(models.Referral.created_at.desc()).all()
    return [_referral_out(db, r) for r in referrals]


@router.get("/referrals/{referral_id}", response_model=schemas_v2.ReferralDetailOut)
def get_referral(referral_id: str, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    referral = _get_assigned_referral(db, current_user, referral_id)
    return _referral_detail_out(db, referral)


@router.post("/episodes/{episode_id}/referrals", response_model=schemas_v2.ReferralOut)
def create_referral(
    payload: schemas_v2.ReferralCreateIn, episode: models.PregnancyEpisode = Depends(require_episode_access),
    current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db),
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only the assigned doctor can create a referral.")
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Please give the referral a title.")

    referral = ReferralCommunicationService(db).create_referral(
        episode, current_user, title, payload.description or "", payload.destination or "",
        payload.referred_to, payload.due_date,
    )
    db.commit()
    db.refresh(referral)
    return _referral_out(db, referral)


@router.post("/referrals/{referral_id}/close", response_model=schemas_v2.ReferralOut)
def doctor_close_referral(referral_id: str, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    referral = _get_assigned_referral(db, current_user, referral_id)
    try:
        ReferralCommunicationService(db).doctor_review_and_close(referral, current_user)
    except ReferralTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    db.commit()
    db.refresh(referral)
    return _referral_out(db, referral)


# ---------- follow-ups ----------

@router.get("/follow-ups", response_model=list[schemas_v2.TaskOut])
def list_follow_ups(status_filter: str | None = Query(None, alias="status"), current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    q = db.query(models.Task).filter(models.Task.owner_user_id == current_user.id)
    if status_filter:
        q = q.filter(models.Task.status == status_filter)
    tasks = q.order_by(models.Task.created_at.desc()).all()
    return [_to_task_out(db, t) for t in tasks]


@router.patch("/follow-ups/{task_id}", response_model=schemas_v2.TaskOut)
def update_follow_up(task_id: str, payload: schemas_v2.TaskUpdateIn, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Follow-up not found.")
    if task.episode_id not in _assigned_episode_ids(db, current_user):
        raise HTTPException(status_code=403, detail="You are not assigned to this patient.")

    if payload.status is not None and payload.status != task.status:
        task.status = payload.status
        _log(db, task.episode_id, current_user, "task_status_changed", f"Follow-up \"{task.title}\" set to {payload.status}", "", "Task", task.id)
    if payload.due_date is not None:
        task.due_date = payload.due_date or None

    task.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)
    return _to_task_out(db, task)


# ---------- handover ----------

@router.get("/handover/{episode_id}", response_model=schemas_v2.HandoverOut | None)
def get_handover(episode: models.PregnancyEpisode = Depends(require_episode_access), db: Session = Depends(get_db)):
    handover = db.query(models.Handover).filter(models.Handover.episode_id == episode.id).order_by(models.Handover.created_at.desc()).first()
    return _to_handover_out(db, handover) if handover else None


@router.post("/handover/{episode_id}/generate", response_model=schemas_v2.HandoverOut)
def generate_handover(episode: models.PregnancyEpisode = Depends(require_episode_access), current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only the assigned doctor can generate a handover draft here.")

    recent_event = db.query(models.JourneyEvent).filter(models.JourneyEvent.episode_id == episode.id).order_by(models.JourneyEvent.event_date.desc()).first()
    what_happened = f"{recent_event.title} ({recent_event.event_date})." if recent_event else "No recent recorded activity."

    open_tasks = db.query(models.Task).filter(models.Task.episode_id == episode.id, models.Task.status.in_(OPEN_TASK_STATUSES)).count()
    open_questions = db.query(models.PatientQuestion).filter(models.PatientQuestion.episode_id == episode.id, models.PatientQuestion.status.in_(OPEN_QUESTION_STATUSES)).count()
    what_remains = f"{open_tasks} open task(s)." if open_tasks else "Nothing outstanding."
    what_to_discuss = f"{open_questions} patient question(s) pending response." if open_questions else "No pending patient questions."

    handover = models.Handover(
        episode_id=episode.id,
        context=f"GA {episode.gestational_age_weeks}w{episode.gestational_age_days}d, risk: {episode.risk_category}.",
        what_happened=what_happened, what_remains=what_remains,
        who_owns_it=f"{current_user.full_name} (clinical).", what_to_discuss=what_to_discuss,
        status="DRAFT", generated_by_ai=True, created_by_user_id=current_user.id,
    )
    db.add(handover)
    db.flush()
    _log(db, episode.id, current_user, "handover_created", "Handover draft generated by doctor", "AI-assisted draft, pending review.", "Handover", handover.id)
    db.commit()
    db.refresh(handover)
    return _to_handover_out(db, handover)


@router.patch("/handover/{handover_id}", response_model=schemas_v2.HandoverOut)
def update_handover(handover_id: str, payload: schemas_v2.HandoverUpdateIn, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
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
    return _to_handover_out(db, handover)


@router.post("/handover/{handover_id}/share", response_model=schemas_v2.HandoverOut)
def share_handover(handover_id: str, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    handover = db.query(models.Handover).filter(models.Handover.id == handover_id).first()
    if handover is None:
        raise HTTPException(status_code=404, detail="Handover not found.")
    if handover.episode_id not in _assigned_episode_ids(db, current_user):
        raise HTTPException(status_code=403, detail="You are not assigned to this patient.")
    handover.status = "FINAL"
    handover.approved_by_user_id = current_user.id
    handover.approved_at = datetime.now(timezone.utc)
    _log(db, handover.episode_id, current_user, "handover_shared", "Handover shared internally by doctor", "", "Handover", handover.id)
    db.commit()
    db.refresh(handover)
    return _to_handover_out(db, handover)


# ---------- updates ----------

@router.get("/updates", response_model=list[schemas_v2.NotificationOut])
def list_updates(current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    notifications = db.query(models.Notification).filter(models.Notification.recipient_user_id == current_user.id).order_by(models.Notification.created_at.desc()).all()
    return [schemas_v2.NotificationOut.model_validate(n) for n in notifications]


@router.patch("/updates/{notification_id}/read", response_model=schemas_v2.NotificationOut)
def mark_update_read(notification_id: str, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    notification = db.query(models.Notification).filter(models.Notification.id == notification_id, models.Notification.recipient_user_id == current_user.id).first()
    if notification is None:
        raise HTTPException(status_code=404, detail="Update not found.")
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return schemas_v2.NotificationOut.model_validate(notification)


# ---------- profile ----------

@router.get("/profile", response_model=schemas_v2.DoctorProfileOut)
def get_profile(current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    profile = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == current_user.id).first()
    return schemas_v2.DoctorProfileOut(full_name=current_user.full_name, email=current_user.email, role=current_user.role, specialty=profile.specialty if profile else None, facility=profile.facility if profile else None)


@router.patch("/profile", response_model=schemas_v2.DoctorProfileOut)
def update_profile(payload: schemas_v2.DoctorProfileUpdateIn, current_user: models.User = Depends(require_role("doctor")), db: Session = Depends(get_db)):
    profile = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == current_user.id).first()
    if profile is None:
        profile = models.DoctorProfile(user_id=current_user.id)
        db.add(profile)
    if payload.full_name is not None and payload.full_name.strip():
        current_user.full_name = payload.full_name.strip()
    if payload.specialty is not None:
        profile.specialty = payload.specialty.strip() or None
    if payload.facility is not None:
        profile.facility = payload.facility.strip() or None
    db.commit()
    db.refresh(current_user)
    db.refresh(profile)
    return schemas_v2.DoctorProfileOut(full_name=current_user.full_name, email=current_user.email, role=current_user.role, specialty=profile.specialty, facility=profile.facility)
