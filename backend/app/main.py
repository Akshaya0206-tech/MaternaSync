import logging

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
from .routers import assistant, caregiver, continuity, clinical_library, companion, emergency as emergency_router, references, whatsapp_webhook
from .seed_continuity import ensure_demo_locations, remove_withdrawn_features, run_seed_continuity
from .seed_assistant import ensure_assistant_user, ensure_demo_caregiver
from .ai_coordinator import orchestrator
from . import config
from .config import DEMO_ENABLED
from .reference_library import sync_reference_library
from .seed_role_data import ensure_additional_demo_accounts, ensure_patient_portal_demo_data, run_seed_role_data

Base.metadata.create_all(bind=engine)
run_additive_migrations(engine)
backfill_handover_versions(engine)

app = FastAPI(title="MaternaSync API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_origin_regex=config.CORS_ORIGIN_REGEX,
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
app.include_router(references.router)
app.include_router(emergency_router.router)
app.include_router(companion.router)
app.include_router(whatsapp_webhook.router)
app.include_router(clinical_guidelines.router)
app.include_router(assistant.router)
app.include_router(caregiver.patient_router)
app.include_router(caregiver.router)


scheduler = BackgroundScheduler()


def _run_reminder_sweep() -> None:
    db = SessionLocal()
    try:
        check_reminders(db)
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    if config.JWT_SECRET_IS_DEFAULT:
        logging.getLogger("uvicorn.error").warning("MATERNASYNC_JWT_SECRET is not set, so the built-in development secret signs every sign-in. Set it before any real deployment.")
    db = SessionLocal()
    try:
        if DEMO_ENABLED:
            run_seed(db)
            run_seed_role_data(db)
            ensure_patient_portal_demo_data(db)
            ensure_additional_demo_accounts(db)
            run_seed_continuity(db)
            ensure_demo_locations(db)
            ensure_demo_caregiver(db)
        # Real reference documents belong to every deployment, not only the demo.
        sync_reference_library(db)
        remove_withdrawn_features(db)  # drug-safety lists and blood-pressure/weight rules are no longer used anywhere
        ensure_assistant_user(db)  # the care assistant's own account: it can never sign in, it only owns what it records
    finally:
        db.close()

    # Reminders are Level-1 safe automation (internal notifications only,
    # never changes clinical/referral state) — see app/reminders.py.
    # Runs every 5 minutes; Task.last_reminder_sent_at keeps it from
    # spamming the same task on every tick.
    scheduler.add_job(_run_reminder_sweep, "interval", minutes=5, id="reminder_sweep")
    # The care assistant (see app/ai_coordinator). Jobs are queued inside the request that caused them and run here, so a slow
    # model can never hold up an upload or a question. Switched off with MATERNASYNC_AI_COORDINATOR=off or MATERNASYNC_AI_WORKER=off.
    if config.AI_WORKER and config.AI_COORDINATOR_MODE != "off":
        scheduler.add_job(orchestrator.process_queue, "interval", seconds=5, id="assistant_queue", max_instances=1, coalesce=True)
        scheduler.add_job(orchestrator.run_sweeps, "interval", minutes=30, id="assistant_sweeps", max_instances=1, coalesce=True)
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
