"""Trusted-person (caregiver) access.

Two routers. The woman's own (`/api/v2/patient/caregivers`): she invites someone, chooses what they may do, sees what they
did, and removes them. The caregiver's (`/api/v2/caregiver`): their own login, limited to the women who invited them and,
for each, to exactly the permissions she gave. Every caregiver endpoint goes through `access()`, which checks that the link
is active, belongs to this caregiver, and carries the permission, on every request. The shared episode access check
(`require_episode_access`) is deliberately NOT widened for caregivers.
"""
from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field
from sqlalchemy.orm import Session

from .. import automation, caregiver_nudge, caregiver_service, caregiver_whatsapp, doctor_names, models, server_text
from .. import caregiver_update_links
from ..ai_coordinator import messages, scheduling, tools
from ..continuity_schemas import Input, LogIn
from ..continuity_service import output_out
from ..database import get_db
from ..deps import get_my_patient_episode, require_role
from ..emergency import numbers_for
from ..models.caregiver import PERMISSIONS
from .emergency import profile_out

patient_router = APIRouter(prefix="/api/v2/patient/caregivers", tags=["patient-caregivers"])
router = APIRouter(prefix="/api/v2/caregiver", tags=["caregiver"])
patient = require_role("patient")
caregiver = require_role("caregiver")


def _iso(value):
    return value.replace(tzinfo=timezone.utc).isoformat() if value else None


def _now():
    return datetime.now(timezone.utc)


# ================================================================= the woman's side
class InviteIn(Input):
    display_name: str = Field(min_length=1, max_length=60)
    relationship: str = Field("", max_length=40)
    permissions: dict[str, bool] = Field(default_factory=dict)
    access_until: date | None = None  # the last day the person may help; empty means until she removes them


class LinkUpdateIn(Input):
    display_name: str | None = Field(None, min_length=1, max_length=60)
    relationship: str | None = Field(None, max_length=40)
    permissions: dict[str, bool] | None = None
    access_until: date | None = None  # sent as null to remove the end date; left out to change nothing


def link_out(db: Session, link: models.CaregiverLink) -> dict:
    who = db.get(models.User, link.caregiver_user_id) if link.caregiver_user_id else None
    asked = db.get(models.CheckInHelper, link.episode_id)
    last = (db.query(models.AuditLog).filter(models.AuditLog.episode_id == link.episode_id, models.AuditLog.actor_user_id == link.caregiver_user_id)
            .order_by(models.AuditLog.timestamp.desc()).first()) if link.caregiver_user_id else None
    return {"id": link.id, "displayName": link.display_name, "relationship": link.relationship, "status": link.status, "permissions": link.permissions or {},
            "caregiverName": who.full_name if who else None, "createdAt": _iso(link.created_at), "acceptedAt": _iso(link.accepted_at), "revokedAt": _iso(link.revoked_at),
            "revokedBy": (link.revoked_by or "patient") if link.status == "REVOKED" else None,
            "inviteExpiresAt": _iso(link.code_expires_at), "lastActivity": _iso(last.timestamp) if last else None,
            "accessUntil": caregiver_service.iso(link.access_until), "ended": caregiver_service.is_ended(link),
            "whatsapp": caregiver_whatsapp.status(db, link)["status"] if link.status == "ACTIVE" else "off",
            "checkInHelper": asked.status if asked is not None and asked.link_id == link.id and link.status == "ACTIVE" else None}


def _mine(db: Session, user: models.User, link_id: str) -> models.CaregiverLink:
    link = db.get(models.CaregiverLink, link_id)
    if link is None or link.patient_user_id != user.id:
        raise HTTPException(404, "Trusted person not found.")
    return link


def _log(db: Session, user: models.User, link: models.CaregiverLink, action: str, title: str, details: str = "") -> None:
    db.add(models.AuditLog(episode_id=link.episode_id, actor_user_id=user.id, actor_role=user.role, actor_display_name=user.full_name, action=action,
                           title=title, details=details[:300], object_type="CaregiverLink", object_id=link.id))


@patient_router.get("")
def list_trusted(ep=Depends(get_my_patient_episode), user=Depends(patient), db: Session = Depends(get_db)):
    links = db.query(models.CaregiverLink).filter_by(patient_user_id=user.id, episode_id=ep.id).order_by(models.CaregiverLink.created_at.desc()).all()
    return {"permissions": list(PERMISSIONS), "items": [link_out(db, l) for l in links]}


@patient_router.post("")
def invite(payload: InviteIn, ep=Depends(get_my_patient_episode), user=Depends(patient), db: Session = Depends(get_db)):
    link = models.CaregiverLink(episode_id=ep.id, patient_user_id=user.id, display_name=payload.display_name.strip(), relationship=payload.relationship.strip(),
                                permissions=caregiver_service.clean_permissions(payload.permissions), status="INVITED",
                                access_until=caregiver_service.access_limit(payload.access_until))
    code = caregiver_service.issue_code(link)  # shown once; only its hash is kept
    db.add(link)
    db.flush()
    _log(db, user, link, "caregiver_invited", "Invited a trusted person", link.display_name)
    db.commit()
    return {**link_out(db, link), "code": code}


@patient_router.patch("/{link_id}")
def update_trusted(link_id: str, payload: LinkUpdateIn, user=Depends(patient), db: Session = Depends(get_db)):
    link = _mine(db, user, link_id)
    if link.status == "REVOKED":
        raise HTTPException(409, "This person was removed. Invite them again if you want them back.")
    if payload.display_name is not None:
        link.display_name = payload.display_name.strip()
    if payload.relationship is not None:
        link.relationship = payload.relationship.strip()
    if payload.permissions is not None:
        link.permissions = caregiver_service.clean_permissions(payload.permissions)
    if "access_until" in payload.model_fields_set:
        link.access_until = caregiver_service.access_limit(payload.access_until)
        _log(db, user, link, "caregiver_access_limit_changed", "Changed how long a trusted person may help",
             f"{link.display_name}: " + (f"until {link.access_until.date().isoformat()}" if link.access_until else "no end date"))
    _log(db, user, link, "caregiver_permissions_changed", "Changed what a trusted person may do", f"{link.display_name}: {link.permissions}")
    db.commit()
    return link_out(db, link)


@patient_router.post("/{link_id}/new-code")
def new_code(link_id: str, user=Depends(patient), db: Session = Depends(get_db)):
    link = _mine(db, user, link_id)
    if link.status != "INVITED":
        raise HTTPException(409, "Only an invite that has not been used can get a new code.")
    code = caregiver_service.issue_code(link)
    _log(db, user, link, "caregiver_code_renewed", "Made a new invite code", link.display_name)
    db.commit()
    return {**link_out(db, link), "code": code}


@patient_router.delete("/{link_id}")
def remove_trusted(link_id: str, user=Depends(patient), db: Session = Depends(get_db)):
    link = _mine(db, user, link_id)
    if link.status != "REVOKED":
        link.status, link.revoked_at, link.revoked_by, link.code_hash, link.code_expires_at = "REVOKED", _now(), "patient", None, None
        if link.caregiver_user_id:
            server_text.notify_key(db, link.caregiver_user_id, "caregiver_removed", episode_id=link.episode_id, type_="caregiver_removed")
        _log(db, user, link, "caregiver_removed", "Removed a trusted person", link.display_name)
        db.commit()
    return link_out(db, link)


@patient_router.get("/visit-help")
def visit_help(ep=Depends(get_my_patient_episode), user=Depends(patient), db: Session = Depends(get_db)):
    """Who has said they will take her to, or cannot come to, each upcoming visit. Only people whose access is current."""
    answers: dict[str, list[dict]] = {}
    for help_row, link in (db.query(models.CaregiverVisitHelp, models.CaregiverLink).join(models.CaregiverLink, models.CaregiverLink.id == models.CaregiverVisitHelp.link_id)
                           .filter(models.CaregiverLink.episode_id == ep.id).all()):
        if caregiver_service.is_current(link):
            answers.setdefault(help_row.appointment_id, []).append({"name": link.display_name, "status": help_row.status, "at": _iso(help_row.updated_at)})
    return answers


class TickIn(Input):
    done: bool


@patient_router.get("/visit-prep")
def visit_prep_for_her(ep=Depends(get_my_patient_episode), user=Depends(patient), db: Session = Depends(get_db)):
    """The checklist her doctor wrote for each upcoming visit, with what is ticked and by whom."""
    return caregiver_service.prep_by_visit(db, ep.id)


@patient_router.put("/visit-prep/{item_id}")
def tick_for_her(item_id: str, payload: TickIn, ep=Depends(get_my_patient_episode), user=Depends(patient), db: Session = Depends(get_db)):
    item = db.get(models.VisitPrepItem, item_id)
    if item is None or item.episode_id != ep.id:
        raise HTTPException(404, "Checklist item not found.")
    caregiver_service.tick_prep_item(db, item, user, payload.done)
    db.add(models.AuditLog(episode_id=ep.id, actor_user_id=user.id, actor_role=user.role, actor_display_name=user.full_name, action="visit_prep_ticked" if payload.done else "visit_prep_unticked",
                           title="Ticked a visit checklist item" if payload.done else "Unticked a visit checklist item", details=item.text[:200], object_type="VisitPrepItem", object_id=item.id))
    db.commit()
    return caregiver_service.prep_out(db, item)


@patient_router.get("/{link_id}/activity")
def trusted_activity(link_id: str, user=Depends(patient), db: Session = Depends(get_db)):
    link = _mine(db, user, link_id)
    if not link.caregiver_user_id:
        return []
    rows = (db.query(models.AuditLog).filter(models.AuditLog.episode_id == link.episode_id, models.AuditLog.actor_user_id == link.caregiver_user_id)
            .order_by(models.AuditLog.timestamp.desc()).limit(50).all())
    return [{"at": _iso(r.timestamp), "title": r.title, "details": r.details or ""} for r in rows]


# ================================================================= the caregiver's side
def access(permission: str | None = None):
    """The one gate for every caregiver endpoint."""

    def dependency(link_id: str, user: models.User = Depends(caregiver), db: Session = Depends(get_db)) -> models.CaregiverLink:
        link = db.get(models.CaregiverLink, link_id)
        if link is None or link.caregiver_user_id != user.id or link.status != "ACTIVE":
            raise HTTPException(403, "You do not have access to this person's information.")  # the same answer whether it exists or not
        if caregiver_service.is_ended(link):
            raise HTTPException(403, "Your access to this person's information has ended. Ask her to extend it.")
        if permission and not (link.permissions or {}).get(permission):
            raise HTTPException(403, "She has not allowed this.")
        return link

    return dependency


def _record(db: Session, user: models.User, link: models.CaregiverLink, action: str, title: str, details: str = "") -> None:
    db.add(models.AuditLog(episode_id=link.episode_id, actor_user_id=user.id, actor_role="caregiver", actor_display_name=user.full_name, action=action,
                           title=title, details=details[:300], object_type="CaregiverLink", object_id=link.id))


def _tell_her(db: Session, link: models.CaregiverLink, key: str, **params) -> None:
    """Whenever a trusted person acts for her, she gets a short note in her Updates, in her language, by the name she gave them."""
    server_text.notify_key(db, link.patient_user_id, key, episode_id=link.episode_id, type_="caregiver_action", params={"name": link.display_name, **params},
                           related_entity_type="CaregiverLink", related_entity_id=link.id)


class HelpIn(Input):
    status: Literal["WILL_TAKE", "CANNOT"]


class NumberIn(Input):
    number: str = Field(min_length=8, max_length=24)


class CodeIn(Input):
    code: str = Field(min_length=4, max_length=12)


def _summary(db: Session, link: models.CaregiverLink) -> dict:
    episode = db.get(models.PregnancyEpisode, link.episode_id)
    return {"linkId": link.id, "womanName": episode.patient_name if episode else "", "relationship": link.relationship, "displayName": link.display_name,
            "permissions": link.permissions or {}, "since": _iso(link.accepted_at),
            "accessUntil": caregiver_service.iso(link.access_until), "ended": caregiver_service.is_ended(link)}


class AcceptIn(Input):
    code: str = Field(min_length=4, max_length=40)


class PreferenceIn(Input):
    language: Literal["en", "hi", "ta", "te"]


class QuestionIn(Input):
    question_text: str = Field(min_length=1, max_length=2000)


class TalkIn(Input):
    message: str = Field("", max_length=500)


@router.get("/women")
def women(user=Depends(caregiver), db: Session = Depends(get_db)):
    links = db.query(models.CaregiverLink).filter_by(caregiver_user_id=user.id, status="ACTIVE").order_by(models.CaregiverLink.accepted_at).all()
    return [_summary(db, l) for l in links]


@router.post("/accept")
def accept(payload: AcceptIn, user=Depends(caregiver), db: Session = Depends(get_db)):
    """An existing caregiver joins another woman with a new invite code."""
    link = caregiver_service.find_open_invite(db, payload.code)
    if db.query(models.CaregiverLink).filter_by(episode_id=link.episode_id, caregiver_user_id=user.id, status="ACTIVE").first():
        raise HTTPException(409, "You are already linked to her.")
    caregiver_service.accept_invite(db, link, user)
    db.commit()
    return _summary(db, link)


@router.get("/preferences")
def get_preferences(user=Depends(caregiver), db: Session = Depends(get_db)):
    pref = db.get(models.PatientPreference, user.id)
    return {"language": pref.language if pref and pref.language in messages.LANGUAGES else "en"}


@router.patch("/preferences")
def set_preferences(payload: PreferenceIn, user=Depends(caregiver), db: Session = Depends(get_db)):
    pref = db.get(models.PatientPreference, user.id)
    if pref is None:
        pref = models.PatientPreference(user_id=user.id)
        db.add(pref)
    pref.language = payload.language
    db.commit()
    return {"language": pref.language}


def _prompt_reminders(db: Session, user: models.User) -> None:
    """A reminder of hers that has come due becomes one short note in their Updates, once, for each woman who allowed reminders."""
    links = db.query(models.CaregiverLink).filter_by(caregiver_user_id=user.id, status="ACTIVE").all()
    if sum(caregiver_service.reminder_prompts(db, link) for link in links):
        db.commit()


@router.get("/notifications")
def notifications(user=Depends(caregiver), db: Session = Depends(get_db)):
    _prompt_reminders(db, user)
    rows = db.query(models.Notification).filter_by(recipient_user_id=user.id).order_by(models.Notification.created_at.desc()).limit(50).all()
    return caregiver_update_links.describe(db, user, rows)


@router.get("/{link_id}/home")
def home(link: models.CaregiverLink = Depends(access()), user=Depends(caregiver), db: Session = Depends(get_db)):
    permissions = link.permissions or {}
    out = _summary(db, link)
    _prompt_reminders(db, user)
    if permissions.get("appointments"):
        now = datetime.utcnow()
        upcoming = db.query(models.Appointment).filter(models.Appointment.episode_id == link.episode_id, models.Appointment.status == "scheduled",
                                                      models.Appointment.scheduled_at > now).order_by(models.Appointment.scheduled_at).limit(3).all()
        out["upcoming"] = [{"id": a.id, "scheduledAt": _iso(a.scheduled_at), "type": a.appointment_type, "location": a.location} for a in upcoming]
    if permissions.get("check_in"):
        last = db.query(models.DailyLog).filter_by(episode_id=link.episode_id, skipped=False).order_by(models.DailyLog.recorded_at.desc()).first()
        out["lastCheckIn"] = _iso(last.recorded_at) if last else None
        asked = db.get(models.CheckInHelper, link.episode_id)
        if asked is not None and asked.link_id == link.id:
            doctor = db.get(models.User, asked.asked_by_user_id)
            out["checkInHelper"] = {"status": asked.status, "askedBy": (doctor_names.shown_name(db, doctor) if doctor else "") or "", "askedAt": _iso(asked.asked_at)}
    return out


@router.get("/{link_id}/appointments")
def appointments(link: models.CaregiverLink = Depends(access("appointments")), db: Session = Depends(get_db)):
    rows = db.query(models.Appointment).filter_by(episode_id=link.episode_id).order_by(models.Appointment.scheduled_at.desc()).limit(30).all()
    mine = {h.appointment_id: h for h in db.query(models.CaregiverVisitHelp).filter_by(link_id=link.id).all()}
    # A request she made to cancel or move a visit, while it is still open (the visit is still confirmed): the kind and when she asked, never her note.
    return [{"id": a.id, "scheduledAt": _iso(a.scheduled_at), "type": a.appointment_type, "location": a.location, "status": a.status,
             "help": {"status": mine[a.id].status, "updatedAt": _iso(mine[a.id].updated_at)} if a.id in mine else None,
             "changeRequest": {"kind": a.change_kind, "requestedAt": _iso(a.change_requested_at)} if a.change_kind and a.status == "scheduled" else None} for a in rows]


def _upcoming_visit(db: Session, link: models.CaregiverLink, appointment_id: str) -> models.Appointment:
    appt = db.get(models.Appointment, appointment_id)
    if appt is None or appt.episode_id != link.episode_id:
        raise HTTPException(404, "Visit not found.")
    if appt.status != "scheduled" or scheduling.utc(appt.scheduled_at) <= _now():
        raise HTTPException(409, "This visit is no longer coming up.")
    return appt


@router.put("/{link_id}/appointments/{appointment_id}/help")
def set_visit_help(appointment_id: str, payload: HelpIn, link: models.CaregiverLink = Depends(access("appointments")), user=Depends(caregiver), db: Session = Depends(get_db)):
    """"I will take her" or "I cannot". She is told, and sees it on her Appointments page. Saying the same thing again changes nothing."""
    appt = _upcoming_visit(db, link, appointment_id)
    current = db.query(models.CaregiverVisitHelp).filter_by(appointment_id=appt.id, link_id=link.id).first()
    if current is not None and current.status == payload.status:
        return {"status": current.status, "updatedAt": _iso(current.updated_at)}
    if current is None:
        current = models.CaregiverVisitHelp(appointment_id=appt.id, link_id=link.id, status=payload.status)
        db.add(current)
    current.status, current.updated_at = payload.status, _now()
    when = scheduling.local_text(appt.scheduled_at, scheduling.rules(db))
    _record(db, user, link, "caregiver_visit_help", "A trusted person answered about a visit", f"{payload.status} {when}")
    _tell_her(db, link, "caregiver_visit_yes" if payload.status == "WILL_TAKE" else "caregiver_visit_no", kind=appt.appointment_type, when=when)
    db.commit()
    return {"status": current.status, "updatedAt": _iso(current.updated_at)}


@router.delete("/{link_id}/appointments/{appointment_id}/help")
def clear_visit_help(appointment_id: str, link: models.CaregiverLink = Depends(access("appointments")), user=Depends(caregiver), db: Session = Depends(get_db)):
    """Back to "not sure yet". Nothing is sent to her; it is only recorded."""
    appt = db.get(models.Appointment, appointment_id)
    if appt is None or appt.episode_id != link.episode_id:
        raise HTTPException(404, "Visit not found.")
    current = db.query(models.CaregiverVisitHelp).filter_by(appointment_id=appt.id, link_id=link.id).first()
    if current is not None:
        db.delete(current)
        _record(db, user, link, "caregiver_visit_help_cleared", "A trusted person is not sure about a visit yet", "")
        db.commit()
    return {"status": None}


# ---- WhatsApp reminders on the person's own number
def _needs_something_to_remind(link: models.CaregiverLink) -> None:
    permissions = link.permissions or {}
    if not (permissions.get("appointments") or permissions.get("check_in")):
        raise HTTPException(403, "She has not allowed you to see visits or check-ins, so there is nothing to remind you about.")


@router.get("/{link_id}/whatsapp")
def whatsapp_status(link: models.CaregiverLink = Depends(access()), db: Session = Depends(get_db)):
    return caregiver_whatsapp.status(db, link)


@router.post("/{link_id}/whatsapp/start")
def whatsapp_start(payload: NumberIn, link: models.CaregiverLink = Depends(access()), user=Depends(caregiver), db: Session = Depends(get_db)):
    _needs_something_to_remind(link)
    result = caregiver_whatsapp.start(db, link, user, payload.number)
    _record(db, user, link, "caregiver_whatsapp_code_sent", "A trusted person asked for a WhatsApp code", "")
    db.commit()
    return {**caregiver_whatsapp.status(db, link), **result}


@router.post("/{link_id}/whatsapp/confirm")
def whatsapp_confirm(payload: CodeIn, link: models.CaregiverLink = Depends(access()), user=Depends(caregiver), db: Session = Depends(get_db)):
    _needs_something_to_remind(link)
    caregiver_whatsapp.confirm(db, link, user, payload.code)
    _record(db, user, link, "caregiver_whatsapp_on", "A trusted person turned on WhatsApp reminders", "")
    _tell_her(db, link, "caregiver_whatsapp_on")
    db.commit()
    return caregiver_whatsapp.status(db, link)


@router.delete("/{link_id}/whatsapp")
def whatsapp_off(link: models.CaregiverLink = Depends(access()), user=Depends(caregiver), db: Session = Depends(get_db)):
    if caregiver_whatsapp.turn_off(db, link):
        _record(db, user, link, "caregiver_whatsapp_off", "A trusted person turned off WhatsApp reminders", "")
        _tell_her(db, link, "caregiver_whatsapp_off")
    db.commit()
    return caregiver_whatsapp.status(db, link)


@router.get("/{link_id}/check-ins")
def check_ins(offset: int = Query(0, ge=0, le=2000), limit: int = Query(14, ge=1, le=50), link: models.CaregiverLink = Depends(access("check_in")), db: Session = Depends(get_db)):
    """Her newest check-ins, 14 at a time; `offset` asks for the next older ones."""
    rows = (db.query(models.DailyLog).filter_by(episode_id=link.episode_id).order_by(models.DailyLog.recorded_at.desc(), models.DailyLog.id)
            .offset(offset).limit(limit).all())
    return [{"id": l.id, "recordedAt": _iso(l.recorded_at), "systolic": l.systolic, "diastolic": l.diastolic, "weightKg": l.weight_kg, "symptoms": l.symptoms,
             "mood": l.mood, "adherence": l.adherence, "skipped": l.skipped, "enteredWithHelp": l.entered_with_help} for l in rows]


@router.post("/{link_id}/check-ins")
def add_check_in(payload: LogIn, link: models.CaregiverLink = Depends(access("check_in")), user=Depends(caregiver), db: Session = Depends(get_db)):
    data = payload.model_dump()
    data["entered_with_help"] = f"Family member: {user.full_name}"  # taken from their own login, never from what the browser sent
    if payload.client_ref:
        # The same check-in sent again (it was kept on the phone, or the answer was lost): one entry, and she is not told twice.
        again = db.query(models.DailyLog).filter_by(episode_id=link.episode_id, client_ref=payload.client_ref, entered_with_help=data["entered_with_help"]).first()
        if again is not None:
            return {"id": again.id, "recordedAt": _iso(again.recorded_at), "enteredWithHelp": again.entered_with_help}
    log = models.DailyLog(episode_id=link.episode_id, **data)
    db.add(log)
    db.flush()
    _record(db, user, link, "caregiver_checkin_recorded", "A trusted person filled in a check-in", link.display_name)
    _tell_her(db, link, "caregiver_acted_checkin")
    db.commit()
    return {"id": log.id, "recordedAt": _iso(log.recorded_at), "enteredWithHelp": log.entered_with_help}


@router.get("/{link_id}/care-plan")
def care_plan(link: models.CaregiverLink = Depends(access("care_plan")), db: Session = Depends(get_db)):
    # Exactly what the woman herself sees: approved by a doctor and released to her, nothing else.
    rows = (db.query(models.ClinicalOutput).filter_by(episode_id=link.episode_id, status="APPROVED", visible_to_patient=True)
            .order_by(models.ClinicalOutput.created_at.desc()).limit(30).all())
    return [output_out(db, o, True) for o in rows]


@router.get("/{link_id}/questions")
def questions(link: models.CaregiverLink = Depends(access("questions")), user=Depends(caregiver), db: Session = Depends(get_db)):
    rows = (db.query(models.PatientQuestion).filter_by(episode_id=link.episode_id, asked_by_user_id=user.id).order_by(models.PatientQuestion.created_at.desc()).limit(30).all())
    return [{"id": q.id, "text": q.question_text, "status": q.status, "createdAt": _iso(q.created_at),
             "attachments": [{"id": a.document_id, "filename": a.document.filename} for a in q.attachments if a.document],  # names only: a trusted person never opens her documents
             "followUpOfText": q.follow_up_of.question_text[:200] if q.follow_up_of else None,
             "replies": [{"text": r.response_text, "at": _iso(r.approved_at)} for r in q.responses if r.status == "APPROVED" and r.visible_to_patient]} for q in rows]


@router.post("/{link_id}/questions")
def ask(payload: QuestionIn, link: models.CaregiverLink = Depends(access("questions")), user=Depends(caregiver), db: Session = Depends(get_db)):
    text = payload.question_text.strip()
    if not text:
        raise HTTPException(400, "Please write the question first.")
    question = models.PatientQuestion(episode_id=link.episode_id, asked_by_user_id=user.id, question_text=text, status="NEW")
    db.add(question)
    db.flush()
    _record(db, user, link, "caregiver_question_asked", "A trusted person asked a question", text[:200])
    _tell_her(db, link, "caregiver_acted_question")
    automation.dispatch_event(db, automation.events.PATIENT_QUESTION_CREATED, episode_id=link.episode_id, actor_user_id=user.id,
                              source_type="PatientQuestion", source_id=question.id, payload={"questionText": text})
    db.commit()
    return {"id": question.id, "status": question.status}


# ---- getting ready for a visit (the checklist a doctor wrote)
@router.get("/{link_id}/visit-prep")
def visit_prep(link: models.CaregiverLink = Depends(access("appointments")), db: Session = Depends(get_db)):
    return caregiver_service.prep_by_visit(db, link.episode_id)


@router.put("/{link_id}/visit-prep/{item_id}")
def tick_item(item_id: str, payload: TickIn, link: models.CaregiverLink = Depends(access("appointments")), user=Depends(caregiver), db: Session = Depends(get_db)):
    item = db.get(models.VisitPrepItem, item_id)
    if item is None or item.episode_id != link.episode_id:
        raise HTTPException(404, "Checklist item not found.")
    caregiver_service.tick_prep_item(db, item, user, payload.done)
    _record(db, user, link, "caregiver_visit_prep_ticked" if payload.done else "caregiver_visit_prep_unticked",
            "A trusted person ticked a visit checklist item" if payload.done else "A trusted person unticked a visit checklist item", item.text)
    db.commit()
    return caregiver_service.prep_out(db, item)


# ---- helping with check-ins when a doctor has asked
class HelperAnswerIn(Input):
    status: Literal["ACCEPTED", "DECLINED"]


@router.put("/{link_id}/checkin-helper")
def answer_helper(payload: HelperAnswerIn, link: models.CaregiverLink = Depends(access("check_in")), user=Depends(caregiver), db: Session = Depends(get_db)):
    """Yes or no to the doctor's request. Either answer can be changed later; she is told each time."""
    asked = db.get(models.CheckInHelper, link.episode_id)
    if asked is None or asked.link_id != link.id:
        raise HTTPException(404, "Nobody has asked you to help with check-ins.")
    if asked.status != payload.status:
        asked.status, asked.responded_at = payload.status, _now()
        _record(db, user, link, "caregiver_helper_answered", "A trusted person answered a doctor's request to help with check-ins", payload.status)
        _tell_her(db, link, "caregiver_helper_yes" if payload.status == "ACCEPTED" else "caregiver_helper_no")
        db.commit()
    return {"status": asked.status, "respondedAt": _iso(asked.responded_at)}


# ---- her reminders, as prompts
@router.get("/{link_id}/reminders")
def reminders(link: models.CaregiverLink = Depends(access("reminders")), user=Depends(caregiver), db: Session = Depends(get_db)):
    """When her reminders are due. The names and instructions of medicine and vaccine reminders appear only if she also allows the doctor's summaries."""
    _prompt_reminders(db, user)
    return {"items": caregiver_service.reminders_for(db, link), "detailsAllowed": bool((link.permissions or {}).get("care_plan")),
            "nudgesLeft": caregiver_nudge.left(db, link, "reminder"), "nudgeLimit": caregiver_nudge.DAILY_LIMIT}


@router.get("/{link_id}/emergency")
def emergency_info(link: models.CaregiverLink = Depends(access("emergency")), db: Session = Depends(get_db)):
    profile = profile_out(db.get(models.PatientEmergencyProfile, link.patient_user_id))
    return {**numbers_for(profile["homeLat"], profile["homeLon"]), "homeLabel": profile["homeLabel"], "contactName": profile["contactName"],
            "contactRelation": profile["contactRelation"], "contactPhone": profile["contactPhone"], "hospitalName": profile["hospitalName"],
            "hospitalPhone": profile["hospitalPhone"], "hospitalAddress": profile["hospitalAddress"]}


@router.post("/{link_id}/talk-to-a-person")
def talk(payload: TalkIn, link: models.CaregiverLink = Depends(access()), user=Depends(caregiver), db: Session = Depends(get_db)):
    """Any active trusted person can reach a doctor. It always works, whatever mode the assistant is in."""
    pref = db.get(models.PatientPreference, user.id)
    language = pref.language if pref and pref.language in messages.LANGUAGES else "en"
    note = payload.message.strip()
    tools.raise_exception(db, episode_id=link.episode_id, run_id=None, kind="attention", urgency="normal", title="A trusted person asked to talk to someone",
                          summary=f"{link.display_name} ({link.relationship or 'trusted person'}): " + (f"“{note}”" if note else "no message left."), recommended_action="Please get back to them.",
                          source_type="CaregiverLink", source_id=link.id)
    _record(db, user, link, "talk_to_a_person", "A trusted person asked to talk to someone", note)
    _tell_her(db, link, "caregiver_acted_talk")
    db.commit()
    return {"message": messages.pick(messages.TALK_TO_PERSON, language)}
