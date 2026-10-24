"""Episode-connected roadmap workflows with server-side role and source checks."""
from datetime import date, timedelta
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import config, models
from ..database import get_db
from ..deps import require_role
from .. import continuity_schemas as S
from ..continuity_service import (ADMIN_REPLIES, allowed_ids, audit, candidate_codes, current_resource,
    episode, get_object, member_ids, name, notify, now, output_out, plain_language_draft, require_member,
    resource_out, row, source_snapshot, suggested_appointment, trend_data, utc, due_reminders)
from ..plain_language import SECTIONED_KINDS, unresolved_placeholders
from .. import whatsapp

router = APIRouter(prefix="/api/v2/continuity", tags=["continuity"])
authenticated = require_role("patient", "doctor", "care_team")
staff = require_role("doctor", "care_team")
doctor = require_role("doctor")
patient = require_role("patient")


@router.get("/context")
def context(user=Depends(authenticated), db: Session = Depends(get_db)):
    if user.role == "patient":
        due_reminders(db, user.id)
    episodes = db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.id.in_(allowed_ids(db, user))).all()
    preference = db.get(models.PatientPreference, user.id)
    return {"language": preference.language if preference else "en", "episodes": [
        {"id": e.id, "patientName": e.patient_name, "weeks": e.gestational_age_weeks,
         "members": [{"id": uid, "name": name(db, uid)} for uid in member_ids(db, e.id)] if user.role != "patient" else []}
        for e in episodes]}


@router.get("/handover-status")
def handover_status(user=Depends(staff)):
    return {"paused": config.HANDOVER_PAUSED, "message": config.HANDOVER_PAUSED_MESSAGE}


@router.patch("/preferences")
def preferences(payload: S.PreferenceIn, user=Depends(patient), db: Session = Depends(get_db)):
    pref = db.get(models.PatientPreference, user.id)
    if not pref:
        pref = models.PatientPreference(user_id=user.id)
        db.add(pref)
    pref.language = payload.language
    audit(db, user, "language_preference_updated", details=payload.language)
    db.commit()
    return {"language": pref.language}


@router.get("/episodes/{episode_id}")
def workspace(episode_id: str, user=Depends(authenticated), db: Session = Depends(get_db)):
    ep = episode(db, user, episode_id)
    is_patient = user.role == "patient"
    if is_patient:
        due_reminders(db, user.id)
    outputs = db.query(models.ClinicalOutput).filter_by(episode_id=ep.id).order_by(models.ClinicalOutput.created_at.desc()).all()
    if is_patient:
        outputs = [o for o in outputs if o.status == "APPROVED" and o.visible_to_patient]
    reminders = db.query(models.CareReminder).filter_by(episode_id=ep.id).order_by(models.CareReminder.scheduled_at).all()
    consents = db.query(models.SharingConsent).filter_by(episode_id=ep.id).order_by(models.SharingConsent.granted_at.desc()).all()
    pref = db.get(models.PatientPreference, ep.patient_user_id)
    plan = db.get(models.MonitoringPlan, ep.id)
    result = {
        "episodeId": ep.id, "patientName": ep.patient_name, "language": pref.language if pref else "en",
        "logs": [row(r) for r in db.query(models.DailyLog).filter_by(episode_id=ep.id).order_by(models.DailyLog.recorded_at.desc()).limit(100).all()],
        "reminders": [{**row(r), "approvedByName": name(db, r.approved_by_user_id)} for r in reminders],
        "consents": [{**row(c), "active": not c.revoked_at and utc(c.expires_at) > now()} for c in consents],
        "outputs": [output_out(db, o, is_patient) for o in outputs],
        "appointments": [row(a) for a in db.query(models.Appointment).filter_by(episode_id=ep.id).order_by(models.Appointment.scheduled_at.desc()).all()],
        "monitoring": row(plan) if plan else None,
    }
    if not is_patient:
        docs = db.query(models.MedicalDocument).filter_by(episode_id=ep.id, status="VERIFIED").all()
        approved = db.query(models.ApprovedConsultation).join(models.Consultation, models.ApprovedConsultation.consultation_id == models.Consultation.id).filter(models.Consultation.episode_id == ep.id).all()
        questions = db.query(models.PatientQuestion).filter_by(episode_id=ep.id).all()
        outreach_items = db.query(models.Outreach).filter_by(episode_id=ep.id).order_by(models.Outreach.created_at.desc()).all()
        whatsapp.advance_simulated(db, outreach_items, now, utc)
        result.update({
            "whatsapp": {"mode": whatsapp.mode(), "automatic": whatsapp.automatic()},
            "sources": [{"id": d.id, "type": "document", "title": d.filename} for d in docs]
                + [{"id": a.id, "type": "consultation", "title": f"Approved visit — {utc(a.approved_at).date()}"} for a in approved]
                + [{"id": q.id, "type": "question", "title": q.question_text} for q in questions],
            "trends": trend_data(db, ep),
            "enrollments": [{**row(e), "title": db.get(models.ClinicalResource, e.resource_id).title} for e in db.query(models.PathwayEnrollment).filter_by(episode_id=ep.id).all()],
            "outreach": [row(o) for o in outreach_items],
            "outcomes": [row(o) for o in db.query(models.RecordedOutcome).filter_by(episode_id=ep.id).all()],
            "handovers": [{"id": h.id, "title": f"Handover {utc(h.created_at).date()}"} for h in db.query(models.Handover).filter_by(episode_id=ep.id).all()],
        })
    audit(db, user, "continuity_viewed", episode_id=ep.id)
    db.commit()
    return result


@router.post("/episodes/{episode_id}/logs")
def add_log(episode_id: str, payload: S.LogIn, user=Depends(patient), db: Session = Depends(get_db)):
    ep = episode(db, user, episode_id)
    log = models.DailyLog(episode_id=ep.id, **payload.model_dump())
    db.add(log)
    db.flush()
    audit(db, user, "patient_log_recorded", log, after=row(log))
    db.commit()
    return row(log)


@router.patch("/logs/{log_id}")
def correct_log(log_id: str, payload: S.LogIn, user=Depends(patient), db: Session = Depends(get_db)):
    log = get_object(db, user, models.DailyLog, log_id)
    if not payload.correction_reason:
        raise HTTPException(400, "Please record why this entry is being corrected.")
    before = row(log)
    for key, value in payload.model_dump().items():
        setattr(log, key, value)
    log.revision += 1
    log.updated_at = now()
    audit(db, user, "patient_log_corrected", log, before=before, after=row(log))
    db.commit()
    return row(log)


@router.get("/logs/{log_id}/history")
def log_history(log_id: str, user=Depends(authenticated), db: Session = Depends(get_db)):
    get_object(db, user, models.DailyLog, log_id)
    return [row(a) for a in db.query(models.AuditLog).filter_by(object_type="DailyLog", object_id=log_id).order_by(models.AuditLog.timestamp).all()]


@router.post("/episodes/{episode_id}/consents")
def consent(episode_id: str, payload: S.ConsentIn, user=Depends(patient), db: Session = Depends(get_db)):
    episode(db, user, episode_id)
    item = models.SharingConsent(episode_id=episode_id, **payload.model_dump())
    db.add(item)
    db.flush()
    audit(db, user, "sharing_consent_granted", item, after=row(item))
    db.commit()
    return row(item)


@router.post("/consents/{consent_id}/revoke")
def revoke(consent_id: str, user=Depends(patient), db: Session = Depends(get_db)):
    item = get_object(db, user, models.SharingConsent, consent_id)
    if not item.revoked_at:
        item.revoked_at = now()
        for message in db.query(models.Outreach).filter(models.Outreach.consent_id == item.id, models.Outreach.status.in_(["PREPARED", "COMPOSER_LINK_READY"])).all():
            message.status = "CANCELLED"
        audit(db, user, "sharing_consent_revoked", item)
        db.commit()
    return row(item)


@router.get("/episodes/{episode_id}/consent-history")
def consent_history(episode_id: str, user=Depends(authenticated), db: Session = Depends(get_db)):
    episode(db, user, episode_id)
    return [row(a) for a in db.query(models.AuditLog).filter(models.AuditLog.episode_id == episode_id, models.AuditLog.action.in_(["sharing_consent_granted", "sharing_consent_revoked"])).order_by(models.AuditLog.timestamp.desc()).all()]


@router.post("/episodes/{episode_id}/reminders")
def create_reminder(episode_id: str, payload: S.ReminderIn, user=Depends(staff), db: Session = Depends(get_db)):
    ep = episode(db, user, episode_id)
    if payload.kind in ("medicine", "vaccine"):
        if user.role != "doctor":
            raise HTTPException(403, "A doctor must approve medicine and vaccine schedules.")
        source_snapshot(db, ep, "consultation", payload.source_id)
    elif payload.kind == "appointment":
        appointment = db.get(models.Appointment, payload.source_id)
        if not appointment or appointment.episode_id != ep.id or appointment.status != "scheduled":
            raise HTTPException(400, "Select a confirmed appointment for this reminder.")
    else:
        task = db.get(models.Task, payload.source_id)
        if not task or task.episode_id != ep.id:
            raise HTTPException(400, "Select a follow-up task for this patient.")
    reminders = []
    for index in range(payload.occurrences):
        item = models.CareReminder(episode_id=ep.id, kind=payload.kind, title=payload.title, instructions=payload.instructions,
            scheduled_at=payload.scheduled_at + timedelta(days=payload.repeat_days * index), source_id=payload.source_id,
            created_by_user_id=user.id, approved_by_user_id=user.id)
        db.add(item)
        db.flush()
        audit(db, user, "reminder_schedule_approved", item)
        reminders.append(item)
    notify(db, ep.id, ep.patient_user_id, "Your care team added reminders", payload.title)
    db.commit()
    return [row(r) for r in reminders]


@router.post("/reminders/{reminder_id}/respond")
def respond(reminder_id: str, payload: S.ReminderResponse, user=Depends(patient), db: Session = Depends(get_db)):
    reminder = get_object(db, user, models.CareReminder, reminder_id)
    if reminder.status != "pending":
        raise HTTPException(409, "This reminder has already been answered.")
    reminder.status = payload.status
    reminder.responded_at = now()
    if payload.status == "needs_help":
        plan = db.get(models.MonitoringPlan, reminder.episode_id)
        owner = plan.owner_user_id if plan and plan.active else reminder.created_by_user_id
        task = models.Task(episode_id=reminder.episode_id, title=f"Help requested: {reminder.title}",
            description="Patient requested support with a reminder. Contact them to clarify; do not infer non-adherence.",
            owner_user_id=owner, created_by_user_id=user.id, due_date=now().date().isoformat(), source_type="reminder", source_id=reminder.id)
        db.add(task)
        notify(db, reminder.episode_id, owner, "Patient requested help with a reminder", reminder.title)
    audit(db, user, "reminder_response_recorded", reminder, after=row(reminder))
    db.commit()
    return row(reminder)


@router.post("/episodes/{episode_id}/monitoring")
def monitoring(episode_id: str, payload: S.MonitorIn, user=Depends(staff), db: Session = Depends(get_db)):
    episode(db, user, episode_id)
    require_member(db, episode_id, payload.owner_user_id)
    plan = db.get(models.MonitoringPlan, episode_id)
    if not plan:
        plan = models.MonitoringPlan(episode_id=episode_id)
        db.add(plan)
    plan.interval_days, plan.active, plan.owner_user_id = payload.interval_days, payload.active, payload.owner_user_id
    plan.agreed_at = now()
    audit(db, user, "monitoring_plan_agreed", episode_id=episode_id, after={"intervalDays": payload.interval_days, "owner": payload.owner_user_id, "active": payload.active})
    db.commit()
    return row(plan)


@router.get("/episodes/{episode_id}/trends")
def trends(episode_id: str, user=Depends(staff), db: Session = Depends(get_db)):
    return trend_data(db, episode(db, user, episode_id))


@router.post("/episodes/{episode_id}/follow-up-flags/confirm")
def confirm_follow_up_flag(episode_id: str, payload: S.FlagConfirmIn, user=Depends(doctor), db: Session = Depends(get_db)):
    """A doctor records what they decided about a follow-up flag: create a follow-up task for a named owner, or
    record that no action is needed and why. Flags never create tasks or messages on their own."""
    ep = episode(db, user, episode_id)
    flag = next((f for f in trend_data(db, ep)["flags"] if f["id"] == payload.flag_id), None)
    if not flag:
        raise HTTPException(404, "That flag is no longer active. Reload the page.")
    if flag["confirmed"]:
        raise HTTPException(409, "A doctor has already reviewed this flag.")
    task = None
    if payload.decision == "create_task":
        require_member(db, episode_id, payload.owner_user_id)
        due = now().date() + timedelta(days=7)
        task = models.Task(
            episode_id=episode_id, title=f"Follow up: {flag['ruleTitle']}",
            description="\n".join(filter(None, [
                flag["nextAction"] or "Follow up and decide the next step.",
                f"Flag: {flag['metric'].replace('_', ' ')} {flag['value']} {'>' if flag['operator'] == 'gt' else '<'} {flag['threshold']}, noted {flag['recordedAt'][:10]}.",
                f"Rule source: {flag['sourceUrl']}", f"Doctor's note: {payload.note}" if payload.note else ""])),
            owner_user_id=payload.owner_user_id, created_by_user_id=user.id, due_date=due.isoformat(),
            priority="routine", source_type="follow_up_flag", source_id=flag["id"])
        db.add(task)
        db.flush()
        db.add(models.TaskAssignment(task_id=task.id, assigned_to_user_id=payload.owner_user_id, assigned_by_user_id=user.id))
        notify(db, episode_id, payload.owner_user_id, "Follow-up assigned", flag["ruleTitle"])
    db.add(models.AuditLog(
        episode_id=episode_id, actor_user_id=user.id, actor_role=user.role, actor_display_name=user.full_name, action="follow_up_flag_confirmed",
        title="Follow-up flag confirmed by a doctor", details=payload.note, object_type="FollowUpFlag", object_id=flag["id"],
        new_state={"decision": payload.decision, "taskId": task.id if task else None, "rule": flag["ruleTitle"]}))
    db.commit()
    return {"flagId": flag["id"], "decision": payload.decision, "task": row(task) if task else None}


@router.post("/episodes/{episode_id}/outputs")
def draft_output(episode_id: str, payload: S.OutputIn, user=Depends(staff), db: Session = Depends(get_db)):
    ep = episode(db, user, episode_id)
    if user.role != "doctor" and payload.kind not in ("insurance", "certificate", "reply"):
        raise HTTPException(403, "A doctor must prepare this clinical draft.")
    if payload.kind == "lab_explanation" and payload.source_type != "document":
        raise HTTPException(400, "A lab explanation requires a verified document.")
    if payload.kind in ("visit_summary", "explanation", "prescription") and payload.source_type != "consultation":
        raise HTTPException(400, "Select an approved consultation for this output.")
    if payload.kind == "reply" and payload.source_type != "question":
        raise HTTPException(400, "A reply requires a patient question.")
    if payload.source_type == "question" and payload.kind != "reply":
        raise HTTPException(400, "Formal documents require verified records or an approved consultation.")
    snapshot = source_snapshot(db, ep, payload.source_type, payload.source_id)
    if payload.appointment_id:
        appt = db.get(models.Appointment, payload.appointment_id)
        if not appt or appt.episode_id != ep.id:
            raise HTTPException(400, "Select an appointment for this patient.")
    template = db.get(models.ClinicalResource, payload.template_id) if payload.template_id else None
    if payload.template_id and (not current_resource(template) or template.kind != "template"):
        raise HTTPException(400, "Select a current, approved note template.")
    fields = template.configuration.get("fields", []) if template else []
    structured = {field: "" for field in fields}
    content = f"Patient: {ep.patient_name}\nSource: {snapshot['title']}\n\n{snapshot['text']}"
    title = payload.kind.replace("_", " ").title()
    appointment_id = payload.appointment_id or suggested_appointment(db, ep, payload)
    if payload.kind in SECTIONED_KINDS:
        built = plain_language_draft(db, ep, payload, snapshot)
        title, content, structured = built["title"], built["content"], built["structured"]
        snapshot = {**snapshot, "draftNotes": built["notes"], **({"parsedResults": built["parsed"]} if "parsed" in built else {})}
    elif payload.kind == "reply":
        content = ADMIN_REPLIES[payload.language]
    elif payload.kind == "prescription":
        content = f"Patient: {ep.patient_name}\nAllergies recorded: {', '.join(ep.allergies or []) or 'Not documented'}\n\nClinician-entered prescription. Every medicine and dose below was entered by the doctor."
        structured = {"Medicine": "", "Dose": "", "Route": "", "Frequency": "", "Duration": "", "Instructions": ""}
    elif fields:
        content += "\n\n" + "\n\n".join(f"{field}\n[Complete from verified information]" for field in fields)
    else:
        headings = {
            "discharge_summary": ["Reason for admission", "Documented course", "Discharge plan", "Follow-up"],
            "referral_letter": ["Recipient", "Reason for referral", "Relevant verified findings", "Requested review"],
            "consent_form": ["Proposed procedure", "Discussion of benefits and risks", "Alternatives discussed", "Patient questions", "Patient signature and date"],
            "certificate": ["Purpose", "Facts certified", "Validity period", "Professional signature"],
            "operative_note": ["Procedure", "Team", "Documented findings", "Procedure details", "Postoperative plan"],
            "insurance": ["Insurer", "Policy / claim reference", "Documented service", "Supporting records", "Authorized signature"],
            "note": ["Documented history", "Observations", "Clinician assessment", "Confirmed plan"],
        }
        content += "\n\n" + "\n\n".join(f"{heading}\n[Complete from verified information]" for heading in headings.get(payload.kind, []))
    output = models.ClinicalOutput(episode_id=ep.id, kind=payload.kind, title=title,
        content=content, language=payload.language, source_type=payload.source_type, source_id=payload.source_id,
        source_snapshot=snapshot, appointment_id=appointment_id, template_id=payload.template_id,
        structured_data=structured, created_by_user_id=user.id)
    db.add(output)
    db.flush()
    audit(db, user, "clinical_output_drafted", output, details="Source-based template draft; requires human editing and approval.")
    db.commit()
    return output_out(db, output)


@router.patch("/outputs/{output_id}")
def edit_output(output_id: str, payload: S.OutputEdit, user=Depends(staff), db: Session = Depends(get_db)):
    output = get_object(db, user, models.ClinicalOutput, output_id)
    if output.status != "DRAFT" or output.revision != payload.revision:
        raise HTTPException(409, "The draft changed or is already approved. Reload before editing.")
    if user.role != "doctor" and output.kind not in ("insurance", "certificate", "reply"):
        raise HTTPException(403, "Only a doctor can edit this clinical output.")
    if payload.selected_codes and user.role != "doctor":
        raise HTTPException(403, "Only a doctor can select clinical codes.")
    valid_codes = {item["code"] for item in candidate_codes(db, output.source_snapshot.get("text", ""))}
    if any(code not in valid_codes for code in payload.selected_codes):
        raise HTTPException(400, "Choose codes from the reviewed candidate set.")
    if payload.appointment_id is not None:
        if payload.appointment_id:
            appt = db.get(models.Appointment, payload.appointment_id)
            if not appt or appt.episode_id != output.episode_id:
                raise HTTPException(400, "Select an appointment for this patient.")
        output.appointment_id = payload.appointment_id or None
    before = row(output)
    output.content, output.structured_data, output.selected_codes = payload.content, payload.structured_data, payload.selected_codes
    output.revision += 1
    audit(db, user, "clinical_output_edited", output, before=before, after=row(output))
    db.commit()
    return output_out(db, output)


@router.get("/outputs/{output_id}/codes")
def codes(output_id: str, user=Depends(doctor), db: Session = Depends(get_db)):
    output = get_object(db, user, models.ClinicalOutput, output_id)
    return candidate_codes(db, output.source_snapshot.get("text", ""))


@router.post("/outputs/{output_id}/approve")
def approve_output(output_id: str, payload: S.PublishIn, user=Depends(staff), db: Session = Depends(get_db)):
    output = get_object(db, user, models.ClinicalOutput, output_id)
    if output.status != "DRAFT" or output.revision != payload.revision:
        raise HTTPException(409, "Only a draft may be approved.")
    ep = episode(db, user, output.episode_id)
    source = source_snapshot(db, ep, output.source_type, output.source_id)
    if source.get("text") != output.source_snapshot.get("text"):
        raise HTTPException(409, "The source changed after drafting. Prepare a new draft from the current source.")
    if user.role != "doctor" and (output.kind != "reply" or source.get("isClinical", True)):
        raise HTTPException(403, "Clinical outputs require an assigned doctor's approval.")
    if output.revision < 2 or unresolved_placeholders(output.content, output.structured_data):
        raise HTTPException(400, "Edit the draft and replace all review placeholders before approval.")
    # The prescription is the doctor's own. Nothing here checks medicines, doses, allergies or interactions.
    if output.kind == "prescription" and any(not output.structured_data.get(f, "").strip() for f in ("Medicine", "Dose", "Route", "Frequency", "Duration")):
        raise HTTPException(400, "Complete the clinician-entered prescription fields.")
    if output.template_id:
        template = db.get(models.ClinicalResource, output.template_id)
        if not current_resource(template):
            raise HTTPException(400, "The template is no longer approved/current. Prepare a new draft.")
        if any(not output.structured_data.get(f, "").strip() for f in template.configuration.get("required", [])):
            raise HTTPException(400, "Complete all required template fields.")
    output.status = "APPROVED"
    output.approved_by_user_id, output.approved_at = user.id, now()
    output.visible_to_patient = payload.visible_to_patient
    if payload.visible_to_patient:
        body = output.content
        if output.structured_data and output.kind in SECTIONED_KINDS:
            body += "\n\n" + "\n\n".join(f"{key}\n{value}" for key, value in output.structured_data.items() if value.strip())
        elif output.structured_data:
            body += "\n\n" + "\n".join(f"{key}: {value}" for key, value in output.structured_data.items())
        db.add(models.JourneyEvent(episode_id=ep.id, event_type="approved_output", title=output.title, summary=body,
            event_date=now().date().isoformat(), gestational_age_weeks=ep.gestational_age_weeks, gestational_age_days=ep.gestational_age_days))
        notify(db, ep.id, ep.patient_user_id, f"New approved {output.title.lower()}", "Your care team reviewed and released this document.")
        if output.kind == "reply":
            q = db.get(models.PatientQuestion, output.source_id)
            db.add(models.QuestionResponse(question_id=q.id, responder_user_id=user.id, responder_role=user.role,
                response_text=output.content, status="APPROVED", approved_by_user_id=user.id, approved_at=now(), visible_to_patient=True))
            q.status = "ANSWERED"
    audit(db, user, "clinical_output_approved", output, after=row(output))
    db.commit()
    return output_out(db, output)


@router.post("/episodes/{episode_id}/pathways")
def enroll(episode_id: str, payload: S.EnrollIn, user=Depends(doctor), db: Session = Depends(get_db)):
    episode(db, user, episode_id)
    require_member(db, episode_id, payload.owner_user_id)
    resource = db.get(models.ClinicalResource, payload.resource_id)
    if not current_resource(resource) or resource.kind != "pathway":
        raise HTTPException(400, "Select a current, clinician-approved administrative pathway.")
    if db.query(models.PathwayEnrollment).filter_by(episode_id=episode_id, resource_id=resource.id).first():
        raise HTTPException(409, "This pathway version is already applied to this patient.")
    enrollment = models.PathwayEnrollment(episode_id=episode_id, resource_id=resource.id, confirmed_by_user_id=user.id)
    db.add(enrollment)
    db.flush()
    for step in resource.configuration["steps"]:
        task = models.Task(episode_id=episode_id, title=step["title"], description=f"Administrative task from {resource.title} v{resource.version}. Source: {resource.source_url}",
            owner_user_id=payload.owner_user_id, created_by_user_id=user.id,
            due_date=(payload.start_date + timedelta(days=step["days"])).isoformat(), source_type="pathway", source_id=enrollment.id)
        db.add(task)
        db.flush()
        db.add(models.TaskAssignment(task_id=task.id, assigned_to_user_id=payload.owner_user_id, assigned_by_user_id=user.id))
    audit(db, user, "pathway_confirmed", enrollment, details=f"{resource.title} v{resource.version}; {len(resource.configuration['steps'])} administrative tasks")
    notify(db, episode_id, payload.owner_user_id, "Pathway tasks assigned", resource.title)
    db.commit()
    return row(enrollment)


@router.post("/episodes/{episode_id}/outreach")
def prepare_outreach(episode_id: str, payload: S.OutreachIn, user=Depends(staff), db: Session = Depends(get_db)):
    episode(db, user, episode_id)
    consent = get_object(db, user, models.SharingConsent, payload.consent_id)
    purpose = "reminders" if payload.source_type == "reminder" else "approved_documents"
    if consent.episode_id != episode_id or consent.purpose != purpose or consent.recipient != payload.recipient or consent.revoked_at or utc(consent.expires_at) <= now():
        raise HTTPException(400, "Active consent for this recipient and purpose is required.")
    source = get_object(db, user, models.CareReminder if payload.source_type == "reminder" else models.ClinicalOutput, payload.source_id)
    if source.episode_id != episode_id:
        raise HTTPException(400, "Source belongs to another episode.")
    if payload.source_type == "output" and (source.status != "APPROVED" or not source.visible_to_patient):
        raise HTTPException(400, "Only approved, patient-visible documents may be shared.")
    # Minimum necessary content: no patient name, diagnosis, medication or record text in the URL.
    message = "MaternaSync: you have a care reminder. Please sign in to view it." if payload.source_type == "reminder" else "MaternaSync: your care team has shared an approved document. Please sign in to view it."
    item = models.Outreach(episode_id=episode_id, consent_id=consent.id, recipient=consent.recipient,
        source_type=payload.source_type, source_id=source.id, message=message, created_by_user_id=user.id)
    db.add(item)
    db.flush()
    audit(db, user, "outreach_prepared", item, details="Recipient verified by staff. Minimal notification only.")
    db.commit()
    return row(item)


def _live_consent(db, item):
    consent = db.get(models.SharingConsent, item.consent_id)
    if not consent or consent.revoked_at or utc(consent.expires_at) <= now():
        raise HTTPException(409, "Consent has expired or been revoked.")


@router.post("/outreach/{outreach_id}/send")
def send_outreach(outreach_id: str, user=Depends(staff), db: Session = Depends(get_db)):
    """Send the minimal notification through the configured provider and record the real outcome."""
    item = get_object(db, user, models.Outreach, outreach_id)
    _live_consent(db, item)
    if item.status not in ("PREPARED", "COMPOSER_LINK_READY", "FAILED"):
        raise HTTPException(409, "This notification was already sent or was cancelled.")
    if not whatsapp.automatic():
        raise HTTPException(409, "Automatic sending is not configured. Use the WhatsApp composer link, then record it as sent.")
    try:
        result = whatsapp.send(item.recipient, item.message)
    except whatsapp.WhatsAppError as error:
        item.status, item.failed_reason, item.updated_at = "FAILED", str(error)[:300], now()
        audit(db, user, "whatsapp_send_failed", item, details=item.failed_reason)
        db.commit()
        raise HTTPException(502, item.failed_reason)
    item.status, item.provider, item.provider_reference = "SENT", result["provider"], result["reference"]
    item.sent_at, item.updated_at, item.failed_reason = now(), now(), None
    audit(db, user, "whatsapp_sent", item, details=f"Sent through {result['provider']}. Minimal sign-in notification only.")
    db.commit()
    return row(item)


@router.post("/outreach/{outreach_id}/mark-sent")
def mark_outreach_sent(outreach_id: str, user=Depends(staff), db: Session = Depends(get_db)):
    """Staff record that they sent it themselves from the composer link. Delivery stays unconfirmed."""
    item = get_object(db, user, models.Outreach, outreach_id)
    _live_consent(db, item)
    if item.status not in ("PREPARED", "COMPOSER_LINK_READY", "FAILED"):
        raise HTTPException(409, "This notification was already sent or was cancelled.")
    item.status, item.provider, item.sent_at, item.updated_at = "MANUALLY_SENT", "manual", now(), now()
    audit(db, user, "whatsapp_marked_sent", item, details="Staff recorded sending from the composer link. Delivery is unconfirmed.")
    db.commit()
    return row(item)


@router.post("/outreach/{outreach_id}/open")
def open_outreach(outreach_id: str, user=Depends(staff), db: Session = Depends(get_db)):
    item = get_object(db, user, models.Outreach, outreach_id)
    consent = db.get(models.SharingConsent, item.consent_id)
    if not consent or consent.revoked_at or utc(consent.expires_at) <= now():
        raise HTTPException(409, "Consent has expired or been revoked.")
    if item.status not in ("PREPARED", "COMPOSER_LINK_READY"):
        raise HTTPException(409, "This outreach has been cancelled.")
    item.status, item.updated_at = "COMPOSER_LINK_READY", now()
    audit(db, user, "whatsapp_link_prepared", item, details="External composer link prepared; opening, sending and delivery are unconfirmed.")
    db.commit()
    return {"url": f"https://wa.me/{item.recipient[1:]}?{urlencode({'text': item.message})}", "status": item.status}


@router.post("/episodes/{episode_id}/outcomes")
def record_outcome(episode_id: str, payload: S.OutcomeIn, user=Depends(staff), db: Session = Depends(get_db)):
    ep = episode(db, user, episode_id)
    source_snapshot(db, ep, "document", payload.source_document_id)
    if payload.event_date > now().date():
        raise HTTPException(400, "An outcome cannot be recorded in the future.")
    if payload.kind == "scan" and payload.value not in ("on_time", "late"):
        raise HTTPException(400, "Scan outcome must be on_time or late.")
    if db.query(models.RecordedOutcome).filter_by(episode_id=episode_id, kind=payload.kind, source_document_id=payload.source_document_id).first():
        raise HTTPException(409, "An outcome for this source is already recorded.")
    item = models.RecordedOutcome(**payload.model_dump(exclude={"event_date"}), event_date=payload.event_date.isoformat(), episode_id=episode_id, recorded_by_user_id=user.id)
    db.add(item)
    db.flush()
    audit(db, user, "outcome_recorded", item, after=row(item))
    db.commit()
    return row(item)


@router.post("/episodes/{episode_id}/appointments")
def request_appointment(episode_id: str, payload: S.AppointmentIn, user=Depends(patient), db: Session = Depends(get_db)):
    episode(db, user, episode_id)
    appt = models.Appointment(episode_id=episode_id, **payload.model_dump(), status="requested")
    db.add(appt)
    db.flush()
    for uid in member_ids(db, episode_id):
        notify(db, episode_id, uid, "Appointment requested", payload.appointment_type)
    audit(db, user, "appointment_requested", appt)
    db.commit()
    return row(appt)


@router.patch("/appointments/{appointment_id}")
def appointment_status(appointment_id: str, payload: S.AppointmentStatusIn, user=Depends(staff), db: Session = Depends(get_db)):
    appt = get_object(db, user, models.Appointment, appointment_id)
    transitions = {"requested": {"scheduled", "cancelled"}, "scheduled": {"completed", "cancelled", "no_show"}}
    if payload.status not in transitions.get(appt.status, set()):
        raise HTTPException(409, "This appointment status transition is not allowed.")
    if payload.status in ("completed", "no_show") and utc(appt.scheduled_at) > now():
        raise HTTPException(400, "A future appointment cannot be marked completed or no-show.")
    appt.status = payload.status
    ep = db.get(models.PregnancyEpisode, appt.episode_id)
    notify(db, ep.id, ep.patient_user_id, f"Appointment {payload.status.replace('_', ' ')}", appt.appointment_type)
    audit(db, user, "appointment_status_changed", appt, after=row(appt))
    db.commit()
    return row(appt)


@router.get("/episodes/{episode_id}/tasks")
def tasks(episode_id: str, user=Depends(staff), db: Session = Depends(get_db)):
    episode(db, user, episode_id)
    return [{**row(t), "ownerName": name(db, t.owner_user_id), "history": [
        {"name": name(db, a.assigned_to_user_id), "by": name(db, a.assigned_by_user_id), "at": utc(a.assigned_at).isoformat()} for a in t.assignments]}
        for t in db.query(models.Task).filter_by(episode_id=episode_id).order_by(models.Task.created_at.desc()).all()]


@router.patch("/tasks/{task_id}/assignment")
def assign(task_id: str, payload: S.TaskAssignIn, user=Depends(staff), db: Session = Depends(get_db)):
    task = get_object(db, user, models.Task, task_id)
    require_member(db, task.episode_id, payload.owner_user_id)
    before = row(task)
    if task.owner_user_id != payload.owner_user_id:
        db.add(models.TaskAssignment(task_id=task.id, assigned_to_user_id=payload.owner_user_id, assigned_by_user_id=user.id))
    task.owner_user_id, task.due_date, task.updated_at = payload.owner_user_id, payload.due_date.isoformat() if payload.due_date else None, now()
    audit(db, user, "task_reassigned", task, before=before, after=row(task))
    db.commit()
    return row(task)


@router.get("/clinic")
def clinic(user=Depends(staff), db: Session = Depends(get_db)):
    ids = allowed_ids(db, user)
    episodes = db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.id.in_(ids)).all()
    today = now().date()
    patients = []
    for ep in episodes:
        open_tasks = db.query(models.Task).filter(models.Task.episode_id == ep.id, models.Task.status.in_(["OPEN", "IN_PROGRESS", "WAITING"])).all()
        plan = db.get(models.MonitoringPlan, ep.id)
        latest = db.query(models.DailyLog).filter_by(episode_id=ep.id, skipped=False).order_by(models.DailyLog.recorded_at.desc()).first()
        baseline = max(utc(latest.recorded_at), utc(plan.agreed_at)) if latest and plan else utc(plan.agreed_at) if plan else None
        checkin_due = baseline + timedelta(days=plan.interval_days) if plan and plan.active else None
        appts = db.query(models.Appointment).filter_by(episode_id=ep.id).all()
        patients.append({"episodeId": ep.id, "patientName": ep.patient_name,
            "doctors": [name(db, a.doctor_user_id) for a in ep.doctor_assignments],
            "openTasks": len(open_tasks), "unassigned": sum(t.owner_user_id is None for t in open_tasks),
            "overdue": sum(bool(t.due_date and t.due_date < today.isoformat()) for t in open_tasks),
            "upcomingVisits": sum(a.status == "scheduled" and now() <= utc(a.scheduled_at) <= now() + timedelta(days=7) for a in appts),
            "appointmentRequests": sum(a.status == "requested" for a in appts),
            "lastCheckIn": utc(latest.recorded_at).isoformat() if latest else None,
            "checkInDue": checkin_due.isoformat() if checkin_due else None,
            "missingCheckIn": bool(checkin_due and checkin_due < now()),
            "openFlagCount": trend_data(db, ep)["openFlagCount"],
            "monitoringOwner": name(db, plan.owner_user_id) if plan else None})
    outcomes = db.query(models.RecordedOutcome).filter(models.RecordedOutcome.episode_id.in_(ids)).all()
    appts = db.query(models.Appointment).filter(models.Appointment.episode_id.in_(ids), models.Appointment.status.in_(["completed", "no_show"])).all()
    scans = [o for o in outcomes if o.kind == "scan"]
    delivery_values = {}
    for out in outcomes:
        if out.kind == "delivery":
            delivery_values[out.value] = delivery_values.get(out.value, 0) + 1
    audit(db, user, "clinic_report_viewed", details=f"{len(ids)} authorized episodes")
    db.commit()
    return {"patients": patients, "metrics": {"recordedScans": len(scans), "onTimeScans": sum(o.value == "on_time" for o in scans),
        "recordedDeliveries": sum(o.kind == "delivery" for o in outcomes), "deliveryOutcomes": delivery_values,
        "attendedOrNoShow": len(appts), "noShows": sum(a.status == "no_show" for a in appts)},
        "definition": "Authorized caseload, all recorded dates. Scan rate uses documented scan outcomes only; no-show rate uses completed and no-show visits only. Missing outcomes are excluded, not counted as success."}
