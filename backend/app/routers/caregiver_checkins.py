"""Daily Check-in for a trusted person: when the last check-in was, and "Remind her".

The reminder is one short note in her Updates, from the person she invited, by the name she gave them. It says nothing about her health and
never names a medicine or a result. A trusted person can send a few a day (`caregiver_nudge`); every one is audit-logged, and she can see it.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import caregiver_nudge, models
from ..database import get_db
from .caregiver import _iso, _tell_her, access, caregiver

router = APIRouter(prefix="/api/v2/caregiver", tags=["caregiver-checkins"])


def _state(db: Session, link: models.CaregiverLink) -> dict:
    last = db.query(models.DailyLog).filter_by(episode_id=link.episode_id, skipped=False).order_by(models.DailyLog.recorded_at.desc()).first()
    return {"lastCheckInAt": _iso(last.recorded_at) if last else None, "nudgesLeft": caregiver_nudge.left(db, link, "check_in"), "nudgeLimit": caregiver_nudge.DAILY_LIMIT}


@router.get("/{link_id}/check-ins/status")
def check_in_status(link: models.CaregiverLink = Depends(access("check_in")), db: Session = Depends(get_db)):
    """When her newest check-in was (skipped ones do not count) and how many reminders this person can still send today."""
    return _state(db, link)


@router.post("/{link_id}/check-ins/nudge")
def remind_her(link: models.CaregiverLink = Depends(access("check_in")), user: models.User = Depends(caregiver), db: Session = Depends(get_db)):
    """"Remind her": a note in her Updates asking her to fill in today's check-in. Refused with 429 once the day's reminders are used."""
    caregiver_nudge.spend(db, link, user, "check_in", "A trusted person reminded her to fill in a check-in", link.display_name)
    _tell_her(db, link, "caregiver_nudge_checkin")
    db.commit()
    return _state(db, link)
