import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .. import extraction, models, schemas
from ..config import UPLOAD_DIR
from ..database import get_db
from ..deps import get_current_user
from .patients import _get_owned_patient, _log_activity

router = APIRouter(prefix="/api/patients/{patient_id}/records", tags=["records"])

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".bmp"}


def _trimester_for_week(weeks: int) -> int:
    if weeks < 14:
        return 1
    if weeks < 28:
        return 2
    return 3


@router.post("/upload")
async def upload_record(
    patient_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    patient = _get_owned_patient(db, patient_id, current_user)

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
        text, used_ocr, ocr_unavailable = extraction.extract_text(dest_path)
        result = extraction.extract_structured_fields(text, file.filename or stored_name)
    except Exception:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="We couldn't extract information from this document.")

    fields = result["fields"]
    derived = result["derived"]
    now = datetime.now(timezone.utc)

    ga_weeks = derived["gaWeeks"] or patient.gestational_age_weeks or 0
    ga_days = derived["gaDays"] or patient.gestational_age_days or 0

    record = models.Record(
        patient_id=patient.id,
        title=derived["title"],
        category=derived["category"],
        timestamp=derived["timestamp"] or now.date().isoformat(),
        gestational_age_weeks=ga_weeks,
        gestational_age_days=ga_days,
        trimester=_trimester_for_week(ga_weeks),
        author=fields["responsibleDoctor"]["value"] or "Not found in source",
        author_role="",
        facility=fields["facility"]["value"] or "Not found in source",
        modality="Uploaded Medical Record",
        source_type="Clinician Uploaded Document (Local Extraction)",
        summary_text=derived["summary"],
        full_content=text[:20000],
        source_id=file.filename or stored_name,
        tags=[],
        is_ai_structured_only=False,
        document_filename=file.filename,
        document_path=stored_name,
        verification_status="raw",
        extraction_status=fields,
    )
    db.add(record)
    db.flush()

    details = "Text-layer extraction via PyMuPDF." if not used_ocr else (
        "Scanned document processed via Tesseract OCR." if not ocr_unavailable
        else "Scanned document detected but OCR is not installed on this server; fields may be incomplete."
    )
    _log_activity(db, patient.id, "record_added", f"Uploaded {file.filename}", details,
                  current_user.full_name, current_user.role, record_id=record.id)
    db.commit()
    db.refresh(record)

    return {
        "record": schemas.RecordOut.model_validate(record),
        "extractedFields": fields,
        "ocrUsed": used_ocr,
        "ocrUnavailable": ocr_unavailable,
    }


@router.post("/manual", response_model=schemas.RecordOut)
def create_manual_record(
    patient_id: str,
    payload: schemas.ManualRecordCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    patient = _get_owned_patient(db, patient_id, current_user)
    ga_weeks = patient.gestational_age_weeks or 0
    ga_days = patient.gestational_age_days or 0

    record = models.Record(
        patient_id=patient.id,
        title=payload.category.replace("_", " ").title(),
        category=payload.category,
        timestamp=payload.timestamp,
        gestational_age_weeks=ga_weeks,
        gestational_age_days=ga_days,
        trimester=_trimester_for_week(ga_weeks),
        author=payload.author or current_user.full_name,
        author_role=current_user.role,
        facility=payload.facility,
        modality="Manually Entered Record",
        source_type=payload.source_reference or "Clinician Manual Entry",
        summary_text=payload.summary_text,
        full_content=payload.summary_text,
        source_id=payload.source_reference or "Manual Entry",
        tags=[],
        is_ai_structured_only=False,
        verification_status="verified",
        verified_by=current_user.full_name,
        verified_at=datetime.now(timezone.utc),
    )
    db.add(record)
    db.flush()
    _log_activity(db, patient.id, "record_added", f"{current_user.full_name} manually entered a record",
                  f"{record.title} added without a source document.", current_user.full_name, current_user.role, record_id=record.id)
    db.commit()
    db.refresh(record)
    return schemas.RecordOut.model_validate(record)


@router.patch("/{record_id}", response_model=schemas.RecordOut)
def update_record(
    patient_id: str,
    record_id: str,
    payload: schemas.RecordUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    patient = _get_owned_patient(db, patient_id, current_user)
    record = next((r for r in patient.records if r.id == record_id), None)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found.")

    update_data = payload.model_dump(exclude_unset=True, by_alias=False)
    status_changed = "verification_status" in update_data
    for key, value in update_data.items():
        setattr(record, key, value)
    if status_changed:
        record.verified_at = datetime.now(timezone.utc)

    if status_changed:
        _log_activity(db, patient.id, "record_verified", f"Record verification status changed to {record.verification_status.upper()}",
                      f"Verified by human care team reviewer: {record.verified_by or current_user.full_name}.",
                      current_user.full_name, current_user.role, record_id=record.id)
    else:
        _log_activity(db, patient.id, "record_replaced", f"Record \"{record.title}\" edited",
                      "Clinician edited extracted/entered fields prior to approval.", current_user.full_name, current_user.role, record_id=record.id)
    db.commit()
    db.refresh(record)
    return schemas.RecordOut.model_validate(record)


@router.post("/{record_id}/approve", response_model=schemas.RecordOut)
def approve_record(
    patient_id: str,
    record_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    patient = _get_owned_patient(db, patient_id, current_user)
    record = next((r for r in patient.records if r.id == record_id), None)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found.")

    record.verification_status = "verified"
    record.verified_by = current_user.full_name
    record.verified_at = datetime.now(timezone.utc)

    _log_activity(db, patient.id, "record_verified", f"{current_user.full_name} verified \"{record.title}\"",
                  "Approved and added to the chronological journey.", current_user.full_name, current_user.role, record_id=record.id)
    db.commit()
    db.refresh(record)
    return schemas.RecordOut.model_validate(record)


@router.post("/{record_id}/reject", response_model=schemas.RecordOut)
def reject_record(
    patient_id: str,
    record_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    patient = _get_owned_patient(db, patient_id, current_user)
    record = next((r for r in patient.records if r.id == record_id), None)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found.")

    record.verification_status = "rejected"
    _log_activity(db, patient.id, "record_replaced", f"Record \"{record.title}\" rejected",
                  "Clinician rejected this extracted record; it will not appear in the journey.", current_user.full_name, current_user.role, record_id=record.id)
    db.commit()
    db.refresh(record)
    return schemas.RecordOut.model_validate(record)


@router.get("/{record_id}/source")
def get_record_source(
    patient_id: str,
    record_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    patient = _get_owned_patient(db, patient_id, current_user)
    record = next((r for r in patient.records if r.id == record_id), None)
    if record is None or not record.document_path:
        raise HTTPException(status_code=404, detail="No original source file is attached to this record.")

    file_path = UPLOAD_DIR / record.document_path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Source file not found on server.")

    return FileResponse(file_path, filename=record.document_filename or file_path.name)
