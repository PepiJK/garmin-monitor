---
description: Main instructions for Garmin Monitor, covering tech stack, workflows, contracts, and documentation.
---

# AGENTS.md — Garmin Monitor Agent Guide

## 1. Project & Stack Overview

**Garmin Monitor** (`https://garmin.pepnet.at`) is a self-hosted Garmin Fenix 7S activity/health synchronization service, training plan & Stammdaten engine, watch calendar workout scheduler, and recovery telemetry web app deployed as a single container on `pepnet.at` behind Caddy Basic Auth.

- **Backend (`backend/`)**: Python `3.14.9` (`.python-version`), FastAPI, Uvicorn, Pydantic v2, SQLite 3 (`WAL` mode at `data/garmin.db`), `python-garminconnect`, `asyncio.TaskGroup` scheduler. Main package: `backend/src/garmin_monitor/` (`main.py`, `cli.py`, `db.py`, `api/`). Tests: `backend/tests/`.
- **Frontend (`frontend/`)**: Node `26.13.0` (`npm 11.20.0`), Angular `22.2` Standalone SPA (`OnPush`, Signals), Tailwind CSS v4, Apache ECharts (`ngx-echarts` SVG). Main app: `frontend/src/app/` (`core/`, `shared/`, `features/training/`, `features/health/`).
- **Container & Deploy**: Multi-stage `Dockerfile`, `docker-compose.yml` (`mem_limit: 384m`, `pepnet_web_net`), `deploy/Caddyfile.garmin.snippet`, `.github/workflows/{ci,cd}.yml`.
- **Quality**: Ruff (`py314`) and `pytest` (`>= 80%` coverage) for `backend/`; ESLint (`angular-eslint`), Prettier, and Vitest (`>= 80%` coverage) for `frontend/`.
- **CI/CD**: `.github/workflows/ci.yml` (pull request & push quality gates) and `.github/workflows/cd.yml` (release image build to `ghcr.io` and SSH rollout to `pepnet.at`).

---

## Documented workflows

- For Backend work, read `backend/AGENTS.md`.
- For Frontend work, read `frontend/AGENTS.md`.
- Before creating a branch, read `docs/agents/branch-template.md`.
- Before creating a commit, read `docs/agents/commit-template.md`.
- Before creating an issue or work item, read `docs/agents/issue-template-guidance.md`.
- Before creating or updating a pull request, read `docs/agents/pull-request-template.md`.
- Before creating a release, read `.github/release_template.md`.
- Before locating code or doing structural or cross-component work, read `ARCHITECTURE.md`; update it in the same change when structure, components, data stores, integrations, or invariants change, and add each settled domain term to its Domain language section as `**Term**:` with a one- or two-sentence definition followed by `_Avoid_:` synonyms.
- Before working in an area, read the ADRs in `docs/adr/` that touch it and flag any conflict explicitly; record a decision without asking when it is hard to reverse, surprising without context, and the result of a real trade-off, using `docs/adr/NNNN-kebab-slug.md` with a short title and 1-3 sentences on context, decision, and why, and supersede rather than rewrite a changed decision.

---

## 2. Documentation & Accountability (`docs/`)

Canonical specifications live in [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`frontend/DESIGN.md`](./frontend/DESIGN.md), and [`docs/`](./docs/README.md):
- [`docs/README.md`](./docs/README.md) — Documentation index
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Architecture, SQLite schemas, API endpoints, sync/matching/warning rules, invariants, domain language & code standards
- [`docs/operations-and-cli-playbook.md`](./docs/operations-and-cli-playbook.md) — `pepnet.at` SSH inspection, SQLite queries, and `plan` / `stammdaten` CLI & YAML schemas
- [`frontend/DESIGN.md`](./frontend/DESIGN.md) — *Alpine Telemetry Lab* palette, typography (`tabular-nums`), German formatting & layout rules
- [`docs/roadmap-and-acceptance-criteria.md`](./docs/roadmap-and-acceptance-criteria.md) — Roadmap, acceptance criteria & log of implemented features
- [`docs/agents/`](./docs/agents/branch-template.md) — Branch, commit, issue, and pull request workflow templates
- [`docs/adr/`](./docs/adr/.gitkeep) — Architecture Decision Records

**Rule**: Read the relevant documentation before making changes. Whenever you implement or modify features, schemas, endpoints, CLI commands, or UI behavior, **update `ARCHITECTURE.md`, `frontend/DESIGN.md`, or `docs/`** (using relative links) so the documentation always keeps account of everything implemented.

---

## 3. Development & Verification Workflow (Strict Order)

Follow this exact sequence for every change:

### Step 1: Red → Green → Refactor (TDD & ≥ 80% Coverage)
1. **Red**: Write or update failing unit/integration tests first (`backend/tests/test_*.py` or `frontend/src/**/*.spec.ts`).
2. **Green**: Implement the minimal code required to pass the tests.
3. **Refactor**: Clean up code while keeping test coverage **≥ 80%** across both backend (`pytest-cov`) and frontend (`@vitest/coverage-v8`).

### Step 2: Format → Lint → Test → Build

#### Backend (`backend/` with `.venv` active: `source .venv/bin/activate`)
```bash
cd backend
ruff format src tests          # 1. Format code
ruff format --check src tests  # 2. Verify formatting
ruff check src tests           # 3. Lint (py314 rules)
pytest                         # 4. Run unit/integration tests (enforces >= 80% coverage)
```

#### Frontend (`frontend/`)
```bash
cd frontend
npm run format                 # 1. Format code (Prettier)
npm run format:check           # 2. Verify formatting
npm run lint                   # 3. Lint (ESLint / angular-eslint)
npm run test:ci                # 4. Run headless Vitest suite (enforces >= 80% coverage)
npm run build                  # 5. Build production bundle (dist/frontend/browser)
```

### Step 3: Serve & Verify Live
```bash
# Backend API & SPA host (http://127.0.0.1:8000)
cd backend && uvicorn garmin_monitor.main:app --reload --host 127.0.0.1 --port 8000

# Frontend dev server (http://127.0.0.1:4200 -> proxies /api/* to :8000)
cd frontend && npm start

# Full-stack Docker container verification (http://127.0.0.1:8000)
docker compose up --build -d && curl -fsS http://127.0.0.1:8000/api/healthz
```

### Step 4: Update `docs/`
Record any new or modified capabilities, schemas, endpoints, or operational commands in [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`frontend/DESIGN.md`](./frontend/DESIGN.md), and [`docs/`](./docs/README.md).
