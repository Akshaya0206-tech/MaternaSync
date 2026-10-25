from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint

from ..database import Base
from ._shared import new_id, now

# What a woman can allow a trusted person to do. Only the first is on unless she chooses more.
# `reminders` lets the person see WHEN her reminders are due. Their names and instructions (a medicine, a vaccine) show only if she also allows `care_plan`.
PERMISSIONS = ("appointments", "check_in", "care_plan", "reminders", "questions", "emergency")
DEFAULT_PERMISSIONS = {"appointments": True, "check_in": False, "care_plan": False, "reminders": False, "questions": False, "emergency": False}


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
    # The woman can limit how long the person may help. After this moment the link stops working by itself; she can extend it.
    access_until = Column(DateTime, nullable=True)


class CaregiverVisitHelp(Base):
    """A trusted person's answer about one visit: "I will take her" or "I cannot". The woman sees it on her Appointments page.
    It is logistics only: it says who can come, and nothing about the visit's content."""

    __tablename__ = "caregiver_visit_help"
    __table_args__ = (UniqueConstraint("appointment_id", "link_id"),)

    id = Column(String, primary_key=True, default=new_id)
    appointment_id = Column(String, ForeignKey("appointments.id"), nullable=False, index=True)
    link_id = Column(String, ForeignKey("caregiver_links.id"), nullable=False, index=True)
    status = Column(String, nullable=False)  # WILL_TAKE | CANNOT
    updated_at = Column(DateTime, default=now)


class CaregiverWhatsApp(Base):
    """A trusted person's own WhatsApp number for short reminders about this woman: the number they typed, the one-time code that
    proves it is theirs (only its hash is kept), and the consent once they confirm. Nothing is sent before the code is confirmed."""

    __tablename__ = "caregiver_whatsapp"

    link_id = Column(String, ForeignKey("caregiver_links.id"), primary_key=True)
    number = Column(String, nullable=True)
    code_hash = Column(String, nullable=True)
    code_expires_at = Column(DateTime, nullable=True)
    attempts = Column(Integer, default=0)
    requested_at = Column(DateTime, nullable=True)
    window_start = Column(DateTime, nullable=True)
    window_count = Column(Integer, default=0)
    verified_at = Column(DateTime, nullable=True)
    consent_id = Column(String, ForeignKey("sharing_consents.id"), nullable=True)


class VisitPrepItem(Base):
    """One line of a "getting ready for this visit" checklist. A DOCTOR writes it (the app adds nothing), for one scheduled visit.
    The woman and any trusted person who may see her appointments can tick it; the doctor sees who did. It is a to-do list, not advice."""

    __tablename__ = "visit_prep_items"

    id = Column(String, primary_key=True, default=new_id)
    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), nullable=False, index=True)
    appointment_id = Column(String, ForeignKey("appointments.id"), nullable=False, index=True)
    text = Column(String(300), nullable=False)
    position = Column(Integer, default=0)
    created_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=now)
    done_at = Column(DateTime, nullable=True)
    done_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    done_by_role = Column(String, nullable=True)  # patient | caregiver


class CheckInHelper(Base):
    """The trusted person a doctor has asked to help with her daily check-ins (one per pregnancy). Only someone she has already allowed to
    do check-ins can be asked, so this never widens what she chose. The person answers yes or no; their missed-check-in reminders then come first."""

    __tablename__ = "checkin_helpers"

    episode_id = Column(String, ForeignKey("pregnancy_episodes.id"), primary_key=True)
    link_id = Column(String, ForeignKey("caregiver_links.id"), nullable=False, index=True)
    status = Column(String, default="ASKED")  # ASKED | ACCEPTED | DECLINED
    asked_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    asked_at = Column(DateTime, default=now)
    responded_at = Column(DateTime, nullable=True)
