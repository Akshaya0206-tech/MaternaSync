"""Clinical Guidelines knowledge-assistant source library. Deliberately its
own domain, not folded into document.py: these rows are never episode- or
patient-scoped (they're shared reference material, curated once and reused
across every consultation), unlike MedicalDocument. The three-table split
(raw entity / chunked content / append-only review log) mirrors
MedicalDocument/DocumentExtraction/DocumentReview on purpose, for the same
reason: each concern stays independently auditable.
"""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from ..database import Base
from ._shared import new_id, now

GUIDELINE_CATEGORIES = [
    "ANTENATAL_CARE", "LABOR_DELIVERY", "POSTPARTUM", "HIGH_RISK",
    "SCREENING", "NUTRITION", "MEDICATION_SAFETY", "GENERAL",
]
GUIDELINE_DOCUMENT_TYPES = [
    "Clinical Practice Guideline", "Protocol", "Position Statement", "Factsheet", "Other",
]


class GuidelineSource(Base):
    __tablename__ = "guideline_sources"

    id = Column(String, primary_key=True, default=new_id)

    title = Column(String, nullable=False)
    issuing_organization = Column(String, nullable=False)
    source_url = Column(String, nullable=True)
    version = Column(String, nullable=True)
    publication_date = Column(String, nullable=True)  # ISO string, left null if not supplied/found
    category = Column(String, nullable=False)
    document_type = Column(String, nullable=False)
    jurisdiction = Column(String, nullable=True)
    language = Column(String, nullable=True, default="en")

    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    uploaded_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    uploaded_by_role = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=now)

    is_demo_content = Column(Boolean, nullable=False, default=False)

    status = Column(String, default="PROCESSING")
    # PROCESSING | AWAITING_REVIEW | APPROVED | REJECTED | EXCLUDED

    chunks = relationship("GuidelineChunk", back_populates="source", cascade="all, delete-orphan")
    reviews = relationship("GuidelineReview", back_populates="source", cascade="all, delete-orphan")


class GuidelineChunk(Base):
    __tablename__ = "guideline_chunks"

    id = Column(String, primary_key=True, default=new_id)
    source_id = Column(String, ForeignKey("guideline_sources.id"), nullable=False)

    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=True)
    section_label = Column(String, nullable=True)  # best-effort heading guess only, often null

    term_freq = Column(JSON, nullable=False, default=dict)  # {token: count}, computed once at ingestion
    token_count = Column(Integer, nullable=False, default=0)

    source = relationship("GuidelineSource", back_populates="chunks")


class GuidelineReview(Base):
    """Append-only review-action log — same shape/intent as DocumentReview."""

    __tablename__ = "guideline_reviews"

    id = Column(String, primary_key=True, default=new_id)
    source_id = Column(String, ForeignKey("guideline_sources.id"), nullable=False)
    reviewer_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    reviewer_role = Column(String, nullable=False)

    action = Column(String, nullable=False)  # APPROVE | REJECT | EXCLUDE
    notes = Column(String, nullable=True)
    reviewed_at = Column(DateTime, default=now)

    source = relationship("GuidelineSource", back_populates="reviews")
