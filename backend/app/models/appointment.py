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

    # A request from the patient to cancel or move this visit. Nothing about the visit changes until a doctor acts on it.
    change_kind = Column(String, nullable=True)  # cancel | reschedule
    change_note = Column(String, nullable=True)
    change_preferred_at = Column(DateTime, nullable=True)
    change_requested_at = Column(DateTime, nullable=True)
    change_new_appointment_id = Column(String, nullable=True)  # the visit request made for the time she asked for
    change_task_id = Column(String, nullable=True)  # the doctor's task about it

    created_at = Column(DateTime, default=now)
