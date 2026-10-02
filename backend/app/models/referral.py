from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from ..database import Base
from ._shared import new_id, now


class Referral(Base):
    __tablename__ = "referrals"

    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False)

    title = Column(String, nullable=False)
    description = Column(Text, default="")
    referred_to = Column(String, nullable=True)
    status = Column(String, default="DRAFT")  # DRAFT|SENT|ACKNOWLEDGED|APPOINTMENT_SCHEDULED|RESPONSE_RECEIVED|CLOSED
    owner_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    created_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    due_date = Column(String, nullable=True)

    created_at = Column(DateTime, default=now)

    events = relationship("ReferralEvent", back_populates="referral", cascade="all, delete-orphan")


class ReferralEvent(Base):
    __tablename__ = "referral_events"

    id = Column(String, primary_key=True, default=new_id)
    referral_id = Column(String, ForeignKey("referrals.id"), nullable=False)
    from_status = Column(String, nullable=True)
    to_status = Column(String, nullable=False)
    note = Column(String, nullable=True)
    actor_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=now)

    referral = relationship("Referral", back_populates="events")
