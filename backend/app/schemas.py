from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


def to_camel(snake: str) -> str:
    parts = snake.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ---------- Auth ----------

class RegisterRequest(CamelModel):
    full_name: str
    email: EmailStr
    password: str
    confirm_password: str
    role: str = "other"


class LoginRequest(CamelModel):
    email: EmailStr
    password: str


class UserOut(CamelModel):
    id: str
    full_name: str
    email: str
    role: str


class TokenResponse(CamelModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Patients ----------

class PatientCreate(CamelModel):
    patient_name: str = Field(min_length=1)
    age: int | None = None
    dob: str | None = None
    edd: str = Field(min_length=1)
    mrn: str | None = None


class PatientSummary(CamelModel):
    id: str
    patient_name: str
    mrn: str | None
    age: int | None
    edd: str
    gestational_age_weeks: int
    gestational_age_days: int
    risk_category: str
    record_count: int
    open_workflow_count: int


class PatientUpdate(CamelModel):
    is_ready_for_today_brief: bool | None = None
    handoff_notes: str | None = None


class PatientOut(CamelModel):
    id: str
    patient_name: str
    mrn: str | None
    age: int | None
    dob: str | None
    gestational_age_weeks: int
    gestational_age_days: int
    edd: str
    gravida_para: str
    blood_type: str
    allergies: list[str]
    primary_clinician: str
    episode_start_date: str
    risk_category: str
    risk_notes: str
    facility: str
    is_ready_for_today_brief: bool
    handoff_timestamp: datetime | None
    handoff_notes: str | None
    next_visit_prepared_at: datetime | None


# ---------- Records ----------

class ExtractedFieldStatus(CamelModel):
    value: str
    status: str  # extracted | needs_review | not_found


class RecordOut(CamelModel):
    id: str
    patient_id: str
    title: str
    category: str
    timestamp: str
    gestational_age_weeks: int
    gestational_age_days: int
    trimester: int
    author: str
    author_role: str
    facility: str
    modality: str
    source_type: str
    summary_text: str
    full_content: str
    source_id: str
    tags: list[str]
    is_ai_structured_only: bool
    document_filename: str | None
    raw_payload_snippet: str | None
    verification_status: str
    verified_by: str | None
    verified_at: datetime | None
    extraction_status: dict[str, Any]
    vital_bp: str | None
    vital_weight_lbs: float | None
    vital_fhr_bpm: int | None
    vital_fundal_height_cm: float | None


class RecordUpdate(CamelModel):
    title: str | None = None
    category: str | None = None
    timestamp: str | None = None
    author: str | None = None
    facility: str | None = None
    summary_text: str | None = None
    full_content: str | None = None
    gestational_age_weeks: int | None = None
    gestational_age_days: int | None = None
    verification_status: str | None = None
    verified_by: str | None = None


class ManualRecordCreate(CamelModel):
    category: str
    timestamp: str
    facility: str = "Not documented"
    author: str = "Not documented"
    summary_text: str = ""
    source_reference: str = ""


class ApproveRecordRequest(CamelModel):
    verifier_name: str | None = None


# ---------- Workflow items ----------

class WorkflowItemOut(CamelModel):
    id: str
    patient_id: str
    record_id: str | None
    type: str
    title: str
    description: str
    due_date: str | None
    priority: str
    status: str
    assignee: str | None
    assigned_role: str | None
    source_context: str
    date_created: datetime
    last_updated_at: datetime
    verification_status: str | None


class WorkflowItemCreate(CamelModel):
    type: str
    title: str
    description: str = ""
    due_date: str | None = None
    priority: str = "routine"
    assignee: str | None = None
    source_context: str = "Clinician Observation"


class WorkflowItemUpdate(CamelModel):
    status: str | None = None
    assignee: str | None = None
    due_date: str | None = None
    description: str | None = None


# ---------- Activity log ----------

class ActivityLogOut(CamelModel):
    id: str
    patient_id: str
    record_id: str | None
    action: str
    title: str
    details: str
    user: str
    role: str
    timestamp: datetime


# ---------- Admin docs ----------

class AdminDocOut(CamelModel):
    id: str
    title: str
    category: str
    status: str
    required_by_stage: str
    last_updated: datetime | None
    notes: str | None
