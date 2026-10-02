from sqlalchemy import Column, DateTime, ForeignKey, String

from ..database import Base
from ._shared import new_id, now


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False)

    scheduled_at = Column(DateTime, nullable=False)
    appointment_type = Column(String, default="consultation")
    location = Column(String, nullable=True)
    status = Column(String, default="scheduled")  # scheduled | completed | cancelled
    notes = Column(String, nullable=True)

    created_at = Column(DateTime, default=now)
