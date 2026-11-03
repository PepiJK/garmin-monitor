"""Unit tests for GET /api/health/dashboard."""

from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient

from garmin_monitor.config import Settings
from garmin_monitor.db import connect_db, finish_sync_run, init_db, start_sync_run
from garmin_monitor.main import create_app
from garmin_monitor.sync_service import DailyHealthRecord, upsert_daily_health


def test_api_health_dashboard_returns_kpis_series_and_warnings(tmp_path: Path) -> None:
    """GET /api/health/dashboard?days=30 returns daily health series, KPIs, and warnings."""
    db_path = tmp_path / "garmin.db"
    settings = Settings(
        DATABASE_PATH=db_path,
        GARMIN_TOKEN_DIR=tmp_path / "tokens",
        ENABLE_SCHEDULER=False,
    )
    init_db(db_path)

    now_utc = datetime.now(UTC)
    base_day = now_utc.date() - timedelta(days=9)

    with connect_db(db_path) as conn:
        run_id = start_sync_run(conn, days_requested=10, started_at=now_utc.isoformat())
        finish_sync_run(
            conn,
            run_id,
            status="success",
            activities_synced=5,
            health_days_synced=10,
            finished_at=now_utc.isoformat(),
        )

        for i in range(10):
            day_str = (base_day + timedelta(days=i)).isoformat()
            is_last_two = i >= 8
            is_last = i == 9
            upsert_daily_health(
                conn,
                DailyHealthRecord(
                    date=day_str,
                    sleep_score=52 if is_last_two else 84,
                    sleep_qualifier="POOR" if is_last_two else "GOOD",
                    sleep_total_sec=21600 if is_last_two else 28800,
                    sleep_deep_sec=3600,
                    sleep_light_sec=12600,
                    sleep_rem_sec=5400,
                    sleep_awake_sec=600,
                    hrv_nightly_avg=44.0 if is_last else 64.0,
                    hrv_weekly_avg=58.0,
                    hrv_baseline_low=55.0,
                    hrv_baseline_high=70.0,
                    hrv_status="LOW" if is_last else "BALANCED",
                    resting_hr=56 if is_last else 48,
                    min_hr=45,
                    max_hr=165,
                    stress_avg=34,
                    stress_max=82,
                    body_battery_high=41 if is_last else 88,
                    body_battery_low=20,
                    spo2_avg=96.0,
                    spo2_low=92.0,
                    respiration_avg=14.5,
                    steps=10500,
                    training_readiness_score=38 if is_last else 80,
                    training_readiness_level="LOW" if is_last else "HIGH",
                    raw_json="{}",
                    synced_at=now_utc.isoformat(),
                ),
            )

    app = create_app(settings=settings)
    with TestClient(app) as client:
        resp = client.get("/api/health/dashboard", params={"days": 30})
        assert resp.status_code == 200
        data = resp.json()
        assert data["days_requested"] == 30
        assert len(data["series"]) == 10
        assert data["kpis"]["hrv_nightly_avg"] == 44.0
        assert data["kpis"]["sleep_score"] == 52
        assert data["kpis"]["resting_hr"] == 56
        assert data["kpis"]["body_battery_high"] == 41

        warning_codes = {w["code"] for w in data["warnings"]}
        assert {
            "hrv_status",
            "hrv_below_baseline",
            "sleep_consecutive_low",
            "resting_hr_elevated",
            "body_battery_low",
        }.issubset(warning_codes)
