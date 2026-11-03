"""Verified login identities are separate from clinical/contact phone fields."""
import secrets
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from ..database import Base


class LoginPhone(Base):
    __tablename__ = "login_phones"
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    phone = Column(String, nullable=False, unique=True, index=True)
    verified_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))


class PhoneChallenge(Base):
    __tablename__ = "phone_challenges"
    id = Column(String, primary_key=True, default=lambda: secrets.token_urlsafe(32))
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    phone = Column(String, nullable=False, index=True)
    purpose = Column(String, nullable=False)
    token_version = Column(Integer, nullable=False, default=0)
    provider_sid = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    last_sent_at = Column(DateTime, nullable=False)
    attempts = Column(Integer, nullable=False, default=0)
    consumed_at = Column(DateTime, nullable=True)
    busy_until = Column(DateTime, nullable=True)


class PhoneAuthLimit(Base):
    __tablename__ = "phone_auth_limits"
    key = Column(String, primary_key=True)
    count = Column(Integer, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
