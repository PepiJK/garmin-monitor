"""Unit tests for SyncCoordinator and FastAPI structured concurrency lifespan."""

import asyncio
from pathlib import Path

from fastapi.testclient import TestClient

from garmin_monitor.config import Settings
from garmin_monitor.main import create_app
from garmin_monitor.scheduler import SyncCoordinator
from garmin_monitor.sync_service import SyncResult


class FakeSyncService:
    """Fake SyncService recording requested days."""

    def __init__(self, settings: Settings, calls: list[int | None]) -> None:
        self.settings = settings
        self.calls = calls

    def sync(self, *, days: int | None = None) -> SyncResult:
        self.calls.append(days)
        return SyncResult(
            run_id=len(self.calls),
            days_synced=days or 90,
            activities_synced=3,
            health_days_synced=days or 90,
            start_date="2026-11-01",
            end_date="2026-11-02",
        )


async def test_sync_coordinator_lock_and_periodic_loop(tmp_path: Path) -> None:
    """SyncCoordinator runs initial backfill on empty DB and stops cleanly on stop_event."""
    settings = Settings(
        DATABASE_PATH=tmp_path / "garmin.db",
        GARMIN_TOKEN_DIR=tmp_path / "tokens",
        SYNC_BACKFILL_DAYS=90,
        SYNC_INTERVAL_HOURS=0.001,
    )
    calls: list[int | None] = []
    coordinator = SyncCoordinator(
        settings,
        sync_factory=lambda s: FakeSyncService(s, calls),  # type: ignore[arg-type,return-value]
    )

    stop_event = asyncio.Event()
    async with asyncio.TaskGroup() as tg:
        tg.create_task(coordinator.run_periodic_loop(stop_event))
        await asyncio.sleep(0.05)
        stop_event.set()

    assert 90 in calls


def test_app_lifespan_with_scheduler_enabled_and_status_routes(tmp_path: Path) -> None:
    """FastAPI lifespan starts/stops the background TaskGroup and serves /api/status & /api/sync."""
    settings = Settings(
        DATABASE_PATH=tmp_path / "garmin.db",
        GARMIN_TOKEN_DIR=tmp_path / "tokens",
        ENABLE_SCHEDULER=True,
        SYNC_BACKFILL_DAYS=14,
    )
    calls: list[int | None] = []
    coordinator = SyncCoordinator(
        settings,
        sync_factory=lambda s: FakeSyncService(s, calls),  # type: ignore[arg-type,return-value]
    )
    app = create_app(settings=settings, coordinator=coordinator)

    with TestClient(app) as client:
        status_resp = client.get("/api/status")
        assert status_resp.status_code == 200
        assert status_resp.json()["timezone"] == "Europe/Vienna"

        sync_resp = client.post("/api/sync", json={"days": 5})
        assert sync_resp.status_code == 200
        assert sync_resp.json()["days_synced"] == 5
        assert 5 in calls
