"""The doctor's side of the care assistant: the Assistant inbox (proposals to approve, things that need a person), the
log of what the assistant did, and the patient's "Talk to a person" button."""
from datetime import datetime, time, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy.orm import Session

from .. import config, models
from ..ai_coordinator import messages, orchestrator, tools
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


def _iso(value):
    return value.replace(tzinfo=timezone.utc).isoformat() if value else None


def _today_start():
    return datetime.combine(datetime.now(timezone.utc).date(), time.min)


def _preview(item: models.ExceptionItem) -> str | None:
    args = item.proposed_args or {}
    return args.get("text") or args.get("note")


def item_out(db: Session, item: models.ExceptionItem) -> dict:
    ep = db.get(models.PregnancyEpisode, item.episode_id)
    decider = db.get(models.User, item.decided_by_user_id) if item.decided_by_user_id else None
    return {"id": item.id, "episodeId": item.episode_id, "patientName": ep.patient_name if ep else "Unknown", "kind": item.kind, "urgency": item.urgency,
            "title": item.title, "summary": item.summary, "recommendedAction": item.recommended_action, "proposedTool": item.proposed_tool,
            "preview": _preview(item), "status": item.status, "createdAt": _iso(item.created_at), "decidedBy": decider.full_name if decider else None,
            "decidedAt": _iso(item.decided_at), "decisionNote": item.decision_note}


@router.get("/status")
def status(user=Depends(doctor), db: Session = Depends(get_db)):
    ids = allowed_ids(db, user)
    open_items = db.query(models.ExceptionItem).filter(models.ExceptionItem.episode_id.in_(ids), models.ExceptionItem.status == "OPEN").all()
    handled = db.query(models.AIAction).filter(models.AIAction.episode_id.in_(ids), models.AIAction.status == "DONE", models.AIAction.created_at >= _today_start()).count()
    return {"mode": config.AI_COORDINATOR_MODE, "provider": config.AI_PROVIDER, "model": config.AI_MODEL if config.AI_PROVIDER == "claude" else None,
            "careTeamEnabled": config.CARE_TEAM_ENABLED, "open": len(open_items), "urgent": sum(i.urgency == "urgent" for i in open_items),
            "proposals": sum(i.kind == "proposal" for i in open_items), "handledToday": handled}


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
            message = tools.execute(db, item.proposed_tool, item.proposed_args or {}, user, episode_id=item.episode_id, via_assistant=True)
            item.status = "APPROVED"
        except HTTPException as exc:
            if exc.status_code != 409:
                db.rollback()
                raise
            item.status, message = "DISMISSED", "This was already handled by someone else, so it was closed."
    else:
        item.status = "DISMISSED" if payload.decision == "dismiss" else "ACKNOWLEDGED"
    item.decided_by_user_id, item.decided_at, item.decision_note = user.id, datetime.now(timezone.utc), payload.note
    db.add(models.AuditLog(episode_id=item.episode_id, actor_user_id=user.id, actor_role=user.role, actor_display_name=user.full_name,
                           action=f"assistant_item_{item.status.lower()}", title=f"Assistant item {item.status.lower()}", details=f"{item.title}. {payload.note}"[:500],
                           object_type="ExceptionItem", object_id=item.id))
    db.commit()
    return {**item_out(db, item), "message": message}


@router.get("/activity")
def activity(limit: int = 60, user=Depends(doctor), db: Session = Depends(get_db)):
    rows = (db.query(models.AIAction, models.AIRun).join(models.AIRun, models.AIRun.id == models.AIAction.run_id)
            .filter(models.AIAction.episode_id.in_(allowed_ids(db, user))).order_by(models.AIAction.created_at.desc()).limit(min(max(limit, 1), 200)).all())
    names = {}
    result = []
    for action, run in rows:
        if action.episode_id not in names:
            ep = db.get(models.PregnancyEpisode, action.episode_id)
            names[action.episode_id] = ep.patient_name if ep else "Unknown"
        result.append({"id": action.id, "createdAt": _iso(action.created_at), "patientName": names[action.episode_id], "workflow": run.workflow, "tool": action.tool,
                       "tier": action.tier, "policy": action.policy, "status": action.status, "reason": action.reason, "result": action.result,
                       "provider": run.provider, "mode": run.mode})
    return result


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
