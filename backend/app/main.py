from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models
from .database import Base, SessionLocal, engine
from .migrations import run_additive_migrations
from .routers import auth, care_team_portal, doctor_portal, episodes, external_simulator, patient_portal, patients, records, workflow
from .seed_data import run_seed
from .seed_role_data import ensure_patient_portal_demo_data, run_seed_role_data

Base.metadata.create_all(bind=engine)
run_additive_migrations(engine)

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


@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        run_seed(db)
        run_seed_role_data(db)
        ensure_patient_portal_demo_data(db)
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok"}
