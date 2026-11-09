---
description: Alpine Telemetry Lab visual design system, Tailwind CSS v4 tokens, typography, and layout rules for the Garmin Monitor Angular frontend.
---

# Garmin Monitor frontend design

The Garmin Monitor Angular SPA (`frontend/`) uses **Tailwind CSS v4** (`@import 'tailwindcss'` in `frontend/src/styles.css`) and **Apache ECharts** (`ngx-echarts` SVG renderer configured in `frontend/src/app/core/echarts/echarts-core.ts`). Following the `frontend-design` skill guidelines, Garmin Monitor avoids generic AI dashboard clichés (no terracotta on cream, no neon acid-green on pitch black, no uniform SaaS card grids with middle-dot eyebrows). Instead, its visual identity is grounded in **Alpine Endurance & Sports Physiology Lab** instrumentation — inspired by high-altitude trail maps, precision chronographs (Fenix 7S MIP sunlight-readable displays), and physiological lab telemetry sheets. Tokens and utility classes are used for their intended purpose and never hard-coded in a parallel palette.

**Sources**: Read `frontend/src/styles.css` (loaded globally via `projects.frontend.architect.build.options.styles` in `frontend/angular.json` with `:root { color-scheme: dark; }`), `frontend/tailwind.config.js`, `frontend/.postcssrc.json`, and the ECharts option builders in `frontend/src/app/features/training/training-dashboard-tab.component.ts` and `frontend/src/app/features/health/health-charts.component.ts` before adding or modifying styling tokens.

## Colors

Status colors (`teal-400` / `#2DD4BF`, `amber-400` / `#FBBF24`, `red-400` / `#F87171`) express completion or physiological state only.

| Purpose                                                  | Variable / Utility                                                      | Hex                   |
| -------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------- |
| Page background (**Obsidian Slate**)                     | `body` background in `src/styles.css`, `bg-slate-950`                   | `#0B1120` / `#020617` |
| Elevated surfaces (**Instrument Surface**)               | `bg-slate-900`, `bg-slate-900/95`                                       | `#0F172A`             |
| Sticky table headers (Plan / Stammdaten)                 | `bg-emerald-950`, `bg-slate-950`                                        | `#022C22` / `#020617` |
| Primary text (**Crisp Telemetry Ink**)                   | `body` color in `src/styles.css`, `text-slate-100`, `text-white`        | `#F8FAFC` / `#F1F5F9` |
| Secondary text & axis labels (**Muted Mineral**)         | `text-slate-400`, `text-slate-300`                                      | `#94A3B8` / `#CBD5E1` |
| Brand & primary interactive (**Cobalt Pace**)            | `bg-sky-500`, `text-sky-400`, `border-sky-400`, `border-sky-500/40`     | `#38BDF8` / `#0EA5E9` |
| Neutral borders & chart gridlines                        | `border-slate-800`, ECharts `splitLine`                                 | `#1E293B`             |
| Success / `done` / strength / HRV band (**Alpine Pine**) | `bg-teal-400`, `text-teal-400`, `bg-emerald-500/15`, `text-emerald-300` | `#2DD4BF` / `#6EE7B7` |
| Warning / `partial` / `syncing` (**Amber Threshold**)    | `bg-amber-400`, `text-amber-300`, `border-amber-500/40`                 | `#FBBF24`             |
| Error / `missed` / `critical` (**Crimson Alert**)        | `bg-red-400`, `text-red-300`, `border-red-500/50`                       | `#F87171`             |

### 1. Core Color Palette (Dark Mode — Night Telemetry)

| Token                   | Hex       | Role                                                                                       |
| ----------------------- | --------- | ------------------------------------------------------------------------------------------ |
| **Obsidian Slate**      | `#0B1120` | Primary page canvas — night-mode OLED instrument readability                               |
| **Instrument Surface**  | `#0F172A` | Elevated data panels, tables, and chart canvases                                           |
| **Crisp Telemetry Ink** | `#F8FAFC` | Primary typography, high-contrast numbers, and active readouts                             |
| **Muted Mineral**       | `#94A3B8` | Secondary labels, axis ticks, and unit annotations                                         |
| **Cobalt Pace**         | `#38BDF8` | Running metrics, primary interactive controls (`7d / 30d / 90d`), and active tab indicator |
| **Alpine Pine**         | `#2DD4BF` | Strength metrics, within-baseline HRV band, and `done` status                              |
| **Amber Threshold**     | `#FBBF24` | `partial` status and physiological `warning` state                                         |
| **Crimson Alert**       | `#F87171` | `missed` status and physiological `critical` alert state                                   |

## Typography

- **Primary Sans (`Inter` / system geometric sans)**: Declared on `body` in `frontend/src/styles.css` (`'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`) for prose, navigation, table headers, and diagnostic descriptions.
- **Tabular Figures (`font-mono tabular-nums` / `JetBrains Mono`)**: Used strictly for numeric telemetry readouts (paces, heart-rate zones, kilometer totals, HRV ms values, dates) so columns align vertically to the decimal point.
- **Size & Weight Scale**:
  - Page headings (`h1`): `text-2xl font-bold tracking-tight text-slate-100`.
  - Section & navbar titles: `text-base font-semibold tracking-tight text-slate-100`.
  - Base controls & table cells: `text-sm` (`font-medium` default, `font-semibold` or `font-bold` for active states and KPI values).
  - Compact telemetry badges & secondary labels: `text-xs` (`0.75rem`) and `text-[11px]` (`font-semibold` or `font-mono tabular-nums`).
- **Rules**:
  - Sentence case for all labels and headers (never tracked-out ALL-CAPS eyebrows).
  - Plain, direct verbs for actions (`Sync now`, `Sync plan to watch`, `Dashboard`, `Plan`).

## Spacing, radius, borders

- **Page Container**: `mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6`.
- **Border Radius**: `rounded-xl` for elevated cards, chart panels, and tab strip containers; `rounded-lg` for inner tab pills; `rounded-md` for action buttons and status badges; `rounded-full` for status indicator dots.
- **Structural Hairline Borders**: `border border-slate-800` (`#1E293B`) separates panels, table cells, and header bars without heavy drop shadows; `border-2 border-sky-500/40` highlights the global time-window selector.

## Breakpoints

- Responsive layout rules use standard Tailwind CSS media-query prefixes in templates (`sm:px-6`, `hidden sm:block`, ` md:grid-cols-2`, `lg:grid-cols-3`, `xl:grid-cols-6`).

## Apache ECharts & Tailwind CSS theming

- **ECharts SVG Rendering**: All charts initialize with `initOpts = { renderer: 'svg' }` via `ngx-echarts` (`frontend/src/app/core/echarts/echarts-core.ts`) using dark-mode axis labels (`#94a3b8`), subtle grid split lines (`#1e293b`), and semantic series colors (`#38bdf8` for running/primary metrics and VO₂ Max progression, `#2dd4bf` for strength/GAT1 Z2 base/HRV baseline bands, `#fbbf24` and `#f87171` for thresholds and Z3–Z5 intensity).
- **Training & Health Chart Suite**:
  - `/training` Dashboard renders a 4-card KPI strip (`Running distance`, `Strength volume`, `Completed workouts`, `VO₂ max & GAT1 Base`), a compact 4-distance Race Predictor strip (`5 km`, `10 km`, `Halbmarathon`, `Marathon`), and a 2x2 ECharts grid (`Weekly running volume`, `Weekly strength volume`, `VO₂ max progression` with Sportordination `46,9` reference line, and `Running HR time-in-zone Z1–Z5` stacked bars with a 5-zone window summary strip).
  - `/health` renders a 6-card vitals KPI strip (including Body Battery `+charged / -drained` and Morning Readiness `Acute load`) and a 2x2 ECharts grid (`Nightly HRV vs. Personal Baseline`, `Sleep Score & Architecture`, `Resting HR & Daily Stress`, and dual-axis `Morning Readiness, Body Battery & 7d Acute Load`).
- **Sticky Table Headers (`StickyTableHeaderDirective`)**: Global `table thead, table thead th { position: sticky; top: 0; z-index: 20; }` in `frontend/src/styles.css` works alongside `thead[appStickyHeader]` (`frontend/src/app/shared/directives/sticky-table-header.directive.ts`) to dynamically constrain table scroll containers to the viewport height.

## Rules

### 3. Layout Architecture

```
+-----------------------------------------------------------------------+
| Garmin Monitor   [Training] [Health]        Last sync: 14m ago [Sync] |
+-----------------------------------------------------------------------+
| Page Header / Active Context   [7d | 30d | 90d] [Dashboard|Plan|Stamm]|
+-----------------------------------------------------------------------+
| Primary Telemetry Strip (KPI Readouts with inline units & context)    |
+-----------------------------------+-----------------------------------+
| Primary ECharts Canvas (Left)     | Secondary ECharts Canvas (Right)  |
+-----------------------------------+-----------------------------------+
| Full-Width Structured Ledger (Plan Table, Stammdaten, or Sessions)    |
+-----------------------------------------------------------------------+
```

- Left-aligned typographic hierarchy; right-aligned numeric table columns (`tabular-nums`) for rapid vertical comparison between **Goal** and **Actual** metrics.
- Structural hairline borders (`#1E293B` / `border-slate-800`) encode data groups cleanly without heavy drop shadows.
- **Sticky Table Headers (`StickyTableHeaderDirective`)**: Data tables (`training-plan-table`, `stammdaten-table`, `week-workouts-table`) use `thead[appStickyHeader]` (`frontend/src/app/shared/directives/sticky-table-header.directive.ts`) to dynamically constrain scroll container height to the viewport and keep opaque headers (`bg-emerald-950` / `bg-slate-950`) pinned while scrolling horizontally and vertically.
- **Locale & Formatting (`german-format.ts`)**: Dates (`DD.MM.YYYY`), 24h times (`HH:mm`), German weekday badges (`Montag`..`Sonntag`), and decimal/thousand separators (`de-DE` / `de-AT`) are formatted consistently via `frontend/src/app/core/format/german-format.ts`.
- **Component Host & Accessibility**: Every component sets `changeDetection: ChangeDetectionStrategy.OnPush` and `host: { class: 'block' }`. Interactive tablists, toggle groups, and status banners provide explicit ARIA attributes (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-pressed`, `aria-label`).
