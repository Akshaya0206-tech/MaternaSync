"""The switches a doctor can flip from the Care Assistant page: pause everything, pause one patient, or make the assistant
wait for approval before every step. They are stored in the database, so they take effect on the very next step and need
no restart. The environment kill switch (MATERNASYNC_AI_COORDINATOR_MODE) is separate and always wins over these.

What "held" means: the work stays queued and nothing is lost; it runs when the doctor resumes. The one thing a pause never
holds back is the fixed emergency message for warning-sign wording, because delaying it could hurt (see workflows.run_held_question).
A doctor can still reverse that message afterwards.
"""
from datetime import datetime, timezone

from .. import models

PAUSED, REVIEW_ALL, PAUSED_EPISODES = "paused", "review_all", "paused_episodes"


def _now():
    return datetime.now(timezone.utc)


def _read(db, key, default):
    row = db.get(models.AssistantSetting, key)
    return default if row is None or row.value is None else row.value


def _write(db, user, key, value) -> None:
    row = db.get(models.AssistantSetting, key)
    if row is None:
        row = models.AssistantSetting(key=key)
        db.add(row)
    row.value, row.updated_by_user_id, row.updated_at = value, user.id if user else None, _now()


def load(db) -> dict:
    return {"paused": bool(_read(db, PAUSED, False)), "review_all": bool(_read(db, REVIEW_ALL, False)),
            "paused_episodes": list(_read(db, PAUSED_EPISODES, []))}


def is_held(db, episode_id: str | None, state: dict | None = None) -> bool:
    """Is this patient's assistant work waiting for a doctor?"""
    state = state or load(db)
    return state["paused"] or (episode_id is not None and episode_id in state["paused_episodes"])


def set_flag(db, user, key: str, value: bool) -> None:
    _write(db, user, key, bool(value))


def set_episode_paused(db, user, episode_id: str, paused: bool) -> None:
    current = [e for e in _read(db, PAUSED_EPISODES, []) if e != episode_id]
    _write(db, user, PAUSED_EPISODES, current + [episode_id] if paused else current)
