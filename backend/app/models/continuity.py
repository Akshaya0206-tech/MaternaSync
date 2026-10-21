"""Roadmap data, linked to the existing episode and audit trail.

Clinical resources are versioned; approvals never mutate their content. Patient
outputs have a separate publication boundary from internal clinical drafts.
"""
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint

from ..database import Base
from ._shared import new_id, now


class DailyLog(Base):
    __tablename__ = "daily_logs"
    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False, index=True)
    recorded_at = Column(DateTime, nullable=False)
    systolic = Column(Integer)
    diastolic = Column(Integer)
    weight_kg = Column(Float)
    symptoms = Column(Text, default="")
    mood = Column(String, default="not_recorded")
    adherence = Column(String, default="not_recorded")
    movement_count = Column(Integer)
    movement_minutes = Column(Integer)
    skipped = Column(Boolean, default=False)
    correction_reason = Column(Text, default="")
    revision = Column(Integer, default=1)
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now)


class PatientPreference(Base):
    __tablename__ = "patient_preferences"
    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    language = Column(String, default="en")


class SharingConsent(Base):
    __tablename__ = "sharing_consents"
    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False, index=True)
    recipient = Column(String, nullable=False)
    purpose = Column(String, nullable=False)  # reminders | approved_documents
    expires_at = Column(DateTime, nullable=False)
    granted_at = Column(DateTime, default=now)
    revoked_at = Column(DateTime)


class CareReminder(Base):
    __tablename__ = "care_reminders"
    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False, index=True)
    kind = Column(String, nullable=False)
    title = Column(String, nullable=False)
    instructions = Column(Text, default="")
    scheduled_at = Column(DateTime, nullable=False)
    status = Column(String, default="pending")
    source_id = Column(String)
    created_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    approved_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    responded_at = Column(DateTime)
    created_at = Column(DateTime, default=now)


class ClinicalResource(Base):
    __tablename__ = "clinical_resources"
    __table_args__ = (UniqueConstraint("family_id", "version"),)
    id = Column(String, primary_key=True, default=new_id)
    family_id = Column(String, nullable=False, index=True)
    version = Column(Integer, default=1)
    kind = Column(String, nullable=False)  # guideline | template | education | pathway | rule | coding
    title = Column(String, nullable=False)
    topic = Column(String, default="")
    issuer = Column(String, default="")
    jurisdiction = Column(String, default="India")
    publication_date = Column(String)
    source_url = Column(String, default="")
    section = Column(String, default="")
    content = Column(Text, default="")
    configuration = Column(JSON, default=dict)
    language = Column(String, default="en")
    stage = Column(String, default="all")
    status = Column(String, default="DRAFT")
    file_path = Column(String)
    rights_note = Column(String, default="")
    created_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    approved_by_user_id = Column(String, ForeignKey("users.id"))
    approved_at = Column(DateTime)
    review_due = Column(String)
    last_checked_at = Column(DateTime)
    created_at = Column(DateTime, default=now)


class ClinicalOutput(Base):
    __tablename__ = "clinical_outputs"
    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False, index=True)
    kind = Column(String, nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, default="")
    language = Column(String, default="en")
    source_type = Column(String, nullable=False)
    source_id = Column(String, nullable=False)
    source_snapshot = Column(JSON, default=dict)
    appointment_id = Column(String, ForeignKey("appointments.id"))
    template_id = Column(String, ForeignKey("clinical_resources.id"))
    structured_data = Column(JSON, default=dict)
    selected_codes = Column(JSON, default=list)
    status = Column(String, default="DRAFT")
    revision = Column(Integer, default=1)
    visible_to_patient = Column(Boolean, default=False)
    created_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    approved_by_user_id = Column(String, ForeignKey("users.id"))
    approved_at = Column(DateTime)
    created_at = Column(DateTime, default=now)


class ReferenceAttachment(Base):
    __tablename__ = "reference_attachments"
    __table_args__ = (UniqueConstraint("resource_id", "target_type", "target_id"),)
    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False)
    resource_id = Column(String, ForeignKey("clinical_resources.id"), nullable=False)
    target_type = Column(String, nullable=False)
    target_id = Column(String, nullable=False)
    attached_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=now)


class PathwayEnrollment(Base):
    __tablename__ = "pathway_enrollments"
    __table_args__ = (UniqueConstraint("episode_id", "resource_id"),)
    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False)
    resource_id = Column(String, ForeignKey("clinical_resources.id"), nullable=False)
    confirmed_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=now)


class MonitoringPlan(Base):
    __tablename__ = "monitoring_plans"
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), primary_key=True)
    interval_days = Column(Integer, default=1)
    active = Column(Boolean, default=True)
    owner_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    agreed_at = Column(DateTime, default=now)


class Outreach(Base):
    __tablename__ = "outreach_messages"
    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False, index=True)
    consent_id = Column(String, ForeignKey("sharing_consents.id"), nullable=False)
    recipient = Column(String, nullable=False)
    source_type = Column(String, nullable=False)
    source_id = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String, default="PREPARED")
    provider_reference = Column(String)
    created_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now)


class RecordedOutcome(Base):
    __tablename__ = "recorded_outcomes"
    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False, index=True)
    kind = Column(String, nullable=False)
    value = Column(String, nullable=False)
    event_date = Column(String, nullable=False)
    source_document_id = Column(String, ForeignKey("medical_documents.id"), nullable=False)
    recorded_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=now)
