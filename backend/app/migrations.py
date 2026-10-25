"""Tiny additive-column migration helper.

This project intentionally has no Alembic (kept dependency-light). SQLite
can't alter existing tables via create_all(), so when a model gains a new
nullable column on an already-existing table, register it here and it will
be added automatically on startup if missing. Only ever used for additive,
nullable columns — never for drops/renames/constraint changes.
"""

from sqlalchemy import text
from sqlalchemy.engine import Engine

ADDITIVE_COLUMNS = {
    "users": [
        ("title", "VARCHAR"),
    ],
    "referrals": [
        ("reference_code", "VARCHAR"),
        ("destination", "VARCHAR"),
        ("sent_at", "DATETIME"),
        ("sent_by_user_id", "VARCHAR"),
        ("acknowledged_at", "DATETIME"),
        ("acknowledged_source", "VARCHAR"),
        ("appointment_date", "VARCHAR"),
        ("appointment_time", "VARCHAR"),
        ("external_provider", "VARCHAR"),
        ("appointment_recorded_source", "VARCHAR"),
        ("response_text", "TEXT"),
        ("response_received_at", "DATETIME"),
        ("response_source", "VARCHAR"),
        ("doctor_reviewed_at", "DATETIME"),
        ("doctor_reviewed_by_user_id", "VARCHAR"),
    ],
    "referral_events": [
        ("actor_source", "VARCHAR"),
    ],
    "tasks": [
        ("waiting_for", "VARCHAR"),
        ("waiting_since", "DATETIME"),
        ("auto_generated", "BOOLEAN"),
        ("last_reminder_sent_at", "DATETIME"),
    ],
    "medical_documents": [
        ("referral_id", "VARCHAR"),
    ],
    "journey_events": [
        ("actor_label", "VARCHAR"),
    ],
    "communications": [
        ("related_referral_id", "VARCHAR"),
        ("type", "VARCHAR"),
        ("sender_label", "VARCHAR"),
        ("recipient_label", "VARCHAR"),
        ("subject", "VARCHAR"),
        ("source", "VARCHAR"),
        ("external_reference", "VARCHAR"),
        ("received_at", "DATETIME"),
    ],
    "handovers": [
        ("version", "INTEGER"),
        ("superseded_by_id", "VARCHAR"),
        ("updated_at", "DATETIME"),
    ],
    "daily_logs": [
        ("entered_with_help", "VARCHAR"),
    ],
    "ai_actions": [
        ("executed_by_user_id", "VARCHAR"),
        ("undo", "JSON"),
        ("undone_at", "DATETIME"),
        ("undone_by_user_id", "VARCHAR"),
        ("undo_note", "VARCHAR"),
    ],
    "notifications": [
        ("message_key", "VARCHAR"),
        ("message_params", "JSON"),
    ],
    "outreach_messages": [
        ("provider", "VARCHAR"),
        ("sent_at", "DATETIME"),
        ("delivered_at", "DATETIME"),
        ("read_at", "DATETIME"),
        ("failed_reason", "VARCHAR"),
    ],
}


def run_additive_migrations(engine: Engine) -> None:
    with engine.connect() as conn:
        for table, columns in ADDITIVE_COLUMNS.items():
            existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
            for col_name, col_type in columns:
                if col_name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                    print(f"[migrations] added {table}.{col_name}")


def backfill_handover_versions(engine: Engine) -> None:
    """One-time, idempotent fix for the pre-existing bug where every
    'Regenerate' click inserted a new Handover row with no version link,
    silently orphaning the previous one. Reconstructs version numbers from
    created_at order and marks every non-final row but the last SUPERSEDED,
    without deleting or touching any already-FINAL (shared) row. No-ops
    once every row has a version (checked via a single COUNT query)."""
    from sqlalchemy.orm import Session

    from . import models

    with Session(engine) as db:
        if db.query(models.Handover).filter(models.Handover.version.is_(None)).count() == 0:
            return
        episode_ids = [row[0] for row in db.query(models.Handover.episode_id).distinct()]
        for episode_id in episode_ids:
            rows = (
                db.query(models.Handover)
                .filter(models.Handover.episode_id == episode_id)
                .order_by(models.Handover.created_at.asc())
                .all()
            )
            for i, row in enumerate(rows):
                row.version = i + 1
                if i < len(rows) - 1 and row.status == "DRAFT":
                    row.status = "SUPERSEDED"
                    row.superseded_by_id = rows[i + 1].id
                if row.updated_at is None:
                    row.updated_at = row.created_at
        db.commit()
        print(f"[migrations] backfilled handover versions for {len(episode_ids)} episode(s)")
