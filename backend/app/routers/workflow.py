from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from .patients import _get_owned_patient, _log_activity

router = APIRouter(prefix="/api/patients/{patient_id}/workflow-items", tags=["workflow"])


@router.post("", response_model=schemas.WorkflowItemOut)
def create_workflow_item(
    patient_id: str,
    payload: schemas.WorkflowItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    patient = _get_owned_patient(db, patient_id, current_user)
    now = datetime.now(timezone.utc)
    item = models.WorkflowItem(
        patient_id=patient.id,
        type=payload.type,
        title=payload.title,
        description=payload.description,
        due_date=payload.due_date,
        priority=payload.priority,
        status="pending",
        assignee=payload.assignee or "Unassigned",
        source_context=payload.source_context,
        date_created=now,
        last_updated_at=now,
        verification_status="Pending Care-Team Review",
    )
    db.add(item)
    _log_activity(db, patient.id, "workflow_created", f"Workflow item \"{item.title}\" catalogued",
                  f"Type: {item.type}. Assigned: {item.assignee}.", current_user.full_name, current_user.role)
    db.commit()
    db.refresh(item)
    return schemas.WorkflowItemOut.model_validate(item)


@router.patch("/{item_id}", response_model=schemas.WorkflowItemOut)
def update_workflow_item(
    patient_id: str,
    item_id: str,
    payload: schemas.WorkflowItemUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    patient = _get_owned_patient(db, patient_id, current_user)
    item = next((w for w in patient.workflow_items if w.id == item_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Workflow item not found.")

    update_data = payload.model_dump(exclude_unset=True, by_alias=False)
    for key, value in update_data.items():
        setattr(item, key, value)
    item.last_updated_at = datetime.now(timezone.utc)

    _log_activity(db, patient.id, "workflow_updated", f"Workflow item \"{item.title}\" updated",
                  f"Status: {item.status}.", current_user.full_name, current_user.role)
    db.commit()
    db.refresh(item)
    return schemas.WorkflowItemOut.model_validate(item)
