"""SQLite WAL storage layer and schema management for Garmin Monitor."""

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

type SyncRunStatus = Literal["running", "success", "error"]
type RowDict = dict[str, Any]

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS activities (
    activity_id INTEGER PRIMARY KEY,
    activity_name TEXT NOT NULL,
    sport_type TEXT NOT NULL,
    start_time_local TEXT NOT NULL,
    date_local TEXT NOT NULL,
    duration_sec REAL NOT NULL DEFAULT 0.0,
    distance_m REAL NOT NULL DEFAULT 0.0,
    avg_hr INTEGER,
    max_hr INTEGER,
    avg_speed_mps REAL,
    calories INTEGER,
    elevation_gain_m REAL,
    aerobic_te REAL,
    anaerobic_te REAL,
    training_load REAL,
    associated_workout_id INTEGER,
    raw_json TEXT NOT NULL,
    synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activities_date_local ON activities(date_local);
CREATE INDEX IF NOT EXISTS idx_activities_sport_type ON activities(sport_type);
CREATE INDEX IF NOT EXISTS idx_activities_workout_id ON activities(associated_workout_id);

CREATE TABLE IF NOT EXISTS daily_health (
    date TEXT PRIMARY KEY,
    sleep_score INTEGER,
    sleep_qualifier TEXT,
    sleep_total_sec INTEGER,
    sleep_deep_sec INTEGER,
    sleep_light_sec INTEGER,
    sleep_rem_sec INTEGER,
    sleep_awake_sec INTEGER,
    hrv_nightly_avg REAL,
    hrv_weekly_avg REAL,
    hrv_baseline_low REAL,
    hrv_baseline_high REAL,
    hrv_status TEXT,
    resting_hr INTEGER,
    min_hr INTEGER,
    max_hr INTEGER,
    stress_avg INTEGER,
    stress_max INTEGER,
    body_battery_high INTEGER,
    body_battery_low INTEGER,
    spo2_avg REAL,
    spo2_low REAL,
    respiration_avg REAL,
    steps INTEGER,
    training_readiness_score INTEGER,
    training_readiness_level TEXT,
    raw_json TEXT NOT NULL,
    synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL,
    days_requested INTEGER NOT NULL,
    activities_synced INTEGER NOT NULL DEFAULT 0,
    health_days_synced INTEGER NOT NULL DEFAULT 0,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS training_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    notes TEXT,
    raw_yaml TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
    date TEXT NOT NULL UNIQUE,
    sport_type TEXT NOT NULL,
    workout_title TEXT NOT NULL,
    focus TEXT,
    goal_km REAL,
    goal_duration_min REAL,
    hr_goal_label TEXT,
    hr_min INTEGER,
    hr_max INTEGER,
    steps_json TEXT NOT NULL DEFAULT '[]',
    garmin_workout_id INTEGER,
    garmin_schedule_id INTEGER,
    actual_km REAL,
    actual_duration_min REAL,
    actual_avg_hr INTEGER,
    actual_max_hr INTEGER,
    actual_pace_min_per_km TEXT,
    actual_cadence_spm INTEGER,
    actual_stride_m REAL,
    actual_power_w INTEGER,
    actual_training_load REAL,
    actual_aerobic_te REAL,
    actual_anaerobic_te REAL,
    actual_calories INTEGER,
    rpe INTEGER,
    notes TEXT,
    matched_activity_ids TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending',
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plan_days_plan_id ON plan_days(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_days_date ON plan_days(date);

CREATE TABLE IF NOT EXISTS stammdaten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    parameter TEXT NOT NULL,
    value TEXT NOT NULL,
    unit_or_range TEXT,
    reference_note TEXT,
    updated_at TEXT NOT NULL
);
"""


def _configure_connection(conn: sqlite3.Connection) -> None:
    """Apply SQLite WAL, busy timeout, and foreign key pragmas."""
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    conn.execute("PRAGMA foreign_keys=ON;")


@contextmanager
def connect_db(db_path: Path | str) -> Iterator[sqlite3.Connection]:
    """Open a WAL-enabled SQLite connection with transaction context management."""
    resolved = Path(db_path)
    resolved.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(resolved), timeout=5.0)
    try:
        _configure_connection(conn)
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(db_path: Path | str) -> None:
    """Idempotently initialize all database tables, indexes, and column migrations."""
    with connect_db(db_path) as conn:
        conn.executescript(SCHEMA_SQL)
        existing_cols = {
            str(row["name"]) for row in conn.execute("PRAGMA table_info(plan_days)").fetchall()
        }
        migrations: list[tuple[str, str]] = [
            ("actual_pace_min_per_km", "TEXT"),
            ("actual_cadence_spm", "INTEGER"),
            ("actual_stride_m", "REAL"),
            ("actual_power_w", "INTEGER"),
            ("actual_training_load", "REAL"),
            ("actual_aerobic_te", "REAL"),
            ("actual_anaerobic_te", "REAL"),
            ("actual_calories", "INTEGER"),
            ("rpe", "INTEGER"),
            ("notes", "TEXT"),
        ]
        for col_name, col_type in migrations:
            if col_name not in existing_cols:
                conn.execute(f"ALTER TABLE plan_days ADD COLUMN {col_name} {col_type}")


def is_database_empty(conn: sqlite3.Connection) -> bool:
    """Return True if neither activities nor daily_health contains any rows."""
    act_count = int(conn.execute("SELECT COUNT(*) FROM activities").fetchone()[0])
    health_count = int(conn.execute("SELECT COUNT(*) FROM daily_health").fetchone()[0])
    return act_count == 0 and health_count == 0


def start_sync_run(
    conn: sqlite3.Connection,
    days_requested: int,
    started_at: str | None = None,
) -> int:
    """Insert a new 'running' sync_runs log entry and return its row id."""
    ts = started_at or datetime.now(UTC).isoformat()
    cursor = conn.execute(
        """
        INSERT INTO sync_runs (started_at, status, days_requested)
        VALUES (?, 'running', ?)
        """,
        (ts, days_requested),
    )
    conn.commit()
    return int(cursor.lastrowid or 0)


def finish_sync_run(
    conn: sqlite3.Connection,
    run_id: int,
    *,
    status: SyncRunStatus,
    activities_synced: int = 0,
    health_days_synced: int = 0,
    error_message: str | None = None,
    finished_at: str | None = None,
) -> None:
    """Update a sync_runs entry upon completion or failure."""
    ts = finished_at or datetime.now(UTC).isoformat()
    conn.execute(
        """
        UPDATE sync_runs
        SET finished_at = ?,
            status = ?,
            activities_synced = ?,
            health_days_synced = ?,
            error_message = ?
        WHERE id = ?
        """,
        (ts, status, activities_synced, health_days_synced, error_message, run_id),
    )
    conn.commit()


def get_latest_sync_run(conn: sqlite3.Connection) -> RowDict | None:
    """Return the most recent sync_runs row as a dictionary, or None."""
    row = conn.execute("SELECT * FROM sync_runs ORDER BY id DESC LIMIT 1").fetchone()
    return dict(row) if row is not None else None
