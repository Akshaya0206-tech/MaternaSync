from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from ..database import Base
from ._shared import new_id, now


class PatientQuestion(Base):
    __tablename__ = "patient_questions"

    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False)
    asked_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)

    question_text = Column(Text, nullable=False)
    status = Column(String, default="NEW")  # NEW | ASSIGNED | WAITING_FOR_RESPONSE | ANSWERED | CLOSED
    is_clinical = Column(Boolean, default=False)
    assigned_to_user_id = Column(String, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=now)

    responses = relationship("QuestionResponse", back_populates="question", cascade="all, delete-orphan")


class QuestionResponse(Base):
    """Care Team can answer coordination questions directly (visible
    immediately). A doctor's clinical response starts as DRAFT and only
    becomes patient-visible once the doctor explicitly approves it —
    that approval is the doctor confirming the wording, not a second
    clinician reviewing another's work."""

    __tablename__ = "question_responses"

    id = Column(String, primary_key=True, default=new_id)
    question_id = Column(String, ForeignKey("patient_questions.id"), nullable=False)
    responder_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    responder_role = Column(String, nullable=False)

    response_text = Column(Text, nullable=False)
    status = Column(String, default="DRAFT")  # DRAFT | APPROVED
    approved_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    visible_to_patient = Column(Boolean, default=False)

    created_at = Column(DateTime, default=now)

    question = relationship("PatientQuestion", back_populates="responses")
