from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models
from .database import Base, SessionLocal, engine
from .routers import auth, patients, records, workflow
from .seed_data import run_seed

Base.metadata.create_all(bind=engine)

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


@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        run_seed(db)
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok"}
