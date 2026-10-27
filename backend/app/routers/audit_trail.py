"""A patient's audit trail, for her doctor. Read-only: nothing here edits or deletes a row. Only the doctor assigned to the patient may read it.

Opening the trail is NOT written to the log (that would bury everything else). Printing or exporting it IS, so that taking a copy leaves its own trace.
Also here: the visit-change requests still waiting for the doctor, shown at the top of the patient's brief."""
import json
from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field
from sqlalchemy import not_
from sqlalchemy.orm import Session

from .. import audit_trail, models, visit_changes
from .. import continuity_schemas as S
from ..continuity_service import audit, utc
from ..database import get_db
from ..deps import require_episode_access, require_role

doctor = require_role("doctor")
router = APIRouter(prefix="/api/v2/doctor/episodes/{episode_id}", tags=["doctor-audit-trail"])

MOST_PER_PAGE = 100


class ExportIn(S.Input):
    kind: Literal["print", "csv"]
    count: int = Field(ge=0, le=100000)
    # What the doctor had chosen when she took the copy (for the record): the date range, who, what kind, whether page views were included.
    filters: dict[str, str] = Field(default_factory=dict)


def _day(value: str | None, name: str) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(422, f"{name} must be a date like 2026-10-26.")


def _query(db: Session, episode_id: str, *, date_from, date_to, who, kind, include_views, tz_offset):
    q = db.query(models.AuditLog).filter(models.AuditLog.episode_id == episode_id)
    if date_from:
        q = q.filter(models.AuditLog.timestamp >= audit_trail.day_start_utc(date_from, tz_offset))
    if date_to:
        q = q.filter(models.AuditLog.timestamp < audit_trail.day_start_utc(date_to + timedelta(days=1), tz_offset))
    if who:
        q = q.filter(audit_trail.who_condition(who))
    if kind:
        q = q.filter(audit_trail.kind_condition(kind))
    if not include_views:
        q = q.filter(not_(models.AuditLog.action.in_(audit_trail.VIEW_ACTIONS)))
    return q


@router.get("/audit-trail")
def read_trail(
    episode_id: str,
    ep: models.PregnancyEpisode = Depends(require_episode_access),
    user: models.User = Depends(doctor),
    db: Session = Depends(get_db),
    date_from: str | None = Query(None, description="First day, YYYY-MM-DD"),
    date_to: str | None = Query(None, description="Last day, YYYY-MM-DD"),
    who: Literal["patient", "doctor", "trusted_person", "assistant", "other"] | None = None,
    kind: Literal["checkins", "documents", "questions", "visits", "consents", "trusted", "approved", "account", "other"] | None = None,
    include_views: bool = False,
    tz_offset: int = Query(0, ge=-840, le=840),
    limit: int = Query(25, ge=1, le=MOST_PER_PAGE),
    offset: int = Query(0, ge=0),
):
    q = _query(db, ep.id, date_from=_day(date_from, "date_from"), date_to=_day(date_to, "date_to"), who=who, kind=kind, include_views=include_views, tz_offset=tz_offset)
    total = q.count()
    rows = q.order_by(models.AuditLog.timestamp.desc(), models.AuditLog.id.desc()).offset(offset).limit(limit).all()
    items = audit_trail.rows_out(db, rows)
    return {"items": items, "total": total, "limit": limit, "offset": offset, "hasMore": offset + len(items) < total}


@router.post("/audit-trail/export")
def note_export(
    episode_id: str, payload: ExportIn,
    ep: models.PregnancyEpisode = Depends(require_episode_access),
    user: models.User = Depends(doctor),
    db: Session = Depends(get_db),
):
    """Recorded by the screen before it prints or saves a copy; if this fails the copy is not made."""
    chosen = {key: value[:40] for key, value in list(payload.filters.items())[:8]}
    audit(db, user, "audit_trail_exported", episode_id=ep.id, details=json.dumps({"how": payload.kind, "rows": payload.count, **chosen})[:500])
    db.commit()
    return {"recorded": True}


@router.get("/open-visit-changes")
def open_visit_changes(
    episode_id: str,
    ep: models.PregnancyEpisode = Depends(require_episode_access),
    user: models.User = Depends(doctor),
    db: Session = Depends(get_db),
):
    """Requests this patient made to move or cancel a confirmed visit that her doctor has not dealt with yet (the doctor's task is still open)."""
    out = []
    for appointment in db.query(models.Appointment).filter(models.Appointment.episode_id == ep.id, models.Appointment.change_kind.isnot(None)).order_by(models.Appointment.scheduled_at):
        task = db.get(models.Task, appointment.change_task_id) if appointment.change_task_id else None
        if task is None or task.status not in visit_changes.OPEN_TASK:
            continue
        out.append({
            "appointmentId": appointment.id, "taskId": task.id, "kind": appointment.change_kind, "visitType": appointment.appointment_type,
            "visitAt": utc(appointment.scheduled_at).isoformat(), "preferredAt": utc(appointment.change_preferred_at).isoformat() if appointment.change_preferred_at else None,
            "requestedAt": utc(appointment.change_requested_at).isoformat() if appointment.change_requested_at else None,
            "note": (appointment.change_note or "")[:500], "title": task.title,
        })
    return out
