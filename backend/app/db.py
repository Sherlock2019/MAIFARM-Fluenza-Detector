"""SQLite storage for the POC."""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path

DB_PATH = Path(os.environ.get("AIFARM_DB", Path(__file__).resolve().parent.parent / "aifarm.db"))

TEXT_COLUMNS = ["vaccination_status", "biosecurity_incident", "notes"]
NUMERIC_COLUMNS = [
    "animal_count", "feed_kg", "water_l", "avg_weight", "mortality", "activity", "cough_events",
    "temp", "humidity", "ammonia", "co2", "ventilation", "egg_production", "abnormal_eggs",
    # camera-derived
    "feeder_visits", "drinker_visits", "inactive_pct", "active_pct", "clustering", "open_beak",
    "posture_events", "balance_events", "immobile_birds",
    # audio-derived
    "distress_events", "sneeze_events", "vocal_events", "acoustic",
]
READING_FIELDS = ["source", "farm_type", "farm", "barn", "date", *NUMERIC_COLUMNS, *TEXT_COLUMNS]

SCHEMA = f"""
CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    farm_type TEXT NOT NULL,
    farm TEXT,
    barn TEXT NOT NULL,
    date TEXT NOT NULL,
    {", ".join(f"{c} REAL" for c in NUMERIC_COLUMNS)},
    {", ".join(f"{c} TEXT" for c in TEXT_COLUMNS)},
    UNIQUE (source, farm_type, barn, date)
);
CREATE TABLE IF NOT EXISTS barns (
    source TEXT NOT NULL,
    farm_type TEXT NOT NULL,
    barn TEXT NOT NULL,
    breed TEXT,
    avg_age_days INTEGER,
    biosecurity TEXT,
    last_movement TEXT,
    medication TEXT,
    PRIMARY KEY (source, farm_type, barn)
);
CREATE TABLE IF NOT EXISTS vaccinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    farm_type TEXT NOT NULL,
    barn TEXT NOT NULL,
    animals INTEGER,
    vaccine TEXT,
    last_dose TEXT,
    next_dose TEXT,
    vaccinated INTEGER,
    due INTEGER,
    overdue INTEGER,
    missing INTEGER
);
CREATE TABLE IF NOT EXISTS biosecurity_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    farm_type TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT,
    barn TEXT,
    category TEXT,
    title TEXT,
    detail TEXT,
    action TEXT,
    status TEXT,
    points INTEGER
);
"""


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)
        # Databases created by an older version of the POC may miss newer columns.
        existing = {r["name"] for r in conn.execute("PRAGMA table_info(readings)")}
        for col in NUMERIC_COLUMNS + TEXT_COLUMNS:
            if col not in existing:
                conn.execute(f"ALTER TABLE readings ADD COLUMN {col} {'TEXT' if col in TEXT_COLUMNS else 'REAL'}")


def upsert_readings(conn: sqlite3.Connection, rows: list[dict]) -> None:
    cols = ", ".join(READING_FIELDS)
    marks = ", ".join("?" for _ in READING_FIELDS)
    conn.executemany(
        f"INSERT OR REPLACE INTO readings ({cols}) VALUES ({marks})",
        [[r.get(f) for f in READING_FIELDS] for r in rows],
    )
