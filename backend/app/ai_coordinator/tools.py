"""The only things the care assistant can do. Each tool is a small, typed wrapper around what the care team used to do by
hand, with its risk level in policy.TOOLS. `act` is the one entry point the workflows use: it asks the policy engine,
runs, proposes or records, and writes the ledger row. `execute` runs a tool under a named identity: the assistant's
service account for low-risk steps, or the doctor's own account when a doctor approves a proposal.
"""
import json
from datetime import datetime, timezone

from fastapi import HTTPException

from .. import models
from ..seed_assistant import ensure_assistant_user
from . import messages, policy


def now():
    return datetime.now(timezone.utc)


def doctor_ids(db, episode_id: str) -> list[str]:
    rows = db.query(models.PatientDoctorAssignment).filter_by(episode_id=episode_id).order_by(models.PatientDoctorAssignment.is_primary.desc()).all()
    return [r.doctor_user_id for r in rows]


def _audit(db, actor: models.User, episode_id: str, action: str, title: str, details: str, object_type: str, object_id: str | None) -> None:
    db.add(models.AuditLog(episode_id=episode_id, actor_user_id=actor.id, actor_role=actor.role, actor_display_name=actor.full_name,
                           action=action, title=title, details=details[:500], object_type=object_type, object_id=object_id))


def raise_exception(db, *, episode_id: str, run_id: str | None, kind: str, urgency: str, title: str, summary: str, recommended_action: str = "",
                    proposed_tool: str | None = None, proposed_args: dict | None = None, source_type: str | None = None,
                    source_id: str | None = None) -> models.ExceptionItem:
    """Put something in front of the patient's doctor(s): an item in the Assistant inbox and a notification."""
    item = models.ExceptionItem(episode_id=episode_id, run_id=run_id, kind=kind, urgency=urgency, title=title, summary=summary,
                                recommended_action=recommended_action, proposed_tool=proposed_tool, proposed_args=proposed_args or {},
                                source_type=source_type, source_id=source_id)
    db.add(item)
    db.flush()
    for doctor_id in doctor_ids(db, episode_id):
        db.add(models.Notification(recipient_user_id=doctor_id, episode_id=episode_id, type="assistant_exception",
                                   title=f"Care assistant: {title}", body=summary[:200], related_entity_type="ExceptionItem", related_entity_id=item.id))
    return item


# ---------------------------------------------------------------- the tools
def _create_attention(db, args, actor, episode_id):
    item = raise_exception(db, episode_id=episode_id, run_id=args.get("run_id"), kind="attention", urgency=args.get("urgency", "normal"),
                           title=args["title"], summary=args.get("summary", ""), recommended_action=args.get("recommended_action", ""),
                           source_type=args.get("source_type"), source_id=args.get("source_id"))
    return f"Exception {item.id} created for the doctor."


def _notify_user(db, args, actor, episode_id):
    db.add(models.Notification(recipient_user_id=args["user_id"], episode_id=episode_id, type=args.get("kind", "assistant"),
                               title=args["title"], body=args.get("body", ""), related_entity_type=args.get("entity_type"), related_entity_id=args.get("entity_id")))
    return "Notification sent."


def _send_urgent_message(db, args, actor, episode_id):
    language = args.get("language", "en")
    db.add(models.Notification(recipient_user_id=args["user_id"], episode_id=episode_id, type="assistant_urgent",
                               title=messages.pick(messages.URGENT_TITLE, language), body=messages.urgent_body(language),
                               related_entity_type="PatientQuestion", related_entity_id=args.get("question_id")))
    return "The fixed emergency message was sent."


def _assign_question_to_doctor(db, args, actor, episode_id):
    question = db.get(models.PatientQuestion, args["question_id"])
    doctor_id = args.get("doctor_id")
    question.assigned_to_user_id = doctor_id
    question.is_clinical = bool(args.get("is_clinical", True))
    if question.status == "NEW":
        question.status = "ASSIGNED"
    if doctor_id:
        db.add(models.Notification(recipient_user_id=doctor_id, episode_id=episode_id, type="PATIENT_QUESTION_CREATED",
                                   title="A patient question needs you", body=question.question_text[:200],
                                   related_entity_type="PatientQuestion", related_entity_id=question.id))
    return "The question was assigned to the doctor."


def _document(db, args, episode_id) -> models.MedicalDocument:
    document = db.get(models.MedicalDocument, args["document_id"])
    if document is None or document.episode_id != episode_id:
        raise HTTPException(404, "Document not found for this patient.")
    if document.status not in ("NEEDS_REVIEW", "PROCESSING"):
        raise HTTPException(409, "This document has already been handled.")
    return document


def _complete_review_tasks(db, document_id: str) -> None:
    for task in db.query(models.Task).filter(models.Task.source_type == "document_review", models.Task.source_id == document_id,
                                             models.Task.status.in_(["OPEN", "IN_PROGRESS", "WAITING"])).all():
        task.status, task.updated_at = "COMPLETED", now()


def _verify_document(db, args, actor, episode_id):
    document = _document(db, args, episode_id)
    episode = db.get(models.PregnancyEpisode, episode_id)
    ext = document.extraction
    document.status = "VERIFIED"
    db.add(models.DocumentReview(document_id=document.id, reviewer_user_id=actor.id, reviewer_role=actor.role, action="VERIFY",
                                 notes=args.get("note"), reviewed_at=now()))
    db.add(models.JourneyEvent(
        episode_id=episode_id, event_type="document", source_document_id=document.id,
        title=(ext.record_type if ext and ext.record_type else document.filename), summary=document.description or "",
        event_date=document.document_date or (ext.event_date if ext else None) or now().date().isoformat(),
        gestational_age_weeks=episode.gestational_age_weeks if episode else 0, gestational_age_days=episode.gestational_age_days if episode else 0,
        actor_label=actor.full_name))
    db.add(models.Notification(recipient_user_id=document.uploaded_by_user_id, episode_id=episode_id, type="document_verified",
                               title="Your care team reviewed your uploaded documents", body="Your journey has been updated.",
                               related_entity_type="MedicalDocument", related_entity_id=document.id))
    _complete_review_tasks(db, document.id)
    return f"Document {document.filename} verified."


def _reject_document(db, args, actor, episode_id):
    document = _document(db, args, episode_id)
    note = args.get("note") or "This document could not be used. Please check it and upload it again if needed."
    document.status = "REJECTED"
    db.add(models.DocumentReview(document_id=document.id, reviewer_user_id=actor.id, reviewer_role=actor.role, action="REJECT", notes=note, reviewed_at=now()))
    db.add(models.Notification(recipient_user_id=document.uploaded_by_user_id, episode_id=episode_id, type="document_rejected",
                               title="Your care team reviewed an uploaded document", body=note,
                               related_entity_type="MedicalDocument", related_entity_id=document.id))
    _complete_review_tasks(db, document.id)
    return f"Document {document.filename} rejected."


def _answer_question(db, args, actor, episode_id):
    question = db.get(models.PatientQuestion, args["question_id"])
    if question is None or question.episode_id != episode_id:
        raise HTTPException(404, "Question not found for this patient.")
    if question.status in ("ANSWERED", "CLOSED"):
        raise HTTPException(409, "This question has already been answered.")
    db.add(models.QuestionResponse(question_id=question.id, responder_user_id=actor.id, responder_role=actor.role, response_text=args["text"],
                                   status="APPROVED", approved_by_user_id=actor.id, approved_at=now(), visible_to_patient=True))
    question.status = "ANSWERED"
    db.add(models.Notification(recipient_user_id=question.asked_by_user_id, episode_id=episode_id, type="question_answered",
                               title="Your question was answered", body="Open My Questions to read the reply.",
                               related_entity_type="PatientQuestion", related_entity_id=question.id))
    return "The reply was sent."


_IMPLEMENTATIONS = {
    "create_attention": _create_attention, "notify_user": _notify_user, "send_urgent_message": _send_urgent_message,
    "assign_question_to_doctor": _assign_question_to_doctor, "verify_document": _verify_document,
    "reject_document": _reject_document, "answer_question": _answer_question,
}


def execute(db, tool: str, args: dict, actor: models.User, *, episode_id: str, via_assistant: bool = False) -> str:
    """Run one tool under `actor`. A tool that is not registered cannot be run at all."""
    if tool not in policy.TOOLS:
        raise HTTPException(403, "This is not an action the assistant is allowed to take.")
    result = _IMPLEMENTATIONS[tool](db, args, actor, episode_id)
    detail = result + (" Proposed by the care assistant." if via_assistant else "")
    _audit(db, actor, episode_id, f"assistant_{tool}", f"Care assistant step: {tool.replace('_', ' ')}", detail, "AIAction", None)
    return result


# ---------------------------------------------------------------- the entry point for workflows
def act(db, run: models.AIRun, tool: str, args: dict, *, key: str | None = None, proposal: dict | None = None) -> models.AIAction | None:
    """Ask the policy engine, then run, propose, record or refuse. Returns the ledger row (None if it was already done)."""
    decision = policy.decide(db, run, tool, args, key)
    if decision.outcome == "deny" and decision.quiet:
        return None
    tier = policy.TOOLS.get(tool, "-")
    action = models.AIAction(run_id=run.id, episode_id=run.episode_id, tool=tool, tier=tier, args=json.loads(json.dumps(args, default=str)),
                             policy=decision.outcome, reason=decision.reason, status="DENIED")
    db.add(action)
    if decision.outcome in ("run", "propose"):
        action.idempotency_key = key
    if decision.outcome == "run":
        try:
            action.result = execute(db, tool, args, ensure_assistant_user(db), episode_id=run.episode_id)
            action.status = "DONE"
        except Exception as exc:  # noqa: BLE001: a failed step is handed to a person, never swallowed
            action.status, action.result = "FAILED", str(getattr(exc, "detail", exc))[:300]
            raise_exception(db, episode_id=run.episode_id, run_id=run.id, kind="attention", urgency="normal", title="The care assistant could not finish a step",
                            summary=f"{tool.replace('_', ' ')}: {action.result}", recommended_action="Please do this step yourself.")
    elif decision.outcome == "propose":
        proposal = proposal or {}
        item = raise_exception(db, episode_id=run.episode_id, run_id=run.id, kind="proposal", urgency=proposal.get("urgency", "normal"),
                               title=proposal.get("title", tool.replace("_", " ").capitalize()), summary=proposal.get("summary", ""),
                               recommended_action=proposal.get("recommended_action", ""), proposed_tool=tool, proposed_args=args,
                               source_type=run.source_type, source_id=run.source_id)
        db.flush()
        action.status, action.exception_id, action.result = "PROPOSED", item.id, "Waiting for a doctor."
    elif decision.outcome == "shadow":
        action.status, action.result = "SHADOW", "Not done: shadow mode."
    else:  # denied: a person is told, so a stopped step is never silent
        action.result = decision.reason
        raise_exception(db, episode_id=run.episode_id, run_id=run.id, kind="attention", urgency="normal", title="The care assistant stopped",
                        summary=decision.reason, recommended_action="Please look at this yourself.", source_type=run.source_type, source_id=run.source_id)
    db.flush()
    return action
