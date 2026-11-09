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
                    training_readiness_score=38 if is_last else 59,
                    training_readiness_level="LOW" if is_last else "MODERATE",
                    raw_json=(
                        '{"user_summary": {"bodyBatteryChargedValue": 64, '
                        '"bodyBatteryDrainedValue": 52, "moderateIntensityMinutes": 20, '
                        '"vigorousIntensityMinutes": 30, "intensityMinutesGoal": 150, '
                        '"activeKilocalories": 540}, '
                        '"training_readiness": ['
                        '{"score": 38, "level": "LOW", '
                        '"inputContext": "AFTER_POST_EXERCISE_RESET", '
                        '"acuteLoad": 150, "recoveryTime": 720, "acwrFactorFeedback": "GOOD", '
                        '"acwrFactorPercent": 96, "feedbackShort": "RECOVERY_IN_PROGRESS"}, '
                        '{"score": 82, "level": "HIGH", "inputContext": "AFTER_WAKEUP_RESET", '
                        '"acuteLoad": 126, "recoveryTime": 324, "acwrFactorFeedback": "VERY_GOOD", '
                        '"acwrFactorPercent": 100, "feedbackShort": "WELL_RECOVERED"}'
                        "]}"
                        if is_last
                        else "{}"
                    ),
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
        assert data["kpis"]["training_readiness_score"] == 82
        assert data["kpis"]["training_readiness_level"] == "HIGH"
        assert data["kpis"]["acute_load"] == 126
        assert data["kpis"]["recovery_time_hours"] == 5.4
        assert data["kpis"]["acwr_status"] == "VERY_GOOD"
        assert data["kpis"]["acwr_percent"] == 100
        assert data["kpis"]["readiness_feedback"] == "WELL_RECOVERED"
        assert data["kpis"]["body_battery_charged"] == 64
        assert data["kpis"]["body_battery_drained"] == 52
        assert data["kpis"]["intensity_minutes"] == 80
        assert data["kpis"]["intensity_minutes_goal"] == 150

        warning_codes = {w["code"] for w in data["warnings"]}
        assert {
            "hrv_status",
            "hrv_below_baseline",
            "sleep_consecutive_low",
            "resting_hr_elevated",
            "body_battery_low",
        }.issubset(warning_codes)
