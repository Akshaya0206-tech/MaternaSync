"""Trusted person -> Home and Updates.

* `GET  /{link}/today`            the Today card: only the lines she has allowed, as counts and times (nothing is read or judged).
* `POST /{link}/stop-helping`     they leave. She is told, it is audit-logged, and they see nothing more about her.
* `GET  /updates-summary`         how many updates are unread, for each woman separately (the dot in the menu and the switcher).
* `PATCH /notifications/{id}/read`, `POST /notifications/read-all`   mark their own updates read.

Every route that is about one woman goes through `access()`, so a removed, ended or someone else's link is refused. The notification routes only ever
touch the signed-in person's own notifications.
"""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import caregiver_update_links, caregiver_whatsapp, models
from ..continuity_service import now, utc
from ..database import get_db
from .caregiver import _iso, _prompt_reminders, _record, _tell_her, access, caregiver

router = APIRouter(prefix="/api/v2/caregiver", tags=["caregiver-home"])


@router.get("/{link_id}/today")
def today(
    # Minutes the phone's clock is behind UTC, as JavaScript's getTimezoneOffset() gives it (India is -330). It decides where "today" starts, exactly as on her own Home.
    tz_offset: int = Query(0, ge=-840, le=840),
    link: models.CaregiverLink = Depends(access()),
    user: models.User = Depends(caregiver),
    db: Session = Depends(get_db),
):
    """What is going on today, for each thing she lets this person see. A line she has not allowed is not in the answer at all."""
    permissions = link.permissions or {}
    current = now()
    day_start = ((current - timedelta(minutes=tz_offset)).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(minutes=tz_offset)).replace(tzinfo=None)
    day_end = day_start + timedelta(days=1)
    out: dict = {}

    if permissions.get("check_in"):
        skipped_flags = [skipped for (skipped,) in db.query(models.DailyLog.skipped).filter(
            models.DailyLog.episode_id == link.episode_id, models.DailyLog.recorded_at >= day_start, models.DailyLog.recorded_at < day_end).all()]
        out["checkIn"] = "none" if not skipped_flags else ("recorded" if any(not skipped for skipped in skipped_flags) else "skipped")

    if permissions.get("reminders"):
        _prompt_reminders(db, user)
        out["remindersDue"] = (db.query(models.CareReminder).filter(models.CareReminder.episode_id == link.episode_id, models.CareReminder.status == "pending",
                                                                   models.CareReminder.scheduled_at < day_end).count())

    if permissions.get("questions"):
        week_ago = current - timedelta(days=7)
        out["answeredRecently"] = sum(
            1 for q in db.query(models.PatientQuestion).filter(models.PatientQuestion.episode_id == link.episode_id, models.PatientQuestion.asked_by_user_id == user.id).all()
            if any(r.status == "APPROVED" and r.visible_to_patient and utc(r.approved_at or r.created_at) >= week_ago for r in q.responses))

    if permissions.get("appointments"):
        ahead = (db.query(models.Appointment).filter(models.Appointment.episode_id == link.episode_id, models.Appointment.status == "scheduled")
                 .order_by(models.Appointment.scheduled_at.asc()).all())
        nxt = next((a for a in ahead if utc(a.scheduled_at) > current), None)
        out["nextVisit"] = {"id": nxt.id, "scheduledAt": _iso(nxt.scheduled_at), "type": nxt.appointment_type, "location": nxt.location} if nxt else None
    return out


@router.post("/{link_id}/stop-helping")
def stop_helping(link: models.CaregiverLink = Depends(access()), user: models.User = Depends(caregiver), db: Session = Depends(get_db)):
    """They stop helping her. This ends the link for good (she can invite them again, with a new code), turns off their WhatsApp reminders,
    leaves any doctor's request to help with check-ins, and tells her. The audit record is written before the link changes. A second call is
    refused like any call on a link that has ended, so nothing is done twice."""
    _record(db, user, link, "caregiver_stopped_helping", "A trusted person stopped helping", link.display_name)
    _tell_her(db, link, "caregiver_stopped")
    caregiver_whatsapp.turn_off(db, link)
    asked = db.get(models.CheckInHelper, link.episode_id)
    if asked is not None and asked.link_id == link.id:
        db.delete(asked)
    link.status, link.revoked_at, link.revoked_by, link.code_hash, link.code_expires_at = "REVOKED", now(), "caregiver", None, None
    db.commit()
    return {"stopped": True}


# ---------------------------------------------------------------- Updates: unread and read
@router.get("/updates-summary")
def updates_summary(user: models.User = Depends(caregiver), db: Session = Depends(get_db)):
    """{total, byLink: {link id: unread}, unassigned}: unread updates in all, for each woman, and those that belong to none of them."""
    _prompt_reminders(db, user)
    return caregiver_update_links.unread_counts(db, user)


@router.post("/notifications/read-all")
def read_all(user: models.User = Depends(caregiver), db: Session = Depends(get_db)):
    for note in caregiver_update_links.unread_for(db, user):
        note.is_read = True
    db.commit()
    return caregiver_update_links.unread_counts(db, user)


@router.patch("/notifications/{notification_id}/read")
def read_one(notification_id: str, user: models.User = Depends(caregiver), db: Session = Depends(get_db)):
    note = db.query(models.Notification).filter(models.Notification.id == notification_id, models.Notification.recipient_user_id == user.id).first()
    if note is None:
        raise HTTPException(404, "Update not found.")
    note.is_read = True
    db.commit()
    return caregiver_update_links.describe(db, user, [note])[0]
