from sqlalchemy import Column, DateTime, ForeignKey, String, Text

from ..database import Base
from ._shared import new_id, now


class Communication(Base):
    """Patient-facing message drafts. Never auto-sent — `status` only ever
    moves to SENT_MANUALLY as a record that a human sent it through the
    clinic's real channel; this system never dispatches it itself."""

    __tablename__ = "communications"

    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False)

    channel = Column(String, default="patient_message")
    direction = Column(String, default="outbound")
    content = Column(Text, nullable=False)
    language = Column(String, default="en")
    status = Column(String, default="DRAFT")  # DRAFT | APPROVED | SENT_MANUALLY

    created_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    approved_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=now)
