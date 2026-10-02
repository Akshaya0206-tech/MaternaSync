from sqlalchemy import Column, DateTime, ForeignKey, JSON, String

from ..database import Base
from ._shared import new_id, now


class AIArtifact(Base):
    """Uniform tracking for every AI-generated output in the system
    (Today's Brief, consultation draft, handover draft, communication
    draft) so each one carries the same DRAFT / REVIEW_REQUIRED / APPROVED
    / REJECTED state machine, regardless of which feature produced it."""

    __tablename__ = "ai_artifacts"

    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False)

    artifact_type = Column(String, nullable=False)  # today_brief | consultation_draft | handover_draft | communication_draft
    status = Column(String, default="DRAFT")  # DRAFT | REVIEW_REQUIRED | APPROVED | REJECTED
    content = Column(JSON, default=dict)

    generated_at = Column(DateTime, default=now)
    reviewed_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
