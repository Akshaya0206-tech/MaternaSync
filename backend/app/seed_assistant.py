"""The care assistant's service account, and a demonstration caregiver for the demo patient."""
import secrets
from datetime import datetime, timezone

from . import models
from .caregiver_service import clean_permissions
from .security import hash_password

ASSISTANT_EMAIL = "care.assistant@maternasync.internal"
ASSISTANT_NAME = "MaternaSync care assistant"

DEMO_CAREGIVER = {"email": "ravi.jenkins@maternasync.app", "password": "RaviDemo123!", "name": "Ravi Jenkins",
                  "woman_email": "sarah.jenkins@maternasync.app", "display_name": "Ravi (husband)", "relationship": "Husband"}


def ensure_assistant_user(db) -> models.User:
    """A user row so that everything the assistant does is attributed to one named identity in the audit log. Nobody
    knows its password and the sign-in check refuses its role, so it can never be used through the web."""
    user = db.query(models.User).filter_by(email=ASSISTANT_EMAIL).first()
    if user is None:
        user = models.User(full_name=ASSISTANT_NAME, email=ASSISTANT_EMAIL, password_hash=hash_password(secrets.token_urlsafe(32)),
                           role="ai_coordinator", title="Care assistant")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def ensure_demo_caregiver(db) -> None:
    """Ravi, Sarah's husband, with every permission switched on so the whole caregiver workspace can be shown."""
    woman = db.query(models.User).filter_by(email=DEMO_CAREGIVER["woman_email"]).first()
    if woman is None:
        return
    episode = db.query(models.PregnancyEpisode).filter_by(patient_user_id=woman.id).order_by(models.PregnancyEpisode.created_at.desc()).first()
    if episode is None:
        return
    user = db.query(models.User).filter_by(email=DEMO_CAREGIVER["email"]).first()
    if user is None:
        user = models.User(full_name=DEMO_CAREGIVER["name"], email=DEMO_CAREGIVER["email"], password_hash=hash_password(DEMO_CAREGIVER["password"]), role="caregiver")
        db.add(user)
        db.flush()
    link = db.query(models.CaregiverLink).filter_by(episode_id=episode.id, caregiver_user_id=user.id).first()
    if link is None:
        db.add(models.CaregiverLink(
            episode_id=episode.id, patient_user_id=woman.id, caregiver_user_id=user.id, display_name=DEMO_CAREGIVER["display_name"],
            relationship=DEMO_CAREGIVER["relationship"], permissions=clean_permissions({k: True for k in ("appointments", "check_in", "care_plan", "questions", "emergency")}),
            status="ACTIVE", accepted_at=datetime.now(timezone.utc),
        ))
    elif link.status == "ACTIVE" and link.accepted_at is None:
        link.accepted_at = link.created_at or datetime.now(timezone.utc)  # a demo link made before this date was recorded
    db.commit()
