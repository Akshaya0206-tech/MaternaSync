"""The doctor's Updates: what is unread (for the dot on the menu) and marking updates read.

These routes are for the signed-in doctor only and read nothing but her own notifications. The list itself and marking one update read are in
doctor_portal.py; the link on each update comes from doctor_update_links.py.
"""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..deps import require_role
from ..schemas import CamelModel

router = APIRouter(prefix="/api/v2/doctor", tags=["doctor-updates"])
doctor = require_role("doctor")


class UnreadSummaryOut(CamelModel):
    total: int


class MarkReadIn(CamelModel):
    scope: Literal["all", "ids"]
    ids: list[str] | None = Field(None, max_length=500)


def _unread(db: Session, user: models.User):
    return db.query(models.Notification).filter(models.Notification.recipient_user_id == user.id,
                                                or_(models.Notification.is_read.is_(False), models.Notification.is_read.is_(None)))


@router.get("/updates/unread-summary", response_model=UnreadSummaryOut)
def unread_summary(user: models.User = Depends(doctor), db: Session = Depends(get_db)):
    return UnreadSummaryOut(total=_unread(db, user).count())


@router.post("/updates/mark-read", response_model=UnreadSummaryOut)
def mark_read(payload: MarkReadIn, user: models.User = Depends(doctor), db: Session = Depends(get_db)):
    """Everything, or just the updates named. Only her own are ever touched: an id that is not hers is ignored."""
    if payload.scope == "ids" and not payload.ids:
        raise HTTPException(400, "Say which updates to mark as read.")
    query = _unread(db, user)
    if payload.scope == "ids":
        query = query.filter(models.Notification.id.in_(payload.ids))
    for note in query.all():
        note.is_read = True
    db.commit()
    return UnreadSummaryOut(total=_unread(db, user).count())
