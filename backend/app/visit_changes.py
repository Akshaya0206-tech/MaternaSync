"""A patient's request to cancel or move a confirmed visit. It only ever asks: the visit stays exactly as it is until a doctor acts on it
(through the visit's status in Connected Care, or the Care Assistant for the new time she asked for)."""
from . import models
from .continuity_service import now

OPEN_TASK = ("OPEN", "IN_PROGRESS", "WAITING")
# Written on the visit request she made for a new time when she withdraws it, so her own page does not list it as "not going ahead".
WITHDRAWN_MARK = "(withdrawn by the patient)"
FIELDS = ("change_kind", "change_note", "change_preferred_at", "change_requested_at", "change_new_appointment_id", "change_task_id")


def doctor_for(db, episode_id: str) -> str | None:
    """The patient's own doctor (the primary one, else any assigned), who gets the task."""
    assignments = db.query(models.PatientDoctorAssignment).filter_by(episode_id=episode_id).all()
    primary = next((a for a in assignments if a.is_primary), None)
    chosen = primary or (assignments[0] if assignments else None)
    return chosen.doctor_user_id if chosen else None


def clear(appointment: models.Appointment) -> None:
    for field in FIELDS:
        setattr(appointment, field, None)


def close_request(db, appointment: models.Appointment, note: str = "") -> None:
    """The visit has been dealt with (cancelled, done or missed): the request is closed and the doctor's task with it."""
    if not appointment.change_kind:
        return
    task = db.get(models.Task, appointment.change_task_id) if appointment.change_task_id else None
    if task is not None and task.status in OPEN_TASK:
        task.status = "COMPLETED"
        task.updated_at = now()
        if note:
            task.description = f"{task.description or ''} {note}".strip()
    clear(appointment)
