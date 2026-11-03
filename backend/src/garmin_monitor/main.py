"""FastAPI application entrypoint mounting /api/* routers and SPA static fallback."""

from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, Response
from pydantic import BaseModel

from garmin_monitor import __version__
from garmin_monitor.api.health import router as health_router
from garmin_monitor.api.status import router as status_router
from garmin_monitor.api.training import router as training_router
from garmin_monitor.config import Settings, get_settings
from garmin_monitor.scheduler import SyncCoordinator, app_lifespan

type HealthStatus = Literal["ok"]

FALLBACK_SPA_HTML: str = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Garmin Monitor</title>
</head>
<body>
  <app-root></app-root>
</body>
</html>
"""


class HealthzResponse(BaseModel):
    """Response payload for container and reverse-proxy health checks."""

    status: HealthStatus = "ok"


def _resolve_static_dir(settings: Settings) -> Path | None:
    """Locate the compiled Angular browser bundle directory if present."""
    if settings.static_dir is not None:
        return settings.static_dir
    repo_dist = Path(__file__).resolve().parents[3] / "frontend" / "dist" / "frontend" / "browser"
    if repo_dist.exists():
        return repo_dist
    container_static = Path("/app/static")
    if container_static.exists():
        return container_static
    return None


def create_app(
    settings: Settings | None = None,
    coordinator: SyncCoordinator | None = None,
) -> FastAPI:
    """Construct and configure the FastAPI application instance."""
    resolved_settings = settings or get_settings()
    app = FastAPI(
        title="Garmin Monitor API",
        version=__version__,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=app_lifespan,
    )
    app.state.settings = resolved_settings
    app.state.coordinator = coordinator or SyncCoordinator(resolved_settings)

    @app.get("/api/healthz", response_model=HealthzResponse, tags=["system"])
    async def healthz() -> HealthzResponse:
        """Liveness probe endpoint returning HTTP 200 {'status': 'ok'}."""
        return HealthzResponse(status="ok")

    app.include_router(status_router)
    app.include_router(training_router)
    app.include_router(health_router)

    @app.api_route("/api/{unmatched_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    async def api_not_found(unmatched_path: str) -> Response:
        """Preserve strict JSON 404 responses on unknown /api/* routes."""
        raise HTTPException(status_code=404, detail=f"API route '/api/{unmatched_path}' not found")

    @app.get("/{spa_path:path}", include_in_schema=False)
    async def serve_spa(spa_path: str) -> Response:
        """Serve compiled Angular static assets or fallback to SPA index.html."""
        static_dir = _resolve_static_dir(resolved_settings)
        if static_dir is not None and static_dir.exists():
            cleaned = spa_path.strip("/")
            if cleaned:
                candidate = (static_dir / cleaned).resolve()
                if candidate.is_relative_to(static_dir.resolve()) and candidate.is_file():
                    return FileResponse(candidate)
            index_file = static_dir / "index.html"
            if index_file.is_file():
                return FileResponse(index_file)
        return HTMLResponse(content=FALLBACK_SPA_HTML, status_code=200)

    return app


app = create_app()
