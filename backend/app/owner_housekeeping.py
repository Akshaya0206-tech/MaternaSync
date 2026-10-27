"""Quiet housekeeping at start-up: while the care-team login is switched off, work that is still owned by a care-team account would sit
unseen (nobody can sign in to answer it), so it is moved to the patient's own doctor.

It only moves OPEN tasks and the owner of an agreed check-in follow-up. Each move is written to the audit log with before and after, and
to the task's reassignment history with the reason. Nobody is notified: this is housekeeping, not a new request. If the care-team login is
switched on again nothing is undone and nothing needs to be."""
from . import config, models
from .continuity_service import now
from .seed_assistant import ASSISTANT_EMAIL
from .visit_changes import doctor_for

OPEN_TASK = ("OPEN", "IN_PROGRESS", "WAITING")
REASON = "Reassigned because the care-team login is off"


def _who(db) -> models.User | None:
    return db.query(models.User).filter_by(email=ASSISTANT_EMAIL).first()


def _audit(db, actor, episode_id, action, obj, before, after, details):
    db.add(models.AuditLog(
        episode_id=episode_id, actor_user_id=actor.id, actor_role=actor.role, actor_display_name=actor.full_name, action=action,
        title=action.replace("_", " ").capitalize(), details=details, object_type=type(obj).__name__, object_id=getattr(obj, "id", None) or getattr(obj, "episode_id", None),
        previous_state=before, new_state=after,
    ))


def reassign_inactive_owners(db) -> int:
    """Returns how many things were moved (0 when the care-team login is on, or when nothing is owned by a care-team account)."""
    if config.CARE_TEAM_ENABLED:
        return 0
    moved = 0
    assistant = _who(db)
    care_team = {u.id: u for u in db.query(models.User).filter_by(role="care_team").all()}
    if not care_team:
        return 0

    tasks = db.query(models.Task).filter(models.Task.owner_user_id.in_(list(care_team)), models.Task.status.in_(OPEN_TASK)).all()
    for task in tasks:
        doctor = doctor_for(db, task.episode_id)
        if doctor is None:
            continue  # no doctor is assigned to this patient: leave it, there is nobody better to give it to
        actor = assistant or db.get(models.User, doctor)
        before = care_team[task.owner_user_id].full_name
        task.owner_user_id = doctor
        task.updated_at = now()
        db.add(models.TaskAssignment(task_id=task.id, assigned_to_user_id=doctor, assigned_by_user_id=actor.id, note=REASON))
        _audit(db, actor, task.episode_id, "task_owner_reassigned_login_off", task, {"owner": before}, {"owner": db.get(models.User, doctor).full_name}, REASON)
        moved += 1

    plans = db.query(models.MonitoringPlan).filter(models.MonitoringPlan.owner_user_id.in_(list(care_team))).all()
    for plan in plans:
        doctor = doctor_for(db, plan.episode_id)
        if doctor is None:
            continue
        actor = assistant or db.get(models.User, doctor)
        before = care_team[plan.owner_user_id].full_name
        plan.owner_user_id = doctor
        _audit(db, actor, plan.episode_id, "monitoring_owner_reassigned_login_off", plan, {"owner": before}, {"owner": db.get(models.User, doctor).full_name}, REASON)
        moved += 1

    if moved:
        db.commit()
    return moved
