"""WhatsApp reminders for a trusted person, on their own number and with their own consent.

Nothing is sent to a number until its owner proves it is theirs: they type the number, receive a one-time code on it and
type the code back (double opt-in), so nobody can be signed up by someone else typing their number. The consent is stored as a
`SharingConsent` for this woman's record (purpose `caregiver_reminders`), so the existing opt-out works too: replying STOP
withdraws it. The messages themselves hold no name, no result and no medicine ("a visit you are helping with is coming up.
Please sign in"), and they stop when the woman ends or limits the person's access. They are a short nudge, not a record.
"""
import hashlib
import re
import secrets
from datetime import timedelta

from fastapi import HTTPException

from . import caregiver_service, config, models, server_text, whatsapp

CODE_MINUTES = 10
MAX_ATTEMPTS = 5
MAX_CODES_PER_DAY = 5
COOLDOWN_SECONDS = 60
CONSENT_DAYS = 180
NUMBER = re.compile(r"^\+[1-9]\d{7,14}$")
PURPOSE = "caregiver_reminders"
# The permission each kind of reminder needs: the person only hears about what she already lets them see.
NEEDS = {"visit": "appointments", "checkin": "check_in"}


def available() -> bool:
    return whatsapp.automatic()


def mask(number: str | None) -> str | None:
    return f"{number[:3]}{'•' * max(len(number) - 7, 3)}{number[-4:]}" if number else None


def _hash(link_id: str, code: str) -> str:
    return hashlib.sha256(f"{link_id}:{code}:{config.JWT_SECRET}".encode()).hexdigest()


def row(db, link) -> models.CaregiverWhatsApp | None:
    return db.get(models.CaregiverWhatsApp, link.id)


def consent_of(db, wa) -> models.SharingConsent | None:
    consent = db.get(models.SharingConsent, wa.consent_id) if wa and wa.consent_id else None
    if consent is None or consent.revoked_at is not None or caregiver_service.utc(consent.expires_at) <= caregiver_service.now():
        return None
    return consent


def status(db, link) -> dict:
    wa = row(db, link)
    consent = consent_of(db, wa) if wa and wa.verified_at else None
    waiting = bool(wa and wa.code_hash and wa.code_expires_at and caregiver_service.utc(wa.code_expires_at) > caregiver_service.now())
    state = "on" if consent else "waiting" if waiting else "off"
    return {"available": available(), "mode": whatsapp.mode(), "status": state, "number": mask(wa.number) if wa and state != "off" else None,
            "expiresAt": caregiver_service.iso(consent.expires_at) if consent else None,
            "visits": bool((link.permissions or {}).get("appointments")), "checkIns": bool((link.permissions or {}).get("check_in"))}


def start(db, link, user, number: str) -> dict:
    if not available():
        raise HTTPException(409, "WhatsApp sending is not set up on this server, so reminders cannot be turned on.")
    number = "".join(number.split())
    if not NUMBER.match(number):
        raise HTTPException(400, "Write the number with the country code, for example +919812345678.")
    wa = row(db, link)
    now = caregiver_service.now()
    if wa is None:
        wa = models.CaregiverWhatsApp(link_id=link.id)
        db.add(wa)
    if wa.requested_at and (now - caregiver_service.utc(wa.requested_at)).total_seconds() < COOLDOWN_SECONDS:
        raise HTTPException(429, "Please wait a minute before asking for another code.")
    if wa.window_start is None or now - caregiver_service.utc(wa.window_start) > timedelta(hours=24):
        wa.window_start, wa.window_count = now, 0
    if wa.window_count >= MAX_CODES_PER_DAY:
        raise HTTPException(429, "Too many codes were asked for today. Please try again tomorrow.")
    code = f"{secrets.randbelow(1_000_000):06d}"
    language = server_text.language_of(db, user.id)
    wa.number, wa.code_hash, wa.code_expires_at, wa.attempts = number, _hash(link.id, code), now + timedelta(minutes=CODE_MINUTES), 0
    wa.requested_at, wa.window_count, wa.verified_at, wa.consent_id = now, wa.window_count + 1, None, None
    try:
        whatsapp.send(number, server_text.code_text(code, language), template_env="MATERNASYNC_WHATSAPP_CODE_TEMPLATE", params=[code])
    except whatsapp.WhatsAppError as error:
        wa.code_hash, wa.code_expires_at = None, None
        db.commit()  # keep the cooldown and the count, drop the code
        raise HTTPException(502, str(error))
    simulated = whatsapp.mode() == "simulator"  # a demo has no phone to read the code from, so the screen shows it, labelled
    return {"demoCode": code if simulated else None}


def confirm(db, link, user, code: str) -> None:
    wa = row(db, link)
    now = caregiver_service.now()
    if wa is None or not wa.code_hash or not wa.code_expires_at or caregiver_service.utc(wa.code_expires_at) <= now:
        raise HTTPException(400, "That code has expired. Ask for a new one.")
    if wa.attempts >= MAX_ATTEMPTS:
        raise HTTPException(429, "Too many wrong codes. Ask for a new one.")
    wa.attempts += 1
    if not secrets.compare_digest(wa.code_hash, _hash(link.id, "".join(ch for ch in (code or "") if ch.isdigit()))):
        db.commit()
        raise HTTPException(400, "That code is not right.")
    expires = now + timedelta(days=CONSENT_DAYS)
    if link.access_until:
        expires = min(expires, caregiver_service.utc(link.access_until))
    consent = models.SharingConsent(episode_id=link.episode_id, recipient=wa.number, purpose=PURPOSE, expires_at=expires)
    db.add(consent)
    db.flush()
    wa.consent_id, wa.verified_at, wa.code_hash, wa.code_expires_at = consent.id, now, None, None


def turn_off(db, link) -> bool:
    wa = row(db, link)
    if wa is None:
        return False
    consent = db.get(models.SharingConsent, wa.consent_id) if wa.consent_id else None
    changed = bool(consent and consent.revoked_at is None) or bool(wa.code_hash)
    if consent and consent.revoked_at is None:
        consent.revoked_at = caregiver_service.now()
    wa.code_hash = wa.code_expires_at = wa.consent_id = wa.verified_at = None
    return changed


def usable(db, link, kind: str) -> models.SharingConsent | None:
    """The consent to send under, only if every condition still holds: the link is current (not removed, not past its end date),
    she still lets this person see that kind of thing, and they have not withdrawn (or replied STOP)."""
    if not caregiver_service.is_current(link) or not (link.permissions or {}).get(NEEDS[kind]):
        return None
    wa = row(db, link)
    return consent_of(db, wa) if wa and wa.verified_at else None
