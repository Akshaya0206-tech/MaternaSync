"""A patient's own emergency details: where home is, who to call, and which hospital they prefer.

Private to the patient. Nothing here is shown to doctors or the care team, and nothing alerts anyone: the
Emergency page only shows the patient who to call.
"""

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, String

from ..database import Base
from ._shared import new_id, now


class PatientEmergencyProfile(Base):
    __tablename__ = "patient_emergency_profiles"

    user_id = Column(String, ForeignKey("users.id"), primary_key=True)

    home_label = Column(String, nullable=True)  # the area or city the patient typed, or the place found for it
    home_lat = Column(Float, nullable=True)
    home_lon = Column(Float, nullable=True)

    contact_name = Column(String, nullable=True)
    contact_relation = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)

    hospital_name = Column(String, nullable=True)
    hospital_phone = Column(String, nullable=True)
    hospital_address = Column(String, nullable=True)

    # The number on her Mother and Child Protection (MCP) card, which she can show at a hospital. Typed by her; never checked or read by the app.
    mcp_number = Column(String, nullable=True)

    # The patient agreed to keep their position up to date while the app is open (used only to find hospitals near them).
    live_location = Column(Boolean, nullable=False, default=False)

    updated_at = Column(DateTime, default=now)


class ClinicContact(Base):
    """The clinic's own name and phone, shown on every patient's Emergency help page and on the card she can show at a hospital.
    One row (key "clinic"), written by a doctor."""

    __tablename__ = "clinic_contact"

    key = Column(String, primary_key=True)
    clinic_name = Column(String, nullable=True)
    clinic_phone = Column(String, nullable=True)
    clinic_hours = Column(String, nullable=True)  # free text, for example "Mon-Sat 9:00-17:00"
    updated_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=now)


class ClinicHospital(Base):
    """A hospital the clinic recommends to its patients in an emergency. A doctor adds, changes and removes them; each change is audit-logged."""

    __tablename__ = "clinic_hospitals"

    id = Column(String, primary_key=True, default=new_id)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    note = Column(String, nullable=True)  # for example "maternity ward, open all day"
    created_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now)
