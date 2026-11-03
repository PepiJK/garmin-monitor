"""Status and manual synchronization REST endpoints (/api/status, /api/sync)."""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from garmin_monitor.config import Settings
from garmin_monitor.db import connect_db, get_latest_sync_run, init_db
from garmin_monitor.scheduler import SyncCoordinator
from garmin_monitor.sync_service import SyncResult

router = APIRouter(prefix="/api", tags=["status"])


class SyncStatusResponse(BaseModel):
    """Current synchronization status and metadata for the navbar indicator."""

    is_syncing: bool
    last_sync_started_at: str | None = None
    last_sync_finished_at: str | None = None
    last_sync_status: str | None = None
    activities_synced: int = 0
    health_days_synced: int = 0
    error_message: str | None = None
    timezone: str


class ManualSyncRequest(BaseModel):
    """Optional request body for triggering an on-demand sync."""

    days: int | None = None


@router.get("/status", response_model=SyncStatusResponse)
async def get_status(request: Request) -> SyncStatusResponse:
    """Return latest sync execution status and runtime state."""
    settings: Settings = request.app.state.settings
    coordinator: SyncCoordinator = request.app.state.coordinator
    init_db(settings.database_path)

    with connect_db(settings.database_path) as conn:
        latest = get_latest_sync_run(conn)

    if latest is None:
        return SyncStatusResponse(
            is_syncing=coordinator.is_syncing,
            timezone=settings.tz,
        )

    return SyncStatusResponse(
        is_syncing=coordinator.is_syncing,
        last_sync_started_at=latest.get("started_at"),
        last_sync_finished_at=latest.get("finished_at"),
        last_sync_status=latest.get("status"),
        activities_synced=int(latest.get("activities_synced") or 0),
        health_days_synced=int(latest.get("health_days_synced") or 0),
        error_message=latest.get("error_message"),
        timezone=settings.tz,
    )


@router.post("/sync", response_model=SyncResult)
async def trigger_manual_sync(
    request: Request,
    payload: ManualSyncRequest | None = None,
) -> SyncResult:
    """Trigger an immediate Garmin Connect synchronization."""
    coordinator: SyncCoordinator = request.app.state.coordinator
    days = payload.days if payload is not None else None
    try:
        return await coordinator.trigger_sync(days=days)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Synchronization failed: {exc}") from exc
