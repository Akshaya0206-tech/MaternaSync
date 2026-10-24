"""A patient's own emergency details: where home is, who to call, and which hospital they prefer.

Private to the patient. Nothing here is shown to doctors or the care team, and nothing alerts anyone: the
Emergency page only shows the patient who to call.
"""

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, String

from ..database import Base
from ._shared import now


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

    # The patient agreed to keep their position up to date while the app is open (used only to find hospitals near them).
    live_location = Column(Boolean, nullable=False, default=False)

    updated_at = Column(DateTime, default=now)
