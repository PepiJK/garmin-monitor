"""Unit tests for the /api/healthz endpoint and application configuration."""

from pathlib import Path

from fastapi.testclient import TestClient

from garmin_monitor.config import Settings, get_settings
from garmin_monitor.main import app, create_app


def test_healthz_returns_ok() -> None:
    """GET /api/healthz returns HTTP 200 with {'status': 'ok'}."""
    client = TestClient(app)
    response = client.get("/api/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_settings_defaults_and_timezone() -> None:
    """Settings provides expected defaults and resolves Europe/Vienna ZoneInfo."""
    custom_settings = Settings(
        GARMIN_EMAIL="runner@example.com",
        GARMIN_TOKEN_DIR=Path("/tmp/tokens"),
        DATABASE_PATH=Path("/tmp/garmin.db"),
        TZ="Europe/Vienna",
    )
    assert custom_settings.garmin_email == "runner@example.com"
    assert custom_settings.timezone.key == "Europe/Vienna"
    assert custom_settings.sync_interval_hours == 2.0
    assert custom_settings.sync_backfill_days == 90

    default_settings = get_settings()
    test_app = create_app(default_settings)
    assert test_app.state.settings.tz == default_settings.tz
