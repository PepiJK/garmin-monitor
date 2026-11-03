# Garmin Monitor — Documentation & Agent Reference

This `docs/` directory stores the canonical requirements, architectural decisions, data models, design system, and verification criteria for the **Garmin Monitor** project (`https://garmin.pepnet.at`).

## Contents

1. [Requirements & Architecture](file:///home/josef/Projects/garmin-monitor/docs/requirements-and-architecture.md)
   - Problem statement, goals, and explicit non-goals
   - Deployment topology on `pepnet.at` (single container + Caddy `basic_auth` + SQLite WAL)
   - Garmin Connect synchronization cadence, metrics scope, and token management
   - Training plan engine, Fenix 7S calendar scheduling, and post-sync auto-completion rules
   - Health warnings engine & 30-day rolling baseline evaluation rules
   - Modern 2026 Python 3.14 & Angular Standalone Signals standards
2. [Roadmap & Acceptance Criteria](file:///home/josef/Projects/garmin-monitor/docs/roadmap-and-acceptance-criteria.md)
   - Sequential implementation plan (Steps 1 through 7)
   - Per-step acceptance criteria and quality gates
   - Chrome DevTools MCP UI/UX verification protocol
3. [Frontend Design System](file:///home/josef/Projects/garmin-monitor/docs/design-system.md)
   - Aesthetic direction, color tokens, typography scale, and layout architecture
   - Component specifications for `/training` (`Dashboard` and `Plan` tabs) and `/health`
