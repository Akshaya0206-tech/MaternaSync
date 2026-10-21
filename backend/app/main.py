from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy.orm import Session

from . import models
from .database import Base, SessionLocal, engine, get_db
from .deps import require_role
from .migrations import backfill_handover_versions, run_additive_migrations
from .reminders import check_reminders
from .routers import auth, care_team_portal, clinical_guidelines, doctor_portal, episodes, external_simulator, patient_portal, patients, records, workflow
from .seed_data import run_seed
from .routers import continuity, clinical_library
from .seed_continuity import run_seed_continuity
from .config import DEMO_ENABLED
from .seed_guidelines import ensure_demo_guideline_sources
from .seed_role_data import ensure_additional_demo_accounts, ensure_patient_portal_demo_data, run_seed_role_data

Base.metadata.create_all(bind=engine)
run_additive_migrations(engine)
backfill_handover_versions(engine)

app = FastAPI(title="MaternaSync API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(records.router)
app.include_router(workflow.router)
app.include_router(episodes.router)
app.include_router(patient_portal.router)
app.include_router(care_team_portal.router)
app.include_router(doctor_portal.router)
app.include_router(external_simulator.router)
app.include_router(continuity.router)
app.include_router(clinical_library.router)
app.include_router(clinical_guidelines.router)


scheduler = BackgroundScheduler()


def _run_reminder_sweep() -> None:
    db = SessionLocal()
    try:
        check_reminders(db)
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        if DEMO_ENABLED:
            run_seed(db)
            run_seed_role_data(db)
            ensure_patient_portal_demo_data(db)
            ensure_additional_demo_accounts(db)
            ensure_demo_guideline_sources(db)
            run_seed_continuity(db)
    finally:
        db.close()

    # Reminders are Level-1 safe automation (internal notifications only,
    # never changes clinical/referral state) — see app/reminders.py.
    # Runs every 5 minutes; Task.last_reminder_sent_at keeps it from
    # spamming the same task on every tick.
    scheduler.add_job(_run_reminder_sweep, "interval", minutes=5, id="reminder_sweep")
    scheduler.start()


@app.on_event("shutdown")
def on_shutdown():
    scheduler.shutdown(wait=False)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/v2/automation/run-reminders")
def run_reminders_now(current_user: models.User = Depends(require_role("doctor", "care_team")), db: Session = Depends(get_db)):
    """Manual trigger for the same sweep the scheduler runs automatically
    — exists so the reminder flow can be verified without waiting for the
    timer, and so a Care Team/Doctor user can force a check on demand."""
    return check_reminders(db)
