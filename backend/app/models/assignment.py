"""These two tables are the entire access-control backbone of the new
system: every episode-scoped API request is authorized by checking for a
matching row here (see deps.require_episode_access in Step 2)."""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship

from ..database import Base
from ._shared import new_id, now


class PatientDoctorAssignment(Base):
    __tablename__ = "patient_doctor_assignments"

    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False)
    doctor_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    is_primary = Column(Boolean, default=True)
    assigned_at = Column(DateTime, default=now)

    episode = relationship("PregnancyEpisode", back_populates="doctor_assignments")


class PatientCareTeamAssignment(Base):
    __tablename__ = "patient_care_team_assignments"

    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False)
    care_team_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    role_on_case = Column(String, default="Care Coordinator")
    assigned_at = Column(DateTime, default=now)

    episode = relationship("PregnancyEpisode", back_populates="care_team_assignments")
