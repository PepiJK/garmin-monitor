"""Unit tests for SyncService, timestamp normalization, and idempotent upserts."""

from datetime import date
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import pytest

from garmin_monitor.config import Settings
from garmin_monitor.db import connect_db, get_latest_sync_run
from garmin_monitor.sync_service import (
    SyncService,
    normalize_sport_type,
    normalize_timestamp_to_tz,
)


class StubGarminClient:
    """Deterministic stub GarminClient returning realistic Fenix 7S payloads."""

    def __init__(self, fail: bool = False) -> None:
        self.fail = fail
        self.session_loaded = False

    def load_session(self) -> None:
        if self.fail:
            raise RuntimeError("Token load failure")
        self.session_loaded = True

    def fetch_activities_by_date(self, start_date: date, end_date: date) -> list[dict[str, Any]]:
        return [
            {
                "activityId": 9001,
                "activityName": "Vienna Canal Tempo",
                "activityType": {"typeKey": "running"},
                "startTimeGMT": "2026-11-01 23:30:00",
                "startTimeLocal": "2026-11-02 00:30:00",
                "duration": 2700.0,
                "distance": 9250.0,
                "averageHR": 152,
                "maxHR": 171,
                "averageSpeed": 3.426,
                "calories": 610,
                "elevationGain": 42.0,
                "aerobicTrainingEffect": 3.6,
                "anaerobicTrainingEffect": 1.2,
                "activityTrainingLoad": 118.5,
                "associatedWorkoutId": 4444,
            },
            {
                "activityId": 9002,
                "activityName": "Kettlebell & Core",
                "activityType": {"typeKey": "strength_training"},
                "startTimeLocal": "2026-11-02T17:15:00",
                "duration": 2400.0,
                "distance": 0.0,
                "averageHR": 124,
                "maxHR": 148,
                "calories": 320,
            },
        ]

    def fetch_daily_health_bundle(self, target_date: date) -> dict[str, Any]:
        return {
            "date": target_date.isoformat(),
            "user_summary": {
                "totalSteps": 12450,
                "bodyBatteryHighestValue": 86,
                "bodyBatteryLowestValue": 29,
                "restingHeartRate": 47,
            },
            "sleep": {
                "dailySleepDTO": {
                    "sleepTimeSeconds": 27900,
                    "deepSleepSeconds": 5400,
                    "lightSleepSeconds": 16200,
                    "remSleepSeconds": 6300,
                    "awakeSleepSeconds": 900,
                    "sleepScores": {"overall": {"value": 84, "qualifierKey": "GOOD"}},
                }
            },
            "hrv": {
                "hrvSummary": {
                    "lastNightAvg": 62.0,
                    "weeklyAvg": 60.0,
                    "status": "BALANCED",
                    "baseline": {"balancedLow": 54.0, "balancedUpper": 68.0},
                }
            },
            "heart_rates": {"restingHeartRate": 47, "minHeartRate": 44, "maxHeartRate": 171},
            "stress": {"avgStressLevel": 26, "maxStressLevel": 78},
            "body_battery": [{"charged": 86, "drained": 29}],
            "spo2": {"averageSpO2": 96.5, "lowestSpO2": 92.0},
            "respiration": {"avgWakingRespirationValue": 14.2},
            "training_readiness": [{"score": 77, "level": "HIGH"}],
        }


def test_normalize_sport_and_timestamps() -> None:
    """Sport keys and timestamps normalize accurately to Europe/Vienna."""
    vienna = ZoneInfo("Europe/Vienna")
    assert normalize_sport_type("trail_running") == "running"
    assert normalize_sport_type("strength_training") == "strength_training"
    assert normalize_sport_type("cycling") == "cycling"
    assert normalize_sport_type(None) == "other"

    # 2026-11-01 23:30:00 UTC is 2026-11-02 00:30:00+01:00 in Europe/Vienna
    iso_ts, local_day = normalize_timestamp_to_tz("2026-11-01 23:30:00", None, vienna)
    assert local_day == "2026-11-02"
    assert iso_ts.startswith("2026-11-02T00:30:00+01:00")

    iso_fallback, day_fallback = normalize_timestamp_to_tz(None, "2026-11-02 18:00:00", vienna)
    assert day_fallback == "2026-11-02"
    assert "18:00:00" in iso_fallback


def test_sync_service_idempotent_backfill_and_incremental(tmp_path: Path) -> None:
    """Syncing populates activities and daily_health idempotently without duplicate rows."""
    db_path = tmp_path / "garmin.db"
    settings = Settings(
        DATABASE_PATH=db_path,
        GARMIN_TOKEN_DIR=tmp_path / "tokens",
        SYNC_BACKFILL_DAYS=3,
        TZ="Europe/Vienna",
    )
    hook_calls: list[date] = []
    stub_client = StubGarminClient()
    service = SyncService(
        settings,
        client=stub_client,  # type: ignore[arg-type]
        post_sync_hook=lambda _conn, d: hook_calls.append(d),
    )

    # First run on empty DB uses backfill_days (3)
    res1 = service.sync(reference_date=date(2026, 11, 2))
    assert res1.days_synced == 3
    assert res1.activities_synced == 2
    assert res1.health_days_synced == 3
    assert hook_calls == [date(2026, 11, 2)]

    # Second run on populated DB defaults to 2 days (today + yesterday) and produces zero duplicates
    res2 = service.sync(reference_date=date(2026, 11, 2))
    assert res2.days_synced == 2
    assert res2.activities_synced == 2
    assert res2.health_days_synced == 2

    with connect_db(db_path) as conn:
        act_rows = conn.execute("SELECT * FROM activities ORDER BY activity_id").fetchall()
        assert len(act_rows) == 2
        assert act_rows[0]["date_local"] == "2026-11-02"
        assert act_rows[0]["associated_workout_id"] == 4444
        assert act_rows[1]["sport_type"] == "strength_training"

        health_rows = conn.execute("SELECT * FROM daily_health ORDER BY date").fetchall()
        assert len(health_rows) == 3
        assert health_rows[-1]["sleep_score"] == 84
        assert health_rows[-1]["hrv_nightly_avg"] == 62.0
        assert health_rows[-1]["resting_hr"] == 47
        assert health_rows[-1]["body_battery_high"] == 86
        assert health_rows[-1]["training_readiness_score"] == 77


def test_sync_service_records_failed_run(tmp_path: Path) -> None:
    """Failed sync runs log status='error' and error_message in sync_runs."""
    db_path = tmp_path / "garmin.db"
    settings = Settings(DATABASE_PATH=db_path, GARMIN_TOKEN_DIR=tmp_path / "tokens")
    service = SyncService(
        settings,
        client=StubGarminClient(fail=True),  # type: ignore[arg-type]
    )

    with pytest.raises(RuntimeError, match="Token load failure"):
        service.sync(days=2, reference_date=date(2026, 11, 2))

    with connect_db(db_path) as conn:
        latest = get_latest_sync_run(conn)
        assert latest is not None
        assert latest["status"] == "error"
        assert "Token load failure" in str(latest["error_message"])
