"""What the clinic tells its patients on their Emergency help page: its own name and phone, and the hospitals it recommends.

A doctor writes this (see routers/clinic_emergency.py); every patient of the clinic reads it (routers/emergency.py). It is plain contact
information the clinic chose to share. Nothing here reads a patient's health information, and every change is written to the audit log.
"""
import re

from sqlalchemy.orm import Session

from . import models

PHONE = re.compile(r"^\+?[0-9][0-9 \-()]{3,22}[0-9]$")
MAX_HOSPITALS = 20  # a short list is easier to use in an emergency, and easier for the clinic to keep correct
CLINIC_KEY = "clinic"


def hospital_out(hospital: models.ClinicHospital) -> dict:
    return {"id": hospital.id, "name": hospital.name, "address": hospital.address, "phone": hospital.phone, "note": hospital.note}


def clinic_out(db: Session) -> dict:
    """The clinic's own contact details and its recommended hospitals, oldest entry first."""
    contact = db.get(models.ClinicContact, CLINIC_KEY)
    hospitals = db.query(models.ClinicHospital).order_by(models.ClinicHospital.created_at, models.ClinicHospital.id).all()
    return {"name": contact.clinic_name if contact else None, "phone": contact.clinic_phone if contact else None,
            "hospitals": [hospital_out(h) for h in hospitals]}


def doctor_name_for(db: Session, episode: models.PregnancyEpisode | None) -> str | None:
    """Her own doctor: the primary one when there is one, otherwise the first assigned."""
    if episode is None:
        return None
    assignments = (db.query(models.PatientDoctorAssignment).filter(models.PatientDoctorAssignment.episode_id == episode.id)
                   .order_by(models.PatientDoctorAssignment.is_primary.desc()).all())
    for assignment in assignments:
        doctor = db.get(models.User, assignment.doctor_user_id)
        if doctor:
            return doctor.full_name
    return None


def audit(db: Session, user: models.User, action: str, title: str, details: str, object_type: str, object_id: str | None,
          before: dict | None = None, after: dict | None = None) -> None:
    db.add(models.AuditLog(episode_id=None, actor_user_id=user.id, actor_role=user.role, actor_display_name=user.full_name, action=action,
                           title=title, details=details[:500], object_type=object_type, object_id=object_id, previous_state=before, new_state=after))
