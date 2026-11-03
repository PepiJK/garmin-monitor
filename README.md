# Garmin Monitor (`garmin.pepnet.at`)

Personal Garmin Fenix 7S training and health telemetry platform deployed as a unified container on `pepnet.at` (`https://garmin.pepnet.at`).

- **Backend**: Python `3.14.9` (`.python-version`), FastAPI, Pydantic v2, SQLite WAL (`/data/garmin.db`), `python-garminconnect` (`garth` OAuth1/OAuth2 token store), structured background scheduler (`asyncio.TaskGroup`).
- **Frontend**: Angular `22.2` Standalone SPA (`frontend/package.json`, Node LTS `26.13.0`), Angular Signals, Tailwind CSS, Apache ECharts (`ngx-echarts`).
- **Views**:
  - `https://garmin.pepnet.at/training` — `Dashboard` tab (current-week ran km, strength minutes, completed workouts, 4w/12w/26w running & strength ECharts) and `Plan` tab (structured training plan with target vs. actual metrics and automatic completion status).
  - `https://garmin.pepnet.at/health` — Severity-sorted physiological & sync warning banners, 6 vitals KPI cards, and 7d/30d/90d ECharts diagrams (HRV vs. personal baseline band, Sleep Score & stages, Resting HR & Stress, Body Battery & Training Readiness).

---

## Pinned Toolchains

| Layer | Version | Pin File |
| :--- | :--- | :--- |
| Python | `3.14.9` | `.python-version`, `backend/pyproject.toml` (`requires-python = ">=3.14"`) |
| Node.js LTS | `26.13.0` (`npm 11.20.0`) | `frontend/package.json` (`engines`), `frontend/.node-version` |
| Docker Base Images | `node:26-alpine`, `python:3.14-slim` | `Dockerfile` |

---

## Local Development Setup

### 1. Backend (`backend/`)

```bash
python3.14 -m venv .venv
source .venv/bin/activate
cd backend
pip install -e ".[dev]"

# Lint, format check, and run tests (>= 80% coverage enforced)
ruff check src tests
ruff format --check src tests
pytest

# Start local API server on http://127.0.0.1:8000
uvicorn garmin_monitor.main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Frontend (`frontend/`)

```bash
cd frontend
npm ci

# Lint, format check, and run tests (>= 80% coverage enforced)
npm run lint
npm run format:check
npm run test:ci

# Start Angular dev server on http://127.0.0.1:4200 (proxies /api/* to :8000)
npm start
```

---

## CLI Usage (Auth, Sync, Training Plan & Fenix 7S Calendar)

```bash
# 1. Interactive one-time Garmin SSO login (persists tokens to GARMIN_TOKEN_DIR)
python -m garmin_monitor auth login --email you@example.com

# 2. Headless incremental or backfill sync
python -m garmin_monitor sync --days 90

# 3. Validate, persist, and push structured workouts to Garmin Connect / Fenix 7S calendar
python -m garmin_monitor plan apply plan.yaml

# 4. Export active plan and actual completion telemetry
python -m garmin_monitor plan export --format yaml
```

See [AGENTS.md](file:///home/josef/Projects/garmin-monitor/AGENTS.md) for the complete YAML/JSON training plan schema and server AI workflow instructions.

---

## Production Deployment on `pepnet.at` (`garmin.pepnet.at`)

### 1. One-Time Server Bootstrap (`/opt/garmin-monitor`)

SSH into `pepnet.at` (`ssh josef@pepnet.at`) and clone this repository into `/opt/garmin-monitor` (separate from `/opt/pepnet`):

```bash
sudo mkdir -p /opt/garmin-monitor
sudo chown josef:josef /opt/garmin-monitor
git clone https://github.com/josef/garmin-monitor.git /opt/garmin-monitor
cd /opt/garmin-monitor
mkdir -p data/garmin_tokens
```

### 2. One-Time Garmin Token Bootstrap

Authenticate once interactively so the background 2-hour sync daemon can refresh OAuth tokens headlessly without MFA prompts or `429` lockouts:

```bash
cd /opt/garmin-monitor
docker compose run --rm garmin-monitor \
  python -m garmin_monitor auth login --email <GARMIN_EMAIL>
```

Then start the service and run the initial 90-day historical backfill:

```bash
docker compose up -d
docker exec garmin-monitor python -m garmin_monitor sync --days 90
```

### 3. Caddy Reverse Proxy & Basic Auth (`garmin.pepnet.at`)

`garmin-monitor` joins the external `pepnet_web_net` network alongside `/opt/pepnet/caddy`.

1. Generate a bcrypt password hash using the running Caddy `v2.11.7` container:
   ```bash
   docker exec -it caddy caddy hash-password
   ```
2. Copy the snippet from [`deploy/Caddyfile.garmin.snippet`](file:///home/josef/Projects/garmin-monitor/deploy/Caddyfile.garmin.snippet) into `/opt/pepnet/caddy/Caddyfile` with your bcrypt hash.
3. Reload Caddy without downtime:
   ```bash
   docker exec caddy caddy reload --config /etc/caddy/Caddyfile
   ```

### 4. Automated GitHub Release CD (`.github/workflows/cd.yml`)

Publishing a GitHub Release triggers [`.github/workflows/cd.yml`](file:///home/josef/Projects/garmin-monitor/.github/workflows/cd.yml) on `ubuntu-latest`:
1. Runs backend (`ruff`, `pytest` ≥ 80% coverage) and frontend (`eslint`, `prettier`, `ng test` ≥ 80% coverage) quality gates using `.python-version` and `frontend/package.json`.
2. Builds the multi-stage Docker image and pushes `:latest` and `:<release-tag>` to `ghcr.io` using `GITHUB_TOKEN`.
3. SSHes into `pepnet.at`, checks out the release tag in `/opt/garmin-monitor`, pulls the pre-built image from `ghcr.io` (zero image build RAM overhead on the 3.7 GiB host), restarts `garmin-monitor` via `docker compose up -d`, prunes old images, and verifies `/api/healthz`.

#### Required GitHub Repository Secrets

Configure these secrets under **Settings → Secrets and variables → Actions**:

| Secret | Description |
| :--- | :--- |
| `DEPLOY_HOST` | `pepnet.at` (or `2.31.123.162`) |
| `DEPLOY_USER` | `josef` |
| `DEPLOY_SSH_KEY` | Private SSH key authorized for `josef@pepnet.at` |
