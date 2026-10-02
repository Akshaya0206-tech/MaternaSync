from sqlalchemy import Column, DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import relationship

from ..database import Base
from ._shared import new_id, now


class MedicalDocument(Base):
    """The raw uploaded file + its lifecycle status. Deliberately does NOT
    hold the extracted fields (see DocumentExtraction) or review history
    (see DocumentReview) — keeps each concern independently auditable."""

    __tablename__ = "medical_documents"

    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False)
    uploaded_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    uploaded_by_role = Column(String, nullable=False)

    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    document_date = Column(String, nullable=True)   # patient-provided, optional
    description = Column(String, nullable=True)      # patient-provided, optional

    status = Column(String, default="PROCESSING")  # PROCESSING | NEEDS_REVIEW | VERIFIED | REJECTED
    uploaded_at = Column(DateTime, default=now)

    extraction = relationship("DocumentExtraction", back_populates="document", uselist=False, cascade="all, delete-orphan")
    reviews = relationship("DocumentReview", back_populates="document", cascade="all, delete-orphan")


class DocumentExtraction(Base):
    __tablename__ = "document_extractions"

    id = Column(String, primary_key=True, default=new_id)
    document_id = Column(String, ForeignKey("medical_documents.id"), nullable=False, unique=True)

    raw_text = Column(Text, default="")
    record_type = Column(String, nullable=True)
    visit_type = Column(String, nullable=True)
    event_date = Column(String, nullable=True)
    facility = Column(String, nullable=True)
    provider = Column(String, nullable=True)
    department = Column(String, nullable=True)
    patient_name_found = Column(String, nullable=True)
    mrn_found = Column(String, nullable=True)
    gestational_age = Column(String, nullable=True)

    # {field_name: "extracted" | "needs_review" | "not_found"}
    field_status = Column(JSON, default=dict)

    extracted_at = Column(DateTime, default=now)

    document = relationship("MedicalDocument", back_populates="extraction")


class DocumentReview(Base):
    """One row per review action — multiple reviews can accumulate on a
    document over time (e.g. care team verifies, doctor later reviews too)."""

    __tablename__ = "document_reviews"

    id = Column(String, primary_key=True, default=new_id)
    document_id = Column(String, ForeignKey("medical_documents.id"), nullable=False)
    reviewer_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    reviewer_role = Column(String, nullable=False)

    action = Column(String, nullable=False)  # VERIFY | REJECT | EDIT | SEND_TO_DOCTOR
    notes = Column(String, nullable=True)
    reviewed_at = Column(DateTime, default=now)

    document = relationship("MedicalDocument", back_populates="reviews")
