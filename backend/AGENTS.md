---
description: Backend engineering and validation instructions for Garmin Monitor.
---

# Garmin Monitor Backend Instructions

These instructions apply to `backend` and add to the repository-root instructions.

## Stack

- Python `3.14.9` (`.python-version`, `requires-python = ">=3.14"` in `backend/pyproject.toml`)
- FastAPI (`>=0.115.0`), Uvicorn (`>=0.32.0`), Pydantic v2 (`>=2.10.0`), `pydantic-settings` (`>=2.6.0`), PyYAML (`>=6.0.2`)
- SQLite 3 (`WAL` mode via `backend/src/garmin_monitor/db.py`)
- `garminconnect` (`>=0.3.0`) for Garmin Connect OAuth session persistence, activity/health sync, and Fenix 7S workout scheduling
- Ruff (`>=0.8.0`, `target-version = "py314"`) and Pytest (`>=8.3.0`, `pytest-asyncio`, `pytest-cov`, `httpx`)

## Verification

Stage 1 (while working):

```bash
cd backend
ruff check src tests
pytest tests/test_<module>.py
```

Stage 2 (finish gates):

```bash
cd backend
ruff format --check src tests
ruff check src tests
pytest
```

## Conventions

- Package code lives in `backend/src/garmin_monitor/` (`main.py`, `cli.py`, `config.py`, `db.py`, `garmin_client.py`, `sync_service.py`, `plan_schema.py`, `plan_service.py`, `workout_builder.py`, `warnings.py`, `scheduler.py`, and `api/`).
- Use modern Python 3.14 features: PEP 695 `type` aliases, PEP 604 union types (`T | None`), `match / case`, `asyncio.TaskGroup`, `asyncio.timeout`, and strict Pydantic v2 models.
- Normalize all calendar dates, daily health windows, and ISO-8601 week boundaries (Monday–Sunday) to `Settings.timezone` (`Europe/Vienna` by default).
- Preserve completed historical training plan rows (`date < today` with status `done` or `partial`) and user-entered `notes` during `plan apply`.
- Ensure unmatched `/api/*` requests raise an HTTP 404 JSON error before the catch-all SPA static file route in `main.py`.

## Testing

- Test runner: `pytest` configured in `backend/pyproject.toml` (`testpaths = ["tests"]`, `asyncio_mode = "auto"`).
- Write unit and integration tests in `backend/tests/test_*.py` using isolated temporary SQLite databases, `httpx.AsyncClient` with `ASGITransport`, and mocked Garmin client boundaries.
- Maintain at least 80% coverage across `garmin_monitor` (`--cov=garmin_monitor --cov-report=term-missing --cov-fail-under=80`).
