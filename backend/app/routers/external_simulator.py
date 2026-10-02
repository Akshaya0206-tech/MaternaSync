"""External Hospital Simulator — prototype-only.

This is NOT a real hospital system and has no real-world counterpart.
It stands in for the external side of a referral so the full
Doctor -> Care Team -> external hospital -> Care Team -> Doctor -> Patient
loop can be demonstrated without a real email/API/EHR integration.

Deliberately unauthenticated (no login, no role) — a real hospital isn't
one of MaternaSync's internal users, so gating this behind our own
auth would misrepresent the architecture. What stands in for "access
control" here is exactly what a real referral ID would be in the real
world: you need the reference_code to act on a referral, and only
referrals that have actually been SENT (or further along) are visible
at all — a DRAFT referral nobody sent yet is invisible here, same as a
real hospital would have no way to know about a referral that was never
transmitted.

Every state-changing action goes through the exact same
ReferralCommunicationService used by the authenticated Care Team/Doctor
routers, with source="SYSTEM_SIMULATOR" — see that module's docstring
for the IMPLEMENTED/SIMULATED/FUTURE INTEGRATION distinction.

The response shape is deliberately minimal: reference code, patient
name, referral type, destination, status, referring doctor and care
coordinator names. No DOB, no MRN, no chart data, no documents — nothing
beyond what a real referral message would actually carry.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas_v2
from ..database import SessionLocal
from ..referral_communication import ReferralCommunicationService, ReferralTransitionError

router = APIRouter(prefix="/api/v2/external-simulator", tags=["external-hospital-simulator-demo"])

VISIBLE_STATUSES = ("SENT", "ACKNOWLEDGED", "APPOINTMENT_SCHEDULED", "RESPONSE_RECEIVED", "CLOSED")


def _get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_sent_referral(db: Session, reference_code: str) -> models.Referral:
    referral = db.query(models.Referral).filter(models.Referral.reference_code == reference_code).first()
    if referral is None or referral.status not in VISIBLE_STATUSES:
        # Same response for "doesn't exist" and "never sent" — a real
        # external system has no way to distinguish those either.
        raise HTTPException(status_code=404, detail="No referral found with that reference code.")
    return referral


def _to_summary(db: Session, r: models.Referral) -> schemas_v2.SimulatorReferralOut:
    episode = db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.id == r.episode_id).first()
    doctor = db.query(models.User).filter(models.User.id == r.created_by_user_id).first()
    coordinator = db.query(models.User).filter(models.User.id == r.owner_user_id).first() if r.owner_user_id else None
    comm = (
        db.query(models.Communication)
        .filter(models.Communication.related_referral_id == r.id, models.Communication.type == "REFERRAL_OUTBOUND")
        .order_by(models.Communication.created_at.desc()).first()
    )
    return schemas_v2.SimulatorReferralOut(
        reference_code=r.reference_code, patient_name=episode.patient_name if episode else "Unknown",
        referral_type=r.title, destination=r.destination, status=r.status,
        created_date=r.created_at.date().isoformat(),
        doctor_name=doctor.full_name if doctor else "Unknown",
        care_coordinator_name=coordinator.full_name if coordinator else None,
        message=comm.content if comm else "",
    )


@router.get("/referrals", response_model=list[schemas_v2.SimulatorReferralOut])
def list_incoming_referrals(db: Session = Depends(_get_db)):
    referrals = db.query(models.Referral).filter(models.Referral.status.in_(VISIBLE_STATUSES)).order_by(models.Referral.sent_at.desc()).all()
    return [_to_summary(db, r) for r in referrals]


@router.get("/referrals/{reference_code}", response_model=schemas_v2.SimulatorReferralOut)
def get_incoming_referral(reference_code: str, db: Session = Depends(_get_db)):
    referral = _get_sent_referral(db, reference_code)
    return _to_summary(db, referral)


@router.post("/referrals/{reference_code}/acknowledge", response_model=schemas_v2.SimulatorReferralOut)
def acknowledge_referral(reference_code: str, payload: schemas_v2.SimulatorAcknowledgeIn, db: Session = Depends(_get_db)):
    referral = _get_sent_referral(db, reference_code)
    try:
        ReferralCommunicationService(db).acknowledge(
            referral, source="SYSTEM_SIMULATOR", actor=None, external_reference=payload.external_reference,
            note="Acknowledged via External Hospital Simulator.",
        )
    except ReferralTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    db.commit()
    db.refresh(referral)
    return _to_summary(db, referral)


@router.post("/referrals/{reference_code}/appointment", response_model=schemas_v2.SimulatorReferralOut)
def schedule_appointment(reference_code: str, payload: schemas_v2.SimulatorAppointmentIn, db: Session = Depends(_get_db)):
    referral = _get_sent_referral(db, reference_code)
    try:
        ReferralCommunicationService(db).record_appointment(
            referral, payload.appointment_date, payload.appointment_time, payload.external_provider,
            source="SYSTEM_SIMULATOR", actor=None,
        )
    except ReferralTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    db.commit()
    db.refresh(referral)
    return _to_summary(db, referral)


@router.post("/referrals/{reference_code}/response", response_model=schemas_v2.SimulatorReferralOut)
def send_response(reference_code: str, payload: schemas_v2.SimulatorResponseIn, db: Session = Depends(_get_db)):
    referral = _get_sent_referral(db, reference_code)
    text = payload.response_text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Please enter a response.")
    try:
        ReferralCommunicationService(db).record_response(referral, text, source="SYSTEM_SIMULATOR", actor=None)
    except ReferralTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    db.commit()
    db.refresh(referral)
    return _to_summary(db, referral)
