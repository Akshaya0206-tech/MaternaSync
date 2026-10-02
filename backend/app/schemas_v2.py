"""Schemas for the new role-based system. Kept separate from schemas.py
(the legacy single-clinician API's schemas) for the same reason models are
split into models/legacy.py vs the rest — the two systems are independently
evolving during the migration."""

from datetime import datetime

from .schemas import CamelModel, UserOut  # reused: User is genuinely shared infrastructure

__all__ = [
    "UserOut", "EpisodeSummaryOut", "EpisodeOut",
    "PatientDocumentOut", "DocumentUploadOut",
    "QuestionResponseOut", "PatientQuestionOut", "QuestionCreateIn",
    "AppointmentOut", "JourneyEventOut", "NotificationOut",
    "PatientProfileOut", "PatientProfileUpdateIn", "PatientDashboardOut",
    # care team
    "NeedsAttentionItem", "CareTeamDashboardOut", "CareTeamPatientRowOut",
    "ExtractionOut", "DocumentReviewOut", "CareTeamDocumentOut", "DocumentEditIn", "ReviewNoteIn",
    "CareTeamQuestionOut", "QuestionRespondIn",
    "TaskOut", "TaskCreateIn", "TaskUpdateIn",
    "ReferralOut", "ReferralCreateIn", "ReferralUpdateIn",
    "SendReferralIn", "AcknowledgeReferralIn", "RecordAppointmentIn", "RecordResponseIn",
    "ReferralEventOut", "CommunicationEventOut", "ReferralDetailOut",
    "HandoverOut", "HandoverUpdateIn",
    "CareTeamProfileOut", "CareTeamProfileUpdateIn",
    # doctor
    "TodayPatientRowOut", "DoctorDashboardOut", "DoctorPatientRowOut",
    "DocumentSummaryOut", "TodaysBriefOut",
    "ConsultationStartIn", "ConsultationOut", "TranscriptUpdateIn",
    "ConsultationDraftOut", "DraftUpdateIn", "ApprovedConsultationOut", "DocumentationItemOut",
    "DraftResponseIn",
    "DoctorProfileOut", "DoctorProfileUpdateIn",
    # external simulator
    "SimulatorReferralOut", "SimulatorAppointmentIn", "SimulatorResponseIn", "SimulatorAcknowledgeIn",
]


class EpisodeSummaryOut(CamelModel):
    id: str
    patient_name: str
    mrn: str | None
    age: int | None
    edd: str
    gestational_age_weeks: int
    gestational_age_days: int
    risk_category: str


class EpisodeOut(CamelModel):
    id: str
    patient_user_id: str
    patient_name: str
    mrn: str | None
    age: int | None
    dob: str | None
    edd: str
    gestational_age_weeks: int
    gestational_age_days: int
    gravida_para: str
    blood_type: str
    allergies: list[str]
    risk_category: str
    risk_notes: str
    facility: str
    is_ready_for_today_brief: bool
    created_at: datetime


# ---------- Patient Portal: documents ----------

DOCUMENT_STATUS_LABELS = {
    "PROCESSING": "Processing",
    "NEEDS_REVIEW": "Under Review",
    "VERIFIED": "Verified",
    "REJECTED": "Needs Review",
}


class PatientDocumentOut(CamelModel):
    """Deliberately excludes DocumentExtraction internals (raw text, field
    status) and DocumentReview notes — a patient sees their own document's
    lifecycle, never the internal AI/reviewer detail behind it."""
    id: str
    filename: str
    status: str
    status_label: str
    document_date: str | None
    description: str | None
    uploaded_at: datetime


class DocumentUploadOut(CamelModel):
    document: PatientDocumentOut
    message: str


# ---------- Patient Portal: questions ----------

class QuestionResponseOut(CamelModel):
    id: str
    response_text: str
    responder_role: str
    created_at: datetime


class PatientQuestionOut(CamelModel):
    id: str
    question_text: str
    status: str
    created_at: datetime
    responses: list[QuestionResponseOut]


class QuestionCreateIn(CamelModel):
    question_text: str


# ---------- Patient Portal: appointments ----------

class AppointmentOut(CamelModel):
    id: str
    scheduled_at: datetime
    appointment_type: str
    location: str | None
    status: str
    doctor_name: str | None = None


# ---------- Patient Portal: journey ----------

class JourneyEventOut(CamelModel):
    id: str
    event_type: str
    title: str
    summary: str
    event_date: str
    gestational_age_weeks: int
    gestational_age_days: int


# ---------- Patient Portal: updates (notifications) ----------

class NotificationOut(CamelModel):
    id: str
    type: str
    title: str
    body: str
    is_read: bool
    created_at: datetime


# ---------- Patient Portal: profile ----------

class PatientProfileOut(CamelModel):
    full_name: str
    email: str
    date_of_birth: str | None
    mrn: str | None
    phone: str | None


class PatientProfileUpdateIn(CamelModel):
    full_name: str | None = None
    phone: str | None = None
    date_of_birth: str | None = None


# ---------- Patient Portal: dashboard ----------

class PatientDashboardOut(CamelModel):
    full_name: str
    gestational_age_weeks: int | None
    gestational_age_days: int | None
    edd: str | None
    next_appointment: AppointmentOut | None
    action_needed: str | None
    open_questions_count: int
    recent_care_title: str | None
    recent_care_date: str | None


# ================== Care Team Portal ==================

# ---------- Dashboard ----------

class NeedsAttentionItem(CamelModel):
    type: str  # document | question | referral | task
    title: str
    patient_name: str
    link: str
    created_at: datetime


class CareTeamDashboardOut(CamelModel):
    full_name: str
    active_patients: int
    documents_to_review: int
    patient_questions: int
    open_tasks: int
    pending_referrals: int
    needs_attention: list[NeedsAttentionItem]


# ---------- Patients ----------

class CareTeamPatientRowOut(CamelModel):
    episode_id: str
    patient_name: str
    age: int | None
    edd: str
    last_activity: datetime | None
    open_tasks: int
    open_questions: int
    documents_needing_review: int


# ---------- Documents ----------

NOT_FOUND = "Not found in source"


class ExtractionOut(CamelModel):
    record_type: str
    visit_type: str
    event_date: str
    facility: str
    provider: str
    department: str
    patient_name_found: str
    mrn_found: str
    gestational_age: str
    field_status: dict


class DocumentReviewOut(CamelModel):
    id: str
    action: str
    reviewer_name: str
    reviewer_role: str
    notes: str | None
    reviewed_at: datetime


class CareTeamDocumentOut(CamelModel):
    id: str
    episode_id: str
    patient_name: str
    filename: str
    description: str | None
    document_date: str | None
    uploaded_by_name: str
    uploaded_by_role: str
    uploaded_at: datetime
    status: str
    status_label: str
    extraction: ExtractionOut | None
    reviews: list[DocumentReviewOut]


class DocumentEditIn(CamelModel):
    description: str | None = None
    document_date: str | None = None
    record_type: str | None = None
    visit_type: str | None = None
    event_date: str | None = None
    facility: str | None = None
    provider: str | None = None
    department: str | None = None
    patient_name_found: str | None = None
    mrn_found: str | None = None
    gestational_age: str | None = None


class ReviewNoteIn(CamelModel):
    notes: str | None = None


# ---------- Questions ----------

class CareTeamQuestionOut(CamelModel):
    id: str
    episode_id: str
    patient_name: str
    question_text: str
    status: str
    is_clinical: bool
    assigned_to_name: str | None
    created_at: datetime
    responses: list[QuestionResponseOut]


class QuestionRespondIn(CamelModel):
    response_text: str


# ---------- Tasks ----------

class TaskOut(CamelModel):
    id: str
    episode_id: str
    patient_name: str
    title: str
    description: str
    owner_name: str | None
    created_by_name: str
    due_date: str | None
    priority: str
    status: str
    source_type: str | None
    source_id: str | None
    waiting_for: str | None
    waiting_since: datetime | None
    created_at: datetime


class TaskCreateIn(CamelModel):
    episode_id: str
    title: str
    description: str | None = None
    owner_user_id: str | None = None
    due_date: str | None = None
    priority: str = "routine"


class TaskUpdateIn(CamelModel):
    title: str | None = None
    description: str | None = None
    owner_user_id: str | None = None
    due_date: str | None = None
    priority: str | None = None
    status: str | None = None


# ---------- Referrals ----------

class ReferralOut(CamelModel):
    id: str
    reference_code: str | None
    episode_id: str
    patient_name: str
    title: str
    description: str
    referred_to: str | None
    destination: str | None
    status: str
    owner_name: str | None
    due_date: str | None
    waiting_for: str | None
    waiting_since: datetime | None
    sent_at: datetime | None
    acknowledged_at: datetime | None
    appointment_date: str | None
    appointment_time: str | None
    external_provider: str | None
    response_received_at: datetime | None
    doctor_reviewed_at: datetime | None
    created_at: datetime


class ReferralCreateIn(CamelModel):
    episode_id: str
    title: str
    description: str | None = None
    destination: str | None = None
    referred_to: str | None = None
    due_date: str | None = None


class ReferralUpdateIn(CamelModel):
    """Edits referral metadata only. Status transitions never go through
    this — each one is its own dedicated, auditable action endpoint (see
    Step 7 item 3: no arbitrary status changes)."""
    title: str | None = None
    description: str | None = None
    referred_to: str | None = None
    owner_user_id: str | None = None
    due_date: str | None = None


class SendReferralIn(CamelModel):
    pass


class AcknowledgeReferralIn(CamelModel):
    note: str | None = None
    external_reference: str | None = None


class RecordAppointmentIn(CamelModel):
    appointment_date: str
    appointment_time: str | None = None
    external_provider: str | None = None


class RecordResponseIn(CamelModel):
    response_text: str


class ReferralEventOut(CamelModel):
    id: str
    from_status: str | None
    to_status: str
    note: str | None
    actor_name: str | None
    actor_source: str
    created_at: datetime


class CommunicationEventOut(CamelModel):
    id: str
    type: str
    direction: str
    sender_label: str | None
    recipient_label: str | None
    subject: str | None
    content: str
    status: str
    source: str
    external_reference: str | None
    created_at: datetime
    received_at: datetime | None


class ReferralDetailOut(CamelModel):
    referral: ReferralOut
    events: list[ReferralEventOut]
    communications: list[CommunicationEventOut]
    related_task: TaskOut | None
    documents: list[PatientDocumentOut]


# ---------- Handover ----------

class HandoverOut(CamelModel):
    id: str
    episode_id: str
    patient_name: str
    context: str
    what_happened: str
    what_remains: str
    who_owns_it: str
    what_to_discuss: str
    status: str
    generated_by_ai: bool
    created_at: datetime


class HandoverUpdateIn(CamelModel):
    context: str | None = None
    what_happened: str | None = None
    what_remains: str | None = None
    who_owns_it: str | None = None
    what_to_discuss: str | None = None


# ---------- Profile ----------

class CareTeamProfileOut(CamelModel):
    full_name: str
    email: str
    role: str
    title: str | None
    facility: str | None


class CareTeamProfileUpdateIn(CamelModel):
    full_name: str | None = None
    title: str | None = None
    facility: str | None = None


# ================== Doctor Portal ==================

# ---------- Dashboard ----------

class TodayPatientRowOut(CamelModel):
    episode_id: str
    patient_name: str
    appointment_time: datetime | None
    brief_status: str  # Ready | Not Ready
    pending_items_summary: str


class DoctorDashboardOut(CamelModel):
    full_name: str
    todays_patients: int
    briefs_ready: int
    questions: int
    documents_to_review: int
    follow_ups: int
    drafts_to_approve: int
    today_patient_rows: list[TodayPatientRowOut]


# ---------- Patients ----------

class DoctorPatientRowOut(CamelModel):
    episode_id: str
    patient_name: str
    age: int | None
    edd: str
    next_appointment: datetime | None
    last_consultation: datetime | None
    open_items: int
    question_count: int


# ---------- Today's Brief ----------

class DocumentSummaryOut(CamelModel):
    id: str
    filename: str
    status: str
    status_label: str
    document_date: str | None


class TodaysBriefOut(CamelModel):
    episode_id: str
    patient_name: str
    age: int | None
    gestational_age_weeks: int
    gestational_age_days: int
    edd: str
    risk_category: str
    recent_events: list[JourneyEventOut]
    pending_items: list[TaskOut]
    patient_questions: list[CareTeamQuestionOut]
    next_appointment: AppointmentOut | None
    latest_approved_info: str
    relevant_documents: list[DocumentSummaryOut]
    status: str  # DRAFT | REVIEWED
    generated_at: datetime


# ---------- Consultation ----------

class ConsultationStartIn(CamelModel):
    episode_id: str
    input_mode: str = "voice"


class ConsultationOut(CamelModel):
    id: str
    episode_id: str
    patient_name: str
    doctor_name: str
    input_mode: str
    status: str  # in_progress | documented
    raw_transcript: str | None
    audio_available: bool
    started_at: datetime


class TranscriptUpdateIn(CamelModel):
    raw_transcript: str


class ConsultationDraftOut(CamelModel):
    id: str
    consultation_id: str
    version: int
    status: str  # DRAFT | REJECTED | SUPERSEDED | APPROVED
    structured_content: dict
    created_at: datetime


class DraftUpdateIn(CamelModel):
    visit_context: str | None = None
    documented_discussion: str | None = None
    relevant_information: str | None = None
    follow_up_next_steps: str | None = None


class ApprovedConsultationOut(CamelModel):
    id: str
    consultation_id: str
    draft_id: str
    approved_by_name: str
    approved_at: datetime
    final_content: dict


class DocumentationItemOut(CamelModel):
    consultation_id: str
    episode_id: str
    patient_name: str
    date: datetime
    type: str
    author_name: str
    status: str
    latest_draft_id: str | None
    approved_id: str | None


# ---------- Questions ----------

class DraftResponseIn(CamelModel):
    response_text: str


# ---------- Profile ----------

class DoctorProfileOut(CamelModel):
    full_name: str
    email: str
    role: str
    specialty: str | None
    facility: str | None


class DoctorProfileUpdateIn(CamelModel):
    full_name: str | None = None
    specialty: str | None = None
    facility: str | None = None


# ================== External Hospital Simulator (prototype-only, no auth) ==================
# Deliberately minimal — never exposes chart data, DOB, MRN, or anything
# beyond what a real referral message would actually carry.

class SimulatorReferralOut(CamelModel):
    reference_code: str
    patient_name: str
    referral_type: str
    destination: str | None
    status: str
    created_date: str
    doctor_name: str
    care_coordinator_name: str | None
    message: str


class SimulatorAcknowledgeIn(CamelModel):
    external_reference: str | None = None


class SimulatorAppointmentIn(CamelModel):
    appointment_date: str
    appointment_time: str | None = None
    external_provider: str | None = None


class SimulatorResponseIn(CamelModel):
    response_text: str
