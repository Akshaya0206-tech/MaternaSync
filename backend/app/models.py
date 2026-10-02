import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from .database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="other")
    created_at = Column(DateTime, default=_now)


class Patient(Base):
    __tablename__ = "patients"

    id = Column(String, primary_key=True, default=_uuid)
    owner_user_id = Column(String, ForeignKey("users.id"), nullable=False)

    patient_name = Column(String, nullable=False)
    mrn = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    dob = Column(String, nullable=True)
    edd = Column(String, nullable=False)

    gestational_age_weeks = Column(Integer, default=0)
    gestational_age_days = Column(Integer, default=0)
    gravida_para = Column(String, default="Not documented")
    blood_type = Column(String, default="Not documented")
    allergies = Column(JSON, default=list)
    primary_clinician = Column(String, default="Not assigned")
    episode_start_date = Column(String, default=lambda: _now().strftime("%Y-%m-%d"))
    risk_category = Column(String, default="routine")
    risk_notes = Column(String, default="")
    facility = Column(String, default="Not documented")

    is_ready_for_today_brief = Column(Boolean, default=False)
    handoff_timestamp = Column(DateTime, nullable=True)
    handoff_notes = Column(Text, nullable=True)
    next_visit_prepared_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=_now)

    records = relationship("Record", back_populates="patient", cascade="all, delete-orphan")
    workflow_items = relationship("WorkflowItem", back_populates="patient", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="patient", cascade="all, delete-orphan")
    admin_docs = relationship("AdminDoc", back_populates="patient", cascade="all, delete-orphan")


class Record(Base):
    __tablename__ = "records"

    id = Column(String, primary_key=True, default=_uuid)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)

    title = Column(String, nullable=False)
    category = Column(String, nullable=False, default="care_document")
    timestamp = Column(String, nullable=False)
    gestational_age_weeks = Column(Integer, default=0)
    gestational_age_days = Column(Integer, default=0)
    trimester = Column(Integer, default=1)

    author = Column(String, default="Not found in source")
    author_role = Column(String, default="")
    facility = Column(String, default="Not found in source")
    modality = Column(String, default="Uploaded Document")
    source_type = Column(String, default="")

    summary_text = Column(Text, default="")
    full_content = Column(Text, default="")
    source_id = Column(String, default="")
    tags = Column(JSON, default=list)
    is_ai_structured_only = Column(Boolean, default=False)

    document_filename = Column(String, nullable=True)
    document_path = Column(String, nullable=True)

    verification_status = Column(String, default="raw")  # raw | verified | ready_for_context | rejected
    verified_by = Column(String, nullable=True)
    verified_at = Column(DateTime, nullable=True)

    raw_payload_snippet = Column(Text, nullable=True)

    # Extraction field-level status, stored as JSON: {field_name: "extracted" | "needs_review" | "not_found"}
    extraction_status = Column(JSON, default=dict)

    vital_bp = Column(String, nullable=True)
    vital_weight_lbs = Column(Float, nullable=True)
    vital_fhr_bpm = Column(Integer, nullable=True)
    vital_fundal_height_cm = Column(Float, nullable=True)

    created_at = Column(DateTime, default=_now)

    patient = relationship("Patient", back_populates="records")


class WorkflowItem(Base):
    __tablename__ = "workflow_items"

    id = Column(String, primary_key=True, default=_uuid)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    record_id = Column(String, ForeignKey("records.id"), nullable=True)

    type = Column(String, nullable=False, default="follow_up_needed")
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    due_date = Column(String, nullable=True)
    priority = Column(String, default="routine")
    status = Column(String, default="pending")
    assignee = Column(String, nullable=True)
    assigned_role = Column(String, nullable=True)
    source_context = Column(String, default="")
    date_created = Column(DateTime, default=_now)
    last_updated_at = Column(DateTime, default=_now)
    verification_status = Column(String, nullable=True)

    patient = relationship("Patient", back_populates="workflow_items")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(String, primary_key=True, default=_uuid)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)
    record_id = Column(String, nullable=True)

    action = Column(String, nullable=False)
    title = Column(String, nullable=False)
    details = Column(Text, default="")
    user = Column(String, default="")
    role = Column(String, default="")
    timestamp = Column(DateTime, default=_now)

    patient = relationship("Patient", back_populates="activity_logs")


class AdminDoc(Base):
    __tablename__ = "admin_docs"

    id = Column(String, primary_key=True, default=_uuid)
    patient_id = Column(String, ForeignKey("patients.id"), nullable=False)

    title = Column(String, nullable=False)
    category = Column(String, default="intake")
    status = Column(String, default="missing")  # complete | missing | pending_verification
    required_by_stage = Column(String, default="")
    last_updated = Column(DateTime, default=_now)
    notes = Column(String, nullable=True)

    patient = relationship("Patient", back_populates="admin_docs")
