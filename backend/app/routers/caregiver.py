"""Trusted-person (caregiver) access.

Two routers. The woman's own (`/api/v2/patient/caregivers`): she invites someone, chooses what they may do, sees what they
did, and removes them. The caregiver's (`/api/v2/caregiver`): their own login, limited to the women who invited them and,
for each, to exactly the permissions she gave. Every caregiver endpoint goes through `access()`, which checks that the link
is active, belongs to this caregiver, and carries the permission, on every request. The shared episode access check
(`require_episode_access`) is deliberately NOT widened for caregivers.
"""
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy.orm import Session

from .. import automation, caregiver_service, models
from ..ai_coordinator import messages, tools
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


class LinkUpdateIn(Input):
    display_name: str | None = Field(None, min_length=1, max_length=60)
    relationship: str | None = Field(None, max_length=40)
    permissions: dict[str, bool] | None = None


def link_out(db: Session, link: models.CaregiverLink) -> dict:
    who = db.get(models.User, link.caregiver_user_id) if link.caregiver_user_id else None
    last = (db.query(models.AuditLog).filter(models.AuditLog.episode_id == link.episode_id, models.AuditLog.actor_user_id == link.caregiver_user_id)
            .order_by(models.AuditLog.timestamp.desc()).first()) if link.caregiver_user_id else None
    return {"id": link.id, "displayName": link.display_name, "relationship": link.relationship, "status": link.status, "permissions": link.permissions or {},
            "caregiverName": who.full_name if who else None, "createdAt": _iso(link.created_at), "acceptedAt": _iso(link.accepted_at), "revokedAt": _iso(link.revoked_at),
            "inviteExpiresAt": _iso(link.code_expires_at), "lastActivity": _iso(last.timestamp) if last else None}


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
                                permissions=caregiver_service.clean_permissions(payload.permissions), status="INVITED")
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
        link.status, link.revoked_at, link.code_hash, link.code_expires_at = "REVOKED", _now(), None, None
        if link.caregiver_user_id:
            db.add(models.Notification(recipient_user_id=link.caregiver_user_id, episode_id=link.episode_id, type="caregiver_removed",
                                       title="Your access was removed", body="You can no longer see this person's information in MaternaSync."))
        _log(db, user, link, "caregiver_removed", "Removed a trusted person", link.display_name)
        db.commit()
    return link_out(db, link)


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
        if permission and not (link.permissions or {}).get(permission):
            raise HTTPException(403, "She has not allowed this.")
        return link

    return dependency


def _record(db: Session, user: models.User, link: models.CaregiverLink, action: str, title: str, details: str = "") -> None:
    db.add(models.AuditLog(episode_id=link.episode_id, actor_user_id=user.id, actor_role="caregiver", actor_display_name=user.full_name, action=action,
                           title=title, details=details[:300], object_type="CaregiverLink", object_id=link.id))


def _summary(db: Session, link: models.CaregiverLink) -> dict:
    episode = db.get(models.PregnancyEpisode, link.episode_id)
    return {"linkId": link.id, "womanName": episode.patient_name if episode else "", "relationship": link.relationship, "displayName": link.display_name,
            "permissions": link.permissions or {}, "since": _iso(link.accepted_at)}


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


@router.get("/notifications")
def notifications(user=Depends(caregiver), db: Session = Depends(get_db)):
    rows = db.query(models.Notification).filter_by(recipient_user_id=user.id).order_by(models.Notification.created_at.desc()).limit(30).all()
    return [{"id": n.id, "title": n.title, "body": n.body, "createdAt": _iso(n.created_at), "type": n.type} for n in rows]


@router.get("/{link_id}/home")
def home(link: models.CaregiverLink = Depends(access()), db: Session = Depends(get_db)):
    permissions = link.permissions or {}
    out = _summary(db, link)
    if permissions.get("appointments"):
        now = datetime.utcnow()
        upcoming = db.query(models.Appointment).filter(models.Appointment.episode_id == link.episode_id, models.Appointment.status == "scheduled",
                                                      models.Appointment.scheduled_at > now).order_by(models.Appointment.scheduled_at).limit(3).all()
        out["upcoming"] = [{"id": a.id, "scheduledAt": _iso(a.scheduled_at), "type": a.appointment_type, "location": a.location} for a in upcoming]
    if permissions.get("check_in"):
        last = db.query(models.DailyLog).filter_by(episode_id=link.episode_id, skipped=False).order_by(models.DailyLog.recorded_at.desc()).first()
        out["lastCheckIn"] = _iso(last.recorded_at) if last else None
    return out


@router.get("/{link_id}/appointments")
def appointments(link: models.CaregiverLink = Depends(access("appointments")), db: Session = Depends(get_db)):
    rows = db.query(models.Appointment).filter_by(episode_id=link.episode_id).order_by(models.Appointment.scheduled_at.desc()).limit(30).all()
    return [{"id": a.id, "scheduledAt": _iso(a.scheduled_at), "type": a.appointment_type, "location": a.location, "status": a.status} for a in rows]


@router.get("/{link_id}/check-ins")
def check_ins(link: models.CaregiverLink = Depends(access("check_in")), db: Session = Depends(get_db)):
    rows = db.query(models.DailyLog).filter_by(episode_id=link.episode_id).order_by(models.DailyLog.recorded_at.desc()).limit(14).all()
    return [{"id": l.id, "recordedAt": _iso(l.recorded_at), "systolic": l.systolic, "diastolic": l.diastolic, "weightKg": l.weight_kg, "symptoms": l.symptoms,
             "mood": l.mood, "adherence": l.adherence, "skipped": l.skipped, "enteredWithHelp": l.entered_with_help} for l in rows]


@router.post("/{link_id}/check-ins")
def add_check_in(payload: LogIn, link: models.CaregiverLink = Depends(access("check_in")), user=Depends(caregiver), db: Session = Depends(get_db)):
    data = payload.model_dump()
    data["entered_with_help"] = f"Family member: {user.full_name}"  # taken from their own login, never from what the browser sent
    log = models.DailyLog(episode_id=link.episode_id, **data)
    db.add(log)
    db.flush()
    _record(db, user, link, "caregiver_checkin_recorded", "A trusted person filled in a check-in", link.display_name)
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
    automation.dispatch_event(db, automation.events.PATIENT_QUESTION_CREATED, episode_id=link.episode_id, actor_user_id=user.id,
                              source_type="PatientQuestion", source_id=question.id, payload={"questionText": text})
    db.commit()
    return {"id": question.id, "status": question.status}


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
    db.commit()
    return {"message": messages.pick(messages.TALK_TO_PERSON, language)}
