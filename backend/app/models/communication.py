from sqlalchemy import Column, DateTime, ForeignKey, String, Text

from ..database import Base
from ._shared import new_id, now


class Communication(Base):
    """General communication-event log, broadened in Step 7 from its
    original patient-facing-draft-only scope to also carry referral
    communication (outbound referral message, inbound external
    acknowledgement/appointment/response). `status` still only ever moves
    to SENT_MANUALLY/SENT as a record that a human or the external
    simulator sent/received it — this system never dispatches real
    external messages itself.

    `source` tracks where an inbound event actually came from
    (SYSTEM_SIMULATOR for the prototype's External Hospital Simulator,
    MANUAL_ENTRY when a human recorded something they learned
    out-of-band). Future real integrations (SECURE_EMAIL, API,
    EHR_INTEGRATION) slot into the same field without a schema change."""

    __tablename__ = "communications"

    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False)
    related_referral_id = Column(String, ForeignKey("referrals.id"), nullable=True)

    type = Column(String, default="PATIENT_MESSAGE")  # PATIENT_MESSAGE | CARE_TEAM_MESSAGE | DOCTOR_MESSAGE | REFERRAL_OUTBOUND | REFERRAL_INBOUND | SYSTEM_NOTIFICATION
    channel = Column(String, default="patient_message")
    direction = Column(String, default="OUTBOUND")  # INBOUND | OUTBOUND
    sender_label = Column(String, nullable=True)
    recipient_label = Column(String, nullable=True)
    subject = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    language = Column(String, default="en")
    status = Column(String, default="DRAFT")  # DRAFT | APPROVED | SENT_MANUALLY | SENT | RECEIVED
    source = Column(String, default="MANUAL_ENTRY")  # SYSTEM_SIMULATOR | SECURE_EMAIL | API | EHR_INTEGRATION | MANUAL_ENTRY
    external_reference = Column(String, nullable=True)

    created_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    approved_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    received_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=now)
