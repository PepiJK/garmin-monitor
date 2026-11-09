import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import {
  CompletedWorkoutItem,
  HealthDayWindow,
  HrZoneWindowItem,
  RacePredictionItem,
  TrainingDashboardResponse,
  TrainingWeekWindow,
  Vo2MaxPoint,
  WeeklyTrainingPoint,
} from '../../core/api/garmin-api.models';
import {
  formatGermanDate,
  formatGermanHoursMinutes,
  formatGermanIsoWeek,
  formatGermanLocalStartTime,
  formatGermanNumber,
  formatGermanShortDate,
  formatRunningPace,
} from '../../core/format/german-format';
import { StickyTableHeaderDirective } from '../../shared/directives/sticky-table-header.directive';

export function buildRunningWeeklyChartOptions(series: WeeklyTrainingPoint[]): EChartsCoreOption {
  const labels = series.map(
    (pt) => `${formatGermanIsoWeek(pt.iso_week_label)} (${formatGermanShortDate(pt.week_start)})`,
  );
  const values = series.map((pt) => pt.running_km);

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 12 },
      valueFormatter: (v: unknown) => `${formatGermanNumber(Number(v ?? 0), 1)} km`,
    },
    grid: { left: 48, right: 20, top: 28, bottom: 32 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: {
      type: 'value',
      name: 'km',
      nameTextStyle: { color: '#94a3b8', fontSize: 11 },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        name: 'Running distance',
        type: 'bar',
        data: values,
        barMaxWidth: 28,
        itemStyle: {
          color: '#0ea5e9',
          borderRadius: [4, 4, 0, 0],
        },
      },
      {
        name: 'Trend',
        type: 'line',
        data: values,
        smooth: true,
        symbolSize: 6,
        lineStyle: { color: '#38bdf8', width: 2 },
        itemStyle: { color: '#38bdf8' },
      },
    ],
  };
}

export function buildStrengthWeeklyChartOptions(series: WeeklyTrainingPoint[]): EChartsCoreOption {
  const labels = series.map(
    (pt) => `${formatGermanIsoWeek(pt.iso_week_label)} (${formatGermanShortDate(pt.week_start)})`,
  );
  const values = series.map((pt) => pt.strength_minutes);

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 12 },
      valueFormatter: (v: unknown) => `${formatGermanNumber(Number(v ?? 0), 0)} min`,
    },
    grid: { left: 48, right: 20, top: 28, bottom: 32 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: {
      type: 'value',
      name: 'min',
      nameTextStyle: { color: '#94a3b8', fontSize: 11 },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        name: 'Strength duration',
        type: 'bar',
        data: values,
        barMaxWidth: 28,
        itemStyle: {
          color: '#14b8a6',
          borderRadius: [4, 4, 0, 0],
        },
      },
      {
        name: 'Trend',
        type: 'line',
        data: values,
        smooth: true,
        symbolSize: 6,
        lineStyle: { color: '#2dd4bf', width: 2 },
        itemStyle: { color: '#2dd4bf' },
      },
    ],
  };
}

export function buildVo2MaxTrendChartOptions(series: Vo2MaxPoint[]): EChartsCoreOption {
  const labels = series.map((pt) => formatGermanShortDate(pt.date));
  const values = series.map((pt) => pt.vo2_max);
  const labReference = series.map(() => 46.9);

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 12 },
      valueFormatter: (v: unknown) => `${formatGermanNumber(Number(v ?? 0), 1)} mL/kg/min`,
    },
    legend: {
      top: 0,
      textStyle: { color: '#cbd5e1', fontSize: 11 },
      data: ['Garmin VO2 Max', 'Lab Reference (46,9)'],
    },
    grid: { left: 48, right: 20, top: 32, bottom: 32 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: {
      type: 'value',
      name: 'mL/kg/min',
      scale: true,
      nameTextStyle: { color: '#94a3b8', fontSize: 11 },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        name: 'Garmin VO2 Max',
        type: 'line',
        data: values,
        smooth: true,
        symbolSize: 7,
        lineStyle: { color: '#38bdf8', width: 2.5 },
        itemStyle: { color: '#38bdf8' },
        areaStyle: { color: 'rgba(56, 189, 248, 0.14)' },
      },
      {
        name: 'Lab Reference (46,9)',
        type: 'line',
        data: labReference,
        symbol: 'none',
        lineStyle: { color: '#2dd4bf', width: 1.5, type: 'dashed' },
        itemStyle: { color: '#2dd4bf' },
      },
    ],
  };
}

export function buildHrZoneWeeklyChartOptions(series: WeeklyTrainingPoint[]): EChartsCoreOption {
  const labels = series.map(
    (pt) => `${formatGermanIsoWeek(pt.iso_week_label)} (${formatGermanShortDate(pt.week_start)})`,
  );

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 12 },
      valueFormatter: (v: unknown) => `${formatGermanNumber(Number(v ?? 0), 1)} min`,
    },
    legend: {
      top: 0,
      textStyle: { color: '#cbd5e1', fontSize: 11 },
      data: ['Z1 Reg', 'Z2 GAT1 Basis', 'Z3 GAT2', 'Z4 Schwelle', 'Z5 VO2max'],
    },
    grid: { left: 48, right: 20, top: 32, bottom: 32 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: {
      type: 'value',
      name: 'min',
      nameTextStyle: { color: '#94a3b8', fontSize: 11 },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        name: 'Z1 Reg',
        type: 'bar',
        stack: 'hr-zones',
        barMaxWidth: 28,
        data: series.map((pt) => pt.hr_zone_1_min ?? 0),
        itemStyle: { color: '#64748b' },
      },
      {
        name: 'Z2 GAT1 Basis',
        type: 'bar',
        stack: 'hr-zones',
        barMaxWidth: 28,
        data: series.map((pt) => pt.hr_zone_2_min ?? 0),
        itemStyle: { color: '#2dd4bf' },
      },
      {
        name: 'Z3 GAT2',
        type: 'bar',
        stack: 'hr-zones',
        barMaxWidth: 28,
        data: series.map((pt) => pt.hr_zone_3_min ?? 0),
        itemStyle: { color: '#38bdf8' },
      },
      {
        name: 'Z4 Schwelle',
        type: 'bar',
        stack: 'hr-zones',
        barMaxWidth: 28,
        data: series.map((pt) => pt.hr_zone_4_min ?? 0),
        itemStyle: { color: '#fbbf24' },
      },
      {
        name: 'Z5 VO2max',
        type: 'bar',
        stack: 'hr-zones',
        barMaxWidth: 28,
        data: series.map((pt) => pt.hr_zone_5_min ?? 0),
        itemStyle: { color: '#f87171', borderRadius: [3, 3, 0, 0] },
      },
    ],
  };
}

@Component({
  selector: 'app-training-dashboard-tab',
  imports: [NgxEchartsDirective, StickyTableHeaderDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-6">
      <!-- Selected Window KPI Strip (7d / 30d / 90d) -->
      <section
        aria-label="Selected time window training summary"
        class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div
          class="rounded-lg border border-slate-800 bg-slate-900/90 p-5"
          data-testid="kpi-running-km"
        >
          <div class="flex items-baseline justify-between">
            <span class="text-sm font-medium text-slate-300">
              Running distance ({{ windowBadgeLabel() }})
            </span>
            <span class="font-mono text-xs text-sky-400">{{ weekRangeLabel() }}</span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="font-mono text-3xl font-bold tabular-nums text-slate-100">
              {{ formatNum(runningKm(), 1) }}
            </span>
            <span class="text-sm font-medium text-slate-400">km</span>
          </div>
          <p class="mt-1 font-mono text-xs tabular-nums text-slate-400">
            {{ runningSessionsCount() }} runs in selected window
          </p>
        </div>

        <div
          class="rounded-lg border border-slate-800 bg-slate-900/90 p-5"
          data-testid="kpi-strength-min"
        >
          <div class="flex items-baseline justify-between">
            <span class="text-sm font-medium text-slate-300">
              Strength training ({{ windowBadgeLabel() }})
            </span>
            <span class="font-mono text-xs text-teal-400">{{ weekRangeLabel() }}</span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="font-mono text-3xl font-bold tabular-nums text-slate-100">
              {{ formatNum(strengthMinutes(), 0) }}
            </span>
            <span class="text-sm font-medium text-slate-400">min</span>
          </div>
          <p class="mt-1 font-mono text-xs tabular-nums text-slate-400">
            {{ strengthSessionsCount() }} sessions ({{ formatDurationHrs(strengthMinutes()) }})
          </p>
        </div>

        <div
          class="rounded-lg border border-slate-800 bg-slate-900/90 p-5"
          data-testid="kpi-completed-workouts"
        >
          <div class="flex items-baseline justify-between">
            <span class="text-sm font-medium text-slate-300">
              Completed workouts ({{ windowBadgeLabel() }})
            </span>
            <span class="font-mono text-xs text-slate-400">Fenix 7S</span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="font-mono text-3xl font-bold tabular-nums text-slate-100">
              {{ completedWorkoutsCount() }}
            </span>
            <span class="text-sm font-medium text-slate-400">sessions</span>
          </div>
          <p class="mt-1 font-mono text-xs tabular-nums text-slate-400">
            Total load: {{ formatNum(totalTrainingLoad(), 0) }} ·
            {{ formatNum(totalCalories(), 0) }} kcal
          </p>
        </div>

        <div
          class="rounded-lg border border-slate-800 bg-slate-900/90 p-5"
          data-testid="kpi-vo2max"
        >
          <div class="flex items-baseline justify-between">
            <span class="text-sm font-medium text-slate-300">VO₂ Max &amp; GAT1 Base</span>
            <span
              class="rounded border border-teal-500/30 bg-teal-500/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-teal-300"
            >
              Lab 46,9
            </span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="font-mono text-3xl font-bold tabular-nums text-slate-100">
              {{ vo2MaxLatest() !== null ? formatNum(vo2MaxLatest(), 1) : '-' }}
            </span>
            <span class="text-xs font-medium text-slate-400">mL/kg/min</span>
          </div>
          <p class="mt-1 font-mono text-xs tabular-nums text-teal-300">
            Z2 GAT1: {{ formatNum(z2SharePercent(), 1) }}% (target 65%)
          </p>
        </div>
      </section>

      <!-- Race Predictions Strip (5K / 10K / Half Marathon / Marathon) -->
      @if (racePredictionItems().length > 0) {
        <section
          aria-label="Running race predictions"
          class="rounded-lg border border-slate-800 bg-slate-900/90 p-5"
          data-testid="race-predictions-panel"
        >
          <div
            class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5"
          >
            <div>
              <h2 class="text-base font-semibold text-slate-100">
                Race predictions (5 km · 10 km · Halbmarathon · Marathon)
              </h2>
              <p class="text-xs text-slate-400">
                Estimated finish times and target paces based on current VO₂ Max ({{
                  formatNum(vo2MaxLatest(), 1)
                }}
                mL/kg/min) · IANS threshold 5:24 /km
              </p>
            </div>
            <span
              class="rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 font-mono text-xs text-sky-300"
            >
              VO₂ Max {{ formatNum(vo2MaxLatest(), 1) }} mL/kg/min
            </span>
          </div>

          <div
            class="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4"
            data-testid="race-predictions-grid"
          >
            @for (pred of racePredictionItems(); track pred.distance_key) {
              <div class="rounded-md border border-slate-800 bg-slate-950/70 p-4">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-slate-300">{{ pred.label }}</span>
                  <span class="font-mono text-[11px] tabular-nums text-slate-400">
                    {{ formatNum(pred.distance_km, 1) }} km
                  </span>
                </div>
                <div class="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-100">
                  {{ pred.predicted_time_label }}
                </div>
                <div class="mt-1 font-mono text-xs tabular-nums text-sky-300">
                  Target pace: {{ pred.predicted_pace_min_per_km }} /km
                </div>
              </div>
            }
          </div>
        </section>
      }

      <!-- Range Selector + ECharts Weekly & Physiological Diagrams -->
      <section class="rounded-lg border border-slate-800 bg-slate-900/90 p-5">
        <div
          class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4"
        >
          <div>
            <h2 class="text-base font-semibold text-slate-100">
              Weekly training &amp; physiological progression ({{ windowBadgeLabel() }})
            </h2>
            <p class="text-xs text-slate-400">
              ISO-8601 weekly volume, VO₂ Max trajectory, and HR zone distribution ({{
                fullDateRangeLabel()
              }})
            </p>
          </div>

          <div
            class="inline-flex rounded-lg border border-sky-500/40 bg-slate-950 p-1"
            role="group"
            aria-label="Training history window"
          >
            @for (d of dayOptions; track d) {
              <button
                type="button"
                (click)="weeksChange.emit(d)"
                [attr.data-testid]="'weeks-btn-' + d"
                [class]="
                  selectedWeeks() === d
                    ? 'cursor-pointer rounded-md bg-sky-500 px-3.5 py-1 font-mono text-xs font-bold text-slate-950 shadow-sm'
                    : 'cursor-pointer rounded-md px-3.5 py-1 font-mono text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white'
                "
              >
                {{ d }}d
              </button>
            }
          </div>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-4">
            <h3 class="mb-2 text-xs font-semibold text-slate-300">Weekly running volume (km)</h3>
            <div
              echarts
              [initOpts]="{ renderer: 'svg' }"
              [options]="runningChartOptions()"
              class="h-64 w-full"
              data-testid="chart-weekly-running"
            ></div>
          </div>

          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-4">
            <h3 class="mb-2 text-xs font-semibold text-slate-300">
              Weekly strength volume (minutes)
            </h3>
            <div
              echarts
              [initOpts]="{ renderer: 'svg' }"
              [options]="strengthChartOptions()"
              class="h-64 w-full"
              data-testid="chart-weekly-strength"
            ></div>
          </div>

          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-4">
            <div class="mb-2 flex items-center justify-between">
              <h3 class="text-xs font-semibold text-slate-300">VO₂ Max progression (mL/kg/min)</h3>
              <span class="font-mono text-[11px] text-slate-400">
                Sportordination Lab: 46,9 mL/kg/min
              </span>
            </div>
            <div
              echarts
              [initOpts]="{ renderer: 'svg' }"
              [options]="vo2MaxChartOptions()"
              class="h-64 w-full"
              data-testid="chart-vo2max-trend"
            ></div>
          </div>

          <div class="rounded-md border border-slate-800 bg-slate-950/60 p-4">
            <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-xs font-semibold text-slate-300">
                Running HR time-in-zone (Z1–Z5 minutes/week)
              </h3>
              <span class="font-mono text-[11px] text-teal-300">
                Z2 GAT1 (140–155 bpm): {{ formatNum(z2SharePercent(), 1) }}% / 65% target
              </span>
            </div>
            <div
              echarts
              [initOpts]="{ renderer: 'svg' }"
              [options]="hrZoneChartOptions()"
              class="h-64 w-full"
              data-testid="chart-hr-zones"
            ></div>
          </div>
        </div>

        @if (hrZonesWindow().length > 0) {
          <div class="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5" data-testid="hr-zones-strip">
            @for (z of hrZonesWindow(); track z.zone) {
              <div class="rounded border border-slate-800 bg-slate-950/80 px-3 py-2">
                <div class="flex items-center justify-between text-[11px]">
                  <span class="font-semibold text-slate-200">{{ z.label }}</span>
                  <span class="font-mono text-slate-400">{{ z.bpm_range }}</span>
                </div>
                <div
                  class="mt-1 flex items-baseline justify-between font-mono text-xs tabular-nums"
                >
                  <span [class]="z.zone === 2 ? 'font-bold text-teal-300' : 'text-slate-100'">
                    {{ formatNum(z.percentage, 1) }}% ({{ formatNum(z.minutes, 1) }}m)
                  </span>
                  <span class="text-[11px] text-slate-400">
                    target {{ formatNum(z.target_percentage, 0) }}%
                  </span>
                </div>
              </div>
            }
          </div>
        }
      </section>

      <!-- Selected Window Completed Workouts Ledger -->
      <section class="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/90">
        <div
          class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-5 py-4"
        >
          <div>
            <h2 class="text-base font-semibold text-slate-100">
              Completed workouts ({{ windowBadgeLabel() }})
            </h2>
            <p class="text-xs text-slate-400">
              Individual Fenix 7S sessions recorded between {{ fullDateRangeLabel() }}
            </p>
          </div>
          <span
            class="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono text-xs text-sky-400"
          >
            {{ displayedActivities().length }} entries
          </span>
        </div>

        @if (displayedActivities().length === 0) {
          <div
            class="px-5 py-8 text-center text-sm text-slate-400"
            data-testid="empty-week-workouts"
          >
            No completed workouts synced for the selected {{ windowBadgeLabel() }} window yet. Sync
            your Fenix 7S after your next session.
          </div>
        } @else {
          <div class="relative overflow-auto">
            <table
              class="w-full border-collapse text-left text-sm"
              data-testid="week-workouts-table"
            >
              <thead appStickyHeader class="sticky top-0 z-20 bg-slate-950">
                <tr
                  class="border-b border-slate-800 bg-slate-950 text-xs font-semibold text-slate-300 shadow-[inset_0_-1px_0_0_#1e293b]"
                >
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-slate-950 px-3.5 py-3 shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Date &amp; Time
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-slate-950 px-3.5 py-3 shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Discipline
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-slate-950 px-3.5 py-3 shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Activity
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-slate-950 px-3.5 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Distance
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-slate-950 px-3.5 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Duration
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-slate-950 px-3.5 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Avg Pace
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-slate-950 px-3.5 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Cadence (spm)
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-slate-950 px-3.5 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Stride
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-slate-950 px-3.5 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Power
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-slate-950 px-3.5 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Elev. Gain
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-slate-950 px-3.5 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Avg / Max HR
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-slate-950 px-3.5 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    TE (Aer / Ana)
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-slate-950 px-3.5 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Calories
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-slate-950 px-3.5 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Load
                  </th>
                </tr>
              </thead>
              <tbody class="relative z-0 divide-y divide-slate-800/80 font-mono text-xs">
                @for (act of displayedActivities(); track act.activity_id) {
                  <tr class="transition-colors hover:bg-slate-800/50">
                    <td class="whitespace-nowrap px-3.5 py-3 tabular-nums text-slate-200">
                      {{ formatStartTime(act.start_time_local, act.date_local) }}
                    </td>
                    <td class="whitespace-nowrap px-3.5 py-3 font-sans">
                      @if (act.sport_type === 'running') {
                        <span
                          class="inline-flex items-center rounded border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-300"
                        >
                          Running
                        </span>
                      } @else if (act.sport_type === 'strength_training') {
                        <span
                          class="inline-flex items-center rounded border border-teal-500/30 bg-teal-500/15 px-2 py-0.5 text-xs font-medium text-teal-300"
                        >
                          Strength
                        </span>
                      } @else {
                        <span
                          class="inline-flex items-center rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300"
                        >
                          {{ act.sport_type }}
                        </span>
                      }
                    </td>
                    <td class="whitespace-nowrap px-3.5 py-3 font-sans font-medium text-slate-100">
                      {{ act.activity_name }}
                    </td>
                    <td
                      class="whitespace-nowrap px-3.5 py-3 text-right tabular-nums text-slate-200"
                    >
                      {{ formatDistanceOrSets(act) }}
                    </td>
                    <td
                      class="whitespace-nowrap px-3.5 py-3 text-right tabular-nums text-slate-200"
                    >
                      {{ formatNum(act.duration_min, 1) }} min
                    </td>
                    <td class="whitespace-nowrap px-3.5 py-3 text-right tabular-nums text-sky-300">
                      {{ formatPace(act) }}
                    </td>
                    <td
                      class="whitespace-nowrap px-3.5 py-3 text-right tabular-nums text-slate-200"
                    >
                      {{ formatCadence(act) }}
                    </td>
                    <td
                      class="whitespace-nowrap px-3.5 py-3 text-right tabular-nums text-slate-300"
                    >
                      {{ formatStride(act) }}
                    </td>
                    <td
                      class="whitespace-nowrap px-3.5 py-3 text-right tabular-nums text-slate-300"
                    >
                      {{
                        act.avg_power_w !== null && act.avg_power_w !== undefined
                          ? formatNum(act.avg_power_w, 0) + ' W'
                          : '-'
                      }}
                    </td>
                    <td
                      class="whitespace-nowrap px-3.5 py-3 text-right tabular-nums text-slate-300"
                    >
                      {{ formatElevation(act) }}
                    </td>
                    <td
                      class="whitespace-nowrap px-3.5 py-3 text-right tabular-nums text-slate-300"
                    >
                      {{ act.avg_hr ?? '-' }} / {{ act.max_hr ?? '-' }} bpm
                    </td>
                    <td
                      class="whitespace-nowrap px-3.5 py-3 text-right tabular-nums text-slate-300"
                    >
                      {{ formatTrainingEffect(act) }}
                    </td>
                    <td
                      class="whitespace-nowrap px-3.5 py-3 text-right tabular-nums text-slate-300"
                    >
                      {{ act.calories !== null ? formatNum(act.calories, 0) + ' kcal' : '-' }}
                    </td>
                    <td
                      class="whitespace-nowrap px-3.5 py-3 text-right tabular-nums text-slate-100"
                    >
                      {{ act.training_load !== null ? formatNum(act.training_load, 0) : '-' }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  `,
})
export class TrainingDashboardTabComponent {
  readonly dashboard = input<TrainingDashboardResponse | null>(null);
  readonly selectedWeeks = input<TrainingWeekWindow>(30);
  readonly weeksChange = output<TrainingWeekWindow>();

  readonly dayOptions: readonly HealthDayWindow[] = [7, 30, 90];

  readonly windowBadgeLabel = computed(() => {
    const w = this.selectedWeeks();
    if (w === 7 || w === 30 || w === 90) {
      return `${w}d`;
    }
    const req = this.dashboard()?.days_requested;
    if (req) {
      return `${req}d`;
    }
    return `${w}w`;
  });

  readonly displayedActivities = computed<CompletedWorkoutItem[]>(() => {
    const d = this.dashboard();
    if (!d) {
      return [];
    }
    if (d.window_activities && d.window_activities.length > 0) {
      return d.window_activities;
    }
    return d.current_week_activities ?? [];
  });

  readonly runningKm = computed(() => {
    const d = this.dashboard();
    if (!d) {
      return 0;
    }
    return d.ran_km_window ?? d.ran_km_this_week ?? 0;
  });

  readonly strengthMinutes = computed(() => {
    const d = this.dashboard();
    if (!d) {
      return 0;
    }
    return d.strength_minutes_window ?? d.strength_minutes_this_week ?? 0;
  });

  readonly completedWorkoutsCount = computed(() => {
    const d = this.dashboard();
    if (!d) {
      return 0;
    }
    return d.completed_workouts_window ?? d.completed_workouts_this_week ?? 0;
  });

  readonly runningSessionsCount = computed(
    () => this.displayedActivities().filter((a) => a.sport_type === 'running').length,
  );

  readonly strengthSessionsCount = computed(
    () => this.displayedActivities().filter((a) => a.sport_type === 'strength_training').length,
  );

  readonly totalTrainingLoad = computed(() =>
    this.displayedActivities().reduce((acc, a) => acc + (a.training_load ?? 0), 0),
  );

  readonly totalCalories = computed(() =>
    this.displayedActivities().reduce((acc, a) => acc + (a.calories ?? 0), 0),
  );

  readonly weekRangeLabel = computed(() => {
    const d = this.dashboard();
    if (!d) {
      return 'Window';
    }
    const start = d.window_start || d.current_week_start;
    const end = d.window_end || d.current_week_end;
    return `${formatGermanShortDate(start)} – ${formatGermanShortDate(end)}`;
  });

  readonly fullDateRangeLabel = computed(() => {
    const d = this.dashboard();
    if (!d) {
      return '-';
    }
    const start = d.window_start || d.current_week_start;
    const end = d.window_end || d.current_week_end;
    return `${formatGermanDate(start)} – ${formatGermanDate(end)}`;
  });

  readonly runningChartOptions = computed<EChartsCoreOption>(() =>
    buildRunningWeeklyChartOptions(this.dashboard()?.weekly_series ?? []),
  );

  readonly strengthChartOptions = computed<EChartsCoreOption>(() =>
    buildStrengthWeeklyChartOptions(this.dashboard()?.weekly_series ?? []),
  );

  readonly vo2MaxLatest = computed<number | null>(() => this.dashboard()?.vo2_max_latest ?? null);

  readonly racePredictionItems = computed<RacePredictionItem[]>(
    () => this.dashboard()?.race_predictions?.items ?? [],
  );

  readonly hrZonesWindow = computed<HrZoneWindowItem[]>(
    () => this.dashboard()?.hr_zones_window ?? [],
  );

  readonly z2SharePercent = computed<number>(() => {
    const z2 = this.hrZonesWindow().find((z) => z.zone === 2);
    return z2?.percentage ?? 0;
  });

  readonly vo2MaxChartOptions = computed<EChartsCoreOption>(() =>
    buildVo2MaxTrendChartOptions(this.dashboard()?.vo2_max_series ?? []),
  );

  readonly hrZoneChartOptions = computed<EChartsCoreOption>(() =>
    buildHrZoneWeeklyChartOptions(this.dashboard()?.weekly_series ?? []),
  );

  formatNum(val: number | null | undefined, decimals: number): string {
    return formatGermanNumber(val, decimals);
  }

  formatDistanceOrSets(act: CompletedWorkoutItem): string {
    if (act.distance_km > 0) {
      return `${formatGermanNumber(act.distance_km, 2)} km`;
    }
    if (act.total_sets && act.total_sets > 0) {
      if (act.total_reps && act.total_reps > 0) {
        return `${act.total_sets} sets · ${act.total_reps} reps`;
      }
      return `${act.total_sets} sets`;
    }
    return '-';
  }

  formatDurationHrs(minutes: number | null | undefined): string {
    return formatGermanHoursMinutes(minutes);
  }

  formatStartTime(startTimeLocal: string, dateLocal: string): string {
    return formatGermanLocalStartTime(startTimeLocal, dateLocal);
  }

  formatPace(act: CompletedWorkoutItem): string {
    if (act.sport_type !== 'running' && act.distance_km <= 0) {
      return '-';
    }
    return formatRunningPace(
      act.avg_pace_min_per_km,
      act.avg_pace_sec_per_km,
      act.duration_min,
      act.distance_km,
    );
  }

  formatCadence(act: CompletedWorkoutItem): string {
    if (act.avg_cadence_spm !== null && act.avg_cadence_spm !== undefined) {
      if (act.max_cadence_spm !== null && act.max_cadence_spm !== undefined) {
        return `${formatGermanNumber(act.avg_cadence_spm, 0)} / ${formatGermanNumber(act.max_cadence_spm, 0)} spm`;
      }
      return `${formatGermanNumber(act.avg_cadence_spm, 0)} spm`;
    }
    return '-';
  }

  formatStride(act: CompletedWorkoutItem): string {
    if (act.avg_stride_m !== null && act.avg_stride_m !== undefined && act.avg_stride_m > 0) {
      const strideStr = `${formatGermanNumber(act.avg_stride_m, 2)} m`;
      if (act.avg_gct_ms !== null && act.avg_gct_ms !== undefined && act.avg_gct_ms > 0) {
        return `${strideStr} · ${formatGermanNumber(act.avg_gct_ms, 0)} ms`;
      }
      return strideStr;
    }
    return '-';
  }

  formatElevation(act: CompletedWorkoutItem): string {
    if (
      act.elevation_gain_m !== null &&
      act.elevation_gain_m !== undefined &&
      act.elevation_gain_m > 0
    ) {
      return `+${formatGermanNumber(act.elevation_gain_m, 0)} m`;
    }
    return '-';
  }

  formatTrainingEffect(act: CompletedWorkoutItem): string {
    if (
      (act.aerobic_te === null || act.aerobic_te === undefined) &&
      (act.anaerobic_te === null || act.anaerobic_te === undefined)
    ) {
      return '-';
    }
    return `${formatGermanNumber(act.aerobic_te ?? 0, 1)} / ${formatGermanNumber(act.anaerobic_te ?? 0, 1)}`;
  }
}
