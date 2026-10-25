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

from .. import caregiver_service, config, models
from . import controls

T0, T1 = "T0", "T1"

# Even in "review every step" mode these never wait: handing something to a doctor IS the human step (a question that waits
# for approval before it reaches the doctor would be invisible), and the fixed emergency message must not be delayed.
# A doctor can still reverse any of them afterwards.
ALWAYS_RUN = {"create_attention", "assign_question_to_doctor", "send_urgent_message"}

TOOLS = {
    "create_attention": T0,
    "notify_user": T0,
    "send_urgent_message": T0,
    "assign_question_to_doctor": T0,
    "verify_document": T1,
    "reject_document": T1,
    "answer_question": T1,
    # Visits: a doctor approves each change to a booking.
    "confirm_appointment": T1,
    "offer_new_times": T1,
    "record_missed_visit": T1,
    # Referrals: sending leaves the clinic and a chase is a message to a third party, so a doctor approves both.
    "send_referral": T1,
    "chase_referral": T1,
    # A WhatsApp reminder the doctor already approved, to a number the woman consented to; consent is checked in code on every send.
    "send_outreach": T0,
    # A short "please sign in" WhatsApp nudge to a trusted person on their own number, only after they confirmed it with a code.
    "send_caregiver_whatsapp": T0,
    # Drafts and counts: nothing here is released to a patient or changes a clinical record.
    "prepare_draft": T0,
    "prepare_handover": T0,
    "post_weekly_summary": T0,
}


@dataclass
class Decision:
    outcome: str  # run | propose | shadow | deny
    reason: str
    quiet: bool = False  # a denial that needs no doctor's attention (switched off, or already done)


def _today_start() -> datetime:
    return datetime.combine(datetime.now(timezone.utc).date(), time.min)


def decide(db, run: models.AIRun, tool: str, args: dict, key: str | None, safety: bool = False) -> Decision:
    """`safety` is only passed for the fixed emergency steps for warning-sign wording; it skips a doctor's pause and
    "review every step" switches (never the environment kill switch) so that message is never held back."""
    mode = config.AI_COORDINATOR_MODE  # read each time, so the kill switch works even for work already queued
    if mode == "off":
        return Decision("deny", "The care assistant is switched off.", quiet=True)
    tier = TOOLS.get(tool)
    if tier is None:
        return Decision("deny", "This is not an action the assistant is allowed to take.")
    state = controls.load(db)
    if not safety and controls.is_held(db, run.episode_id, state):
        return Decision("deny", "A doctor paused the care assistant, so this waits.", quiet=True)

    # Everything the action touches must belong to the same patient the run is about.
    for field, table in (("document_id", models.MedicalDocument), ("question_id", models.PatientQuestion), ("task_id", models.Task),
                         ("appointment_id", models.Appointment), ("referral_id", models.Referral), ("reminder_id", models.CareReminder),
                         ("link_id", models.CaregiverLink)):
        if field in args:
            item = db.get(table, args[field])
            if item is None or item.episode_id != run.episode_id:
                return Decision("deny", "The item does not belong to this patient, so nothing was done.")
    if tool == "notify_user" and not _recipient_belongs(db, run.episode_id, args.get("user_id")):
        return Decision("deny", "That person is not linked to this patient, so no message was sent.")
    if tool in ("prepare_handover", "post_weekly_summary"):
        doctor = db.get(models.User, args.get("doctor_id"))
        if doctor is None or doctor.role != "doctor" or (run.episode_id and not db.query(models.PatientDoctorAssignment).filter_by(episode_id=run.episode_id, doctor_user_id=doctor.id).first()):
            return Decision("deny", "That doctor is not assigned to this patient, so nothing was prepared.")

    if key and db.query(models.AIAction).filter_by(idempotency_key=key).first():
        return Decision("deny", "This step was already done.", quiet=True)

    done_today = db.query(models.AIAction).filter(
        models.AIAction.episode_id == run.episode_id, models.AIAction.status == "DONE", models.AIAction.created_at >= _today_start()).count()
    if done_today >= config.AI_DAILY_ACTION_CAP:
        return Decision("deny", f"The assistant has already taken {done_today} steps for this patient today, so it stopped and asks a person to look.")

    if mode == "shadow":
        return Decision("shadow", "Shadow mode: recorded only, nothing was done.")
    if tier == T0 and state["review_all"] and tool not in ALWAYS_RUN and not safety:
        return Decision("propose", "Review-every-step mode: a doctor approves this step before it runs.")
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
    link = db.query(models.CaregiverLink).filter_by(episode_id=episode_id, caregiver_user_id=user_id, status="ACTIVE").first()
    return link is not None and caregiver_service.is_current(link)  # not past the end date she set
