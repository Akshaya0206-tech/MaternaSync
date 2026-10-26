from sqlalchemy import Column, DateTime, ForeignKey, String, Text

from ..database import Base
from ._shared import new_id, now


class PatientTopicReview(Base):
    """A doctor's record that the clinic has read a topic on the patient References page (the text that ships with the app).

    One row per topic for the whole clinic; the latest review replaces the one before, and the audit log keeps the history.
    The patient sees "Reviewed by your clinic on <date> (<doctor>)" only while a row exists."""

    __tablename__ = "patient_topic_reviews"

    topic_id = Column(String, primary_key=True)
    reviewed_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    reviewed_at = Column(DateTime, default=now, nullable=False)
    note = Column(Text, default="")
