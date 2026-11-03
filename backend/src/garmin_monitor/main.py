"""FastAPI application entrypoint for Garmin Monitor."""

from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel

from garmin_monitor import __version__
from garmin_monitor.config import Settings, get_settings

type HealthStatus = Literal["ok"]


class HealthzResponse(BaseModel):
    """Response payload for container and reverse-proxy health checks."""

    status: HealthStatus = "ok"


def create_app(settings: Settings | None = None) -> FastAPI:
    """Construct and configure the FastAPI application instance."""
    resolved_settings = settings or get_settings()
    app = FastAPI(
        title="Garmin Monitor API",
        version=__version__,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )
    app.state.settings = resolved_settings

    @app.get("/api/healthz", response_model=HealthzResponse, tags=["system"])
    async def healthz() -> HealthzResponse:
        """Liveness probe endpoint returning HTTP 200 {'status': 'ok'}."""
        return HealthzResponse(status="ok")

    return app


app = create_app()
