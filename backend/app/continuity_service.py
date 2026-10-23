"""Shared authorization, serialization and source handling for continuity APIs."""
from datetime import date, datetime, time, timedelta, timezone
import re

from fastapi import HTTPException
from sqlalchemy import inspect

from . import drug_safety, models
from .deps import require_episode_access
from .plain_language import (SECTIONED_KINDS, build_explanation, build_lab_explanation, build_visit_summary, detect_conditions,
                             format_when, review_notes, section_kinds, stage_for_weeks)


def now():
    return datetime.now(timezone.utc)


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def camel(value):
    first, *rest = value.split("_")
    return first + "".join(v.title() for v in rest)


def row(value, exclude=()):
    result = {}
    for attr in inspect(value).mapper.column_attrs:
        if attr.key in exclude or attr.key in ("file_path", "password_hash"):
            continue
        item = getattr(value, attr.key)
        if isinstance(item, datetime):
            item = utc(item).isoformat()
        result[camel(attr.key)] = item
    return result


def name(db, user_id):
    user = db.get(models.User, user_id) if user_id else None
    return user.full_name if user else "Unassigned"


def audit(db, user, action, obj=None, episode_id=None, before=None, after=None, details=""):
    db.add(models.AuditLog(
        episode_id=episode_id or getattr(obj, "episode_id", None), actor_user_id=user.id,
        actor_role=user.role, actor_display_name=user.full_name, action=action,
        title=action.replace("_", " ").capitalize(), details=details,
        object_type=type(obj).__name__ if obj is not None else "Continuity",
        object_id=getattr(obj, "id", None), previous_state=before, new_state=after,
    ))


def allowed_ids(db, user):
    if user.role == "patient":
        return [e.id for e in db.query(models.PregnancyEpisode).filter_by(patient_user_id=user.id).all()]
    table, field = (models.PatientDoctorAssignment, "doctor_user_id") if user.role == "doctor" else (models.PatientCareTeamAssignment, "care_team_user_id")
    if user.role not in ("doctor", "care_team"):
        return []
    return [r.episode_id for r in db.query(table).filter(getattr(table, field) == user.id).all()]


def episode(db, user, episode_id):
    return require_episode_access(episode_id, user, db)


def member_ids(db, episode_id):
    doctors = db.query(models.PatientDoctorAssignment).filter_by(episode_id=episode_id).all()
    staff = db.query(models.PatientCareTeamAssignment).filter_by(episode_id=episode_id).all()
    return list(dict.fromkeys([r.doctor_user_id for r in doctors] + [r.care_team_user_id for r in staff]))


def require_member(db, episode_id, user_id):
    if user_id not in member_ids(db, episode_id):
        raise HTTPException(400, "The owner must be assigned to this patient.")


def get_object(db, user, table, object_id):
    obj = db.get(table, object_id)
    if obj is None:
        raise HTTPException(404, "Item not found.")
    episode(db, user, obj.episode_id)
    return obj


def notify(db, episode_id, recipient, title, body=""):
    db.add(models.Notification(recipient_user_id=recipient, episode_id=episode_id,
                               type="continuity", title=title, body=body))


def handover_continuity(db, episode_id):
    """Unresolved new work is carried into existing handover drafts."""
    tasks = db.query(models.Task).filter(models.Task.episode_id == episode_id, models.Task.status.in_(["OPEN", "IN_PROGRESS", "WAITING"])).all()
    lines = [f"{t.title} — owner: {name(db, t.owner_user_id)}; due: {t.due_date or 'not set'}; source: {t.source_type or 'manual'}" for t in tasks]
    requests = db.query(models.Appointment).filter_by(episode_id=episode_id, status="requested").count()
    drafts = db.query(models.ClinicalOutput).filter_by(episode_id=episode_id, status="DRAFT").count()
    if requests:
        lines.append(f"{requests} appointment request(s) awaiting confirmation.")
    if drafts:
        lines.append(f"{drafts} document / explanation draft(s) awaiting review.")
    return "\n".join(lines)


def due_reminders(db, patient_user_id):
    """Materialize due in-app alerts on portal activity, idempotently.

    This does not send push/WhatsApp messages or require a background service.
    """
    episodes = db.query(models.PregnancyEpisode).filter_by(patient_user_id=patient_user_id).all()
    for ep in episodes:
        reminders = db.query(models.CareReminder).filter(models.CareReminder.episode_id == ep.id,
            models.CareReminder.status == "pending", models.CareReminder.scheduled_at <= now()).all()
        for reminder in reminders:
            if not db.query(models.Notification).filter_by(recipient_user_id=patient_user_id, related_entity_type="CareReminder", related_entity_id=reminder.id).first():
                db.add(models.Notification(recipient_user_id=patient_user_id, episode_id=ep.id, type="reminder_due",
                    title=f"Reminder: {reminder.title}", body=reminder.instructions,
                    related_entity_type="CareReminder", related_entity_id=reminder.id))
    db.commit()


def current_resource(resource):
    return bool(resource and resource.status == "APPROVED" and resource.review_due and resource.review_due >= date.today().isoformat())


def resource_out(db, resource):
    return {**row(resource), "approvedByName": name(db, resource.approved_by_user_id) if resource.approved_by_user_id else None,
            "hasFile": bool(resource.file_path), "usable": current_resource(resource)}


def output_out(db, output, patient=False):
    excluded = ("source_snapshot", "selected_codes") if patient else ()
    result = {**row(output, excluded), "approvedByName": name(db, output.approved_by_user_id) if output.approved_by_user_id else None}
    if output.kind in SECTIONED_KINDS:
        result["sectionKinds"] = section_kinds(output.language, (output.structured_data or {}).keys() if output.kind == "explanation" else ())
    if not patient:
        result["references"] = [resource_out(db, db.get(models.ClinicalResource, a.resource_id)) for a in db.query(models.ReferenceAttachment).filter_by(target_type="note", target_id=output.id).all()]
        result["reviewNotes"] = review_notes(output) if output.status == "DRAFT" else []
    return result


def safety_sets(db):
    """Approved, in-date drug-safety lists. Without one, interaction and pregnancy checks are reported as unchecked."""
    return [{"title": r.title, "version": r.version, "configuration": r.configuration or {}, "approvedBy": name(db, r.approved_by_user_id), "reviewDue": r.review_due}
            for r in db.query(models.ClinicalResource).filter_by(kind="interaction", status="APPROVED").all() if current_resource(r)]


def run_safety_check(db, output):
    ep = db.get(models.PregnancyEpisode, output.episode_id)
    sets = safety_sets(db)
    cutoff = now() - timedelta(days=120)
    earlier = [(o.structured_data or {}).get("Medicine", "") for o in db.query(models.ClinicalOutput).filter(
        models.ClinicalOutput.episode_id == output.episode_id, models.ClinicalOutput.kind == "prescription",
        models.ClinicalOutput.status == "APPROVED", models.ClinicalOutput.id != output.id).all() if utc(o.created_at) >= cutoff]
    result = drug_safety.check((output.structured_data or {}).get("Medicine", ""), earlier, list(ep.allergies or []), sets)
    result.update({"status": "checked" if sets else "unchecked", "limitation": drug_safety.LIMITATION, "allergiesRecorded": list(ep.allergies or []),
                   "checkedAgainst": [{"title": s["title"], "version": s["version"], "approvedBy": s["approvedBy"], "reviewDue": s["reviewDue"],
                                       "pairs": len(s["configuration"].get("pairs", [])), "cautions": len(s["configuration"].get("cautions", []))} for s in sets]})
    return result


def suggested_appointment(db, ep, payload):
    """Link a visit summary to the visit it describes when exactly one appointment fell on that day."""
    if payload.kind not in ("visit_summary", "explanation") or payload.source_type != "consultation":
        return None
    approved = db.get(models.ApprovedConsultation, payload.source_id)
    if not approved:
        return None
    day = utc(approved.approved_at).date()
    same_day = [a for a in db.query(models.Appointment).filter(models.Appointment.episode_id == ep.id,
                models.Appointment.status.in_(["scheduled", "completed"])).all() if utc(a.scheduled_at).date() == day]
    return same_day[0].id if len(same_day) == 1 else None


def plain_language_draft(db, ep, payload, snapshot):
    """Build the sectioned plain-language draft; the doctor still edits and signs it."""
    if payload.kind == "lab_explanation":
        return build_lab_explanation(language=payload.language, text=snapshot["text"], document_title=snapshot["title"])
    approved = db.get(models.ApprovedConsultation, payload.source_id)
    if payload.kind == "explanation":
        text = " ".join(str(v) for v in (approved.final_content or {}).values())
        detected = detect_conditions(text)
        by_topic = {}
        for r in db.query(models.ClinicalResource).filter_by(kind="education", status="APPROVED", language=payload.language).all():
            if r.topic in detected and r.topic not in by_topic and current_resource(r):
                by_topic[r.topic] = {"title": r.title, "content": r.content, "issuer": r.issuer, "version": r.version, "reviewer": name(db, r.approved_by_user_id)}
        upcoming = sorted((a for a in db.query(models.Appointment).filter_by(episode_id=ep.id, status="scheduled").all() if utc(a.scheduled_at) > now()), key=lambda a: utc(a.scheduled_at))
        return build_explanation(language=payload.language, episode=ep, approved_content=approved.final_content or {}, consult_date=format_when(approved.approved_at),
                                 detected=detected, modules=by_topic,
                                 next_appointment={"when": format_when(upcoming[0].scheduled_at), "kind": upcoming[0].appointment_type} if upcoming else None)
    stage = stage_for_weeks(ep.gestational_age_weeks)
    modules = [r for r in db.query(models.ClinicalResource).filter_by(kind="education", status="APPROVED", language=payload.language).all()
               if current_resource(r) and r.stage in (stage, "all") and not r.family_id.startswith("starter-condition-")][:3]
    education = [{"title": r.title, "content": r.content, "issuer": r.issuer, "version": r.version,
                  "reviewer": name(db, r.approved_by_user_id)} for r in modules]
    upcoming = sorted((a for a in db.query(models.Appointment).filter_by(episode_id=ep.id, status="scheduled").all() if utc(a.scheduled_at) > now()),
                      key=lambda a: utc(a.scheduled_at))
    next_appointment = {"when": format_when(upcoming[0].scheduled_at), "kind": upcoming[0].appointment_type} if upcoming else None
    open_questions = [q.question_text[:200] for q in db.query(models.PatientQuestion).filter(
        models.PatientQuestion.episode_id == ep.id, models.PatientQuestion.status.in_(["NEW", "ASSIGNED", "WAITING_FOR_RESPONSE"]))
        .order_by(models.PatientQuestion.created_at).limit(5).all()]
    return build_visit_summary(kind=payload.kind, language=payload.language, episode=ep, approved_content=approved.final_content or {},
                               consult_date=format_when(approved.approved_at), next_appointment=next_appointment,
                               education=education, open_questions=open_questions, education_available=bool(education))


def source_snapshot(db, ep, source_type, source_id):
    if source_type == "consultation":
        approved = db.get(models.ApprovedConsultation, source_id)
        consult = db.get(models.Consultation, approved.consultation_id) if approved else None
        if not consult or consult.episode_id != ep.id:
            raise HTTPException(400, "Select an approved consultation for this patient.")
        return {"title": "Approved consultation", "text": "\n".join(f"{k}: {v}" for k, v in approved.final_content.items()),
                "date": utc(approved.approved_at).isoformat(), "reviewer": name(db, approved.approved_by_user_id)}
    if source_type == "document":
        doc = db.get(models.MedicalDocument, source_id)
        if not doc or doc.episode_id != ep.id or doc.status != "VERIFIED":
            raise HTTPException(400, "Select a verified document for this patient.")
        return {"title": doc.filename, "text": doc.extraction.raw_text if doc.extraction else "", "date": doc.document_date}
    question = db.get(models.PatientQuestion, source_id)
    if not question or question.episode_id != ep.id:
        raise HTTPException(400, "Select a question for this patient.")
    return {"title": "Patient question", "text": question.question_text, "isClinical": question.is_clinical}


TIER_RANK = {"routine": 1, "soon": 2, "urgent": 3}
TIER_LABEL = {"urgent": "Urgent review", "soon": "Review soon", "routine": "Routine review"}


def trend_data(db, ep):
    start = datetime.combine(now().date() - timedelta(days=29), time.min, tzinfo=timezone.utc)
    logs = db.query(models.DailyLog).filter(models.DailyLog.episode_id == ep.id, models.DailyLog.recorded_at >= start).order_by(models.DailyLog.recorded_at).all()
    rules = [r for r in db.query(models.ClinicalResource).filter_by(kind="rule", status="APPROVED").all() if current_resource(r)]
    flags, task_titles = [], {}
    latest = next((log for log in reversed(logs) if not log.skipped), None)
    for rule in rules:
        cfg = rule.configuration
        metric = cfg["metric"]
        candidates = []
        if metric == "missing_days":
            plan = db.get(models.MonitoringPlan, ep.id)
            if plan and plan.active:
                baseline = max(utc(latest.recorded_at), utc(plan.agreed_at)) if latest else utc(plan.agreed_at)
                candidates = [(None, (now() - baseline).days, baseline.isoformat())]
        elif metric == "overdue_task_days":
            for task in db.query(models.Task).filter(models.Task.episode_id == ep.id, models.Task.status.in_(["OPEN", "IN_PROGRESS", "WAITING"])).all():
                if task.due_date:
                    try:
                        candidates.append((task.id, (date.today() - date.fromisoformat(task.due_date[:10])).days, task.due_date))
                        task_titles[task.id] = task.title
                    except ValueError:
                        continue
        else:
            candidates = [(log.id, getattr(log, metric), utc(log.recorded_at).isoformat()) for log in logs if not log.skipped and getattr(log, metric) is not None]
        for source_id, value, timestamp in candidates:
            matched = value > cfg["threshold"] if cfg["operator"] == "gt" else value < cfg["threshold"]
            if matched:
                # A flag is identified by its rule and the value that triggered it, so a decision about one
                # reading never silences a later one. "Missing check-in" is keyed by the day counting started.
                flag_id = f"{rule.id}:{source_id or 'plan-' + timestamp[:10]}"
                flags.append({"id": flag_id, "ruleId": rule.id, "ruleTitle": rule.title, "version": rule.version, "metric": metric,
                              "value": value, "operator": cfg["operator"], "threshold": cfg["threshold"],
                              "tier": cfg.get("tier", "routine"), "nextAction": cfg.get("nextAction", ""),
                              "sourceId": source_id, "recordedAt": timestamp, "sourceUrl": rule.source_url,
                              "reviewer": name(db, rule.approved_by_user_id), "context": (f"Task: {task_titles[source_id]}. " if source_id in task_titles else "") + "Review flag; no diagnosis or treatment recommendation."})
    decisions = {a.object_id: a for a in db.query(models.AuditLog).filter(
        models.AuditLog.episode_id == ep.id, models.AuditLog.action == "risk_flag_confirmed", models.AuditLog.object_type == "RiskFlag").all()}
    for flag in flags:
        decision = decisions.get(flag["id"])
        flag["confirmed"] = None if not decision else {
            "by": decision.actor_display_name, "at": utc(decision.timestamp).isoformat(), "decision": (decision.new_state or {}).get("decision"),
            "note": decision.details, "taskId": (decision.new_state or {}).get("taskId")}
    flags.sort(key=lambda f: (TIER_RANK[f["tier"]], f["recordedAt"]), reverse=True)
    open_tiers = [f["tier"] for f in flags if not f["confirmed"]]
    days_with_logs = len({utc(log.recorded_at).date() for log in logs if not log.skipped})
    return {"logs": [row(log) for log in logs], "flags": flags, "daysWithLogs": days_with_logs,
            "missingDays": 30 - days_with_logs, "activeRuleCount": len(rules),
            # Highest tier among flags nobody has reviewed yet. A review order for people, not a clinical risk score.
            "reviewPriority": max(open_tiers, key=TIER_RANK.get) if open_tiers else "none",
            "tierCounts": {tier: open_tiers.count(tier) for tier in TIER_RANK},
            "units": {"systolic": "mmHg", "diastolic": "mmHg", "weightKg": "kg", "movementCount": "movements"}}


ADMIN_REPLIES = {
    "en": "Thank you for your question. Your care team has received it and will follow up. Please check My Questions for an approved response.",
    "hi": "आपके प्रश्न के लिए धन्यवाद। आपकी देखभाल टीम को यह मिल गया है और वे आपसे संपर्क करेंगे। स्वीकृत उत्तर के लिए मेरे प्रश्न देखें।",
    "ta": "உங்கள் கேள்விக்கு நன்றி. உங்கள் பராமரிப்புக் குழு அதைப் பெற்றுள்ளது; அவர்கள் உங்களைத் தொடர்புகொள்வார்கள். அங்கீகரிக்கப்பட்ட பதிலுக்கு எனது கேள்விகள் பகுதியைப் பார்க்கவும்.",
    "te": "మీ ప్రశ్నకు ధన్యవాదాలు. మీ సంరక్షణ బృందం దాన్ని స్వీకరించింది, వారు మిమ్మల్ని సంప్రదిస్తారు. ఆమోదించిన సమాధానం కోసం నా ప్రశ్నలు చూడండి.",
}


def candidate_codes(db, text):
    found = []
    for resource in db.query(models.ClinicalResource).filter_by(kind="coding", status="APPROVED").all():
        if current_resource(resource):
            for item in resource.configuration.get("entries", []):
                if re.search(r"(?<!\w)" + re.escape(item["match"]) + r"(?!\w)", text, re.I):
                    found.append({**item, "resourceId": resource.id, "sourceUrl": resource.source_url, "version": resource.version})
    # One candidate per code (its longest matching phrase), and the most specific wording wins: if "secondary postpartum
    # haemorrhage" matched, the code for plain "postpartum haemorrhage" is not offered as well.
    best = {}
    for item in found:
        key = (item["resourceId"], item["code"])
        if key not in best or len(item["match"]) > len(best[key]["match"]):
            best[key] = item
    kept = list(best.values())
    return [c for c in kept if not any(o["code"] != c["code"] and len(o["match"]) > len(c["match"]) and c["match"].lower() in o["match"].lower() for o in kept)]
