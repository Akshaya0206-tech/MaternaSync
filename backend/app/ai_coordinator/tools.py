"""The only things the care assistant can do. Each tool is a small, typed wrapper around what the care team used to do by
hand, with its risk level in policy.TOOLS. `act` is the one entry point the workflows use: it asks the policy engine,
runs, proposes or records, and writes the ledger row. `execute` runs a tool under a named identity: the assistant's
service account for low-risk steps, or the doctor's own account when a doctor approves a proposal.

Every tool also records what it changed (`Outcome.undo`), so a doctor can reverse the step afterwards with `undo`.
"""
import json
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException

from .. import companion, models
from ..seed_assistant import ensure_assistant_user
from . import messages, policy


@dataclass
class Outcome:
    message: str
    undo: dict | None = None


def now():
    return datetime.now(timezone.utc)


def doctor_ids(db, episode_id: str) -> list[str]:
    rows = db.query(models.PatientDoctorAssignment).filter_by(episode_id=episode_id).order_by(models.PatientDoctorAssignment.is_primary.desc()).all()
    return [r.doctor_user_id for r in rows]


def _audit(db, actor: models.User | None, episode_id: str | None, action: str, title: str, details: str, object_type: str, object_id: str | None) -> None:
    db.add(models.AuditLog(episode_id=episode_id, actor_user_id=actor.id if actor else None, actor_role=actor.role if actor else "system",
                           actor_display_name=actor.full_name if actor else "MaternaSync (fixed rule)", action=action, title=title, details=details[:500],
                           object_type=object_type, object_id=object_id))


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


# ---------------------------------------------------------------- plain-rule routing (not an assistant step)
def route_question_to_doctor(db, question: models.PatientQuestion) -> None:
    """When the assistant is not doing the work (switched off, shadow mode, paused or failed), a new question must still
    reach a doctor: a doctor's Patient Questions page lists only the questions assigned to them. This is the same fixed
    rule the care team's automation used (assign to the primary doctor and notify), with no judgement involved."""
    if question.assigned_to_user_id:
        return
    doctors = doctor_ids(db, question.episode_id)
    if not doctors:
        return
    question.assigned_to_user_id = doctors[0]
    if question.status == "NEW":
        question.status = "ASSIGNED"
    urgent = companion.respond(question.question_text, "en", [])["safety"] == "urgent"
    db.add(models.Notification(recipient_user_id=doctors[0], episode_id=question.episode_id, type="PATIENT_QUESTION_CREATED",
                               title="Possible warning-sign wording in a patient question" if urgent else "A patient question needs you",
                               body=question.question_text[:200], related_entity_type="PatientQuestion", related_entity_id=question.id))
    _audit(db, None, question.episode_id, "question_routed_by_rule", "A patient question was assigned to the doctor",
           "The care assistant was not handling it, so the fixed rule assigned it.", "PatientQuestion", question.id)


def notify_doctors_of_document(db, document: models.MedicalDocument) -> None:
    """Same idea for an upload while the assistant is not handling it: tell the doctor it is waiting for review."""
    for doctor_id in doctor_ids(db, document.episode_id):
        db.add(models.Notification(recipient_user_id=doctor_id, episode_id=document.episode_id, type="DOCUMENT_UPLOADED",
                                   title="New document uploaded", body=f"{document.filename} needs review.",
                                   related_entity_type="MedicalDocument", related_entity_id=document.id))


# ---------------------------------------------------------------- the tools
def _create_attention(db, args, actor, episode_id) -> Outcome:
    item = raise_exception(db, episode_id=episode_id, run_id=args.get("run_id"), kind="attention", urgency=args.get("urgency", "normal"),
                           title=args["title"], summary=args.get("summary", ""), recommended_action=args.get("recommended_action", ""),
                           source_type=args.get("source_type"), source_id=args.get("source_id"))
    return Outcome(f"Exception {item.id} created for the doctor.", {"kind": "exception", "exception_id": item.id})


def _notify_user(db, args, actor, episode_id) -> Outcome:
    note = models.Notification(recipient_user_id=args["user_id"], episode_id=episode_id, type=args.get("kind", "assistant"),
                               title=args["title"], body=args.get("body", ""), related_entity_type=args.get("entity_type"), related_entity_id=args.get("entity_id"))
    db.add(note)
    db.flush()
    return Outcome("Notification sent.", {"kind": "notifications", "notification_ids": [note.id]})


def _send_urgent_message(db, args, actor, episode_id) -> Outcome:
    language = args.get("language", "en")
    note = models.Notification(recipient_user_id=args["user_id"], episode_id=episode_id, type="assistant_urgent",
                               title=messages.pick(messages.URGENT_TITLE, language), body=messages.urgent_body(language),
                               related_entity_type="PatientQuestion", related_entity_id=args.get("question_id"))
    db.add(note)
    db.flush()
    return Outcome("The fixed emergency message was sent.", {"kind": "notifications", "notification_ids": [note.id]})


def _assign_question_to_doctor(db, args, actor, episode_id) -> Outcome:
    question = db.get(models.PatientQuestion, args["question_id"])
    doctor_id = args.get("doctor_id")
    before = {"assigned_to_user_id": question.assigned_to_user_id, "status": question.status, "is_clinical": question.is_clinical}
    question.assigned_to_user_id = doctor_id
    question.is_clinical = bool(args.get("is_clinical", True))
    if question.status == "NEW":
        question.status = "ASSIGNED"
    ids = []
    if doctor_id:
        note = models.Notification(recipient_user_id=doctor_id, episode_id=episode_id, type="PATIENT_QUESTION_CREATED",
                                   title="A patient question needs you", body=question.question_text[:200],
                                   related_entity_type="PatientQuestion", related_entity_id=question.id)
        db.add(note)
        db.flush()
        ids.append(note.id)
    return Outcome("The question was assigned to the doctor.", {"kind": "assign", "question_id": question.id, "before": before, "assigned_to_user_id": doctor_id,
                                                              "after_status": question.status, "notification_ids": ids})


def _document(db, args, episode_id) -> models.MedicalDocument:
    document = db.get(models.MedicalDocument, args["document_id"])
    if document is None or document.episode_id != episode_id:
        raise HTTPException(404, "Document not found for this patient.")
    if document.status not in ("NEEDS_REVIEW", "PROCESSING"):
        raise HTTPException(409, "This document has already been handled.")
    return document


def _complete_review_tasks(db, document_id: str) -> list[dict]:
    closed = []
    for task in db.query(models.Task).filter(models.Task.source_type == "document_review", models.Task.source_id == document_id,
                                             models.Task.status.in_(["OPEN", "IN_PROGRESS", "WAITING"])).all():
        closed.append({"id": task.id, "status": task.status})
        task.status, task.updated_at = "COMPLETED", now()
    return closed


def _verify_document(db, args, actor, episode_id) -> Outcome:
    document = _document(db, args, episode_id)
    episode = db.get(models.PregnancyEpisode, episode_id)
    ext = document.extraction
    before = document.status
    document.status = "VERIFIED"
    review = models.DocumentReview(document_id=document.id, reviewer_user_id=actor.id, reviewer_role=actor.role, action="VERIFY",
                                   notes=args.get("note"), reviewed_at=now())
    event = models.JourneyEvent(
        episode_id=episode_id, event_type="document", source_document_id=document.id,
        title=(ext.record_type if ext and ext.record_type else document.filename), summary=document.description or "",
        event_date=document.document_date or (ext.event_date if ext else None) or now().date().isoformat(),
        gestational_age_weeks=episode.gestational_age_weeks if episode else 0, gestational_age_days=episode.gestational_age_days if episode else 0,
        actor_label=actor.full_name)
    note = models.Notification(recipient_user_id=document.uploaded_by_user_id, episode_id=episode_id, type="document_verified",
                               title="Your care team reviewed your uploaded documents", body="Your journey has been updated.",
                               related_entity_type="MedicalDocument", related_entity_id=document.id)
    db.add_all([review, event, note])
    closed = _complete_review_tasks(db, document.id)
    db.flush()
    return Outcome(f"Document {document.filename} verified.", {"kind": "verify", "document_id": document.id, "before_status": before, "review_id": review.id,
                                                              "journey_event_id": event.id, "notification_ids": [note.id], "tasks": closed})


def _reject_document(db, args, actor, episode_id) -> Outcome:
    document = _document(db, args, episode_id)
    before = document.status
    text = args.get("note") or "This document could not be used. Please check it and upload it again if needed."
    document.status = "REJECTED"
    review = models.DocumentReview(document_id=document.id, reviewer_user_id=actor.id, reviewer_role=actor.role, action="REJECT", notes=text, reviewed_at=now())
    note = models.Notification(recipient_user_id=document.uploaded_by_user_id, episode_id=episode_id, type="document_rejected",
                               title="Your care team reviewed an uploaded document", body=text,
                               related_entity_type="MedicalDocument", related_entity_id=document.id)
    db.add_all([review, note])
    closed = _complete_review_tasks(db, document.id)
    db.flush()
    return Outcome(f"Document {document.filename} rejected.", {"kind": "reject", "document_id": document.id, "before_status": before, "review_id": review.id,
                                                              "notification_ids": [note.id], "tasks": closed})


def _answer_question(db, args, actor, episode_id) -> Outcome:
    question = db.get(models.PatientQuestion, args["question_id"])
    if question is None or question.episode_id != episode_id:
        raise HTTPException(404, "Question not found for this patient.")
    if question.status in ("ANSWERED", "CLOSED"):
        raise HTTPException(409, "This question has already been answered.")
    before = question.status
    reply = models.QuestionResponse(question_id=question.id, responder_user_id=actor.id, responder_role=actor.role, response_text=args["text"],
                                    status="APPROVED", approved_by_user_id=actor.id, approved_at=now(), visible_to_patient=True)
    question.status = "ANSWERED"
    note = models.Notification(recipient_user_id=question.asked_by_user_id, episode_id=episode_id, type="question_answered",
                               title="Your question was answered", body="Open My Questions to read the reply.",
                               related_entity_type="PatientQuestion", related_entity_id=question.id)
    db.add_all([reply, note])
    db.flush()
    return Outcome("The reply was sent.", {"kind": "answer", "question_id": question.id, "before_status": before, "response_id": reply.id,
                                          "notification_ids": [note.id], "text": args["text"][:300]})


_IMPLEMENTATIONS = {
    "create_attention": _create_attention, "notify_user": _notify_user, "send_urgent_message": _send_urgent_message,
    "assign_question_to_doctor": _assign_question_to_doctor, "verify_document": _verify_document,
    "reject_document": _reject_document, "answer_question": _answer_question,
}


def execute(db, tool: str, args: dict, actor: models.User, *, episode_id: str, via_assistant: bool = False) -> Outcome:
    """Run one tool under `actor`. A tool that is not registered cannot be run at all."""
    if tool not in policy.TOOLS:
        raise HTTPException(403, "This is not an action the assistant is allowed to take.")
    outcome = _IMPLEMENTATIONS[tool](db, args, actor, episode_id)
    detail = outcome.message + (" Proposed by the care assistant." if via_assistant else "")
    _audit(db, actor, episode_id, f"assistant_{tool}", f"Care assistant step: {tool.replace('_', ' ')}", detail, "AIAction", None)
    return outcome


# ---------------------------------------------------------------- undo: a doctor reverses a step that already ran
def _gone(what: str) -> HTTPException:
    return HTTPException(409, f"{what} has changed since, so it was left alone. Check it by hand.")


def _remove_notifications(db, ids: list[str]) -> int:
    removed = 0
    for note_id in ids:
        note = db.get(models.Notification, note_id)
        if note is not None:
            db.delete(note)
            removed += 1
    return removed


def _undo_exception(db, undo: dict, actor, note: str) -> str:
    item = db.get(models.ExceptionItem, undo["exception_id"])
    if item is None or item.status != "OPEN":
        raise HTTPException(409, "A doctor has already dealt with that item, so there is nothing to undo.")
    item.status, item.decided_by_user_id, item.decided_at, item.decision_note = "DISMISSED", actor.id, now(), f"Undone. {note}".strip()
    return "The hand-off was dismissed."


def _undo_notifications(db, undo: dict, actor, note: str) -> str:
    removed = _remove_notifications(db, undo.get("notification_ids", []))
    return "The message was withdrawn from her Updates." if removed else "The message was already gone."


def _undo_assign(db, undo: dict, actor, note: str) -> str:
    question = db.get(models.PatientQuestion, undo["question_id"])
    if question is None or question.status != undo.get("after_status") or question.assigned_to_user_id != undo.get("assigned_to_user_id"):
        raise _gone("The question")
    before = undo["before"]
    question.assigned_to_user_id, question.status, question.is_clinical = before["assigned_to_user_id"], before["status"], before["is_clinical"]
    _remove_notifications(db, undo.get("notification_ids", []))
    return "The question was put back as it was."


def _undo_document(db, undo: dict, actor, note: str) -> str:
    verified = undo["kind"] == "verify"
    document = db.get(models.MedicalDocument, undo["document_id"])
    if document is None or document.status != ("VERIFIED" if verified else "REJECTED"):
        raise _gone("The document")
    document.status = undo["before_status"]
    db.add(models.DocumentReview(document_id=document.id, reviewer_user_id=actor.id, reviewer_role=actor.role, action="REVERT",
                                 notes=note or "Reversed by a doctor.", reviewed_at=now()))
    if verified:
        event = db.get(models.JourneyEvent, undo.get("journey_event_id"))
        if event is not None:
            db.delete(event)  # it must not stay on her journey
    _remove_notifications(db, undo.get("notification_ids", []))
    for entry in undo.get("tasks", []):
        task = db.get(models.Task, entry["id"])
        if task is not None and task.status == "COMPLETED":
            task.status, task.updated_at = entry["status"], now()
    return "The document is back under review."


def _undo_answer(db, undo: dict, actor, note: str) -> str:
    reply = db.get(models.QuestionResponse, undo["response_id"])
    question = db.get(models.PatientQuestion, undo["question_id"])
    if reply is None or question is None or question.status != "ANSWERED":
        raise _gone("The question")
    db.delete(reply)  # the wording is kept in the audit log, not in her list of replies
    question.status = undo["before_status"]
    _remove_notifications(db, undo.get("notification_ids", []))
    return "The reply was withdrawn and the question is open again."


_UNDO = {"exception": _undo_exception, "notifications": _undo_notifications, "assign": _undo_assign, "verify": _undo_document,
         "reject": _undo_document, "answer": _undo_answer}


def can_undo(action: models.AIAction) -> bool:
    return action.status == "DONE" and action.undone_at is None and bool(action.undo) and (action.undo or {}).get("kind") in _UNDO


def undo(db, action: models.AIAction, actor: models.User, note: str) -> str:
    """Reverse one finished step. The caller has already checked that the doctor is assigned to this patient."""
    if action.undone_at is not None:
        raise HTTPException(409, "This step was already undone.")
    if not can_undo(action):
        raise HTTPException(409, "This step cannot be undone.")
    undo_data = action.undo or {}
    message = _UNDO[undo_data["kind"]](db, undo_data, actor, note)
    action.status, action.undone_at, action.undone_by_user_id, action.undo_note = "UNDONE", now(), actor.id, note[:500]
    wording = f" Reply withdrawn: {undo_data['text']}" if undo_data.get("kind") == "answer" else ""
    _audit(db, actor, action.episode_id, f"assistant_undo_{action.tool}", f"Undid a care assistant step: {action.tool.replace('_', ' ')}",
           f"{message} {note}{wording}", "AIAction", action.id)
    return message


# ---------------------------------------------------------------- the entry point for workflows
def _default_proposal(db, tool: str, args: dict) -> dict:
    """What a doctor reads when a routine step waits for approval (review-every-step mode) and the workflow gave no wording."""
    if tool == "notify_user":
        return {"title": "Send a reminder", "summary": f"{args.get('title', '')}: {args.get('body', '')}", "recommended_action": "Approve to send this fixed reminder."}
    return {"title": tool.replace("_", " ").capitalize(), "summary": "", "recommended_action": "Approve to run this step."}


def act(db, run: models.AIRun, tool: str, args: dict, *, key: str | None = None, proposal: dict | None = None, safety: bool = False) -> models.AIAction | None:
    """Ask the policy engine, then run, propose, record or refuse. Returns the ledger row (None if it was already done)."""
    decision = policy.decide(db, run, tool, args, key, safety)
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
            assistant = ensure_assistant_user(db)
            outcome = execute(db, tool, args, assistant, episode_id=run.episode_id)
            action.result, action.undo, action.executed_by_user_id = outcome.message, outcome.undo, assistant.id
            action.status = "DONE"
        except Exception as exc:  # noqa: BLE001: a failed step is handed to a person, never swallowed
            action.status, action.result = "FAILED", str(getattr(exc, "detail", exc))[:300]
            raise_exception(db, episode_id=run.episode_id, run_id=run.id, kind="attention", urgency="normal", title="The care assistant could not finish a step",
                            summary=f"{tool.replace('_', ' ')}: {action.result}", recommended_action="Please do this step yourself.")
    elif decision.outcome == "propose":
        proposal = proposal or _default_proposal(db, tool, args)
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
