"""Phone sign-in and password-confirmed enrollment for existing accounts."""
import hashlib
import hmac
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import Field
from sqlalchemy import case, or_
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import config, models, phone_provider, schemas
from ..database import get_db
from ..deps import get_current_user, refuse_sign_in
from ..security import create_access_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["phone sign-in"])
INVALID = "The code is incorrect or expired. Please request a new code if needed."
UNAVAILABLE = "Phone sign-in is unavailable right now. Please use your password."
LIMITED = "Too many requests. Please wait before trying again."


class PhoneIn(schemas.CamelModel):
    phone: str = Field(min_length=10, max_length=30)


class EnrollIn(PhoneIn):
    password: str = Field(min_length=1, max_length=128)


class ChallengeIn(schemas.CamelModel):
    challenge_id: str = Field(min_length=30, max_length=100)


class CheckIn(ChallengeIn):
    code: str = Field(pattern=r"^[0-9]{6}$")


class PasswordIn(schemas.CamelModel):
    password: str = Field(min_length=1, max_length=128)


class ChallengeOut(schemas.CamelModel):
    challenge_id: str
    masked_phone: str
    expires_at: datetime
    resend_after: int


def enabled():
    if not phone_provider.configured():
        raise HTTPException(503, UNAVAILABLE)


def normalize_phone(raw: str) -> str:
    number = re.sub(r"[\s()\-]", "", raw)
    if re.fullmatch(r"[6-9][0-9]{9}", number):
        number = "+91" + number
    if not re.fullmatch(r"\+91[6-9][0-9]{9}", number):
        raise HTTPException(400, "Enter a valid Indian mobile number with +91.")
    return number


def masked(phone: str) -> str:
    return "+91 ******" + phone[-4:]


def rate(db: Session, scope: str, value: str, limit: int, seconds: int):
    """Atomic, rolling window counters shared by all API processes using this DB."""
    if limit < 1:
        raise HTTPException(429, LIMITED)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    key = hmac.new(config.JWT_SECRET.encode(), f"{scope}:{value}".encode(), hashlib.sha256).hexdigest()
    table = models.PhoneAuthLimit
    expired = table.expires_at <= now
    statement = insert(table).values(key=key, count=1, expires_at=now + timedelta(seconds=seconds))
    statement = statement.on_conflict_do_update(
        index_elements=["key"],
        set_={"count": case((expired, 1), else_=table.count + 1),
              "expires_at": case((expired, now + timedelta(seconds=seconds)), else_=table.expires_at)},
        where=or_(expired, table.count < limit),
    ).returning(table.key)
    accepted = db.execute(statement).first() is not None
    db.commit()
    if not accepted:
        raise HTTPException(429, LIMITED, headers={"Retry-After": str(seconds)})


def ip(request: Request) -> str:
    # Proxy headers are accepted only through the API host's trusted-proxy configuration.
    return request.client.host if request.client else "unknown"


def send_limits(db: Session, request: Request, phone: str, user_id: str | None = None):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    db.query(models.PhoneAuthLimit).filter(models.PhoneAuthLimit.expires_at < now - timedelta(days=1)).delete()
    db.query(models.PhoneChallenge).filter(models.PhoneChallenge.expires_at < now - timedelta(days=1)).delete()
    db.commit()
    rate(db, "send-ip", ip(request), 20, 3600)
    if user_id:
        rate(db, "enroll-user", user_id, 5, 3600)
    rate(db, "send-phone-hour", phone, 5, 3600)
    rate(db, "send-phone-cooldown", phone, 1, config.PHONE_OTP_COOLDOWN_SECONDS)
    rate(db, "send-budget", "global", max(0, config.PHONE_OTP_DAILY_SEND_LIMIT), 86400)


def allowed(user) -> bool:
    if user is None:
        return False
    try:
        refuse_sign_in(user)
        return True
    except HTTPException:
        return False


def output(challenge) -> ChallengeOut:
    return ChallengeOut(challenge_id=challenge.id, masked_phone=masked(challenge.phone),
                        expires_at=challenge.expires_at, resend_after=config.PHONE_OTP_COOLDOWN_SECONDS)


def start(db, provider, phone, purpose, user):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    # A new browser challenge supersedes earlier challenges for this number, including another purpose.
    db.query(models.PhoneChallenge).filter_by(phone=phone, consumed_at=None).update({"consumed_at": now})
    challenge = models.PhoneChallenge(phone=phone, purpose=purpose, user_id=user.id if user else None,
                                     token_version=int(user.token_version or 0) if user else 0,
                                     created_at=now, expires_at=now + timedelta(seconds=config.PHONE_OTP_TTL_SECONDS), last_sent_at=now)
    db.add(challenge)
    db.commit()
    if user:
        try:
            challenge.provider_sid = provider.send(phone)
        except phone_provider.ProviderUnavailable:
            challenge.consumed_at = datetime.now(timezone.utc).replace(tzinfo=None)
            db.commit()
            raise HTTPException(503, UNAVAILABLE) from None
        db.commit()
    # Unknown and unavailable accounts get the same challenge response, but no SMS or token.
    return output(challenge)


def active(db, challenge_id, purpose, current=None):
    challenge = db.get(models.PhoneChallenge, challenge_id)
    if (challenge is None or challenge.purpose != purpose or challenge.consumed_at is not None
            or challenge.expires_at <= datetime.now(timezone.utc).replace(tzinfo=None) or challenge.attempts >= config.PHONE_OTP_MAX_ATTEMPTS
            or (purpose == "enroll" and (current is None or challenge.user_id != current.id))):
        raise HTTPException(401, INVALID)
    return challenge


def eligible(db, challenge):
    user = db.get(models.User, challenge.user_id) if challenge.user_id else None
    if not allowed(user) or int(user.token_version or 0) != challenge.token_version:
        return None
    identity = db.get(models.LoginPhone, user.id)
    if challenge.purpose == "login" and (identity is None or identity.phone != challenge.phone):
        return None
    if challenge.purpose == "enroll" and identity is not None:
        return None
    return user


def verify(db, provider, payload, purpose, current=None):
    challenge = active(db, payload.challenge_id, purpose, current)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    claimed = db.query(models.PhoneChallenge).filter(
        models.PhoneChallenge.id == challenge.id, models.PhoneChallenge.consumed_at.is_(None),
        models.PhoneChallenge.attempts < config.PHONE_OTP_MAX_ATTEMPTS,
        or_(models.PhoneChallenge.busy_until.is_(None), models.PhoneChallenge.busy_until <= now),
    ).update({"busy_until": now + timedelta(seconds=30), "attempts": models.PhoneChallenge.attempts + 1})
    db.commit()
    if not claimed:
        raise HTTPException(429, LIMITED)
    try:
        user = eligible(db, challenge)
        approved = bool(user and challenge.provider_sid and provider.check(challenge.provider_sid, challenge.phone, payload.code))
        # Refresh identity/account state after the network operation.
        db.expire_all()
        user = eligible(db, challenge)
        if not approved or user is None:
            raise HTTPException(401, INVALID)
        used = db.query(models.PhoneChallenge).filter(
            models.PhoneChallenge.id == challenge.id, models.PhoneChallenge.consumed_at.is_(None),
            models.PhoneChallenge.expires_at > datetime.now(timezone.utc).replace(tzinfo=None),
        ).update({"consumed_at": datetime.now(timezone.utc).replace(tzinfo=None)})
        if not used:
            raise HTTPException(401, INVALID)
        if purpose == "enroll":
            db.add(models.LoginPhone(user_id=user.id, phone=challenge.phone))
        db.commit()  # consumes the challenge and links the number together, before issuing any token
        return user
    except phone_provider.ProviderUnavailable:
        raise HTTPException(503, UNAVAILABLE) from None
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This number cannot be linked. Use another number or contact support.") from None
    finally:
        db.query(models.PhoneChallenge).filter_by(id=payload.challenge_id).update({"busy_until": None})
        db.commit()


def resend(db, provider, request, payload, purpose, current=None):
    challenge = active(db, payload.challenge_id, purpose, current)
    send_limits(db, request, challenge.phone, current.id if current else None)
    # Resends retain the original application expiry and attempt count.
    user = eligible(db, challenge)
    if user:
        try:
            sid = provider.send(challenge.phone)
        except phone_provider.ProviderUnavailable:
            raise HTTPException(503, UNAVAILABLE) from None
        challenge.provider_sid = sid
    challenge.last_sent_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    return output(challenge)


@router.get("/phone")
def phone_status(current=Depends(get_current_user), db: Session = Depends(get_db)):
    identity = db.get(models.LoginPhone, current.id)
    return {"enabled": phone_provider.configured(), "maskedPhone": masked(identity.phone) if identity else None}


@router.post("/phone/enroll/start", response_model=ChallengeOut, dependencies=[Depends(enabled)])
def enroll_start(payload: EnrollIn, request: Request, current=Depends(get_current_user),
                 db: Session = Depends(get_db), provider=Depends(phone_provider.get_provider)):
    phone = normalize_phone(payload.phone)
    send_limits(db, request, phone, current.id)
    if not verify_password(payload.password, current.password_hash):
        raise HTTPException(401, "Your current password is not right.")
    if db.get(models.LoginPhone, current.id) or db.query(models.LoginPhone).filter_by(phone=phone).first():
        raise HTTPException(409, "This number cannot be linked. Use another number or contact support.")
    return start(db, provider, phone, "enroll", current)


@router.post("/phone/enroll/verify", dependencies=[Depends(enabled)])
def enroll_verify(payload: CheckIn, request: Request, current=Depends(get_current_user),
                  db: Session = Depends(get_db), provider=Depends(phone_provider.get_provider)):
    rate(db, "check-ip", ip(request), 30, 60)
    verify(db, provider, payload, "enroll", current)
    return {"linked": True}


@router.post("/phone/enroll/resend", response_model=ChallengeOut, dependencies=[Depends(enabled)])
def enroll_resend(payload: ChallengeIn, request: Request, current=Depends(get_current_user),
                  db: Session = Depends(get_db), provider=Depends(phone_provider.get_provider)):
    return resend(db, provider, request, payload, "enroll", current)


@router.post("/phone/remove")
def remove_phone(payload: PasswordIn, request: Request, current=Depends(get_current_user), db: Session = Depends(get_db)):
    rate(db, "remove-user", current.id, 5, 3600)
    if not verify_password(payload.password, current.password_hash):
        raise HTTPException(401, "Your current password is not right.")
    identity = db.get(models.LoginPhone, current.id)
    if identity:
        db.query(models.PhoneChallenge).filter_by(phone=identity.phone, consumed_at=None).update({"consumed_at": datetime.now(timezone.utc).replace(tzinfo=None)})
        db.delete(identity)
        db.commit()
    return {"linked": False}


@router.post("/otp/start", response_model=ChallengeOut, dependencies=[Depends(enabled)])
def login_start(payload: PhoneIn, request: Request, db: Session = Depends(get_db), provider=Depends(phone_provider.get_provider)):
    phone = normalize_phone(payload.phone)
    send_limits(db, request, phone)
    identity = db.query(models.LoginPhone).filter_by(phone=phone).first()
    user = db.get(models.User, identity.user_id) if identity else None
    return start(db, provider, phone, "login", user if allowed(user) else None)


@router.post("/otp/verify", response_model=schemas.TokenResponse, dependencies=[Depends(enabled)])
def login_verify(payload: CheckIn, request: Request, db: Session = Depends(get_db), provider=Depends(phone_provider.get_provider)):
    rate(db, "check-ip", ip(request), 30, 60)
    user = verify(db, provider, payload, "login")
    return schemas.TokenResponse(access_token=create_access_token(user.id, user.token_version), user=schemas.UserOut.model_validate(user))


@router.post("/otp/resend", response_model=ChallengeOut, dependencies=[Depends(enabled)])
def login_resend(payload: ChallengeIn, request: Request, db: Session = Depends(get_db), provider=Depends(phone_provider.get_provider)):
    return resend(db, provider, request, payload, "login")
