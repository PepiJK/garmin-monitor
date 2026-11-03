"""Unit tests for the SQLite WAL database storage layer."""

from pathlib import Path

import pytest

from garmin_monitor.db import (
    connect_db,
    finish_sync_run,
    get_latest_sync_run,
    init_db,
    is_database_empty,
    start_sync_run,
)


def test_init_db_sets_wal_mode_and_creates_tables(tmp_path: Path) -> None:
    """SQLite initializes in WAL mode with activities, daily_health, and sync_runs tables."""
    db_file = tmp_path / "subdir" / "garmin.db"
    init_db(db_file)
    # Re-running init_db is idempotent
    init_db(db_file)

    with connect_db(db_file) as conn:
        journal_mode = str(conn.execute("PRAGMA journal_mode;").fetchone()[0]).lower()
        assert journal_mode == "wal"

        foreign_keys = int(conn.execute("PRAGMA foreign_keys;").fetchone()[0])
        assert foreign_keys == 1

        tables = {
            str(row[0])
            for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        }
        assert {"activities", "daily_health", "sync_runs"}.issubset(tables)
        assert is_database_empty(conn) is True


def test_connect_db_rolls_back_on_exception(tmp_path: Path) -> None:
    """Transactions roll back cleanly if an exception escapes connect_db."""
    db_file = tmp_path / "garmin.db"
    init_db(db_file)

    with pytest.raises(RuntimeError, match="simulated failure"):
        with connect_db(db_file) as conn:
            conn.execute(
                """
                INSERT INTO daily_health (date, raw_json, synced_at)
                VALUES ('2026-11-01', '{}', '2026-11-01T08:00:00Z')
                """
            )
            raise RuntimeError("simulated failure")

    with connect_db(db_file) as conn:
        assert is_database_empty(conn) is True


def test_sync_run_lifecycle_tracking(tmp_path: Path) -> None:
    """start_sync_run, finish_sync_run, and get_latest_sync_run record execution metadata."""
    db_file = tmp_path / "garmin.db"
    init_db(db_file)

    with connect_db(db_file) as conn:
        assert get_latest_sync_run(conn) is None

        run_id = start_sync_run(conn, days_requested=90, started_at="2026-11-02T07:00:00Z")
        latest_running = get_latest_sync_run(conn)
        assert latest_running is not None
        assert latest_running["id"] == run_id
        assert latest_running["status"] == "running"
        assert latest_running["days_requested"] == 90

        finish_sync_run(
            conn,
            run_id,
            status="success",
            activities_synced=14,
            health_days_synced=90,
            finished_at="2026-11-02T07:01:00Z",
        )
        latest_done = get_latest_sync_run(conn)
        assert latest_done is not None
        assert latest_done["status"] == "success"
        assert latest_done["activities_synced"] == 14
        assert latest_done["health_days_synced"] == 90
        assert latest_done["finished_at"] == "2026-11-02T07:01:00Z"
