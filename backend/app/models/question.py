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
    # Set when she asks again about an answer she has already had ("I still have a question"): the earlier question it follows.
    follow_up_of_id = Column(String, ForeignKey("patient_questions.id"), nullable=True)
    # Set when a doctor closes a question without a written reply because it was dealt with by phone or at the clinic. The note is the doctor's
    # own, private to doctors: it is never sent to, or shown to, the patient or a trusted person.
    closed_how = Column(String, nullable=True)  # phone_or_clinic
    closed_note = Column(Text, nullable=True)
    closed_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    closed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=now)

    responses = relationship("QuestionResponse", back_populates="question", cascade="all, delete-orphan")
    attachments = relationship("QuestionAttachment", back_populates="question", cascade="all, delete-orphan")
    follow_up_of = relationship("PatientQuestion", remote_side=[id], foreign_keys=[follow_up_of_id])


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


class QuestionAttachment(Base):
    """A photo or report she attached to a question. The file itself is an ordinary MedicalDocument, so it is reviewed like any record
    she uploads; this row only says which question it came with."""

    __tablename__ = "question_attachments"

    id = Column(String, primary_key=True, default=new_id)
    question_id = Column(String, ForeignKey("patient_questions.id"), nullable=False)
    document_id = Column(String, ForeignKey("medical_documents.id"), nullable=False)
    created_at = Column(DateTime, default=now)

    question = relationship("PatientQuestion", back_populates="attachments")
    document = relationship("MedicalDocument")
