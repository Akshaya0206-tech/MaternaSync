"""A signed-in person's own account: change the password, sign out the other devices (any role), and, for a patient, download a copy of her data or close
her account. See account_service.py for what each one does and does not do."""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import Field
from sqlalchemy.orm import Session

from .. import account_service, models, schemas
from ..continuity_service import audit
from ..database import get_db
from ..deps import get_current_user, require_role
from ..schemas import CamelModel
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(tags=["account"])

WRONG_PASSWORD = "Your current password is not right."
WRONG_PASSWORD_TO_CLOSE = "Your password is not right."
TOO_MANY_TRIES = "Too many tries. Please wait a few minutes and try again."
NO_MATCH = "Your new password and its confirmation do not match."
TOO_SHORT = "Your new password must be at least 8 characters."
SAME_AS_OLD = "Choose a new password that is different from your current one."
DEMO_PASSWORD = "This is a demonstration account, so its password cannot be changed."
DEMO_CLOSE = "This is a demonstration account, so it cannot be closed."
NOT_CONFIRMED = "Please confirm that you want to close your account."


class ChangePasswordIn(CamelModel):
    # Not trimmed: a password may begin or end with a space.
    current_password: str = Field(max_length=200)
    new_password: str = Field(max_length=200)
    confirm_password: str = Field(max_length=200)


class CloseAccountIn(CamelModel):
    password: str = Field(max_length=200)
    understood: bool = False


def _fresh_token(user: models.User) -> schemas.TokenResponse:
    return schemas.TokenResponse(access_token=create_access_token(user.id, user.token_version), user=schemas.UserOut.model_validate(user))


def _her_episode_id(db: Session, user: models.User) -> str | None:
    episode = db.query(models.PregnancyEpisode).filter_by(patient_user_id=user.id).order_by(models.PregnancyEpisode.created_at.desc()).first()
    return episode.id if episode else None


@router.post("/api/auth/change-password", response_model=schemas.TokenResponse)
def change_password(payload: ChangePasswordIn, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Needs the current password. Every other device is signed out (the session counter goes up) and this one gets a fresh token."""
    if account_service.is_demo_account(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, DEMO_PASSWORD)
    if account_service.too_many_tries(user.id):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, TOO_MANY_TRIES)
    if not verify_password(payload.current_password, user.password_hash):
        account_service.note_failure(user.id)  # the same words whoever is asking: nothing here says more than "not right"
        raise HTTPException(status.HTTP_400_BAD_REQUEST, WRONG_PASSWORD)
    account_service.clear_failures(user.id)
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, NO_MATCH)
    if len(payload.new_password) < 8:  # the same rule as sign-up
        raise HTTPException(status.HTTP_400_BAD_REQUEST, TOO_SHORT)
    if payload.new_password == payload.current_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, SAME_AS_OLD)
    user.password_hash = hash_password(payload.new_password)
    user.token_version = (user.token_version or 0) + 1
    audit(db, user, "password_changed", user, episode_id=_her_episode_id(db, user) if user.role == "patient" else None, details="Changed the password and signed out every other device.")
    db.commit()
    db.refresh(user)
    return _fresh_token(user)


@router.post("/api/auth/sign-out-other-devices", response_model=schemas.TokenResponse)
def sign_out_other_devices(user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Raises the session counter: every token made so far stops working, and this device gets a fresh one so it stays signed in."""
    user.token_version = (user.token_version or 0) + 1
    audit(db, user, "other_devices_signed_out", user, episode_id=_her_episode_id(db, user) if user.role == "patient" else None, details="Signed out every other device.")
    db.commit()
    db.refresh(user)
    return _fresh_token(user)


@router.get("/api/v2/patient/my-data")
def download_my_data(user: models.User = Depends(require_role("patient")), db: Session = Depends(get_db)):
    """A zip of her own information (my-data.json) and the files in her records (documents/)."""
    content = account_service.build_zip(db, user)
    audit(db, user, "my_data_downloaded", user, episode_id=_her_episode_id(db, user), details="Downloaded a copy of her own data.")
    db.commit()
    return Response(content=content, media_type="application/zip",
                    headers={"Content-Disposition": 'attachment; filename="maternasync-my-data.zip"', "Cache-Control": "no-store"})


@router.post("/api/v2/patient/close-account")
def close_my_account(payload: CloseAccountIn, user: models.User = Depends(require_role("patient")), db: Session = Depends(get_db)):
    """Closes her account (see account_service.close_account). Her record is kept; her doctor is given a task about it."""
    if account_service.is_demo_account(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, DEMO_CLOSE)
    if account_service.too_many_tries(user.id):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, TOO_MANY_TRIES)
    if not verify_password(payload.password, user.password_hash):
        account_service.note_failure(user.id)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, WRONG_PASSWORD_TO_CLOSE)
    account_service.clear_failures(user.id)
    if not payload.understood:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, NOT_CONFIRMED)
    result = account_service.close_account(db, user)
    db.commit()
    return result
