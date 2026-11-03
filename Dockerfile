# syntax=docker/dockerfile:1

# ==============================================================================
# Stage 1: Build Angular 22 SPA production bundle with pinned Node 26 LTS
# ==============================================================================
FROM node:26-alpine AS frontend-build

WORKDIR /build

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Python 3.14 runtime serving FastAPI + compiled Angular SPA
# ==============================================================================
FROM python:3.14-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Europe/Vienna \
    DATABASE_PATH=/data/garmin.db \
    GARMIN_TOKEN_DIR=/data/garmin_tokens \
    STATIC_DIR=/app/static \
    HOST=0.0.0.0 \
    PORT=8000

RUN groupadd --gid 10001 garmin \
    && useradd --uid 10001 --gid garmin --shell /sbin/nologin --create-home garmin \
    && mkdir -p /data /data/garmin_tokens /app/static \
    && chown -R garmin:garmin /data /app

WORKDIR /app

COPY backend/pyproject.toml ./
COPY backend/src ./src
RUN pip install --no-cache-dir .

COPY --from=frontend-build --chown=garmin:garmin /build/dist/frontend/browser /app/static

USER garmin

VOLUME ["/data"]

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/healthz', timeout=3)" || exit 1

CMD ["uvicorn", "garmin_monitor.main:app", "--host", "0.0.0.0", "--port", "8000"]
