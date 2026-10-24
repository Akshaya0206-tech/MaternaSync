"""Trusted-person (caregiver) links: invite codes, acceptance and the permission rules.

The woman is always the owner. She creates an invite, chooses what the person may do, and can remove them at any time.
A code is shown once, is single-use, expires after 48 hours, and only its hash is stored.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from . import config, models
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
    db.add(models.Notification(
        recipient_user_id=link.patient_user_id, episode_id=link.episode_id, type="caregiver_joined",
        title="A trusted person joined", body=f"{user.full_name} can now use MaternaSync for you, within what you allowed.",
        related_entity_type="CaregiverLink", related_entity_id=link.id,
    ))


def active_links_for_episode(db, episode_id: str, permission: str | None = None) -> list[models.CaregiverLink]:
    links = db.query(models.CaregiverLink).filter_by(episode_id=episode_id, status="ACTIVE").all()
    return [l for l in links if l.caregiver_user_id and (permission is None or (l.permissions or {}).get(permission))]
