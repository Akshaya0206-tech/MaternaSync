from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from pydantic import Field

from .. import caregiver_service, config, models, schemas
from ..database import get_db
from ..deps import get_current_user, refuse_sign_in
from ..security import create_access_token, hash_password, verify_password
from .emergency import EmergencyIn, resolve_home, write_profile

router = APIRouter(prefix="/api/auth", tags=["auth"])

VALID_ROLES = {"patient", "doctor", "caregiver", "nurse", "care_coordinator", "other"}
STAFF_ROLES = {"nurse", "care_coordinator", "other"}  # these sign in to the older single-clinician app; closed while the care-team login is off
SIGN_UP_ROLES = [("patient", "Patient"), ("doctor", "Doctor"), ("caregiver", "Family member or trusted person"),
                 ("nurse", "Nurse"), ("care_coordinator", "Care Coordinator"), ("other", "Other Care Team Member")]


class RegisterIn(schemas.RegisterRequest):
    # Where a patient lives, and who to call in an emergency. Only used for patients.
    emergency: EmergencyIn | None = None
    # A caregiver can only join with the invite code a woman made for them.
    invite_code: str | None = Field(None, max_length=40)


class RegisterOut(schemas.TokenResponse):
    # For a patient: whether a position for the home was found (False: an area the map could not find).
    location_found: bool | None = None


@router.get("/options")
def options():
    """What the sign-up page offers. Staff roles disappear while the care-team login is switched off."""
    roles = [{"value": value, "label": label} for value, label in SIGN_UP_ROLES if config.CARE_TEAM_ENABLED or value not in STAFF_ROLES]
    return {"careTeamEnabled": config.CARE_TEAM_ENABLED, "signUpRoles": roles}


@router.get("/demo-accounts")
def demo_accounts(db: Session = Depends(get_db)):
    from ..config import DEMO_ENABLED
    from ..seed_assistant import DEMO_CAREGIVER
    from ..seed_role_data import PASSWORDS
    if not DEMO_ENABLED:
        return []
    accounts = []
    listed = [("sarah.jenkins@maternasync.app", "Patient"), ("demo@maternasync.app", "Doctor")]
    if config.CARE_TEAM_ENABLED:
        listed.insert(1, ("brenda.miller@maternasync.app", "Care Team"))
    for email, label in listed:
        user = db.query(models.User).filter_by(email=email).first()
        if user:
            accounts.append({"label": label, "role": user.role, "name": user.full_name, "email": email, "password": PASSWORDS[email]})
    caregiver = db.query(models.User).filter_by(email=DEMO_CAREGIVER["email"]).first()
    if caregiver:
        accounts.append({"label": "Caregiver", "role": caregiver.role, "name": caregiver.full_name, "email": caregiver.email, "password": DEMO_CAREGIVER["password"]})
    return accounts


@router.post("/register", response_model=RegisterOut)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    role = payload.role if payload.role in VALID_ROLES else "other"
    if role in STAFF_ROLES and not config.CARE_TEAM_ENABLED:
        raise HTTPException(status_code=400, detail="That role is not available at the moment.")

    existing = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    link = caregiver_service.find_open_invite(db, payload.invite_code) if role == "caregiver" else None  # checked before anything is created

    home = None
    if role == "patient":
        given = payload.emergency
        if not given or not (given.home_label or (given.home_lat is not None and given.home_lon is not None)):
            raise HTTPException(status_code=400, detail="Please tell us where you live: your area or city, or use your current location.")
        home = given.model_dump()
        resolve_home(home)  # may look the area up on the map; done before anything is written, and never blocks sign-up

    user = models.User(
        full_name=payload.full_name.strip(),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=role,
    )
    db.add(user)
    if home is not None:
        db.flush()
        write_profile(db, user.id, home)  # the account and its location are saved together, or not at all
    if link is not None:
        db.flush()
        caregiver_service.accept_invite(db, link, user)  # the account and the link to her are saved together, or not at all
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return RegisterOut(
        access_token=token,
        user=schemas.UserOut.model_validate(user),
        location_found=None if home is None else home["home_lat"] is not None,
    )


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    refuse_sign_in(user)  # a care-team account while that login is switched off, or the assistant's service account

    token = create_access_token(user.id)
    return schemas.TokenResponse(access_token=token, user=schemas.UserOut.model_validate(user))


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return schemas.UserOut.model_validate(current_user)
