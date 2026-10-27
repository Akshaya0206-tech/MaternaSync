"""A trusted person can nudge her ("Remind her") a few times a day.

One limit and one audit record for every kind of nudge, so the screens that offer it agree. The note that reaches her is written by the
caller through `_tell_her` (four languages, no medicine names, no results); this only decides whether another nudge is allowed and
records that it happened. Counting uses the audit log, so nothing new is stored and nothing can be hidden from her record.
"""
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from . import models

DAILY_LIMIT = 3  # per trusted person, per woman, per kind, in any 24 hours
KINDS = ("reminder", "check_in")


def _action(kind: str) -> str:
    return f"caregiver_nudge_{kind}"


def used(db: Session, link: models.CaregiverLink, kind: str) -> int:
    since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=24)
    return (db.query(models.AuditLog).filter(models.AuditLog.action == _action(kind), models.AuditLog.object_id == link.id, models.AuditLog.timestamp >= since).count())


def left(db: Session, link: models.CaregiverLink, kind: str) -> int:
    return max(0, DAILY_LIMIT - used(db, link, kind))


def spend(db: Session, link: models.CaregiverLink, user: models.User, kind: str, title: str, details: str = "") -> int:
    """Use one nudge: refuse (429) when today's are used up, otherwise record it. Returns how many are left. The caller then tells her and commits."""
    if kind not in KINDS:
        raise ValueError(kind)
    if left(db, link, kind) <= 0:
        raise HTTPException(429, f"You have reminded her {DAILY_LIMIT} times in the last day. Please wait before sending another.")
    db.add(models.AuditLog(episode_id=link.episode_id, actor_user_id=user.id, actor_role="caregiver", actor_display_name=user.full_name, action=_action(kind), title=title,
                           details=details[:300], object_type="CaregiverLink", object_id=link.id))
    db.flush()
    return left(db, link, kind)
