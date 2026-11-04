import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import {
  CompletedWorkoutItem,
  HealthDayWindow,
  TrainingDashboardResponse,
  TrainingWeekWindow,
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
        class="grid grid-cols-1 gap-5 sm:grid-cols-3"
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
      </section>

      <!-- Range Selector + ECharts Weekly Diagrams -->
      <section class="rounded-lg border border-slate-800 bg-slate-900/90 p-5">
        <div
          class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4"
        >
          <div>
            <h2 class="text-base font-semibold text-slate-100">
              Weekly training progression ({{ windowBadgeLabel() }})
            </h2>
            <p class="text-xs text-slate-400">
              ISO-8601 weekly running distance and strength duration ({{ fullDateRangeLabel() }})
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
        </div>
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
                      {{ act.distance_km > 0 ? formatNum(act.distance_km, 2) + ' km' : '-' }}
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

  formatNum(val: number | null | undefined, decimals: number): string {
    return formatGermanNumber(val, decimals);
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
      return `${formatGermanNumber(act.avg_stride_m, 2)} m`;
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
