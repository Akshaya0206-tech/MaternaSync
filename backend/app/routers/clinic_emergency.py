"""A doctor's side of the patients' Emergency help page: the clinic's own name and phone, and the hospitals it recommends.

Patients read this list on their Emergency help page (routers/emergency.py). Only a doctor can change it, and every change is
written to the audit log with what it was before and after.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field, field_validator
from sqlalchemy.orm import Session

from .. import clinic_emergency as clinic, models
from ..continuity_schemas import Input
from ..continuity_service import now
from ..database import get_db
from ..deps import require_role

router = APIRouter(prefix="/api/v2/clinic/emergency", tags=["clinic-emergency"])
doctor = require_role("doctor")


def _check_phone(value):
    if value and not clinic.PHONE.match(value):
        raise ValueError("Enter a phone number using digits, and + for a country code if needed.")
    return value or None


class ContactIn(Input):
    clinic_name: str | None = Field(None, max_length=200)
    clinic_phone: str | None = Field(None, max_length=30)

    @field_validator("clinic_phone")
    @classmethod
    def phone(cls, value):
        return _check_phone(value)

    @field_validator("clinic_name")
    @classmethod
    def blank_is_nothing(cls, value):
        return value or None


class HospitalIn(Input):
    name: str = Field(min_length=2, max_length=200)
    address: str | None = Field(None, max_length=300)
    phone: str | None = Field(None, max_length=30)
    note: str | None = Field(None, max_length=200)

    @field_validator("phone")
    @classmethod
    def phone_ok(cls, value):
        return _check_phone(value)

    @field_validator("address", "note")
    @classmethod
    def blank_is_nothing(cls, value):
        return value or None


@router.get("")
def read(user=Depends(doctor), db: Session = Depends(get_db)):
    return clinic.clinic_out(db)


@router.put("/contact")
def save_contact(payload: ContactIn, user=Depends(doctor), db: Session = Depends(get_db)):
    contact = db.get(models.ClinicContact, clinic.CLINIC_KEY)
    before = {"name": contact.clinic_name, "phone": contact.clinic_phone} if contact else {"name": None, "phone": None}
    if not contact:
        contact = models.ClinicContact(key=clinic.CLINIC_KEY)
        db.add(contact)
    contact.clinic_name, contact.clinic_phone = payload.clinic_name, payload.clinic_phone
    contact.updated_by_user_id, contact.updated_at = user.id, now()
    after = {"name": contact.clinic_name, "phone": contact.clinic_phone}
    clinic.audit(db, user, "clinic_contact_changed", "Changed the clinic's name and phone on the patients' Emergency help page",
                 f"{after['name'] or 'no name'}; {after['phone'] or 'no phone'}", "ClinicContact", clinic.CLINIC_KEY, before, after)
    db.commit()
    return clinic.clinic_out(db)


@router.post("/hospitals")
def add_hospital(payload: HospitalIn, user=Depends(doctor), db: Session = Depends(get_db)):
    if db.query(models.ClinicHospital).count() >= clinic.MAX_HOSPITALS:
        raise HTTPException(409, f"The list holds at most {clinic.MAX_HOSPITALS} hospitals. Remove one first.")
    hospital = models.ClinicHospital(**payload.model_dump(), created_by_user_id=user.id)
    db.add(hospital)
    db.flush()
    after = clinic.hospital_out(hospital)
    clinic.audit(db, user, "clinic_hospital_added", "Added a hospital to the patients' Emergency help page", hospital.name, "ClinicHospital", hospital.id, None, after)
    db.commit()
    return clinic.clinic_out(db)


def _get(db: Session, hospital_id: str) -> models.ClinicHospital:
    hospital = db.get(models.ClinicHospital, hospital_id)
    if not hospital:
        raise HTTPException(404, "That hospital is not on the list.")
    return hospital


@router.patch("/hospitals/{hospital_id}")
def change_hospital(hospital_id: str, payload: HospitalIn, user=Depends(doctor), db: Session = Depends(get_db)):
    hospital = _get(db, hospital_id)
    before = clinic.hospital_out(hospital)
    for key, value in payload.model_dump().items():
        setattr(hospital, key, value)
    hospital.updated_at = now()
    clinic.audit(db, user, "clinic_hospital_changed", "Changed a hospital on the patients' Emergency help page", hospital.name, "ClinicHospital", hospital.id,
                 before, clinic.hospital_out(hospital))
    db.commit()
    return clinic.clinic_out(db)


@router.delete("/hospitals/{hospital_id}")
def remove_hospital(hospital_id: str, user=Depends(doctor), db: Session = Depends(get_db)):
    hospital = _get(db, hospital_id)
    before = clinic.hospital_out(hospital)
    clinic.audit(db, user, "clinic_hospital_removed", "Removed a hospital from the patients' Emergency help page", hospital.name, "ClinicHospital", hospital.id, before, None)
    db.delete(hospital)
    db.commit()
    return clinic.clinic_out(db)
