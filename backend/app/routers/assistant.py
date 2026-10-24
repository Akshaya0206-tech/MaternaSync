"""The doctor's side of the care assistant: the Assistant inbox (proposals to approve, things that need a person), the
log of what the assistant did, the controls (pause, review every step, undo a step), and the patient's "Talk to a person" button."""
from datetime import datetime, time, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy.orm import Session

from .. import config, models
from ..ai_coordinator import controls, messages, orchestrator, tools
from ..continuity_schemas import Input
from ..continuity_service import allowed_ids, episode
from ..database import get_db
from ..deps import get_my_patient_episode, require_role

router = APIRouter(prefix="/api/v2/assistant", tags=["assistant"])
doctor = require_role("doctor")
patient = require_role("patient")


class DecideIn(Input):
    decision: Literal["approve", "dismiss", "acknowledge"]
    note: str = Field("", max_length=500)


class TalkIn(Input):
    message: str = Field("", max_length=500)


class SettingsIn(Input):
    paused: bool | None = None
    review_all: bool | None = None


class UndoIn(Input):
    note: str = Field("", max_length=500)


def _iso(value):
    return value.replace(tzinfo=timezone.utc).isoformat() if value else None


def _today_start():
    return datetime.combine(datetime.now(timezone.utc).date(), time.min)


def _name(db: Session, user_id: str | None) -> str | None:
    user = db.get(models.User, user_id) if user_id else None
    return user.full_name if user else None


def _log(db: Session, user: models.User, episode_id: str | None, action: str, title: str, details: str = "", object_type: str = "AssistantSetting", object_id: str | None = None) -> None:
    db.add(models.AuditLog(episode_id=episode_id, actor_user_id=user.id, actor_role=user.role, actor_display_name=user.full_name, action=action, title=title,
                           details=details[:500], object_type=object_type, object_id=object_id))


def _preview(item: models.ExceptionItem) -> str | None:
    args = item.proposed_args or {}
    return args.get("text") or args.get("note") or args.get("body")


def item_out(db: Session, item: models.ExceptionItem) -> dict:
    ep = db.get(models.PregnancyEpisode, item.episode_id)
    return {"id": item.id, "episodeId": item.episode_id, "patientName": ep.patient_name if ep else "Unknown", "kind": item.kind, "urgency": item.urgency,
            "title": item.title, "summary": item.summary, "recommendedAction": item.recommended_action, "proposedTool": item.proposed_tool,
            "preview": _preview(item), "status": item.status, "createdAt": _iso(item.created_at), "decidedBy": _name(db, item.decided_by_user_id),
            "decidedAt": _iso(item.decided_at), "decisionNote": item.decision_note}


def _state(db: Session, user: models.User) -> dict:
    ids = allowed_ids(db, user)
    state = controls.load(db)
    open_items = db.query(models.ExceptionItem).filter(models.ExceptionItem.episode_id.in_(ids), models.ExceptionItem.status == "OPEN").all()
    handled = db.query(models.AIAction).filter(models.AIAction.episode_id.in_(ids), models.AIAction.status == "DONE", models.AIAction.created_at >= _today_start()).count()
    queued = db.query(models.AIRun).filter(models.AIRun.episode_id.in_(ids), models.AIRun.status == "QUEUED").count()
    paused_here = []
    for episode_id in state["paused_episodes"]:
        if episode_id in ids:
            ep = db.get(models.PregnancyEpisode, episode_id)
            paused_here.append({"episodeId": episode_id, "patientName": ep.patient_name if ep else "Unknown"})
    setting = db.get(models.AssistantSetting, controls.PAUSED)
    return {"mode": config.AI_COORDINATOR_MODE, "provider": config.AI_PROVIDER, "model": config.AI_MODEL if config.AI_PROVIDER == "claude" else None,
            "careTeamEnabled": config.CARE_TEAM_ENABLED, "open": len(open_items), "urgent": sum(i.urgency == "urgent" for i in open_items),
            "proposals": sum(i.kind == "proposal" for i in open_items), "handledToday": handled,
            "paused": state["paused"], "pausedBy": _name(db, setting.updated_by_user_id) if setting and state["paused"] else None,
            "reviewAll": state["review_all"], "pausedPatients": paused_here, "waiting": queued}


@router.get("/status")
def status(user=Depends(doctor), db: Session = Depends(get_db)):
    return _state(db, user)


@router.patch("/settings")
def change_settings(payload: SettingsIn, user=Depends(doctor), db: Session = Depends(get_db)):
    """Pause or resume the assistant for everyone, or turn "review every step" on or off. Takes effect on the next step."""
    if payload.paused is not None:
        controls.set_flag(db, user, controls.PAUSED, payload.paused)
        _log(db, user, None, "assistant_paused" if payload.paused else "assistant_resumed",
             "Paused the care assistant" if payload.paused else "Resumed the care assistant")
    if payload.review_all is not None:
        controls.set_flag(db, user, controls.REVIEW_ALL, payload.review_all)
        _log(db, user, None, "assistant_review_all_on" if payload.review_all else "assistant_review_all_off",
             "Switched on review of every assistant step" if payload.review_all else "Switched off review of every assistant step")
    db.commit()
    return _state(db, user)


@router.post("/patients/{episode_id}/pause")
def pause_patient(episode_id: str, user=Depends(doctor), db: Session = Depends(get_db)):
    ep = episode(db, user, episode_id)  # the doctor must be assigned to this patient
    controls.set_episode_paused(db, user, ep.id, True)
    _log(db, user, ep.id, "assistant_paused_for_patient", "Paused the care assistant for this patient", ep.patient_name)
    db.commit()
    return _state(db, user)


@router.post("/patients/{episode_id}/resume")
def resume_patient(episode_id: str, user=Depends(doctor), db: Session = Depends(get_db)):
    ep = episode(db, user, episode_id)
    controls.set_episode_paused(db, user, ep.id, False)
    _log(db, user, ep.id, "assistant_resumed_for_patient", "Resumed the care assistant for this patient", ep.patient_name)
    db.commit()
    return _state(db, user)


@router.get("/exceptions")
def exceptions(scope: Literal["open", "all"] = "open", user=Depends(doctor), db: Session = Depends(get_db)):
    query = db.query(models.ExceptionItem).filter(models.ExceptionItem.episode_id.in_(allowed_ids(db, user)))
    if scope == "open":
        query = query.filter(models.ExceptionItem.status == "OPEN")
    items = query.order_by(models.ExceptionItem.created_at.desc()).limit(200).all()
    items.sort(key=lambda i: (i.status != "OPEN", i.urgency != "urgent"))  # open first, urgent first; newest first within each group
    return [item_out(db, i) for i in items]


@router.post("/exceptions/{item_id}/decide")
def decide(item_id: str, payload: DecideIn, user=Depends(doctor), db: Session = Depends(get_db)):
    item = db.get(models.ExceptionItem, item_id)
    if item is None:
        raise HTTPException(404, "Item not found.")
    episode(db, user, item.episode_id)  # the doctor must be assigned to this patient
    if item.status != "OPEN":
        raise HTTPException(409, "A doctor has already decided this.")
    message = ""
    if payload.decision == "approve":
        if item.kind != "proposal" or not item.proposed_tool:
            raise HTTPException(400, "Only a proposal can be approved. Use Acknowledge for anything else.")
        try:
            # The step runs under the doctor's own identity, so the record says a doctor decided it.
            outcome = tools.execute(db, item.proposed_tool, item.proposed_args or {}, user, episode_id=item.episode_id, via_assistant=True)
            message = outcome.message
            item.status = "APPROVED"
            ledger = db.query(models.AIAction).filter_by(exception_id=item.id).first()
            if ledger is not None:  # the proposal's row in the log becomes a finished step that can now be undone
                ledger.status, ledger.result, ledger.undo, ledger.executed_by_user_id = "DONE", outcome.message, outcome.undo, user.id
        except HTTPException as exc:
            if exc.status_code != 409:
                db.rollback()
                raise
            item.status, message = "DISMISSED", "This was already handled by someone else, so it was closed."
    else:
        item.status = "DISMISSED" if payload.decision == "dismiss" else "ACKNOWLEDGED"
    item.decided_by_user_id, item.decided_at, item.decision_note = user.id, datetime.now(timezone.utc), payload.note
    _log(db, user, item.episode_id, f"assistant_item_{item.status.lower()}", f"Assistant item {item.status.lower()}", f"{item.title}. {payload.note}",
         "ExceptionItem", item.id)
    db.commit()
    return {**item_out(db, item), "message": message}


def action_out(db: Session, action: models.AIAction, run: models.AIRun, patient_name: str) -> dict:
    return {"id": action.id, "episodeId": action.episode_id, "createdAt": _iso(action.created_at), "patientName": patient_name, "workflow": run.workflow,
            "tool": action.tool, "tier": action.tier, "policy": action.policy, "status": action.status, "reason": action.reason, "result": action.result,
            "provider": run.provider, "mode": run.mode, "executedBy": _name(db, action.executed_by_user_id), "undoable": tools.can_undo(action),
            "undoneAt": _iso(action.undone_at), "undoneBy": _name(db, action.undone_by_user_id), "undoNote": action.undo_note}


@router.get("/activity")
def activity(limit: int = 60, user=Depends(doctor), db: Session = Depends(get_db)):
    rows = (db.query(models.AIAction, models.AIRun).join(models.AIRun, models.AIRun.id == models.AIAction.run_id)
            .filter(models.AIAction.episode_id.in_(allowed_ids(db, user))).order_by(models.AIAction.created_at.desc()).limit(min(max(limit, 1), 200)).all())
    names: dict[str, str] = {}
    result = []
    for action, run in rows:
        if action.episode_id not in names:
            ep = db.get(models.PregnancyEpisode, action.episode_id)
            names[action.episode_id] = ep.patient_name if ep else "Unknown"
        result.append(action_out(db, action, run, names[action.episode_id]))
    return result


@router.post("/actions/{action_id}/undo")
def undo_action(action_id: str, payload: UndoIn, user=Depends(doctor), db: Session = Depends(get_db)):
    """Reverse a step that already ran (a reminder, an assignment, a verification, a reply...). The doctor must be assigned to
    the patient. What cannot be reversed (a step that has since changed, or an old step with no record of what it did) is refused."""
    action = db.get(models.AIAction, action_id)
    if action is None:
        raise HTTPException(404, "Step not found.")
    ep = episode(db, user, action.episode_id)
    try:
        message = tools.undo(db, action, user, payload.note.strip())
    except HTTPException:
        db.rollback()
        raise
    db.commit()
    run = db.get(models.AIRun, action.run_id)
    return {**action_out(db, action, run, ep.patient_name), "message": message}


@router.post("/run-now")
def run_now(user=Depends(doctor)):
    """Process queued assistant work and the follow-up sweeps immediately, instead of waiting for the schedule."""
    return orchestrator.run_all()


@router.post("/talk-to-a-person")
def talk_to_a_person(payload: TalkIn, ep=Depends(get_my_patient_episode), user=Depends(patient), db: Session = Depends(get_db)):
    """Always works, whatever mode the assistant is in: it goes straight to a doctor."""
    pref = db.get(models.PatientPreference, user.id)
    language = pref.language if pref and pref.language in messages.LANGUAGES else "en"
    note = payload.message.strip()
    tools.raise_exception(db, episode_id=ep.id, run_id=None, kind="attention", urgency="normal", title="A patient asked to talk to a person",
                          summary=(f"“{note}”" if note else "She pressed Talk to a person and did not leave a message."), recommended_action="Please get back to her.",
                          source_type="User", source_id=user.id)
    db.add(models.AuditLog(episode_id=ep.id, actor_user_id=user.id, actor_role=user.role, actor_display_name=user.full_name, action="talk_to_a_person",
                           title="Asked to talk to a person", details=note[:200], object_type="User", object_id=user.id))
    db.commit()
    return {"message": messages.pick(messages.TALK_TO_PERSON, language)}
