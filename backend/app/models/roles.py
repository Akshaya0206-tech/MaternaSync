"""Role-specific profile tables. A User's `role` column (patient | care_team
| doctor) determines which one of these it has exactly one of."""

from sqlalchemy import Column, ForeignKey, String
from sqlalchemy.orm import relationship

from ..database import Base
from ._shared import new_id


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, unique=True)
    date_of_birth = Column(String, nullable=True)
    mrn = Column(String, nullable=True)
    phone = Column(String, nullable=True)


class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, unique=True)
    specialty = Column(String, default="Obstetrics")
    facility = Column(String, nullable=True)


class CareTeamProfile(Base):
    __tablename__ = "care_team_profiles"

    id = Column(String, primary_key=True, default=new_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, unique=True)
    title = Column(String, default="Care Coordinator")
    facility = Column(String, nullable=True)
