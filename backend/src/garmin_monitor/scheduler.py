"""Background sync scheduler using Python 3.14 structured concurrency (TaskGroup & timeout)."""

import asyncio
import logging
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI

from garmin_monitor.config import Settings
from garmin_monitor.db import connect_db, init_db, is_database_empty
from garmin_monitor.sync_service import SyncResult, SyncService

logger = logging.getLogger(__name__)

type SyncServiceFactory = Callable[[Settings], SyncService]


class SyncCoordinator:
    """Coordinates periodic 2-hour background syncs and manual sync requests via a shared lock."""

    def __init__(
        self,
        settings: Settings,
        sync_factory: SyncServiceFactory = SyncService,
        sync_timeout_sec: float = 300.0,
    ) -> None:
        self.settings = settings
        self.sync_factory = sync_factory
        self.sync_timeout_sec = sync_timeout_sec
        self._lock = asyncio.Lock()

    @property
    def is_syncing(self) -> bool:
        """Return True if a synchronization task currently holds the lock."""
        return self._lock.locked()

    async def trigger_sync(self, *, days: int | None = None) -> SyncResult:
        """Execute a Garmin synchronization under the shared async lock and deadline timeout."""
        async with self._lock:
            async with asyncio.timeout(self.sync_timeout_sec):
                service = self.sync_factory(self.settings)
                return await asyncio.to_thread(service.sync, days=days)

    async def run_periodic_loop(self, stop_event: asyncio.Event) -> None:
        """Run initial backfill (if DB is empty) followed by periodic 2-hour sync cycles."""
        interval_sec = max(1.0, self.settings.sync_interval_hours * 3600.0)
        while not stop_event.is_set():
            try:
                init_db(self.settings.database_path)
                with connect_db(self.settings.database_path) as conn:
                    empty = is_database_empty(conn)
                days = self.settings.sync_backfill_days if empty else 2
                await self.trigger_sync(days=days)
            except Exception as exc:
                logger.warning(f"Periodic background sync failed: {exc}")

            with suppress(TimeoutError):
                async with asyncio.timeout(interval_sec):
                    await stop_event.wait()


@asynccontextmanager
async def app_lifespan(app: FastAPI) -> AsyncIterator[None]:
    """FastAPI lifespan context manager orchestrating background sync via asyncio.TaskGroup."""
    settings: Settings = app.state.settings
    init_db(settings.database_path)
    coordinator: SyncCoordinator = getattr(app.state, "coordinator", None) or SyncCoordinator(
        settings
    )
    app.state.coordinator = coordinator

    if not settings.enable_scheduler:
        yield
        return

    stop_event = asyncio.Event()
    async with asyncio.TaskGroup() as tg:
        tg.create_task(coordinator.run_periodic_loop(stop_event))
        try:
            yield
        finally:
            stop_event.set()
