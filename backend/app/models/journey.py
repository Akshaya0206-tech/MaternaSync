from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from ..database import Base
from ._shared import new_id, now


class JourneyEvent(Base):
    """The patient-visible curated timeline. Rows here are created ONLY by
    a verify/approve action (see services/journey_service.py in Step 2+) —
    there is deliberately no raw-document or draft-consultation query path
    that a patient-facing endpoint could accidentally expose. Existence of
    a row IS the visibility rule."""

    __tablename__ = "journey_events"

    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False)

    event_type = Column(String, nullable=False)  # document | consultation | milestone
    source_document_id = Column(String, ForeignKey("medical_documents.id"), nullable=True)
    source_consultation_id = Column(String, ForeignKey("approved_consultations.id"), nullable=True)

    title = Column(String, nullable=False)
    summary = Column(Text, default="")
    event_date = Column(String, nullable=False)
    gestational_age_weeks = Column(Integer, default=0)
    gestational_age_days = Column(Integer, default=0)

    created_at = Column(DateTime, default=now)
