"""Queue and schedule for the care assistant.

Events only *enqueue* a job row, inside the request that caused them (so a slow or failing model can never hold up or
break an upload or a question). A background job, or the doctor's "Run now" button, processes the queue. Each job
writes an `ai_runs` row with the mode, provider, model, prompt version and outcome, and any failure becomes an item in
the doctor's inbox instead of disappearing.
"""
import logging
import threading
from datetime import datetime, timezone

from .. import config, models
from ..database import SessionLocal
from . import prompts, workflows
from .providers import get_provider

WORKFLOWS = {"document_intake": workflows.run_document_intake, "question_routing": workflows.run_question_routing}
PROMPT_VERSIONS = {"document_intake": prompts.INTAKE_VERSION, "question_routing": prompts.TRIAGE_VERSION}
_LOCK = threading.Lock()


def _now():
    return datetime.now(timezone.utc)


def enqueue(db, workflow: str, *, episode_id: str, source_type: str, source_id: str) -> models.AIRun | None:
    """Add a queued job to the current transaction (the caller commits). The same trigger is only ever queued once."""
    if config.AI_COORDINATOR_MODE == "off":
        return None
    key = f"{workflow}:{source_type}:{source_id}"
    if db.query(models.AIRun).filter_by(trigger_key=key).first():
        return None
    run = models.AIRun(workflow=workflow, episode_id=episode_id, source_type=source_type, source_id=source_id, trigger_key=key,
                       status="QUEUED", mode=config.AI_COORDINATOR_MODE)
    db.add(run)
    return run


def _stamp(run: models.AIRun, provider) -> None:
    run.mode, run.provider, run.model = config.AI_COORDINATOR_MODE, provider.name, provider.model
    run.framework, run.prompt_version = "langgraph", PROMPT_VERSIONS.get(run.workflow, "none")


def _fail(db, run_id: str, exc: Exception) -> None:
    from . import tools
    db.rollback()
    run = db.get(models.AIRun, run_id)
    run.status, run.error, run.finished_at = "FAILED", str(exc)[:500], _now()
    tools.raise_exception(db, episode_id=run.episode_id, run_id=run.id, kind="attention", urgency="normal", title="The care assistant hit a problem",
                          summary=f"{run.workflow.replace('_', ' ')}: {str(exc)[:200]}", recommended_action="Please handle this item yourself.",
                          source_type=run.source_type, source_id=run.source_id)
    db.commit()


def process_queue(session_factory=None, limit: int = 25) -> int:
    """Run queued jobs. Safe to call from the scheduler, the 'Run now' button or a test."""
    factory = session_factory or SessionLocal
    handled = 0
    with _LOCK:
        db = factory()
        try:
            for run_id in [r.id for r in db.query(models.AIRun).filter_by(status="QUEUED").order_by(models.AIRun.created_at).limit(limit).all()]:
                run = db.get(models.AIRun, run_id)
                if config.AI_COORDINATOR_MODE == "off":
                    run.status, run.summary, run.finished_at = "SKIPPED", "The care assistant is switched off.", _now()
                    db.commit()
                    continue
                provider = get_provider()
                run.status, run.started_at = "RUNNING", _now()
                _stamp(run, provider)
                db.commit()
                try:
                    run.summary = WORKFLOWS[run.workflow](db, run, provider)
                    run.status, run.finished_at = "DONE", _now()
                    db.commit()
                except Exception as exc:  # noqa: BLE001: nothing the assistant does may fail silently
                    _fail(db, run_id, exc)
                handled += 1
        finally:
            db.close()
    return handled


def run_sweeps(session_factory=None) -> dict:
    """The scheduled follow-up work: reminders for missed check-ins, and overdue tasks raised to a doctor."""
    if config.AI_COORDINATOR_MODE == "off":
        return {"missedCheckIns": 0, "overdueTasks": 0}
    factory = session_factory or SessionLocal
    with _LOCK:
        db = factory()
        try:
            provider = get_provider()

            def make_run(workflow, episode_id, source_type, source_id, key):
                if db.query(models.AIRun).filter_by(trigger_key=key).first():
                    return None
                run = models.AIRun(workflow=workflow, episode_id=episode_id, source_type=source_type, source_id=source_id, trigger_key=key,
                                   status="DONE", started_at=_now(), finished_at=_now())
                _stamp(run, provider)
                db.add(run)
                db.flush()
                return run

            counts = {"missedCheckIns": workflows.sweep_missed_checkins(db, make_run), "overdueTasks": workflows.sweep_overdue_tasks(db, make_run)}
            db.commit()
            return counts
        except Exception:  # noqa: BLE001: a failed sweep must not stop the scheduler
            logging.getLogger(__name__).exception("The care assistant's follow-up sweep failed")
            db.rollback()
            return {"missedCheckIns": 0, "overdueTasks": 0, "error": True}
        finally:
            db.close()


def run_all(session_factory=None) -> dict:
    handled = process_queue(session_factory)
    return {"queued": handled, **run_sweeps(session_factory)}
