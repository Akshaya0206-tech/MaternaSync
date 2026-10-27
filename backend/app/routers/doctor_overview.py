"""The doctor's Follow-ups page and the Clinic Overview's printed / downloaded summary.

Follow-ups: the open tasks assigned to the signed-in doctor (the same ones the Dashboard counts under "Follow-ups owned by you"), with how many
days each is overdue, and, separately, the open tasks for her patients that someone else owns or nobody owns. Plain dates and counts only.

Clinic summary: printing or downloading the clinic overview is recorded, like every other way patient information leaves the screen."""
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy.orm import Session

from .. import clinic_range, models, schemas_v2
from .. import continuity_schemas as S
from ..continuity_service import audit, now
from ..database import get_db
from ..deps import require_role
from ..schemas import CamelModel
from .doctor_portal import OPEN_TASK_STATUSES, _assigned_episode_ids, _to_task_out

router = APIRouter(tags=["doctor-overview"])
doctor = require_role("doctor")
staff = require_role("doctor", "care_team")


class FollowUpOut(schemas_v2.TaskOut):
    days_overdue: int | None = None  # whole days after the due date; None when the task is not overdue
    is_due: bool = False  # due today or earlier
    owned_by_you: bool = False


class FollowUpsOverviewOut(CamelModel):
    today: str
    mine: list[FollowUpOut]
    others: list[FollowUpOut]


def _follow_up(db: Session, task: models.Task, me: models.User, today: date) -> FollowUpOut:
    base = _to_task_out(db, task)
    due = None
    try:
        due = date.fromisoformat(task.due_date) if task.due_date else None
    except ValueError:
        due = None  # a due date that is not a date is treated as no due date
    late = (today - due).days if due and due < today else None
    return FollowUpOut(**base.model_dump(), days_overdue=late, is_due=bool(due and due <= today), owned_by_you=task.owner_user_id == me.id)


def _order(task: models.Task):
    return (task.due_date is None, task.due_date or "", task.created_at)


@router.get("/api/v2/doctor/follow-ups/overview", response_model=FollowUpsOverviewOut)
def follow_ups_overview(current_user: models.User = Depends(doctor), db: Session = Depends(get_db)):
    today = now().date()
    mine = (db.query(models.Task).filter(models.Task.owner_user_id == current_user.id, models.Task.status.in_(OPEN_TASK_STATUSES)).all())
    episode_ids = _assigned_episode_ids(db, current_user)
    others = []
    if episode_ids:
        others = [t for t in db.query(models.Task).filter(models.Task.episode_id.in_(episode_ids), models.Task.status.in_(OPEN_TASK_STATUSES)).all()
                  if t.owner_user_id != current_user.id]
    return FollowUpsOverviewOut(
        today=today.isoformat(),
        mine=[_follow_up(db, t, current_user, today) for t in sorted(mine, key=_order)],
        others=[_follow_up(db, t, current_user, today) for t in sorted(others, key=_order)],
    )


class ClinicExportIn(S.Input):
    kind: Literal["print", "csv"]
    from_date: str | None = Field(None, max_length=10)
    to_date: str | None = Field(None, max_length=10)
    patients: int = Field(ge=0, le=5000)


@router.post("/api/v2/continuity/clinic/export")
def clinic_export(payload: ClinicExportIn, user: models.User = Depends(staff), db: Session = Depends(get_db)):
    """A printout or a file of the clinic overview leaves the screen: that is recorded (who, how, which range, how many patients)."""
    window = clinic_range.parse_range(payload.from_date, payload.to_date)
    audit(db, user, "clinic_report_exported", after={"how": payload.kind, "range": window.text() if window else None, "patients": payload.patients},
          details=f"{user.full_name} {'printed' if payload.kind == 'print' else 'downloaded'} the clinic summary ({payload.patients} patients, "
                  + (f"{window.first} to {window.last}" if window else "all recorded dates") + ")")
    db.commit()
    return {"recorded": True}
