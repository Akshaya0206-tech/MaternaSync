import json

from sqlalchemy.orm import Session

from .. import models
from .handlers import REGISTRY


def dispatch_event(
    db: Session,
    event_type: str,
    *,
    episode_id: str,
    actor_user_id: str | None = None,
    source_type: str | None = None,
    source_id: str | None = None,
    payload: dict | None = None,
) -> None:
    """Fires every handler registered for `event_type`. Call this AFTER
    `db.add()`-ing the primary record the event describes (e.g. the new
    MedicalDocument) but BEFORE `db.commit()` — dispatch_event does not
    commit anything itself, it only adds further pending writes (tasks,
    notifications, the audit entry) to the same transaction.

    On handler failure: the SAVEPOINT rolls back only the automation's
    own partial writes. The caller's own pending changes from before this
    call are untouched, and a failure AuditLog row is written so the
    failure is visible without blocking or corrupting the real action.
    """
    handlers = REGISTRY.get(event_type, [])
    if not handlers:
        return

    payload = payload or {}
    try:
        with db.begin_nested():
            for handler in handlers:
                handler(
                    db, episode_id=episode_id, actor_user_id=actor_user_id,
                    source_type=source_type, source_id=source_id, payload=payload,
                )
        db.add(models.AuditLog(
            episode_id=episode_id, actor_user_id=None, actor_role=None, actor_display_name="System",
            action=event_type.lower(), title=f"Automation: {event_type.replace('_', ' ').title()}",
            details=json.dumps(payload)[:500], object_type=source_type, object_id=source_id,
        ))
    except Exception as exc:  # noqa: BLE001 — automation must never propagate into the triggering request
        db.add(models.AuditLog(
            episode_id=episode_id, actor_user_id=None, actor_role=None, actor_display_name="System",
            action=f"{event_type.lower()}_failed", title=f"Automation failed: {event_type.replace('_', ' ').title()}",
            details=str(exc)[:500], object_type=source_type, object_id=source_id,
        ))
