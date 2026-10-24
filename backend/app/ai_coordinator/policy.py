"""The policy engine: ordinary code that sits between the assistant and the things it can do.

The model proposes; this code disposes. Nothing the model writes is ever run as text, and nothing here depends on the
model's own judgement about whether an action is safe.

Risk levels
  T0  act: reversible, administrative, fixed wording (hand something to a doctor, send a fixed reminder)
  T1  propose: low risk but a mistake would matter (verify or reject a document, send an answer to a patient).
      In `assist` mode these become one-click proposals a doctor approves.
  T2/T3  never available. Diagnosing, prescribing, interpreting a result, clearing an urgent flag, releasing a document
      to a patient, deleting a record or changing who can see what are simply not in TOOLS, so they cannot be requested.
"""
from dataclasses import dataclass
from datetime import datetime, time, timezone

from .. import config, models

T0, T1 = "T0", "T1"

TOOLS = {
    "create_attention": T0,
    "notify_user": T0,
    "send_urgent_message": T0,
    "assign_question_to_doctor": T0,
    "verify_document": T1,
    "reject_document": T1,
    "answer_question": T1,
}


@dataclass
class Decision:
    outcome: str  # run | propose | shadow | deny
    reason: str
    quiet: bool = False  # a denial that needs no doctor's attention (switched off, or already done)


def _today_start() -> datetime:
    return datetime.combine(datetime.now(timezone.utc).date(), time.min)


def decide(db, run: models.AIRun, tool: str, args: dict, key: str | None) -> Decision:
    mode = config.AI_COORDINATOR_MODE  # read each time, so the kill switch works even for work already queued
    if mode == "off":
        return Decision("deny", "The care assistant is switched off.", quiet=True)
    tier = TOOLS.get(tool)
    if tier is None:
        return Decision("deny", "This is not an action the assistant is allowed to take.")

    # Everything the action touches must belong to the same patient the run is about.
    for field, table in (("document_id", models.MedicalDocument), ("question_id", models.PatientQuestion), ("task_id", models.Task)):
        if field in args:
            item = db.get(table, args[field])
            if item is None or item.episode_id != run.episode_id:
                return Decision("deny", "The item does not belong to this patient, so nothing was done.")
    if tool == "notify_user" and not _recipient_belongs(db, run.episode_id, args.get("user_id")):
        return Decision("deny", "That person is not linked to this patient, so no message was sent.")

    if key and db.query(models.AIAction).filter_by(idempotency_key=key).first():
        return Decision("deny", "This step was already done.", quiet=True)

    done_today = db.query(models.AIAction).filter(
        models.AIAction.episode_id == run.episode_id, models.AIAction.status == "DONE", models.AIAction.created_at >= _today_start()).count()
    if done_today >= config.AI_DAILY_ACTION_CAP:
        return Decision("deny", f"The assistant has already taken {done_today} steps for this patient today, so it stopped and asks a person to look.")

    if mode == "shadow":
        return Decision("shadow", "Shadow mode: recorded only, nothing was done.")
    if tier == T0:
        return Decision("run", "Low-risk administrative step.")
    return Decision("propose", "A doctor approves this step before it runs.")


def _recipient_belongs(db, episode_id: str, user_id: str | None) -> bool:
    """A message may only go to the patient, one of her doctors, or a trusted person she linked."""
    if not user_id:
        return False
    episode = db.get(models.PregnancyEpisode, episode_id)
    if episode is None:
        return False
    if user_id == episode.patient_user_id:
        return True
    if db.query(models.PatientDoctorAssignment).filter_by(episode_id=episode_id, doctor_user_id=user_id).first():
        return True
    return db.query(models.CaregiverLink).filter_by(episode_id=episode_id, caregiver_user_id=user_id, status="ACTIVE").first() is not None
