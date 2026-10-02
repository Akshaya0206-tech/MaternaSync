"""New role-based system's episode endpoints. Namespaced under /api/v2 to
stay cleanly separate from the legacy /api/patients routes while both
systems run side by side during the migration.

This file exists in Step 2 specifically to prove the RBAC mechanism
(require_episode_access) end-to-end against real seeded data before the
full role workspaces are built in later steps.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas_v2
from ..database import get_db
from ..deps import get_current_user, require_episode_access

router = APIRouter(prefix="/api/v2/episodes", tags=["episodes"])


@router.get("", response_model=list[schemas_v2.EpisodeSummaryOut])
def list_my_episodes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Role-filtered: a patient sees their own episode(s); a doctor or
    care-team member sees only episodes they're formally assigned to."""
    if current_user.role == "patient":
        episodes = db.query(models.PregnancyEpisode).filter(
            models.PregnancyEpisode.patient_user_id == current_user.id
        ).all()
    elif current_user.role == "doctor":
        episodes = (
            db.query(models.PregnancyEpisode)
            .join(models.PatientDoctorAssignment, models.PatientDoctorAssignment.episode_id == models.PregnancyEpisode.id)
            .filter(models.PatientDoctorAssignment.doctor_user_id == current_user.id)
            .all()
        )
    elif current_user.role == "care_team":
        episodes = (
            db.query(models.PregnancyEpisode)
            .join(models.PatientCareTeamAssignment, models.PatientCareTeamAssignment.episode_id == models.PregnancyEpisode.id)
            .filter(models.PatientCareTeamAssignment.care_team_user_id == current_user.id)
            .all()
        )
    else:
        episodes = []

    return [schemas_v2.EpisodeSummaryOut.model_validate(e) for e in episodes]


@router.get("/{episode_id}", response_model=schemas_v2.EpisodeOut)
def get_episode(episode: models.PregnancyEpisode = Depends(require_episode_access)):
    """Single choke-point authorization: require_episode_access 404s if the
    episode doesn't exist, 403s if the caller isn't the owning patient or a
    formally assigned doctor/care-team member — enforced server-side on
    every request, independent of anything the frontend sends."""
    return schemas_v2.EpisodeOut.model_validate(episode)
