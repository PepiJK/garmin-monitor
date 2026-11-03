"""Unit tests for SPA index.html fallback routing and /api/* 404 preservation."""

from pathlib import Path

from fastapi.testclient import TestClient

from garmin_monitor.config import Settings
from garmin_monitor.main import create_app


def test_spa_routing_and_api_404(tmp_path: Path) -> None:
    """GET /training and /health return SPA index.html (200), while /api/unknown returns 404."""
    static_dir = tmp_path / "browser"
    static_dir.mkdir(parents=True)
    (static_dir / "index.html").write_text(
        "<!doctype html><html><body><app-root>SPA Bundle</app-root></body></html>",
        encoding="utf-8",
    )
    (static_dir / "main.js").write_text("console.log('bundle');", encoding="utf-8")
    (static_dir / "main-ABCD1234.js").write_text("console.log('hashed');", encoding="utf-8")

    settings = Settings(
        DATABASE_PATH=tmp_path / "garmin.db",
        GARMIN_TOKEN_DIR=tmp_path / "tokens",
        STATIC_DIR=static_dir,
        ENABLE_SCHEDULER=False,
    )
    app = create_app(settings=settings)

    with TestClient(app) as client:
        for route in ("/", "/training", "/health"):
            resp = client.get(route)
            assert resp.status_code == 200
            assert "<app-root>SPA Bundle</app-root>" in resp.text
            assert resp.headers.get("cache-control") == "no-cache"

        asset_resp = client.get("/main.js")
        assert asset_resp.status_code == 200
        assert "console.log('bundle');" in asset_resp.text
        assert asset_resp.headers.get("cache-control") == "public, max-age=3600"

        hashed_resp = client.get("/main-ABCD1234.js")
        assert hashed_resp.status_code == 200
        assert "console.log('hashed');" in hashed_resp.text
        assert hashed_resp.headers.get("cache-control") == "public, max-age=31536000, immutable"

        unknown_api = client.get("/api/unknown")
        assert unknown_api.status_code == 404
        assert "detail" in unknown_api.json()
