"""All ORM models, old and new, registered on the same SQLAlchemy Base so a
single Base.metadata.create_all() creates every table. Re-exported flatly
here so both `from . import models; models.User` (existing routers) and
`from .models import PregnancyEpisode` (new routers) resolve identically.
"""

# --- Legacy single-clinician schema (unchanged, still used by the
#     existing Phase 1-5 app and its routers) ---
from .legacy import User, Patient, Record, WorkflowItem, ActivityLog, AdminDoc

# --- New role-based schema ---
from .roles import PatientProfile, DoctorProfile, CareTeamProfile
from .episode import PregnancyEpisode
from .assignment import PatientDoctorAssignment, PatientCareTeamAssignment
from .document import MedicalDocument, DocumentExtraction, DocumentReview
from .journey import JourneyEvent
from .consultation import Consultation, ConsultationDraft, ApprovedConsultation
from .question import PatientQuestion, QuestionResponse
from .task import Task, TaskAssignment
from .referral import Referral, ReferralEvent
from .appointment import Appointment
from .handover import Handover
from .notification import Notification
from .audit import AuditLog
from .ai_artifact import AIArtifact
from .communication import Communication

__all__ = [
    # legacy
    "User", "Patient", "Record", "WorkflowItem", "ActivityLog", "AdminDoc",
    # roles
    "PatientProfile", "DoctorProfile", "CareTeamProfile",
    # episode + access control
    "PregnancyEpisode", "PatientDoctorAssignment", "PatientCareTeamAssignment",
    # documents
    "MedicalDocument", "DocumentExtraction", "DocumentReview",
    # journey
    "JourneyEvent",
    # consultation
    "Consultation", "ConsultationDraft", "ApprovedConsultation",
    # questions
    "PatientQuestion", "QuestionResponse",
    # tasks
    "Task", "TaskAssignment",
    # referrals
    "Referral", "ReferralEvent",
    # appointments
    "Appointment",
    # handover
    "Handover",
    # notifications
    "Notification",
    # audit
    "AuditLog",
    # AI artifacts
    "AIArtifact",
    # communication
    "Communication",
]
