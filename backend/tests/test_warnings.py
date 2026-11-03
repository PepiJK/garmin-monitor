"""Unit tests for the health warnings evaluation engine (warnings.py)."""

from datetime import UTC, datetime, timedelta
from typing import Any

from garmin_monitor.warnings import evaluate_health_warnings


def _make_baseline_rows(count: int = 10) -> list[dict[str, Any]]:
    base_date = datetime(2026, 10, 20, tzinfo=UTC).date()
    return [
        {
            "date": (base_date + timedelta(days=i)).isoformat(),
            "sleep_score": 82,
            "sleep_qualifier": "GOOD",
            "hrv_nightly_avg": 64.0,
            "hrv_weekly_avg": 63.0,
            "hrv_baseline_low": 56.0,
            "hrv_baseline_high": 70.0,
            "hrv_status": "BALANCED",
            "resting_hr": 48,
            "body_battery_high": 85,
        }
        for i in range(count)
    ]


def test_healthy_baseline_produces_zero_warnings() -> None:
    """Healthy metrics with a fresh sync produce an empty warning list."""
    now = datetime(2026, 11, 2, 12, 0, tzinfo=UTC)
    rows = _make_baseline_rows(10)
    sync_run = {
        "status": "success",
        "finished_at": (now - timedelta(hours=1)).isoformat(),
    }
    warnings = evaluate_health_warnings(rows, sync_run, now_utc=now)
    assert warnings == []


def test_all_anomaly_triggers_and_severity_sorting() -> None:
    """Violating HRV, consecutive sleep < 60, RHR >= +5, BB < 50, and stale sync emit warnings."""
    now = datetime(2026, 11, 2, 12, 0, tzinfo=UTC)
    rows = _make_baseline_rows(12)

    # Second-to-last day: sleep_score < 60
    rows[-2]["sleep_score"] = 54
    # Latest day:
    # - HRV POOR & nightly 45 ms (< 56 ms baseline_low)
    # - Sleep score 49 (2nd consecutive night < 60)
    # - Resting HR 55 bpm (+7 bpm over 48 bpm 30-day mean)
    # - Body Battery high 42 (< 50)
    rows[-1].update(
        {
            "hrv_status": "POOR",
            "hrv_nightly_avg": 45.0,
            "hrv_baseline_low": 56.0,
            "hrv_baseline_high": 70.0,
            "sleep_score": 49,
            "sleep_qualifier": "POOR",
            "resting_hr": 55,
            "body_battery_high": 42,
        }
    )

    stale_sync = {
        "status": "success",
        "finished_at": (now - timedelta(hours=8)).isoformat(),
    }
    warnings = evaluate_health_warnings(rows, stale_sync, now_utc=now)
    codes = [w.code for w in warnings]
    assert "sync_stale" in codes
    assert "hrv_status" in codes
    assert "hrv_below_baseline" in codes
    assert "sleep_consecutive_low" in codes
    assert "resting_hr_elevated" in codes
    assert "body_battery_low" in codes

    # Verify critical warnings are sorted before warning-level items
    severities = [w.severity for w in warnings]
    first_warning_idx = severities.index("warning")
    assert all(s == "critical" for s in severities[:first_warning_idx])


def test_sync_failed_unbalanced_hrv_and_single_poor_sleep() -> None:
    """Failed sync, UNBALANCED HRV, and single-night POOR sleep emit expected codes."""
    now = datetime(2026, 11, 2, 12, 0, tzinfo=UTC)
    rows = _make_baseline_rows(5)
    rows[-1].update(
        {
            "hrv_status": "UNBALANCED",
            "hrv_nightly_avg": 58.0,
            "sleep_score": 62,
            "sleep_qualifier": "POOR",
        }
    )
    failed_sync = {
        "status": "error",
        "started_at": (now - timedelta(minutes=30)).isoformat(),
        "error_message": "429 Too Many Requests",
    }
    warnings = evaluate_health_warnings(rows, failed_sync, now_utc=now)
    by_code = {w.code: w for w in warnings}
    assert by_code["sync_failed"].severity == "critical"
    assert "429" in by_code["sync_failed"].description
    assert by_code["hrv_status"].severity == "warning"
    assert by_code["sleep_poor"].severity == "warning"

    # Never synced case
    never_warnings = evaluate_health_warnings([], None, now_utc=now)
    assert len(never_warnings) == 1
    assert never_warnings[0].code == "sync_stale"
