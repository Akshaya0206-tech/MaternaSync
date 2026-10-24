from datetime import date, datetime, timezone
from typing import Literal
from urllib.parse import urlparse
import math

from pydantic import Field, field_validator, model_validator
from .schemas import CamelModel

Language = Literal["en", "hi", "ta", "te"]


class Input(CamelModel):
    model_config = {"extra": "forbid", "str_strip_whitespace": True}

    @field_validator("*", mode="after")
    @classmethod
    def normalize_timestamps(cls, value):
        if isinstance(value, datetime) and value.tzinfo is not None:
            return value.astimezone(timezone.utc)
        return value


class LogIn(Input):
    recorded_at: datetime
    systolic: int | None = Field(None, ge=30, le=300)
    diastolic: int | None = Field(None, ge=20, le=200)
    weight_kg: float | None = Field(None, ge=20, le=400, allow_inf_nan=False)
    symptoms: str = Field("", max_length=4000)
    mood: Literal["not_recorded", "good", "okay", "low", "anxious"] = "not_recorded"
    adherence: Literal["not_recorded", "done", "skipped", "needs_help", "not_applicable"] = "not_recorded"
    movement_count: int | None = Field(None, ge=0, le=1000)
    movement_minutes: int | None = Field(None, ge=1, le=1440)
    skipped: bool = False
    correction_reason: str = Field("", max_length=1000)
    entered_with_help: str | None = Field(None, max_length=120)

    @field_validator("entered_with_help")
    @classmethod
    def helper_or_nothing(cls, value):
        return value or None

    @model_validator(mode="after")
    def validate_log(self):
        if self.recorded_at.tzinfo is None:
            raise ValueError("A timestamp with timezone is required.")
        if self.recorded_at > datetime.now(timezone.utc):
            raise ValueError("Logs cannot be dated in the future.")
        if (self.systolic is None) != (self.diastolic is None):
            raise ValueError("Enter both blood pressure values, or leave both blank.")
        if (self.movement_count is None) != (self.movement_minutes is None):
            raise ValueError("Movement count and duration must be recorded together.")
        return self


class PreferenceIn(Input):
    language: Language


class ConsentIn(Input):
    recipient: str = Field(pattern=r"^\+[1-9]\d{7,14}$")
    purpose: Literal["reminders", "approved_documents"]
    expires_at: datetime

    @field_validator("expires_at")
    @classmethod
    def future(cls, value):
        if value.tzinfo is None or value <= datetime.now(timezone.utc):
            raise ValueError("Consent expiry must be a future timestamp with timezone.")
        return value


class ReminderIn(Input):
    kind: Literal["medicine", "vaccine", "appointment", "follow_up"]
    title: str = Field(min_length=3, max_length=200)
    instructions: str = Field("", max_length=4000)
    scheduled_at: datetime
    source_id: str = Field(min_length=1)
    repeat_days: int = Field(0, ge=0, le=365)
    occurrences: int = Field(1, ge=1, le=90)

    @model_validator(mode="after")
    def schedule(self):
        if self.scheduled_at.tzinfo is None:
            raise ValueError("Include a timezone in the schedule.")
        if self.occurrences > 1 and self.repeat_days < 1:
            raise ValueError("Repeating reminders require an interval.")
        return self


class ReminderResponse(Input):
    status: Literal["done", "skipped", "needs_help"]


class ResourceIn(Input):
    kind: Literal["guideline", "template", "education", "pathway", "rule", "coding"]
    title: str = Field(min_length=3, max_length=250)
    topic: str = Field("", max_length=150)
    issuer: str = Field("", max_length=150)
    jurisdiction: str = Field("India", max_length=100)
    # Publishers often give only a year or a month, so a partial date (2019, 2025-12) is kept as printed.
    publication_date: str | None = Field(None, pattern=r"^\d{4}(-\d{2}(-\d{2})?)?$")
    source_url: str = Field("", max_length=2000)
    section: str = Field("", max_length=200)
    content: str = Field("", max_length=1000000)
    configuration: dict = Field(default_factory=dict)
    language: Language = "en"
    stage: Literal["all", "first", "second", "third", "postpartum"] = "all"
    rights_note: str = Field("", max_length=1000)
    review_due: date | None = None
    previous_version_id: str | None = None

    @field_validator("source_url")
    @classmethod
    def valid_url(cls, value):
        if value and (urlparse(value).scheme != "https" or not urlparse(value).hostname):
            raise ValueError("Use an HTTPS source URL.")
        return value

    @model_validator(mode="after")
    def configuration_shape(self):
        config = self.configuration
        if self.kind == "pathway":
            steps = config.get("steps", [])
            if not isinstance(steps, list) or not 1 <= len(steps) <= 30:
                raise ValueError("A pathway requires 1–30 administrative steps.")
            for step in steps:
                if not isinstance(step, dict) or not isinstance(step.get("title"), str) or not step["title"].strip() or not isinstance(step.get("days"), int) or not 0 <= step["days"] <= 365:
                    raise ValueError("Each step needs a title and days (0–365).")
        if self.kind == "rule":
            # Follow-up rules only look at whether check-ins and tasks are happening. They never read a blood pressure,
            # a weight or any other clinical value, and they do not rank patients by urgency or risk.
            if config.get("metric") not in ("missing_days", "overdue_task_days"):
                raise ValueError("Follow-up rules can only watch missed check-ins and overdue tasks.")
            if config.get("operator") not in ("gt", "lt") or not isinstance(config.get("threshold"), (float, int)):
                raise ValueError("Rules need a gt/lt comparison and numeric threshold.")
            if not math.isfinite(config["threshold"]):
                raise ValueError("Rule thresholds must be finite.")
            if config.get("tier", "routine") != "routine":
                raise ValueError("Follow-up rules have a single level; there is no urgency ranking.")
            if not isinstance(config.get("nextAction", ""), str) or len(config.get("nextAction", "")) > 300:
                raise ValueError("The next action must be text of up to 300 characters.")
        if self.kind == "template":
            fields = config.get("fields", [])
            if not isinstance(fields, list) or not 1 <= len(fields) <= 30 or any(not isinstance(f, str) or not f.strip() or len(f) > 120 for f in fields) or len(set(fields)) != len(fields):
                raise ValueError("Provide 1–30 unique template field names.")
            if not isinstance(config.get("required", []), list) or any(f not in fields for f in config.get("required", [])):
                raise ValueError("Required fields must be present in the template.")
            if "default" in config and not isinstance(config["default"], bool):
                raise ValueError("Template default must be true or false.")
        if self.kind == "coding":
            entries = config.get("entries", [])
            if not isinstance(entries, list) or not 1 <= len(entries) <= 200:
                raise ValueError("Provide 1–200 reviewed code entries.")
            for item in entries:
                if not isinstance(item, dict) or not all(isinstance(item.get(k), str) and item[k].strip() for k in ("code", "label", "match")):
                    raise ValueError("Each code requires code, label and match text.")
        return self


class ApprovalIn(Input):
    confirmed: Literal[True]


class BatchApprovalIn(ApprovalIn):
    ids: list[str] = Field(min_length=1, max_length=100)


class OutputIn(Input):
    kind: Literal["visit_summary", "explanation", "lab_explanation", "discharge_summary", "referral_letter", "consent_form", "certificate", "operative_note", "insurance", "prescription", "note", "reply"]
    source_type: Literal["consultation", "document", "question"]
    source_id: str
    language: Language = "en"
    appointment_id: str | None = None
    template_id: str | None = None
    # For a patient explanation: the topics the doctor chose to explain. The note is never scanned to pick them.
    topics: list[str] = Field(default_factory=list, max_length=20)


class OutputEdit(Input):
    content: str = Field(min_length=1, max_length=30000)
    structured_data: dict[str, str] = Field(default_factory=dict)
    selected_codes: list[str] = Field(default_factory=list, max_length=30)
    appointment_id: str | None = None  # None keeps the link, "" removes it
    revision: int = Field(ge=1)


class PublishIn(ApprovalIn):
    visible_to_patient: bool = True
    revision: int = Field(ge=1)


class EnrollIn(ApprovalIn):
    resource_id: str
    owner_user_id: str
    start_date: date


class MonitorIn(Input):
    active: bool = True
    interval_days: int = Field(1, ge=1, le=90)
    owner_user_id: str
    patient_agreed: Literal[True]


class FlagConfirmIn(ApprovalIn):
    flag_id: str = Field(min_length=3, max_length=200)
    decision: Literal["create_task", "no_action_needed"]
    owner_user_id: str | None = None
    note: str = Field("", max_length=1000)

    @model_validator(mode="after")
    def decision_needs_detail(self):
        if self.decision == "create_task" and not self.owner_user_id:
            raise ValueError("Choose who will own the follow-up task.")
        if self.decision == "no_action_needed" and len(self.note) < 3:
            raise ValueError("Record why no action is needed.")
        return self


class OutreachIn(ApprovalIn):
    consent_id: str
    source_type: Literal["reminder", "output"]
    source_id: str
    recipient: str


class OutcomeIn(Input):
    kind: Literal["scan", "delivery"]
    value: str = Field(min_length=1, max_length=200)
    event_date: date
    source_document_id: str


class AppointmentIn(Input):
    scheduled_at: datetime
    appointment_type: str = Field(min_length=2, max_length=100)
    notes: str = Field("", max_length=2000)

    @field_validator("scheduled_at")
    @classmethod
    def future(cls, value):
        if value.tzinfo is None or value <= datetime.now(timezone.utc):
            raise ValueError("Choose a future appointment time with timezone.")
        return value


class AppointmentStatusIn(Input):
    status: Literal["scheduled", "completed", "cancelled", "no_show"]


class TaskAssignIn(Input):
    owner_user_id: str
    due_date: date | None = None
