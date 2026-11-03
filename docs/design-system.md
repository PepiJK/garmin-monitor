# Frontend Design System — Alpine Telemetry Lab

Following the `frontend-design` skill guidelines, Garmin Monitor avoids generic AI dashboard clichés (no terracotta on cream, no neon acid-green on pitch black, no uniform SaaS card grids with middle-dot eyebrows). Instead, its visual identity is grounded in **Alpine Endurance & Sports Physiology Lab** instrumentation — inspired by high-altitude trail maps, precision chronographs (Fenix 7S MIP sunlight-readable displays), and physiological lab telemetry sheets.

## 1. Core Color Palette

| Token | Hex | Role |
|---|---|---|
| **Slate Paper** | `#F6F8FA` | Primary page canvas — crisp daylight instrument readability |
| **Instrument Surface** | `#FFFFFF` | Elevated data panels, tables, and chart canvases |
| **Deep Slate Ink** | `#0F172A` | Primary typography, high-contrast numbers, and active borders |
| **Muted Mineral** | `#475569` | Secondary labels, axis ticks, and unit annotations |
| **Cobalt Pace** | `#0284C7` | Running metrics, primary interactive controls, and active tab indicator |
| **Alpine Pine** | `#0D9488` | Strength metrics, within-baseline HRV band, and `done` status |
| **Amber Threshold** | `#D97706` | `partial` status and physiological `warning` state |
| **Crimson Alert** | `#DC2626` | `missed` status and physiological `critical` alert state |

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
| Page Header / Active Context                 [Sub-navigation / Range] |
+-----------------------------------------------------------------------+
| Primary Telemetry Strip (KPI Readouts with inline units & context)    |
+-----------------------------------+-----------------------------------+
| Primary ECharts Canvas (Left)     | Secondary ECharts Canvas (Right)  |
+-----------------------------------+-----------------------------------+
| Full-Width Structured Ledger (Plan Table or Completed Sessions)       |
+-----------------------------------------------------------------------+
```

- Left-aligned typographic hierarchy; right-aligned numeric table columns (`tabular-nums`) for rapid vertical comparison between **Goal** and **Actual** metrics.
- Structural hairline borders (`#E2E8F0`) encode data groups cleanly without heavy drop shadows.
