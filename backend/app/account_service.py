"""A person's own account: the copy of her data she can download, closing her account, and the small limit on password guesses.

Closing an account is a REQUEST, not a deletion. Her pregnancy record belongs to the clinic's care of her and its audit trail, so it is never erased
here: closing signs her out everywhere, ends every trusted person's access and her WhatsApp permissions, stops her signing in, and gives her doctor a task
to decide what the clinic must keep and what can be erased.
"""
import io
import json
import re
import time
import zipfile
from datetime import timedelta
from pathlib import Path

from . import config, models, server_text
from .config import UPLOAD_DIR
from .continuity_service import audit, now, row, utc

# ---------------------------------------------------------------- demonstration accounts
def is_demo_account(user: models.User) -> bool:
    """The seeded sign-ins that are shown on the sign-in page. Their password must not change and they must not be closed, or the next visitor could not use them."""
    if not config.DEMO_ENABLED:
        return False
    from .seed_assistant import DEMO_CAREGIVER
    from .seed_role_data import PASSWORDS
    email = (user.email or "").lower()
    return email in PASSWORDS or email == DEMO_CAREGIVER["email"]


# ---------------------------------------------------------------- guesses at the current password
# A signed-in session that has been stolen must not be able to guess the password. Five wrong tries in 15 minutes stop further tries for a while.
# Kept in memory, so it is per server process and starts again when the server restarts.
_WINDOW_SECONDS = 15 * 60
_MOST_FAILURES = 5
_failures: dict[str, list[float]] = {}


def _recent(user_id: str) -> list[float]:
    cutoff = time.monotonic() - _WINDOW_SECONDS
    kept = [moment for moment in _failures.get(user_id, []) if moment > cutoff]
    _failures[user_id] = kept
    return kept


def too_many_tries(user_id: str) -> bool:
    return len(_recent(user_id)) >= _MOST_FAILURES


def note_failure(user_id: str) -> None:
    _recent(user_id).append(time.monotonic())


def clear_failures(user_id: str) -> None:
    _failures.pop(user_id, None)


# ---------------------------------------------------------------- the copy of her data
READ_ME = """This folder is a copy of the information MaternaSync holds about you.

my-data.json   your details, check-ins, questions and the replies you were sent, visits, reminders, summaries your doctor released to you,
               your sharing permissions and trusted people, your Updates, and your emergency details.
documents/     the files in your records, with the same names as on the My Records page.

It holds only your own information. Notes your doctor keeps for the clinic's own use are not part of it. Keep this file somewhere safe: anyone who has it can read it.
"""


def _iso(value):
    return utc(value).isoformat() if value else None


def _safe_name(name: str) -> str:
    cleaned = re.sub(r"[^\w.\- ]+", "_", Path(name or "file").name).strip(" .") or "file"
    return cleaned[:120]


def my_data(db, user: models.User) -> tuple[dict, list[tuple[str, Path]]]:
    """Everything that is HERS, as a plain dictionary, and the uploaded files to put beside it. Only rows tied to her own account or her own
    pregnancy record are read, and only the fields she can already see on her own pages."""
    episodes = db.query(models.PregnancyEpisode).filter_by(patient_user_id=user.id).order_by(models.PregnancyEpisode.created_at).all()
    ids = [e.id for e in episodes]
    profile = db.query(models.PatientProfile).filter_by(user_id=user.id).first()
    preference = db.get(models.PatientPreference, user.id)
    emergency = db.get(models.PatientEmergencyProfile, user.id)

    logs = db.query(models.DailyLog).filter(models.DailyLog.episode_id.in_(ids)).order_by(models.DailyLog.recorded_at).all() if ids else []
    history: dict[str, list] = {}
    if logs:
        trail = (db.query(models.AuditLog)
                 .filter(models.AuditLog.object_type == "DailyLog", models.AuditLog.object_id.in_(db.query(models.DailyLog.id).filter(models.DailyLog.episode_id.in_(ids))))
                 .order_by(models.AuditLog.timestamp).all())
        for entry in trail:
            history.setdefault(entry.object_id, []).append({"at": _iso(entry.timestamp), "what": entry.action, "before": entry.previous_state, "after": entry.new_state})

    questions = []
    for question in db.query(models.PatientQuestion).filter_by(asked_by_user_id=user.id).order_by(models.PatientQuestion.created_at).all():
        questions.append({
            "id": question.id, "asked": question.question_text, "status": question.status, "askedAt": _iso(question.created_at),
            "followUpToEarlierQuestion": question.follow_up_of.question_text if question.follow_up_of is not None else None,
            "attachedDocumentIds": [a.document_id for a in question.attachments],
            "replies": [{"from": r.responder_role, "text": r.response_text, "at": _iso(r.created_at)} for r in question.responses if r.status == "APPROVED" and r.visible_to_patient],
        })

    appointments = db.query(models.Appointment).filter(models.Appointment.episode_id.in_(ids)).order_by(models.Appointment.scheduled_at).all() if ids else []
    reminders = db.query(models.CareReminder).filter(models.CareReminder.episode_id.in_(ids)).order_by(models.CareReminder.scheduled_at).all() if ids else []
    outputs = (db.query(models.ClinicalOutput).filter(models.ClinicalOutput.episode_id.in_(ids), models.ClinicalOutput.status == "APPROVED", models.ClinicalOutput.visible_to_patient.is_(True))
               .order_by(models.ClinicalOutput.approved_at).all()) if ids else []
    journey = db.query(models.JourneyEvent).filter(models.JourneyEvent.episode_id.in_(ids)).order_by(models.JourneyEvent.event_date).all() if ids else []
    consents = (db.query(models.SharingConsent).filter(models.SharingConsent.episode_id.in_(ids), models.SharingConsent.purpose != "caregiver_reminders")
                .order_by(models.SharingConsent.granted_at).all()) if ids else []  # a trusted person's own number is theirs, not hers
    links = db.query(models.CaregiverLink).filter(models.CaregiverLink.patient_user_id == user.id).order_by(models.CaregiverLink.created_at).all()
    notes = db.query(models.Notification).filter_by(recipient_user_id=user.id).order_by(models.Notification.created_at).all()
    documents = db.query(models.MedicalDocument).filter(models.MedicalDocument.episode_id.in_(ids)).order_by(models.MedicalDocument.uploaded_at).all() if ids else []

    files: list[tuple[str, Path]] = []
    document_rows = []
    for document in documents:
        path = UPLOAD_DIR / document.file_path if document.file_path else None
        inside = None
        if path is not None and path.is_file():
            inside = f"documents/{document.id[:8]}-{_safe_name(document.filename)}"
            files.append((inside, path))
        document_rows.append({"id": document.id, "name": document.filename, "description": document.description, "kind": document.document_type, "documentDate": document.document_date,
                              "status": document.status, "uploadedAt": _iso(document.uploaded_at), "uploadedBy": document.uploaded_by_role, "fileInThisCopy": inside})

    emergency_out = None
    if emergency is not None:
        emergency_out = {key: value for key, value in row(emergency).items() if key != "userId"}

    data = {
        "about": {"exportedAt": _iso(now()), "note": "A copy of your own information in MaternaSync. Notes the clinic keeps for its own use are not included."},
        "account": {"fullName": user.full_name, "email": user.email, "role": user.role, "createdAt": _iso(user.created_at), "language": preference.language if preference else "en"},
        "profile": {"dateOfBirth": profile.date_of_birth if profile else None, "phone": profile.phone if profile else None, "medicalRecordNumber": profile.mrn if profile else None},
        "pregnancy": [{"estimatedDueDate": e.edd, "gestationalAgeWeeks": e.gestational_age_weeks, "gestationalAgeDays": e.gestational_age_days, "medicalRecordNumber": e.mrn} for e in episodes],
        "checkIns": [{
            "id": log.id, "recordedAt": _iso(log.recorded_at), "systolic": log.systolic, "diastolic": log.diastolic, "weightKg": log.weight_kg, "symptoms": log.symptoms,
            "mood": log.mood, "adherence": log.adherence, "movementCount": log.movement_count, "movementMinutes": log.movement_minutes, "skipped": bool(log.skipped),
            "filledInWithHelpFrom": log.entered_with_help, "reasonForLastCorrection": log.correction_reason or None, "version": log.revision,
            "savedAt": _iso(log.created_at), "lastChangedAt": _iso(log.updated_at), "history": history.get(log.id, []),
        } for log in logs],
        "questions": questions,
        "appointments": [{"id": a.id, "when": _iso(a.scheduled_at), "type": a.appointment_type, "place": a.location, "status": a.status, "notes": a.notes,
                          "yourRequestToChangeIt": ({"asked": a.change_kind, "note": a.change_note, "preferredTime": _iso(a.change_preferred_at), "askedAt": _iso(a.change_requested_at)} if a.change_kind else None)}
                         for a in appointments],
        "reminders": [{"id": r.id, "kind": r.kind, "title": r.title, "instructions": r.instructions, "when": _iso(r.scheduled_at), "status": r.status, "answeredAt": _iso(r.responded_at)} for r in reminders],
        "summariesAndInstructionsReleasedToYou": [{"id": o.id, "kind": o.kind, "title": o.title, "language": o.language, "text": o.content, "sections": o.structured_data or {},
                                                   "approvedAt": _iso(o.approved_at)} for o in outputs],
        "journey": [{"date": j.event_date, "title": j.title, "summary": j.summary, "type": j.event_type} for j in journey],
        "documents": document_rows,
        "sharingPermissions": [{"recipient": c.recipient, "purpose": c.purpose, "givenAt": _iso(c.granted_at), "expiresAt": _iso(c.expires_at), "revokedAt": _iso(c.revoked_at)} for c in consents],
        "trustedPeople": [{"name": link.display_name, "relationship": link.relationship, "mayDo": link.permissions, "status": link.status, "invitedAt": _iso(link.created_at),
                           "joinedAt": _iso(link.accepted_at), "removedAt": _iso(link.revoked_at), "accessUntil": _iso(link.access_until)} for link in links],
        "updates": [{"type": n.type, "title": texts[0], "text": texts[1], "read": bool(n.is_read), "at": _iso(n.created_at)} for n in notes for texts in [server_text.texts(db, user.id, n)]],
        "emergencyDetails": emergency_out,
    }
    return data, files


def build_zip(db, user: models.User) -> bytes:
    data, files = my_data(db, user)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("my-data.json", json.dumps(data, ensure_ascii=False, indent=2, default=str))
        archive.writestr("read-me.txt", READ_ME)
        for name, path in files:
            archive.write(path, name)
    return buffer.getvalue()


# ---------------------------------------------------------------- closing the account
def close_account(db, user: models.User) -> dict:
    """The caller has already checked the password and committed to nothing yet; the caller commits."""
    when = now()
    episodes = db.query(models.PregnancyEpisode).filter_by(patient_user_id=user.id).all()
    removed = revoked = tasks = 0
    for episode in episodes:
        for link in db.query(models.CaregiverLink).filter(models.CaregiverLink.episode_id == episode.id, models.CaregiverLink.status != "REVOKED").all():
            link.status, link.revoked_at, link.code_hash, link.code_expires_at = "REVOKED", when, None, None
            if link.caregiver_user_id:
                server_text.notify_key(db, link.caregiver_user_id, "caregiver_removed", episode_id=episode.id, type_="caregiver_removed")
            removed += 1
        for consent in db.query(models.SharingConsent).filter(models.SharingConsent.episode_id == episode.id, models.SharingConsent.revoked_at.is_(None)).all():
            consent.revoked_at = when
            for message in db.query(models.Outreach).filter(models.Outreach.consent_id == consent.id, models.Outreach.status.in_(["PREPARED", "COMPOSER_LINK_READY"])).all():
                message.status = "CANCELLED"
            revoked += 1
        assignment = (db.query(models.PatientDoctorAssignment).filter_by(episode_id=episode.id)
                      .order_by(models.PatientDoctorAssignment.is_primary.desc(), models.PatientDoctorAssignment.assigned_at).first())
        if assignment is not None:
            db.add(models.Task(
                episode_id=episode.id, title="Patient closed her account and asked for her data to be erased",
                description=(f"{episode.patient_name} closed her MaternaSync account on {when.date().isoformat()}. Her trusted people and WhatsApp permissions were ended and she can no longer sign in. "
                             "Her record was NOT deleted. Please follow your clinic's policy and the law about what must be kept and what can be erased, and tell her what you decide."),
                owner_user_id=assignment.doctor_user_id, created_by_user_id=user.id, due_date=(when + timedelta(days=30)).date().isoformat(),
                source_type="account_closed", source_id=user.id))
            server_text.notify_key(db, assignment.doctor_user_id, "account_closed", episode_id=episode.id, type_="account_closed", params={"name": episode.patient_name})
            tasks += 1
        audit(db, user, "account_closed", user, episode_id=episode.id,
              details=f"Closed her own account. Trusted people removed: {removed}. Sharing permissions ended: {revoked}. Her record was kept.")
    if not episodes:
        audit(db, user, "account_closed", user, details="Closed her own account. She had no pregnancy record.")
    user.closed_at = when
    user.token_version = (user.token_version or 0) + 1  # every token made so far stops working
    return {"closed": True, "trustedPeopleRemoved": removed, "sharingPermissionsEnded": revoked, "tasksForDoctor": tasks}
