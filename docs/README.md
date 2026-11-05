# Garmin Monitor — Documentation & Agent Reference

This `docs/` directory and its companion root/part documents store the canonical requirements, architectural decisions, data models, operational CLI playbook, design system, agent workflow templates, and implementation log for the **Garmin Monitor** project (`https://garmin.pepnet.at`).

> **Agent Maintenance Rule**: Whenever you implement new features, endpoints, database tables/columns, UI views, or CLI workflows, update the corresponding documents in [`ARCHITECTURE.md`](../ARCHITECTURE.md), [`frontend/DESIGN.md`](../frontend/DESIGN.md), and `docs/` so the documentation always reflects the current state of the system.

## Contents

1. [Architecture & Requirements Specification](../ARCHITECTURE.md)
   - Project structure, system diagram, core components, architectural invariants, data stores, external integrations, security considerations, and domain language
   - Problem statement, goals, and explicit non-goals
   - Deployment topology on `pepnet.at` (single container + Caddy `basic_auth` + SQLite WAL)
   - Garmin Connect synchronization cadence, metrics scope (`activities`, `daily_health`, `sync_runs`), and token management
   - Training plan & Stammdaten engine (`training_plans`, `plan_days`, `stammdaten`), Fenix 7S calendar scheduling, post-sync auto-completion rules, and inline day-notes editing
   - Health warnings engine & 30-day rolling baseline evaluation rules
   - Modern Python 3.14 & Angular 22.2 Standalone Signals standards
2. [Server AI & Developer Operational Playbook](./operations-and-cli-playbook.md)
   - Production infrastructure & read-only SSH diagnostics (`pepnet.at`)
   - Inspecting training plans, Stammdaten, and physiological SQLite telemetry
   - Authoring and applying training plans (`plan apply`) and Stammdaten (`stammdaten apply`) with full YAML schema examples
3. [Frontend Design System](../frontend/DESIGN.md)
   - Aesthetic direction (*Alpine Telemetry Lab*), color tokens, typography scale, German (`de-AT`/`de-DE`) date/number formatting, and layout architecture
   - Component specifications for `/training` (`Dashboard`, `Plan`, and `Stammdaten` tabs), `/health`, and sticky viewport-aware table headers (`StickyTableHeaderDirective`)
4. [Roadmap & Implementation Log](./roadmap-and-acceptance-criteria.md)
   - Sequential implementation steps (Steps 1 through 7) and acceptance criteria
   - Log of post-roadmap enhancements and implemented capabilities
5. [Agent Workflow Templates (`docs/agents/`)](./agents/branch-template.md)
   - [Branch Naming Template](./agents/branch-template.md)
   - [Commit Template](./agents/commit-template.md)
   - [Issue Template Guidance](./agents/issue-template-guidance.md)
   - [Pull Request Template](./agents/pull-request-template.md)
6. [Architecture Decision Records (`docs/adr/`)](./adr/.gitkeep)
   - Numbered ADRs (`NNNN-kebab-slug.md`) recording durable architectural trade-offs
