---
description: Frontend engineering and validation instructions for Garmin Monitor.
---

# Garmin Monitor Frontend Instructions

These instructions apply to `frontend` and add to the repository-root instructions.

## Stack

- Node `26.13.0` (`frontend/.node-version`) and npm `11.20.0` (`frontend/package.json` `engines`)
- Angular `22.2` Standalone SPA (`@angular/core`, `@angular/router`, `@angular/forms`, TypeScript `~6.0.2`)
- Tailwind CSS v4 (`tailwindcss`, `@tailwindcss/postcss`) and Apache ECharts (`echarts` `^6.1.0`, `ngx-echarts` `^22.0.0`)
- ESLint (`angular-eslint`, `typescript-eslint`), Prettier (`printWidth: 100`, `singleQuote: true`), and Vitest (`@angular/build:unit-test`, `@vitest/coverage-v8`, `jsdom`)

## Documented workflows

- Before UI work in this frontend, read `DESIGN.md`; update it when design tokens or component styling change.

## Verification

Stage 1 (while working):

```bash
cd frontend
npx eslint src/app/<path-to-changed-file>.ts
npx ng test --watch=false --include src/app/<path-to-changed-file>.spec.ts
```

Stage 2 (finish gates):

```bash
cd frontend
npm run format:check
npm run lint
npm run test:ci
npm run build
```

## Conventions

- Organize source under `frontend/src/app/` into `core/` (`api/`, `echarts/`, `format/`), `shared/` (`directives/`, `layout/`), and `features/` (`training/`, `health/`).
- Use standalone components with `ChangeDetectionStrategy.OnPush`, Angular Signals (`signal`, `computed`, `input`, `output`), `inject()`, and native control flow (`@if`, `@for`, `@switch`).
- Use component selector prefix `app-` (`kebab-case` element) and directive selector prefix `app` (`camelCase` attribute) enforced by `frontend/eslint.config.js`.
- Format dates (`DD.MM.YYYY`), 24h times (`HH:mm`), German weekday badges, and localized numbers via `frontend/src/app/core/format/german-format.ts`.
- Keep all HTTP calls in `GarminApiService` using relative `/api/*` paths so Caddy HTTP Basic Auth credentials are sent automatically by the browser.

## Testing

- Test runner: Vitest via Angular CLI (`npm run test:ci` / `ng test --watch=false --coverage`).
- Co-locate unit specs in `frontend/src/app/**/*.spec.ts` covering component rendering, signal state updates, and HTTP requests via `HttpTestingController`.
- Maintain at least 80% coverage across statements, branches, functions, and lines as enforced in `frontend/angular.json`.
