from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/api/patients", tags=["patients"])


def _compute_gestational_age(edd_str: str) -> tuple[int, int]:
    """Reverse-calculates current gestational age from EDD using the
    standard 40-week pregnancy length. This is simple arithmetic on a
    clinician-provided date, not a clinical inference."""
    try:
        edd = date.fromisoformat(edd_str)
    except ValueError:
        return 0, 0
    days_until_due = (edd - date.today()).days
    days_pregnant = max(0, (40 * 7) - days_until_due)
    weeks, days = divmod(days_pregnant, 7)
    return min(weeks, 42), days


def _log_activity(db: Session, patient_id: str, action: str, title: str, details: str, user: str, role: str, record_id: str | None = None):
    entry = models.ActivityLog(
        patient_id=patient_id, action=action, title=title, details=details,
        user=user, role=role, record_id=record_id,
    )
    db.add(entry)


@router.get("", response_model=list[schemas.PatientSummary])
def list_patients(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    patients = db.query(models.Patient).filter(models.Patient.owner_user_id == current_user.id).order_by(models.Patient.created_at.desc()).all()
    summaries = []
    for p in patients:
        open_count = sum(1 for w in p.workflow_items if w.status != "completed")
        summaries.append(schemas.PatientSummary(
            id=p.id, patient_name=p.patient_name, mrn=p.mrn, age=p.age, edd=p.edd,
            gestational_age_weeks=p.gestational_age_weeks, gestational_age_days=p.gestational_age_days,
            risk_category=p.risk_category, record_count=len(p.records), open_workflow_count=open_count,
        ))
    return summaries


@router.post("", response_model=schemas.PatientOut)
def create_patient(payload: schemas.PatientCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    weeks, days = _compute_gestational_age(payload.edd)
    patient = models.Patient(
        owner_user_id=current_user.id,
        patient_name=payload.patient_name.strip(),
        age=payload.age,
        dob=payload.dob,
        edd=payload.edd,
        mrn=payload.mrn,
        gestational_age_weeks=weeks,
        gestational_age_days=days,
        primary_clinician=current_user.full_name,
    )
    db.add(patient)
    db.flush()
    _log_activity(db, patient.id, "record_added", f"Patient episode created for {patient.patient_name}",
                  "Episode created manually by care team.", current_user.full_name, current_user.role)
    db.commit()
    db.refresh(patient)
    return schemas.PatientOut.model_validate(patient)


def _get_owned_patient(db: Session, patient_id: str, current_user: models.User) -> models.Patient:
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if patient is None or patient.owner_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Patient not found.")
    return patient


@router.get("/{patient_id}", response_model=schemas.PatientOut)
def get_patient(patient_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    patient = _get_owned_patient(db, patient_id, current_user)
    return schemas.PatientOut.model_validate(patient)


@router.patch("/{patient_id}", response_model=schemas.PatientOut)
def update_patient(patient_id: str, payload: schemas.PatientUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    patient = _get_owned_patient(db, patient_id, current_user)
    update_data = payload.model_dump(exclude_unset=True, by_alias=False)

    marking_ready = update_data.get("is_ready_for_today_brief") is True and not patient.is_ready_for_today_brief
    for key, value in update_data.items():
        setattr(patient, key, value)
    if marking_ready:
        from datetime import datetime, timezone
        patient.handoff_timestamp = datetime.now(timezone.utc)
        _log_activity(db, patient.id, "phase1_handoff", "Phase 1 Context Package Locked & Handed Off",
                      f"All quality gates passed. Context prepared for \"Today's Brief\" under supervision of {patient.primary_clinician}.",
                      current_user.full_name, current_user.role)

    db.commit()
    db.refresh(patient)
    return schemas.PatientOut.model_validate(patient)


@router.get("/{patient_id}/records", response_model=list[schemas.RecordOut])
def list_records(patient_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    patient = _get_owned_patient(db, patient_id, current_user)
    records = sorted(patient.records, key=lambda r: r.timestamp, reverse=True)
    return [schemas.RecordOut.model_validate(r) for r in records]


@router.get("/{patient_id}/workflow-items", response_model=list[schemas.WorkflowItemOut])
def list_workflow_items(patient_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    patient = _get_owned_patient(db, patient_id, current_user)
    items = sorted(patient.workflow_items, key=lambda w: w.date_created, reverse=True)
    return [schemas.WorkflowItemOut.model_validate(w) for w in items]


@router.get("/{patient_id}/activity", response_model=list[schemas.ActivityLogOut])
def list_activity(patient_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    patient = _get_owned_patient(db, patient_id, current_user)
    logs = sorted(patient.activity_logs, key=lambda l: l.timestamp, reverse=True)
    return [schemas.ActivityLogOut.model_validate(l) for l in logs]


@router.get("/{patient_id}/admin-docs", response_model=list[schemas.AdminDocOut])
def list_admin_docs(patient_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    patient = _get_owned_patient(db, patient_id, current_user)
    return [schemas.AdminDocOut.model_validate(d) for d in patient.admin_docs]
