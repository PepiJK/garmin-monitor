# Frontend Design System — Alpine Telemetry Lab

Following the `frontend-design` skill guidelines, Garmin Monitor avoids generic AI dashboard clichés (no terracotta on cream, no neon acid-green on pitch black, no uniform SaaS card grids with middle-dot eyebrows). Instead, its visual identity is grounded in **Alpine Endurance & Sports Physiology Lab** instrumentation — inspired by high-altitude trail maps, precision chronographs (Fenix 7S MIP sunlight-readable displays), and physiological lab telemetry sheets.

## 1. Core Color Palette (Dark Mode — Night Telemetry)

| Token | Hex | Role |
|---|---|---|
| **Obsidian Slate** | `#0B1120` | Primary page canvas — night-mode OLED instrument readability |
| **Instrument Surface** | `#0F172A` | Elevated data panels, tables, and chart canvases |
| **Crisp Telemetry Ink** | `#F8FAFC` | Primary typography, high-contrast numbers, and active readouts |
| **Muted Mineral** | `#94A3B8` | Secondary labels, axis ticks, and unit annotations |
| **Cobalt Pace** | `#38BDF8` | Running metrics, primary interactive controls (`7d / 30d / 90d`), and active tab indicator |
| **Alpine Pine** | `#2DD4BF` | Strength metrics, within-baseline HRV band, and `done` status |
| **Amber Threshold** | `#FBBF24` | `partial` status and physiological `warning` state |
| **Crimson Alert** | `#F87171` | `missed` status and physiological `critical` alert state |

## 2. Typography

- **Primary Sans (`Inter` / system geometric sans)**: Clean, legible prose, navigation, table headers, and diagnostic descriptions.
- **Tabular Figures (`font-variant-numeric: tabular-nums` / `JetBrains Mono`)**: Used strictly for numeric telemetry readouts (paces, heart-rate zones, kilometer totals, HRV ms values, dates) so columns align vertically to the decimal point.
- **Rules**:
  - Sentence case for all labels and headers (never tracked-out ALL-CAPS eyebrows).
  - Plain, direct verbs for actions (`Sync now`, `Sync plan to watch`, `Dashboard`, `Plan`).

## 3. Layout Architecture

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
