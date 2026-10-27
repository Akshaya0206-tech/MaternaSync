"""Connected Care additions for the doctor: a record that a patient's entries were exported (printed or downloaded), and the three answers a
doctor can give to a patient's request to cancel or move a confirmed visit. Every one is a person's click: nothing here runs by itself."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy.orm import Session

from .. import models, visit_changes
from ..ai_coordinator import scheduling, tools as assistant_tools
from .. import continuity_schemas as S
from ..continuity_service import audit, episode, get_object, notify, row
from ..database import get_db
from ..deps import require_role
from .continuity import appointment_status

router = APIRouter(prefix="/api/v2/continuity", tags=["connected-care"])
staff = require_role("doctor", "care_team")
doctor = require_role("doctor")


class EntriesExportIn(S.Input):
    kind: Literal["print", "csv"]
    range: Literal["14", "30", "all"]
    count: int = Field(ge=0, le=1000)


@router.post("/episodes/{episode_id}/entries-export")
def entries_export(episode_id: str, payload: EntriesExportIn, user=Depends(staff), db: Session = Depends(get_db)):
    """The patient's own entries leave the screen as a printout or a file: that is recorded, like every other way her data is read."""
    ep = episode(db, user, episode_id)
    audit(db, user, "patient_entries_exported", episode_id=ep.id, after={"how": payload.kind, "range": payload.range, "entries": payload.count},
          details=f"{user.full_name} {'printed' if payload.kind == 'print' else 'downloaded'} {payload.count} of the patient's entries")
    db.commit()
    return {"recorded": True}


# ---------------------------------------------------------------- a patient's request to cancel or move a visit
class ChangeAnswerIn(S.Input):
    accept_outside_rules: bool = False  # confirming a time the booking rules would not have allowed, knowingly


def _open_change(db, user, appointment_id: str, kind: str) -> models.Appointment:
    visit = get_object(db, user, models.Appointment, appointment_id)
    if visit.status != "scheduled" or visit.change_kind != kind:
        raise HTTPException(409, "There is no open request of that kind about this visit any more.")
    return visit


def _new_visit(db, visit: models.Appointment) -> models.Appointment:
    new = db.get(models.Appointment, visit.change_new_appointment_id) if visit.change_new_appointment_id else None
    if new is None or new.episode_id != visit.episode_id or new.status != "requested":
        raise HTTPException(409, "The visit request for the new time is no longer waiting, so nothing was changed.")
    return new


@router.get("/appointments/{appointment_id}/change-preview")
def change_preview(appointment_id: str, user=Depends(doctor), db: Session = Depends(get_db)):
    """What a doctor needs to decide: both times on the clinic's clock, whether the new time is inside the booking rules, and the next free times."""
    visit = get_object(db, user, models.Appointment, appointment_id)
    if visit.status != "scheduled" or not visit.change_kind:
        raise HTTPException(409, "There is no open request about this visit.")
    rules = scheduling.rules(db)
    out = {"kind": visit.change_kind, "visitWhen": scheduling.local_text(visit.scheduled_at, rules), "note": visit.change_note,
           "newWhen": None, "outsideRules": None, "freeTimes": []}
    if visit.change_kind == "reschedule":
        new = _new_visit(db, visit)
        found = scheduling.problems(db, rules, new)
        out["newWhen"] = scheduling.local_text(new.scheduled_at, rules)
        out["outsideRules"] = scheduling.explain(found, rules) if found else None
        out["freeTimes"] = [scheduling.local_text(s, rules) for s in scheduling.free_slots(db, rules, visit.episode_id, new.scheduled_at)]
    return out


@router.post("/appointments/{appointment_id}/change/confirm-new-time")
def confirm_new_time(appointment_id: str, payload: ChangeAnswerIn, user=Depends(doctor), db: Session = Depends(get_db)):
    """Confirm the visit she asked for at the new time AND cancel the old one, in one step. She is told both, in her language."""
    visit = _open_change(db, user, appointment_id, "reschedule")
    new = _new_visit(db, visit)
    rules = scheduling.rules(db)
    found = scheduling.problems(db, rules, new)
    if found and not payload.accept_outside_rules:
        raise HTTPException(409, f"That time is outside the clinic's booking rules ({scheduling.explain(found, rules)}). Confirm it anyway to set the rules aside.")
    ep = db.get(models.PregnancyEpisode, visit.episode_id)
    old_when, new_when = scheduling.local_text(visit.scheduled_at, rules), scheduling.local_text(new.scheduled_at, rules)

    assistant_tools._confirm_appointment(db, {"appointment_id": new.id}, user, visit.episode_id)  # requested -> scheduled, and she is told
    visit.status = "cancelled"
    visit_changes.close_request(db, visit, f"Moved to {new_when}: confirmed by {user.full_name}.")
    notify(db, ep.id, ep.patient_user_id, "appointment_cancelled", kind=visit.appointment_type)
    audit(db, user, "visit_change_confirmed_new_time", visit, after={"oldVisit": old_when, "newVisit": new_when, "outsideRules": bool(found)},
          details=f"{user.full_name} confirmed the visit on {new_when} and cancelled the one on {old_when}")
    audit(db, user, "appointment_status_changed", new, after=row(new))
    db.commit()
    return {"old": row(visit), "new": row(new)}


@router.post("/appointments/{appointment_id}/change/offer-other-times")
def offer_other_times(appointment_id: str, user=Depends(doctor), db: Session = Depends(get_db)):
    """Close the visit request for the new time and send her the next free times (the Care Assistant's own step). The old visit stays as it is."""
    visit = _open_change(db, user, appointment_id, "reschedule")
    new = _new_visit(db, visit)
    rules = scheduling.rules(db)
    slots = scheduling.free_slots(db, rules, visit.episode_id, new.scheduled_at)
    if not slots:
        raise HTTPException(409, "No free time was found in the next three weeks inside the booking rules. Please answer her yourself.")
    assistant_tools._offer_new_times(db, {"appointment_id": new.id, "slots": [s.isoformat() for s in slots]}, user, visit.episode_id)
    visit_changes.close_request(db, visit, f"Other times were offered by {user.full_name}.")
    audit(db, user, "visit_change_other_times_offered", visit, after={"offered": [scheduling.local_text(s, rules) for s in slots]},
          details=f"{user.full_name} offered other times instead of the requested move")
    db.commit()
    return {"visit": row(visit), "offered": [scheduling.local_text(s, rules) for s in slots]}


@router.post("/appointments/{appointment_id}/change/cancel-visit")
def cancel_visit(appointment_id: str, user=Depends(doctor), db: Session = Depends(get_db)):
    """She asked to cancel: the same status change the visit list offers, started from the request itself."""
    _open_change(db, user, appointment_id, "cancel")
    return appointment_status(appointment_id, S.AppointmentStatusIn(status="cancelled"), user, db)
