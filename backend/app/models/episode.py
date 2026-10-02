from sqlalchemy import Boolean, Column, ForeignKey, Integer, JSON, String, DateTime
from sqlalchemy.orm import relationship

from ..database import Base
from ._shared import new_id, now


class PregnancyEpisode(Base):
    __tablename__ = "pregnancy_episodes"

    id = Column(String, primary_key=True, default=new_id)
    patient_user_id = Column(String, ForeignKey("users.id"), nullable=False)

    # Denormalized display copy (kept in sync with the patient's User.full_name)
    patient_name = Column(String, nullable=False)
    mrn = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    dob = Column(String, nullable=True)
    edd = Column(String, nullable=False)

    gestational_age_weeks = Column(Integer, default=0)
    gestational_age_days = Column(Integer, default=0)
    gravida_para = Column(String, default="Not documented")
    blood_type = Column(String, default="Not documented")
    allergies = Column(JSON, default=list)
    risk_category = Column(String, default="routine")
    risk_notes = Column(String, default="")
    facility = Column(String, default="Not documented")

    is_current = Column(Boolean, default=True)
    is_ready_for_today_brief = Column(Boolean, default=False)

    created_at = Column(DateTime, default=now)

    doctor_assignments = relationship("PatientDoctorAssignment", back_populates="episode", cascade="all, delete-orphan")
    care_team_assignments = relationship("PatientCareTeamAssignment", back_populates="episode", cascade="all, delete-orphan")
