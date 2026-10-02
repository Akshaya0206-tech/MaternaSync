from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import models
from .database import get_db
from .security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise unauthorized

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise unauthorized

    return user


def require_role(*roles: str):
    """Dependency factory: 403s unless current_user.role is one of `roles`.
    Role is re-read from the DB via get_current_user on every call — never
    trust a role claim embedded in the JWT alone."""

    def _dependency(current_user: models.User = Depends(get_current_user)) -> models.User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )
        return current_user

    return _dependency


def require_episode_access(
    episode_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> models.PregnancyEpisode:
    """The single choke point for all episode-scoped data access. FastAPI
    binds `episode_id` from the `{episode_id}` path segment of whatever
    route uses this as a dependency — so every protected route re-verifies
    access server-side on every request, regardless of what the frontend
    sends or which URL was typed in."""
    episode = db.query(models.PregnancyEpisode).filter(models.PregnancyEpisode.id == episode_id).first()
    if episode is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Episode not found.")

    if current_user.role == "patient":
        allowed = episode.patient_user_id == current_user.id
    elif current_user.role == "doctor":
        allowed = db.query(models.PatientDoctorAssignment).filter(
            models.PatientDoctorAssignment.episode_id == episode_id,
            models.PatientDoctorAssignment.doctor_user_id == current_user.id,
        ).first() is not None
    elif current_user.role == "care_team":
        allowed = db.query(models.PatientCareTeamAssignment).filter(
            models.PatientCareTeamAssignment.episode_id == episode_id,
            models.PatientCareTeamAssignment.care_team_user_id == current_user.id,
        ).first() is not None
    else:
        allowed = False

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this patient's data.",
        )

    return episode


def get_my_patient_episode(
    current_user: models.User = Depends(require_role("patient")),
    db: Session = Depends(get_db),
) -> models.PregnancyEpisode:
    """Patient-portal equivalent of require_episode_access, but stronger:
    there is no episode_id to trust or tamper with at all. The episode is
    always resolved server-side from the caller's own user id, so there is
    no URL/body parameter a patient could change to reach another
    patient's episode."""
    episode = (
        db.query(models.PregnancyEpisode)
        .filter(models.PregnancyEpisode.patient_user_id == current_user.id)
        .order_by(models.PregnancyEpisode.created_at.desc())
        .first()
    )
    if episode is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pregnancy episode was found for your account.",
        )
    return episode
