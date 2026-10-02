from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from ..database import Base
from ._shared import new_id, now


class Consultation(Base):
    __tablename__ = "consultations"

    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False)
    doctor_user_id = Column(String, ForeignKey("users.id"), nullable=False)

    input_mode = Column(String, default="voice")  # voice | text
    audio_path = Column(String, nullable=True)
    raw_transcript = Column(Text, nullable=True)
    status = Column(String, default="in_progress")  # in_progress | documented

    started_at = Column(DateTime, default=now)

    drafts = relationship("ConsultationDraft", back_populates="consultation", cascade="all, delete-orphan")


class ConsultationDraft(Base):
    """AI-generated structured documentation. Never becomes clinical truth
    on its own — see ApprovedConsultation, created only by an explicit
    doctor approval action."""

    __tablename__ = "consultation_drafts"

    id = Column(String, primary_key=True, default=new_id)
    consultation_id = Column(String, ForeignKey("consultations.id"), nullable=False)
    version = Column(Integer, default=1)
    structured_content = Column(JSON, default=dict)
    status = Column(String, default="DRAFT")  # DRAFT | REJECTED | SUPERSEDED | APPROVED
    created_at = Column(DateTime, default=now)

    consultation = relationship("Consultation", back_populates="drafts")


class ApprovedConsultation(Base):
    __tablename__ = "approved_consultations"

    id = Column(String, primary_key=True, default=new_id)
    consultation_id = Column(String, ForeignKey("consultations.id"), nullable=False)
    draft_id = Column(String, ForeignKey("consultation_drafts.id"), nullable=False)
    approved_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    final_content = Column(JSON, default=dict)
    approved_at = Column(DateTime, default=now)
