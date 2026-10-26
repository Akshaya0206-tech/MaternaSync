"""A patient's emergency page: numbers to call, their own contact and preferred hospital, and hospitals near them.

Patient-only and private: nothing here is visible to doctors or the care team, and nothing alerts anyone.
"""
import re

from fastapi import APIRouter, Depends, Query
from pydantic import Field, field_validator
from sqlalchemy.orm import Session

from .. import clinic_emergency, emergency, models
from ..continuity_schemas import Input
from ..continuity_service import now
from ..database import get_db
from ..deps import require_role

router = APIRouter(prefix="/api/v2/patient/emergency", tags=["patient-emergency"])
patient = require_role("patient")
_PHONE = re.compile(r"^\+?[0-9][0-9 \-()]{3,22}[0-9]$")
_MCP = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 /\-]{0,28}[A-Za-z0-9]$|^[A-Za-z0-9]$")


class EmergencyIn(Input):
    home_label: str | None = Field(None, max_length=200)
    home_lat: float | None = Field(None, ge=-90, le=90)
    home_lon: float | None = Field(None, ge=-180, le=180)
    contact_name: str | None = Field(None, max_length=120)
    contact_relation: str | None = Field(None, max_length=60)
    contact_phone: str | None = Field(None, max_length=30)
    hospital_name: str | None = Field(None, max_length=200)
    hospital_phone: str | None = Field(None, max_length=30)
    hospital_address: str | None = Field(None, max_length=300)
    mcp_number: str | None = Field(None, max_length=30)
    live_location: bool = False

    @field_validator("contact_phone", "hospital_phone")
    @classmethod
    def phone(cls, value):
        if value and not _PHONE.match(value):
            raise ValueError("Enter a phone number using digits, and + for a country code if needed.")
        return value or None

    @field_validator("home_label", "contact_name", "contact_relation", "hospital_name", "hospital_address")
    @classmethod
    def blank_is_nothing(cls, value):
        return value or None

    @field_validator("mcp_number")
    @classmethod
    def mcp(cls, value):
        if value and not _MCP.match(value):
            raise ValueError("Use only letters, digits, spaces, / and - for the card number.")
        return value or None


def profile_out(profile: models.PatientEmergencyProfile | None) -> dict:
    p = profile
    return {
        "homeLabel": p.home_label if p else None, "homeLat": p.home_lat if p else None, "homeLon": p.home_lon if p else None,
        "hasHome": bool(p and p.home_lat is not None and p.home_lon is not None),
        "contactName": p.contact_name if p else None, "contactRelation": p.contact_relation if p else None, "contactPhone": p.contact_phone if p else None,
        "hospitalName": p.hospital_name if p else None, "hospitalPhone": p.hospital_phone if p else None, "hospitalAddress": p.hospital_address if p else None,
        "mcpNumber": p.mcp_number if p else None,
        "liveLocation": bool(p and p.live_location),
    }


def overview(db: Session, user: models.User, profile: models.PatientEmergencyProfile | None) -> dict:
    """Everything the Emergency help page shows, including what the "Show this to the hospital" card needs: her own name and due date,
    her doctor, and what her clinic has said about itself. It holds nothing about her health."""
    out = profile_out(profile)
    episode = (db.query(models.PregnancyEpisode).filter_by(patient_user_id=user.id)
               .order_by(models.PregnancyEpisode.created_at.desc()).first())
    clinic = clinic_emergency.clinic_out(db)
    clinic["doctorName"] = clinic_emergency.doctor_name_for(db, episode)
    return {"profile": out, "clinic": clinic, "me": {"name": user.full_name, "edd": episode.edd if episode else None},
            **emergency.numbers_for(out["homeLat"], out["homeLon"])}


def _mine(db: Session, user: models.User) -> models.PatientEmergencyProfile | None:
    return db.get(models.PatientEmergencyProfile, user.id)


def resolve_home(data: dict) -> bool | None:
    """Make a saved home consistent: a position needs both numbers, a typed area is looked up on the map, and a
    position with no name is called "My current location". Changes `data`. Returns whether the typed area was
    found, or None when nothing was looked up. This may call the map service, so keep it out of a database
    transaction."""
    located = None
    if (data["home_lat"] is None) != (data["home_lon"] is None):
        data["home_lat"] = data["home_lon"] = None
    if data["home_lat"] is None and data["home_label"]:
        found = emergency.geocode(data["home_label"])  # the typed area, turned into a position
        located = bool(found)
        if found:
            data["home_lat"], data["home_lon"] = found["lat"], found["lon"]
    elif data["home_lat"] is not None and not data["home_label"]:
        data["home_label"] = "My current location"
    return located


def write_profile(db: Session, user_id: str, data: dict) -> models.PatientEmergencyProfile:
    """Create or update the patient's emergency details. The caller commits."""
    profile = db.get(models.PatientEmergencyProfile, user_id)
    if not profile:
        profile = models.PatientEmergencyProfile(user_id=user_id)
        db.add(profile)
    for key, value in data.items():
        setattr(profile, key, value)
    profile.updated_at = now()
    return profile


@router.get("")
def read(user=Depends(patient), db: Session = Depends(get_db)):
    return overview(db, user, _mine(db, user))


@router.put("")
def save(payload: EmergencyIn, user=Depends(patient), db: Session = Depends(get_db)):
    data = payload.model_dump()
    if "mcp_number" not in payload.model_fields_set:
        data.pop("mcp_number")  # a form that does not send it (the Profile page's location form) must not wipe it
    located = resolve_home(data)
    profile = write_profile(db, user.id, data)
    db.commit()
    return {**overview(db, user, profile), "located": located}


@router.get("/nearby")
def nearby(lat: float | None = Query(None, ge=-90, le=90), lon: float | None = Query(None, ge=-180, le=180),
           user=Depends(patient), db: Session = Depends(get_db)):
    """Hospitals near the given position (the patient's current one), or near their saved home when none is given."""
    profile = _mine(db, user)
    home = (profile.home_lat, profile.home_lon) if profile and profile.home_lat is not None and profile.home_lon is not None else None
    if (lat is None) != (lon is None):
        lat = lon = None
    if lat is None and home:
        lat, lon = home
    if lat is None:
        return {"needsLocation": True, "hospitals": [], "error": None, "usedPosition": None, "awayKm": None, "away": False, **emergency.numbers_for(None, None)}
    away_km = round(emergency.distance_km(home[0], home[1], lat, lon), 1) if home else None
    return {"needsLocation": False, "usedPosition": {"lat": lat, "lon": lon}, "awayKm": away_km,
            "away": bool(away_km is not None and away_km > emergency.AWAY_KM), **emergency.nearby_hospitals(lat, lon), **emergency.numbers_for(lat, lon)}
