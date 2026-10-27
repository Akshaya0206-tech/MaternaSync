"""Emergency help for a trusted person: the card she can show at a hospital, and the hospitals her clinic recommends.

Both go through `access("emergency")`, the same gate as the numbers page, so a removed person, someone else's link, an ended link or a woman who
switched `emergency` off gets a refusal. The card holds exactly five things and nothing about her health: her name, her estimated due date, her
doctor, the clinic phone and the number on her MCP card. Opening the card is written to the audit log (she sees it in what that person has done),
but she is not sent a note for it: looking at a card changes nothing, and a note each time would teach her to ignore the real ones.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import clinic_emergency, models
from ..continuity_schemas import Input
from ..database import get_db
from .caregiver import _record, access, caregiver

router = APIRouter(prefix="/api/v2/caregiver", tags=["caregiver-emergency"])

CARD_FIELDS = ("name", "dueDate", "doctorName", "clinicPhone", "mcpNumber")  # the whole card; a test pins this list
LATE_REPORT = timedelta(days=7)  # an opening reported later than this (a phone kept offline for days) is logged without its own time


def card_for(db: Session, link: models.CaregiverLink) -> dict:
    """Her name, due date, doctor, the clinic's phone and her MCP number. A missing one is null, never filled in."""
    episode = db.get(models.PregnancyEpisode, link.episode_id)
    woman = db.get(models.User, link.patient_user_id)
    profile = db.get(models.PatientEmergencyProfile, link.patient_user_id)
    contact = db.get(models.ClinicContact, clinic_emergency.CLINIC_KEY)
    return {
        "name": (episode.patient_name if episode and episode.patient_name else woman.full_name if woman else None) or None,
        "dueDate": (episode.edd or None) if episode else None,
        "doctorName": clinic_emergency.doctor_name_for(db, episode),
        "clinicPhone": (contact.clinic_phone or None) if contact else None,
        "mcpNumber": (profile.mcp_number or None) if profile else None,
    }


@router.get("/{link_id}/hospital-card")
def hospital_card(link: models.CaregiverLink = Depends(access("emergency")), db: Session = Depends(get_db)):
    return card_for(db, link)


@router.get("/{link_id}/clinic-hospitals")
def clinic_hospitals(link: models.CaregiverLink = Depends(access("emergency")), db: Session = Depends(get_db)):
    """The hospitals her doctor's clinic recommends: the same list she sees on her own Emergency help page."""
    return {"hospitals": clinic_emergency.clinic_out(db)["hospitals"]}


class OpenedIn(Input):
    at: datetime | None = None  # when it was opened on the phone, sent later if there was no signal at the time


@router.post("/{link_id}/hospital-card/opened")
def hospital_card_opened(payload: OpenedIn, link: models.CaregiverLink = Depends(access("emergency")), user=Depends(caregiver), db: Session = Depends(get_db)):
    """The helper opened "Show this to the hospital". Recorded for her; a repeat within half a minute (a double tap) is not written twice."""
    now = datetime.now(timezone.utc)
    when = payload.at.astimezone(timezone.utc) if payload.at is not None and payload.at.tzinfo is not None else None
    late = when is not None and now - LATE_REPORT <= when <= now
    recent = now.replace(tzinfo=None) - timedelta(seconds=30)
    if not late and db.query(models.AuditLog).filter(models.AuditLog.action == "caregiver_hospital_card_opened", models.AuditLog.object_id == link.id,
                                                    models.AuditLog.timestamp >= recent).first():
        return {"recorded": False}
    _record(db, user, link, "caregiver_hospital_card_opened", "A trusted person opened the hospital card", f"opened on the phone at {when.strftime('%Y-%m-%d %H:%M')} UTC" if late else "")
    db.commit()
    return {"recorded": True}
