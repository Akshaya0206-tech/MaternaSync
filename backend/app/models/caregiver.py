from sqlalchemy import Column, DateTime, ForeignKey, JSON, String

from ..database import Base
from ._shared import new_id, now

# What a woman can allow a trusted person to do. Only the first is on unless she chooses more.
PERMISSIONS = ("appointments", "check_in", "care_plan", "questions", "emergency")
DEFAULT_PERMISSIONS = {"appointments": True, "check_in": False, "care_plan": False, "questions": False, "emergency": False}


class CaregiverLink(Base):
    """A trusted person (a relative, a friend) linked to one woman's pregnancy record. The woman creates the invite,
    chooses the permissions and can revoke at any time. The caregiver has their own login and sees only what is
    allowed here, and only for this woman."""

    __tablename__ = "caregiver_links"

    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False, index=True)
    patient_user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    caregiver_user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)  # set when the invite is accepted

    display_name = Column(String, nullable=False)  # what the woman calls them
    relationship = Column(String, default="")
    permissions = Column(JSON, default=dict)
    status = Column(String, default="INVITED")  # INVITED | ACTIVE | REVOKED

    code_hash = Column(String, nullable=True, index=True)  # the invite code is shown once and only its hash is kept
    code_expires_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=now)
    accepted_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
