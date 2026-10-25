"""Trusted-person (caregiver) links: invite codes, acceptance and the permission rules.

The woman is always the owner. She creates an invite, chooses what the person may do, and can remove them at any time.
A code is shown once, is single-use, expires after 48 hours, and only its hash is stored.
"""
import hashlib
import secrets
from datetime import date, datetime, time, timedelta, timezone

from fastapi import HTTPException

from . import config, models, server_text
from .models.caregiver import DEFAULT_PERMISSIONS, PERMISSIONS

INVITE_HOURS = 48
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O or 1/I, so a code read aloud or copied by hand is not mistaken


def now():
    return datetime.now(timezone.utc)


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def normalise(code: str | None) -> str:
    return "".join(ch for ch in (code or "").upper() if ch.isalnum())


def hash_code(code: str) -> str:
    return hashlib.sha256(f"{normalise(code)}:{config.JWT_SECRET}".encode()).hexdigest()


def new_code() -> str:
    raw = "".join(secrets.choice(_ALPHABET) for _ in range(8))
    return f"{raw[:4]}-{raw[4:]}"


def clean_permissions(given: dict | None) -> dict:
    """Only the known permissions, each a plain true or false; anything not mentioned stays at its default."""
    result = dict(DEFAULT_PERMISSIONS)
    for key in PERMISSIONS:
        if given and key in given:
            result[key] = bool(given[key])
    return result


def issue_code(link: models.CaregiverLink) -> str:
    code = new_code()
    link.code_hash = hash_code(code)
    link.code_expires_at = now() + timedelta(hours=INVITE_HOURS)
    return code


def find_open_invite(db, code: str | None) -> models.CaregiverLink:
    """The invite a code belongs to. The same message is used for every failure so a code cannot be guessed at."""
    bad = HTTPException(status_code=400, detail="That invite code is not valid or has expired. Ask her to make a new one.")
    if not normalise(code):
        raise bad
    link = db.query(models.CaregiverLink).filter(models.CaregiverLink.code_hash == hash_code(code or "")).first()
    if link is None or link.status != "INVITED" or not link.code_expires_at or utc(link.code_expires_at) < now():
        raise bad
    return link


def accept_invite(db, link: models.CaregiverLink, user: models.User) -> None:
    if user.id == link.patient_user_id:
        raise HTTPException(status_code=400, detail="You cannot be your own trusted person.")
    link.caregiver_user_id = user.id
    link.status = "ACTIVE"
    link.accepted_at = now()
    link.code_hash = None  # single use
    link.code_expires_at = None
    db.add(models.AuditLog(
        episode_id=link.episode_id, actor_user_id=user.id, actor_role="caregiver", actor_display_name=user.full_name,
        action="caregiver_invite_accepted", title="A trusted person accepted the invite", details=link.display_name,
        object_type="CaregiverLink", object_id=link.id,
    ))
    server_text.notify_key(db, link.patient_user_id, "caregiver_joined", episode_id=link.episode_id, type_="caregiver_joined", params={"name": user.full_name},
                           related_entity_type="CaregiverLink", related_entity_id=link.id)


def iso(value):
    return utc(value).isoformat() if value else None


MAX_ACCESS_DAYS = 730


def is_ended(link: models.CaregiverLink) -> bool:
    """Active, but past the end date the woman set. The person is still linked; they just cannot see anything until she extends it."""
    return link.status == "ACTIVE" and link.access_until is not None and utc(link.access_until) <= now()


def is_current(link: models.CaregiverLink) -> bool:
    """Linked, not removed and not past the end date: the only state in which the person may see anything or be messaged."""
    return link.status == "ACTIVE" and not is_ended(link)


def access_limit(day: date | None) -> datetime | None:
    """The woman picks a date; access lasts to the end of that day (UTC). Empty means no end date."""
    if day is None:
        return None
    end = datetime.combine(day, time(23, 59, 59), tzinfo=timezone.utc)
    if end <= now():
        raise HTTPException(status_code=400, detail="Choose a date in the future.")
    if end > now() + timedelta(days=MAX_ACCESS_DAYS):
        raise HTTPException(status_code=400, detail="Access can be limited for two years at most. Leave the date empty for no end date.")
    return end.replace(tzinfo=None)


def active_links_for_episode(db, episode_id: str, permission: str | None = None) -> list[models.CaregiverLink]:
    links = db.query(models.CaregiverLink).filter_by(episode_id=episode_id, status="ACTIVE").all()
    return [l for l in links if is_current(l) and l.caregiver_user_id and (permission is None or (l.permissions or {}).get(permission))]


# ================================================================= a doctor works with a trusted person
def helper_link(db, episode_id: str):
    """The trusted person a doctor asked to help with check-ins, as (request, link), if they can still do it: linked, inside their
    access dates, and she still allows check-ins. Someone who said no does not count. None when there is nobody."""
    request = db.get(models.CheckInHelper, episode_id)
    if request is None or request.status == "DECLINED":
        return None
    link = db.get(models.CaregiverLink, request.link_id)
    if link is None or not link.caregiver_user_id or not is_current(link) or not (link.permissions or {}).get("check_in"):
        return None
    return request, link


def upcoming_visits(db, episode_id: str) -> dict[str, models.Appointment]:
    """Confirmed visits still to come, by id: the only ones a checklist belongs to."""
    cutoff = now().replace(tzinfo=None)
    rows = db.query(models.Appointment).filter(models.Appointment.episode_id == episode_id, models.Appointment.status == "scheduled",
                                               models.Appointment.scheduled_at > cutoff).all()
    return {a.id: a for a in rows}


def prep_out(db, item: models.VisitPrepItem) -> dict:
    who = db.get(models.User, item.done_by_user_id) if item.done_by_user_id else None
    return {"id": item.id, "appointmentId": item.appointment_id, "text": item.text, "done": item.done_at is not None, "doneAt": iso(item.done_at),
            "doneByName": who.full_name if who else None, "doneByRole": item.done_by_role if who else None}


def prep_by_visit(db, episode_id: str) -> dict[str, list[dict]]:
    """The checklist for each upcoming visit, in the order the doctor wrote it."""
    visits = upcoming_visits(db, episode_id)
    if not visits:
        return {}
    items = (db.query(models.VisitPrepItem).filter(models.VisitPrepItem.episode_id == episode_id, models.VisitPrepItem.appointment_id.in_(list(visits)))
             .order_by(models.VisitPrepItem.position, models.VisitPrepItem.created_at).all())
    out: dict[str, list[dict]] = {}
    for item in items:
        out.setdefault(item.appointment_id, []).append(prep_out(db, item))
    return out


def tick_prep_item(db, item: models.VisitPrepItem, user: models.User, done: bool) -> None:
    """Tick or untick one line. The visit must still be coming up. Saying the same thing again changes nothing."""
    visits = upcoming_visits(db, item.episode_id)
    if item.appointment_id not in visits:
        raise HTTPException(status_code=409, detail="This visit is no longer coming up.")
    if done and item.done_at is None:
        item.done_at, item.done_by_user_id, item.done_by_role = now(), user.id, user.role
    elif not done and item.done_at is not None:
        item.done_at = item.done_by_user_id = item.done_by_role = None


SENSITIVE_KINDS = ("medicine", "vaccine")


def reminder_view(reminder: models.CareReminder, details: bool) -> dict:
    """What a trusted person sees of one of her reminders. WHEN and what KIND is always shown (she allowed reminders). The title and
    instructions of a medicine or vaccine reminder are shown only when she also allows the doctor's summaries and instructions, and
    nobody but her sees how she answered: only whether she has."""
    hidden = reminder.kind in SENSITIVE_KINDS and not details
    return {"id": reminder.id, "kind": reminder.kind, "scheduledAt": iso(reminder.scheduled_at), "answered": reminder.status != "pending",
            "title": None if hidden else reminder.title, "instructions": reminder.instructions if details else None, "detailsHidden": hidden}


def reminders_for(db, link: models.CaregiverLink) -> list[dict]:
    """Her pending reminders for the next month, plus the ones she answered in the last three days."""
    details = bool((link.permissions or {}).get("care_plan"))
    t = now().replace(tzinfo=None)
    rows = (db.query(models.CareReminder).filter(models.CareReminder.episode_id == link.episode_id, models.CareReminder.scheduled_at > t - timedelta(days=3),
                                                 models.CareReminder.scheduled_at <= t + timedelta(days=30))
            .order_by(models.CareReminder.scheduled_at).limit(60).all())
    return [reminder_view(r, details) for r in rows if r.status == "pending" or (r.responded_at and utc(r.responded_at) > now() - timedelta(days=3))]


def reminder_prompts(db, link: models.CaregiverLink) -> int:
    """Once a reminder of hers has come due, the trusted person who may see her reminders gets one short note in their Updates (no names,
    no instructions). Done when they open the app, once per reminder, and only for reminders from the last three days."""
    if not is_current(link) or not link.caregiver_user_id or not (link.permissions or {}).get("reminders"):
        return 0
    t = now().replace(tzinfo=None)
    due = (db.query(models.CareReminder).filter(models.CareReminder.episode_id == link.episode_id, models.CareReminder.status == "pending",
                                                models.CareReminder.scheduled_at <= t, models.CareReminder.scheduled_at > t - timedelta(days=3)).all())
    episode = db.get(models.PregnancyEpisode, link.episode_id)
    first_name = ((episode.patient_name if episode else "") or "").split(" ")[0]
    made = 0
    for reminder in due:
        if db.query(models.Notification).filter_by(recipient_user_id=link.caregiver_user_id, related_entity_type="CareReminder", related_entity_id=reminder.id).first():
            continue
        server_text.notify_key(db, link.caregiver_user_id, "reminder_due_caregiver", episode_id=link.episode_id, type_="reminder_due_caregiver", params={"name": first_name},
                               related_entity_type="CareReminder", related_entity_id=reminder.id)
        made += 1
    return made
