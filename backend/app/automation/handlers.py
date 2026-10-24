"""Event handlers. Each one reacts to exactly one event type and only
ever does LEVEL 1 "safe automation": create/update an operational task,
send an internal notification. None of them answer a patient, approve
anything clinical, or decide a diagnosis — human review stays mandatory
everywhere that matters (document verification, clinical question
response, consultation approval all remain separate, human-triggered
actions elsewhere in the codebase).
"""

from .. import config, models
from . import events

OPEN_TASK_STATUSES = ("OPEN", "IN_PROGRESS", "WAITING")

# A simple keyword heuristic — explicitly NOT a medical classifier or AI.
# It only decides which internal queue a new question is routed to for
# human triage; a human (Care Team, then optionally Doctor) always makes
# the real decision via the existing assign-to-doctor / respond actions.
CLINICAL_KEYWORDS = {
    "pain", "bleeding", "blood", "pressure", "contraction", "fever", "nausea", "vomit",
    "headache", "swelling", "dizzy", "symptom", "medication", "dose", "normal", "result",
    "test", "level", "abnormal", "hurt", "cramp", "movement", "kick", "discharge", "rash",
}


def _looks_clinical(text: str) -> bool:
    lowered = text.lower()
    return any(keyword in lowered for keyword in CLINICAL_KEYWORDS)


def _first_care_team_user_id(db, episode_id: str) -> str | None:
    row = db.query(models.PatientCareTeamAssignment.care_team_user_id).filter(
        models.PatientCareTeamAssignment.episode_id == episode_id
    ).first()
    return row[0] if row else None


def _existing_open_task(db, episode_id: str, source_type: str, source_id: str):
    return db.query(models.Task).filter(
        models.Task.episode_id == episode_id, models.Task.source_type == source_type,
        models.Task.source_id == source_id, models.Task.status.in_(OPEN_TASK_STATUSES),
    ).first()


def handle_document_uploaded(db, *, episode_id, actor_user_id, source_id, payload, **_kwargs):
    """DocumentUploaded → create a Care Team review task (idempotent —
    skip if one is already open for this document) and notify Care Team.

    Deliberately does NOT create a JourneyEvent: the Step 1 architecture
    guarantees a JourneyEvent row only ever exists for verified/approved
    content, so the patient-facing journey can never leak an unverified
    upload. Automation traceability for this step lives in AuditLog
    (written by dispatch_event) instead.

    While the care-team login is switched off nobody would pick this task up, so it is skipped: the care assistant
    (app/ai_coordinator) checks the document and hands the doctor a proposal instead."""
    if not config.CARE_TEAM_ENABLED:
        return
    if _existing_open_task(db, episode_id, "document_review", source_id):
        return

    care_team_id = _first_care_team_user_id(db, episode_id)
    filename = payload.get("filename", "uploaded document")
    db.add(models.Task(
        episode_id=episode_id, title=f"Review document: {filename}",
        description="Automatically created when the patient uploaded this document.",
        owner_user_id=care_team_id, created_by_user_id=actor_user_id,
        status="OPEN", source_type="document_review", source_id=source_id, auto_generated=True,
    ))
    if care_team_id:
        db.add(models.Notification(
            recipient_user_id=care_team_id, episode_id=episode_id, type="DOCUMENT_UPLOADED",
            title="New document uploaded", body=f"{filename} needs review.",
            related_entity_type="MedicalDocument", related_entity_id=source_id,
        ))


def handle_patient_question_created(db, *, episode_id, actor_user_id, source_id, payload, **_kwargs):
    """PatientQuestionCreated → heuristically flag is_clinical (a routing
    hint only, not an answer), create a Care Team triage task (idempotent),
    and notify Care Team. Care Team still makes the real coordination-vs-
    clinical call via the existing respond / assign-to-doctor actions."""
    question = db.query(models.PatientQuestion).filter(models.PatientQuestion.id == source_id).first()
    if question is None:
        return

    question_text = payload.get("questionText", question.question_text)
    is_clinical = _looks_clinical(question_text)
    question.is_clinical = is_clinical

    if not config.CARE_TEAM_ENABLED:  # the care assistant routes the question instead (app/ai_coordinator)
        return
    if _existing_open_task(db, episode_id, "question_triage", source_id):
        return

    care_team_id = _first_care_team_user_id(db, episode_id)
    hint = " (may be clinical — review before responding)" if is_clinical else ""
    db.add(models.Task(
        episode_id=episode_id, title=f"Triage patient question{hint}",
        description=question_text[:300], owner_user_id=care_team_id, created_by_user_id=actor_user_id,
        status="OPEN", source_type="question_triage", source_id=source_id, auto_generated=True,
    ))
    if care_team_id:
        db.add(models.Notification(
            recipient_user_id=care_team_id, episode_id=episode_id, type="PATIENT_QUESTION_CREATED",
            title=f"New patient question{hint}", body=question_text[:200],
            related_entity_type="PatientQuestion", related_entity_id=source_id,
        ))


def _assistant_is_handling(db, episode_id) -> bool:
    """False when the assistant will not pick the work up now: switched off, shadow mode, or paused by a doctor."""
    from ..ai_coordinator import controls
    return config.AI_COORDINATOR_MODE == "assist" and not controls.is_held(db, episode_id)


def queue_for_assistant_document(db, *, episode_id, source_id, **_kwargs):
    """Hand the new document to the care assistant. This only adds a queued job row to the same transaction; the
    assistant does the work later, so a slow model can never hold up an upload. If the assistant is not handling work
    right now, the doctor is told about the upload by the fixed rule instead, so it is never missed."""
    from ..ai_coordinator import orchestrator, tools
    orchestrator.enqueue(db, "document_intake", episode_id=episode_id, source_type="MedicalDocument", source_id=source_id)
    if not config.CARE_TEAM_ENABLED and not _assistant_is_handling(db, episode_id):
        document = db.get(models.MedicalDocument, source_id)
        if document is not None:
            tools.notify_doctors_of_document(db, document)


def queue_for_assistant_question(db, *, episode_id, source_id, **_kwargs):
    from ..ai_coordinator import orchestrator, tools
    orchestrator.enqueue(db, "question_routing", episode_id=episode_id, source_type="PatientQuestion", source_id=source_id)
    if not config.CARE_TEAM_ENABLED and not _assistant_is_handling(db, episode_id):
        question = db.get(models.PatientQuestion, source_id)
        if question is not None:
            tools.route_question_to_doctor(db, question)


REGISTRY = {
    events.DOCUMENT_UPLOADED: [handle_document_uploaded, queue_for_assistant_document],
    events.PATIENT_QUESTION_CREATED: [handle_patient_question_created, queue_for_assistant_question],
}
