"""How a doctor's name is written wherever a PATIENT (or someone helping her) reads it.

A doctor can choose a title (for example Dr. or Prof.) and a name to show patients on her Profile. If she chooses nothing, patients see her
account name exactly as before. Her own screens, the audit log and the clinic's other doctors always see the real account name: this is only
about what patients are shown, and every patient-facing place goes through `shown_name` so the choice applies the same everywhere.
"""
from sqlalchemy.orm import Session

from . import models

MAX_TITLE = 20
MAX_NAME = 80


def compose(full_name: str | None, title: str | None, name: str | None) -> str | None:
    """The title, then the name shown to patients (or the account name when none is chosen). A title the name already starts with is not repeated."""
    title, name = (title or "").strip(), (name or "").strip()
    base = name or (full_name or "").strip()
    if not base:
        return None
    if not title or base.lower().startswith(title.lower()):
        return base
    return f"{title} {base}"


def shown_name(db: Session, user: models.User | None) -> str | None:
    """What patients see for this doctor."""
    if user is None:
        return None
    profile = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == user.id).first()
    if profile is None:
        return user.full_name
    return compose(user.full_name, profile.display_title, profile.display_name)


def shown_name_of(db: Session, user_id: str | None, fallback: str = "Unassigned") -> str:
    """Like `shown_name` for a user id; the fallback is what the code showed before when there is no such person."""
    user = db.get(models.User, user_id) if user_id else None
    return shown_name(db, user) or fallback if user else fallback
