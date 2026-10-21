"""Lightweight scheduled automation — Level 1 "safe automation" only
(internal notifications). Never changes referral/clinical state, never
marks anything completed — it only tells a human their attention is
needed.

Dedup: Task.last_reminder_sent_at enforces a cooldown so the same task
is never reminded more than once per sweep window, whether the sweep
runs on the APScheduler timer or is triggered manually for testing.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from . import models

OPEN_TASK_STATUSES = ("OPEN", "IN_PROGRESS", "WAITING")
REMINDER_COOLDOWN = timedelta(hours=20)  # effectively once/day even if the sweep runs more often


def _parse_date(value: str | None):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value[:10]).date()
    except ValueError:
        return None


def check_reminders(db: Session) -> dict:
    """One reminder sweep: tasks due tomorrow or overdue get an
    owner notification, at most once per cooldown window. Returns a
    small summary dict for logging / the manual-trigger endpoint."""
    now = datetime.now(timezone.utc)
    today = now.date()
    tomorrow = today + timedelta(days=1)
    now_naive = now.replace(tzinfo=None)  # SQLite returns naive datetimes; compare like-for-like

    sent = 0
    tasks = (
        db.query(models.Task)
        .filter(models.Task.status.in_(OPEN_TASK_STATUSES), models.Task.due_date.isnot(None), models.Task.owner_user_id.isnot(None))
        .all()
    )
    for task in tasks:
        due = _parse_date(task.due_date)
        if due is None or due > tomorrow:
            continue
        if task.last_reminder_sent_at and (now_naive - task.last_reminder_sent_at) < REMINDER_COOLDOWN:
            continue

        overdue = due < today
        db.add(models.Notification(
            recipient_user_id=task.owner_user_id, episode_id=task.episode_id,
            type="TASK_OVERDUE" if overdue else "TASK_DUE_SOON",
            title="Task overdue" if overdue else "Task due tomorrow",
            body=task.title, related_entity_type="Task", related_entity_id=task.id,
        ))
        task.last_reminder_sent_at = now_naive
        sent += 1

    db.add(models.AuditLog(
        episode_id=None, actor_user_id=None, actor_role=None, actor_display_name="System",
        action="reminders_checked", title="Automation: reminder sweep",
        details=f"{sent} reminder(s) sent.", object_type=None, object_id=None,
    ))
    db.commit()
    return {"remindersSent": sent, "checkedAt": now.isoformat()}
