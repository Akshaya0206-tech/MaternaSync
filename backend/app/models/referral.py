from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from ..database import Base
from ._shared import new_id, now


class Referral(Base):
    __tablename__ = "referrals"

    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False)

    reference_code = Column(String, nullable=True)  # human-facing id, e.g. "REF-2026-00001" — connects referral/message/tasks/audit
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    referred_to = Column(String, nullable=True)
    destination = Column(String, nullable=True)  # external facility/org name, e.g. "ABC Specialist Hospital"
    status = Column(String, default="DRAFT")  # DRAFT|SENT|ACKNOWLEDGED|APPOINTMENT_SCHEDULED|RESPONSE_RECEIVED|CLOSED
    owner_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    created_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    due_date = Column(String, nullable=True)

    sent_at = Column(DateTime, nullable=True)
    sent_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)

    acknowledged_at = Column(DateTime, nullable=True)
    acknowledged_source = Column(String, nullable=True)  # SYSTEM_SIMULATOR | MANUAL_ENTRY | SECURE_EMAIL | API | EHR_INTEGRATION

    appointment_date = Column(String, nullable=True)
    appointment_time = Column(String, nullable=True)
    external_provider = Column(String, nullable=True)
    appointment_recorded_source = Column(String, nullable=True)

    response_text = Column(Text, nullable=True)
    response_received_at = Column(DateTime, nullable=True)
    response_source = Column(String, nullable=True)

    doctor_reviewed_at = Column(DateTime, nullable=True)
    doctor_reviewed_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=now)

    events = relationship("ReferralEvent", back_populates="referral", cascade="all, delete-orphan")


class ReferralEvent(Base):
    """The referral's state-transition timeline. actor_user_id is null for
    events the External Hospital Simulator generates — there is no
    internal user behind those; actor_source distinguishes who/what drove
    the transition (a real person via the UI vs. the simulated external
    channel) so the timeline stays honest about where each update
    actually came from (see Step 7 — no fake automation)."""

    __tablename__ = "referral_events"

    id = Column(String, primary_key=True, default=new_id)
    referral_id = Column(String, ForeignKey("referrals.id"), nullable=False)
    from_status = Column(String, nullable=True)
    to_status = Column(String, nullable=False)
    note = Column(String, nullable=True)
    actor_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    actor_source = Column(String, default="MANUAL_ENTRY")  # SYSTEM_SIMULATOR | MANUAL_ENTRY | SECURE_EMAIL | API | EHR_INTEGRATION
    created_at = Column(DateTime, default=now)

    referral = relationship("Referral", back_populates="events")
