"""Plain counts for the clinic, worked out by code from the database. No model writes or checks any number here, and nothing
is graded: these are how many things arrived, how many were handled, how long they waited, and what the assistant did.
The same figures feed the Care Assistant page and the weekly message to each doctor.
"""
from datetime import datetime, timedelta, timezone
from statistics import median

from .. import models

OPEN_TASKS = ("OPEN", "IN_PROGRESS", "WAITING")


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _hours(pairs) -> float | None:
    values = [(_utc(b) - _utc(a)).total_seconds() / 3600 for a, b in pairs if a and b and _utc(b) >= _utc(a)]
    return round(median(values), 1) if values else None


def summary(db, episode_ids: list[str], days: int = 7, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    since = (now - timedelta(days=days)).replace(tzinfo=None)
    cutoff = now.replace(tzinfo=None)
    ids = list(episode_ids)

    questions = db.query(models.PatientQuestion).filter(models.PatientQuestion.episode_id.in_(ids), models.PatientQuestion.created_at >= since).all()
    answered = [q for q in questions if q.status in ("ANSWERED", "CLOSED")]
    replies = []
    for q in answered:
        first = (db.query(models.QuestionResponse).filter_by(question_id=q.id, status="APPROVED").order_by(models.QuestionResponse.approved_at).first())
        replies.append((q.created_at, first.approved_at if first else None))

    documents = db.query(models.MedicalDocument).filter(models.MedicalDocument.episode_id.in_(ids), models.MedicalDocument.uploaded_at >= since).all()
    verified = [d for d in documents if d.status == "VERIFIED"]
    checks = []
    for d in verified:
        review = db.query(models.DocumentReview).filter_by(document_id=d.id, action="VERIFY").order_by(models.DocumentReview.reviewed_at).first()
        checks.append((d.uploaded_at, review.reviewed_at if review else None))

    logs = db.query(models.DailyLog).filter(models.DailyLog.episode_id.in_(ids), models.DailyLog.recorded_at >= since, models.DailyLog.skipped == False).count()  # noqa: E712
    overdue_checkins = 0
    for plan in db.query(models.MonitoringPlan).filter(models.MonitoringPlan.episode_id.in_(ids), models.MonitoringPlan.active == True).all():  # noqa: E712
        latest = db.query(models.DailyLog).filter_by(episode_id=plan.episode_id, skipped=False).order_by(models.DailyLog.recorded_at.desc()).first()
        baseline = max(_utc(latest.recorded_at), _utc(plan.agreed_at)) if latest else _utc(plan.agreed_at)
        overdue_checkins += baseline + timedelta(days=plan.interval_days) < now

    today = now.date().isoformat()
    tasks = db.query(models.Task).filter(models.Task.episode_id.in_(ids), models.Task.status.in_(OPEN_TASKS)).all()
    visits = db.query(models.Appointment).filter(models.Appointment.episode_id.in_(ids)).all()
    in_window = [a for a in visits if since <= a.scheduled_at <= cutoff]

    actions = db.query(models.AIAction).filter(models.AIAction.episode_id.in_(ids), models.AIAction.created_at >= since).all()
    items = db.query(models.ExceptionItem).filter(models.ExceptionItem.episode_id.in_(ids), models.ExceptionItem.decided_at.isnot(None), models.ExceptionItem.decided_at >= since).all()
    return {
        "days": days, "from": since.date().isoformat(), "to": today,
        "questions": {"received": len(questions), "answered": len(answered), "hoursToReply": _hours(replies)},
        "documents": {"uploaded": len(documents), "verified": len(verified), "hoursToVerify": _hours(checks)},
        "checkIns": {"recorded": logs, "patientsOverdue": overdue_checkins},
        "tasks": {"open": len(tasks), "overdue": sum(bool(t.due_date and t.due_date[:10] < today) for t in tasks)},
        "visits": {"waitingForAnswer": sum(a.status == "requested" for a in visits), "completed": sum(a.status == "completed" for a in in_window),
                   "missed": sum(a.status == "no_show" for a in in_window)},
        "assistant": {"stepsDone": sum(a.status == "DONE" for a in actions), "proposed": sum(a.status == "PROPOSED" for a in actions),
                      "approved": sum(i.kind == "proposal" and i.status == "APPROVED" for i in items),
                      "dismissed": sum(i.kind == "proposal" and i.status == "DISMISSED" for i in items),
                      "undone": sum(a.undone_at is not None and a.undone_at >= since for a in actions)},
    }
