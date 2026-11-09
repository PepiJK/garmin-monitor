# Implementation Roadmap & Acceptance Criteria

## Sequential Steps Overview

### Step 1: Repository Scaffold, Pinned Toolchains, Quality Tooling, and GitHub Free CI Pipeline
- **Deliverables**:
  - `.gitignore`, `.python-version` (`3.14.9`), `frontend/.node-version` (`26.13.0`), `frontend/package.json` (`engines: { node: "26.13.0", npm: "11.20.0" }`).
  - `backend/pyproject.toml`, `backend/src/garmin_monitor/__init__.py`, `config.py`, `main.py` (`GET /api/healthz`), `backend/tests/test_healthz.py`.
  - `frontend/` Angular workspace with ESLint, Prettier, Tailwind CSS, routes (`/` -> `/training`, `/training`, `/health`), and unit tests with ≥ 80% coverage thresholds.
  - `.github/workflows/ci.yml` reusing `.python-version` and `frontend/package.json`.
- **Acceptance Criteria**:
  - `ruff check` and `ruff format --check` exit `0`.
  - `pytest` passes with ≥ 80% coverage and `GET /api/healthz` returns `200 {"status": "ok"}`.
  - `npm run lint`, `npm run format:check`, and `npm run test:ci` exit `0` with ≥ 80% coverage across statements, branches, functions, and lines.
  - `git check-ignore .scratch/` exits `0`.

### Step 2: SQLite WAL Storage Layer, Garmin Auth Bootstrap, and Health/Activity Sync CLI
- **Deliverables**:
  - `backend/src/garmin_monitor/db.py` (WAL mode, `activities`, `daily_health`, `sync_runs`).
  - `backend/src/garmin_monitor/garmin_client.py` (interactive `login()` and headless token reload).
  - `backend/src/garmin_monitor/sync_service.py` (idempotent activity & daily health sync normalized to `Europe/Vienna`).
  - `backend/src/garmin_monitor/cli.py` (`auth login`, `sync [--days 90]`).
  - Unit tests (`test_db.py`, `test_garmin_client.py`, `test_sync_service.py`, `test_cli_sync.py`).

### Step 3: Training Plan Engine, Auto-Completion Matcher, Fenix 7S Calendar Sync, and `AGENTS.md`
- **Deliverables**:
  - `training_plans` and `plan_days` schema in `db.py`.
  - `plan_schema.py`, `workout_builder.py`, `plan_service.py` (`apply_plan`, `reconcile_plan_completions`).
  - `cli.py` (`plan summary`, `plan export`, `plan apply <file>`, `plan sync`).
  - `AGENTS.md` operational playbook for `pepnet.at`.
  - Unit tests (`test_workout_builder.py`, `test_plan_service.py`, `test_cli_plan.py`).

### Step 4: FastAPI REST API (`/api/*`), Background Scheduler, Health Warnings Engine, and SPA Hosting
- **Deliverables**:
  - `warnings.py`, `scheduler.py` (`asyncio.TaskGroup`, `asyncio.timeout`).
  - API routers: `api/status.py`, `api/training.py`, `api/health.py`.
  - SPA fallback routing in `main.py`.
  - Unit tests (`test_warnings.py`, `test_scheduler.py`, `test_api_training.py`, `test_api_health.py`, `test_spa_routing.py`).

### Step 5: Angular SPA Shell, `/training` Dashboard, and Chrome DevTools MCP Verification
- **Deliverables**:
  - `garmin-api.models.ts`, `garmin-api.service.ts`.
  - `navbar.component.ts`, `training-page.component.ts`, `training-dashboard-tab.component.ts`, `training-plan-tab.component.ts`.
  - Comprehensive unit tests (`*.spec.ts`) ≥ 80% coverage.
  - Live UI/UX verification via `chrome-devtools` MCP server against `http://localhost:4200/training`.

### Step 6: Angular `/health` Dashboard, Warning Banners, and Chrome DevTools MCP Verification
- **Deliverables**:
  - `health-page.component.ts`, `health-warnings-banner.component.ts`, `health-kpis.component.ts`, `health-charts.component.ts`.
  - Comprehensive unit tests (`*.spec.ts`) ≥ 80% coverage.
  - Live UI/UX verification via `chrome-devtools` MCP server against `http://localhost:4200/health`.

### Step 7: Pinned Docker Packaging, `pepnet.at` Caddy Integration, GitHub Release CD Pipeline, and Full-Stack Verification
- **Deliverables**:
  - Multi-stage `Dockerfile` (`node:26-alpine` + `python:3.14-slim`), `docker-compose.yml` (`mem_limit: 384m`, `pepnet_web_net`), `deploy/Caddyfile.garmin.snippet`, `.github/workflows/cd.yml`, `README.md`.
  - Live full-stack container verification via `chrome-devtools` MCP server against `http://localhost:8000/training` and `http://localhost:8000/health`.

---

## Implemented Post-Roadmap Enhancements

### Step 8: Stammdaten (Athlete Master Data & Performance Diagnostics), Extended Plan Sheet, and Global Time Window
- **Deliverables**:
  - **Stammdaten Engine**: `stammdaten` table in `db.py`, `StammdatenEntrySpec` / `StammdatenSpec` in `plan_schema.py`, CLI `stammdaten summary|export|apply` in `cli.py`, `GET /api/training/stammdaten` in `api/training.py`, and `TrainingStammdatenTabComponent` (`training-stammdaten-tab.component.ts`).
  - **Extended Plan Sheet & Inline Day Notes**: 20-column structured sheet in `TrainingPlanTabComponent` (`training-plan-tab.component.ts`) showing planned zone/BPM/duration/details alongside reconciled actuals (`IST MN`, `IST KM`, `AVG / MAX BPM`, `AVG PACE`, `SPM`, `LOAD`, `TE (AER/ANA)`, `WATT`, `KCAL`, `RPE`) and auto-expanding inline `NOTIZEN / GEFÜHL` persisted on blur via `PATCH /api/training/plan/days/{day_date}/notes`.
  - **Extended Completed Workouts Telemetry**: `CompletedWorkoutItem` enriched with pace (`min/km`), running cadence (`avg`/`max spm`), stride length (`m`), running power (`W`), elevation gain (`m`), and aerobic/anaerobic training effect (`TE`).
  - **Global `7d / 30d / 90d` Time Window & German Formatting**: Shared `selectedDays` signal across `/training` and `/health` (`GarminApiService`), German locale date/number formatting (`german-format.ts`), and viewport-aware sticky table headers (`StickyTableHeaderDirective`).

### Step 9: High-Impact Garmin Performance & Recovery Telemetry (VO₂ Max, Race Predictions, HR Zones, GCT, Morning Readiness & Acute Load)
- **Deliverables**:
  - **VO₂ Max Progression & Race Predictions**: Extracted `vO2MaxValue` (running activities) and `max_metrics` / `race_predictions` into `TrainingDashboardResponse` (`vo2_max_latest`, `vo2_max_delta`, `vo2_max_series`, `race_predictions` for `5 km`, `10 km`, `Halbmarathon`, and `Marathon` with Daniels/Firstbeat oxygen-cost velocity fallback), rendered in `kpi-vo2max`, `race-predictions-panel`, and `chart-vo2max-trend` (against Sportordination `46,9 mL/kg/min` lab baseline).
  - **Running HR Time-in-Zone (`Z1–Z5`) vs. Sportordination GAT1 Target**: Aggregated `hrTimeInZone_1..5` per workout, per ISO week (`WeeklyTrainingPoint`), and across the selected window (`hr_zones_window` with `[10%, 65%, 10%, 10%, 5%]` targets), rendered in `chart-hr-zones` and `hr-zones-strip`.
  - **Biomechanics & Strength Ledger Enhancements**: Added Ground Contact Time (`avg_gct_ms`, e.g., `0,78 m · 302 ms`) alongside stride length for runs and multi-set strength volume (`total_sets`, `total_reps`, e.g., `18 sets · 184 reps`) in the `Distance` column of the completed workouts table while ignoring single-block timer placeholders (`1 set, 0 reps`).
  - **True Morning Readiness, 7-Day Acute Load & Body Battery Charge/Drain**: Added `select_morning_training_readiness` (`inputContext == "AFTER_WAKEUP_RESET"`) in `sync_service.py` and `api/health.py`, and exposed `acute_load`, `recovery_time_hours`, `acwr_status`, `body_battery_charged`, and `body_battery_drained` across `/health` KPIs, the dual-axis Readiness/Body Battery/Acute Load ECharts diagram, and the daily breakdown table.
