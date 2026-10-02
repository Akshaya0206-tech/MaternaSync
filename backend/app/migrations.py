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
