"""A trusted person's Updates: which woman each one is about, whether it is unread, and which of their pages it leads to.

Like `update_links.py` for the woman. An update is worded from a message key (server_text.CATALOG); a few older ones carry only a type.
A page is offered only if she has allowed it: "Open Reminders" never appears for someone who may not see her reminders. The server decides
that here, and the page itself is refused again when it is opened.
"""
from sqlalchemy import or_
from sqlalchemy.orm import Session

from . import caregiver_service, models, server_text

HOME = "/caregiver/home"
APPOINTMENTS = "/caregiver/appointments"
CHECK_IN = "/caregiver/check-in"
REMINDERS = "/caregiver/reminders"
QUESTIONS = "/caregiver/questions"

# message key -> (page, the permission she must have given for the page to open for them; None means they can always open it)
BY_KEY = {
    "reminder_due_caregiver": (REMINDERS, "reminders"),
    "visit_prep_caregiver": (APPOINTMENTS, "appointments"),
    "visit_reminder_caregiver": (APPOINTMENTS, "appointments"),
    "helper_asked_caregiver": (HOME, None),
    "helper_ended_caregiver": (HOME, None),
    "caregiver_removed": (HOME, None),
    # a reply to a question this person asked (the question goes to whoever asked it)
    "question_answered": (QUESTIONS, "questions"),
    "question_answered_doctor": (QUESTIONS, "questions"),
    "question_handled_offline": (QUESTIONS, "questions"),
}
# notification type -> the same, for notes that were written without a key (the missed check-in reminder, and older rows)
BY_TYPE = {
    "reminder_due_caregiver": (REMINDERS, "reminders"),
    "assistant_visit_reminder": (APPOINTMENTS, "appointments"),
    "assistant_reminder": (CHECK_IN, "check_in"),
    "question_answered": (QUESTIONS, "questions"),
    "caregiver_removed": (HOME, None),
}


def _key(note: models.Notification) -> str | None:
    if note.message_key in server_text.CATALOG:
        return note.message_key
    return server_text._LEGACY.get((note.title, note.body or ""))


def target(note: models.Notification) -> tuple[str, str | None] | None:
    return BY_KEY.get(_key(note)) or BY_TYPE.get(note.type)


def link_for(note: models.Notification, link: models.CaregiverLink | None) -> str | None:
    """The page this update leads to, or None when there is none or she has not allowed it."""
    found = target(note)
    if found is None:
        return None
    page, permission = found
    if permission is None:
        return page
    if link is None or not caregiver_service.is_current(link) or not (link.permissions or {}).get(permission):
        return None
    return page


def links_by_episode(db: Session, user: models.User) -> dict[str, models.CaregiverLink]:
    """The women this person is linked to right now, by the pregnancy record each one belongs to."""
    rows = db.query(models.CaregiverLink).filter_by(caregiver_user_id=user.id, status="ACTIVE").order_by(models.CaregiverLink.accepted_at).all()
    return {l.episode_id: l for l in rows}


def describe(db: Session, user: models.User, notes: list[models.Notification]) -> list[dict]:
    by_episode = links_by_episode(db, user)
    names = {}
    if by_episode:
        names = {e.id: e.patient_name for e in db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.id.in_(list(by_episode))).all()}
    out = []
    for note in notes:
        title, body = server_text.texts(db, user.id, note)
        link = by_episode.get(note.episode_id) if note.episode_id else None
        out.append({"id": note.id, "title": title, "body": body, "createdAt": caregiver_service.iso(note.created_at),
                    "type": note.type, "isRead": bool(note.is_read), "linkId": link.id if link else None, "womanName": names.get(link.episode_id) if link else None,
                    "link": link_for(note, link)})
    return out


def unread_for(db: Session, user: models.User) -> list[models.Notification]:
    return (db.query(models.Notification)
            .filter(models.Notification.recipient_user_id == user.id, or_(models.Notification.is_read.is_(False), models.Notification.is_read.is_(None))).all())


def unread_counts(db: Session, user: models.User) -> dict:
    """How many updates are unread in all, for each woman separately, and how many belong to no woman they look after right now."""
    by_episode = links_by_episode(db, user)
    unread = unread_for(db, user)
    by_link = {link.id: 0 for link in by_episode.values()}
    unassigned = 0
    for note in unread:
        link = by_episode.get(note.episode_id) if note.episode_id else None
        if link is None:
            unassigned += 1
        else:
            by_link[link.id] += 1
    return {"total": len(unread), "byLink": by_link, "unassigned": unassigned}
