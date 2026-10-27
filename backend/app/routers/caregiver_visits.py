"""Caregiver Reminders: "Remind her".

A trusted person who may see her reminders can send her one short note about a reminder that has not been answered yet. The note says only
that they are reminding her (no title, no medicine or vaccine name, no instructions), is limited to a few a day (`caregiver_nudge`), is
written to the audit log, and she is told by name. Only she can answer a reminder: nothing here answers one for her.
"""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import caregiver_nudge, caregiver_service, models
from ..database import get_db
from .caregiver import _tell_her, access, caregiver

router = APIRouter(prefix="/api/v2/caregiver", tags=["caregiver"])


@router.post("/{link_id}/reminders/{reminder_id}/nudge")
def remind_her(reminder_id: str, link: models.CaregiverLink = Depends(access("reminders")), user=Depends(caregiver), db: Session = Depends(get_db)):
    """One short note in her Updates about one of her reminders. Only a reminder of hers that is still waiting for her answer, and that is due soon
    (the same window the Reminders page shows), can be nudged."""
    reminder = db.get(models.CareReminder, reminder_id)
    if reminder is None or reminder.episode_id != link.episode_id:
        raise HTTPException(404, "Reminder not found.")
    if reminder.status != "pending":
        raise HTTPException(409, "She has already answered this reminder.")
    moment = caregiver_service.now().replace(tzinfo=None)
    if not (moment - timedelta(days=3) < reminder.scheduled_at <= moment + timedelta(days=30)):
        raise HTTPException(409, "This reminder is not due soon, so it cannot be sent now.")
    left = caregiver_nudge.spend(db, link, user, "reminder", "A trusted person reminded her about a reminder", reminder.kind)
    _tell_her(db, link, "caregiver_nudged_reminder")
    db.commit()
    return {"left": left, "limit": caregiver_nudge.DAILY_LIMIT}
