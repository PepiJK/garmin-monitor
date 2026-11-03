import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import {
  TrainingDashboardResponse,
  TrainingWeekWindow,
  WeeklyTrainingPoint,
} from '../../core/api/garmin-api.models';

export function buildRunningWeeklyChartOptions(series: WeeklyTrainingPoint[]): EChartsCoreOption {
  const labels = series.map((pt) => pt.iso_week_label);
  const values = series.map((pt) => pt.running_km);

  return {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: unknown) => `${Number(v ?? 0).toFixed(1)} km`,
    },
    grid: { left: 48, right: 20, top: 28, bottom: 32 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: '#475569', fontSize: 11 },
      axisLine: { lineStyle: { color: '#CBD5E1' } },
    },
    yAxis: {
      type: 'value',
      name: 'km',
      nameTextStyle: { color: '#475569', fontSize: 11 },
      axisLabel: { color: '#475569', fontSize: 11 },
      splitLine: { lineStyle: { color: '#E2E8F0' } },
    },
    series: [
      {
        name: 'Running distance',
        type: 'bar',
        data: values,
        barMaxWidth: 28,
        itemStyle: {
          color: '#0284C7',
          borderRadius: [4, 4, 0, 0],
        },
      },
      {
        name: 'Trend',
        type: 'line',
        data: values,
        smooth: true,
        symbolSize: 6,
        lineStyle: { color: '#0369A1', width: 2 },
        itemStyle: { color: '#0369A1' },
      },
    ],
  };
}

export function buildStrengthWeeklyChartOptions(series: WeeklyTrainingPoint[]): EChartsCoreOption {
  const labels = series.map((pt) => pt.iso_week_label);
  const values = series.map((pt) => pt.strength_minutes);

  return {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: unknown) => `${Number(v ?? 0).toFixed(0)} min`,
    },
    grid: { left: 48, right: 20, top: 28, bottom: 32 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: '#475569', fontSize: 11 },
      axisLine: { lineStyle: { color: '#CBD5E1' } },
    },
    yAxis: {
      type: 'value',
      name: 'min',
      nameTextStyle: { color: '#475569', fontSize: 11 },
      axisLabel: { color: '#475569', fontSize: 11 },
      splitLine: { lineStyle: { color: '#E2E8F0' } },
    },
    series: [
      {
        name: 'Strength duration',
        type: 'bar',
        data: values,
        barMaxWidth: 28,
        itemStyle: {
          color: '#0D9488',
          borderRadius: [4, 4, 0, 0],
        },
      },
      {
        name: 'Trend',
        type: 'line',
        data: values,
        smooth: true,
        symbolSize: 6,
        lineStyle: { color: '#0F766E', width: 2 },
        itemStyle: { color: '#0F766E' },
      },
    ],
  };
}

@Component({
  selector: 'app-training-dashboard-tab',
  imports: [NgxEchartsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Current ISO-Week KPI Strip -->
      <section
        aria-label="Current week training summary"
        class="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <div class="rounded-lg border border-slate-200 bg-white p-5" data-testid="kpi-running-km">
          <div class="flex items-baseline justify-between">
            <span class="text-sm font-medium text-slate-600">Running distance this week</span>
            <span class="font-mono text-xs text-sky-700">{{ weekRangeLabel() }}</span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="font-mono text-3xl font-bold tabular-nums text-slate-900">
              {{ (dashboard()?.ran_km_this_week ?? 0).toFixed(1) }}
            </span>
            <span class="text-sm font-medium text-slate-500">km</span>
          </div>
          <p class="mt-1 text-xs text-slate-500">Monday–Sunday ISO-8601 window</p>
        </div>

        <div class="rounded-lg border border-slate-200 bg-white p-5" data-testid="kpi-strength-min">
          <div class="flex items-baseline justify-between">
            <span class="text-sm font-medium text-slate-600">Strength training this week</span>
            <span class="font-mono text-xs text-teal-700">{{ weekRangeLabel() }}</span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="font-mono text-3xl font-bold tabular-nums text-slate-900">
              {{ (dashboard()?.strength_minutes_this_week ?? 0).toFixed(0) }}
            </span>
            <span class="text-sm font-medium text-slate-500">min</span>
          </div>
          <p class="mt-1 text-xs text-slate-500">Cumulative strength &amp; conditioning time</p>
        </div>

        <div
          class="rounded-lg border border-slate-200 bg-white p-5"
          data-testid="kpi-completed-workouts"
        >
          <div class="flex items-baseline justify-between">
            <span class="text-sm font-medium text-slate-600">Completed workouts this week</span>
            <span class="font-mono text-xs text-slate-500">Fenix 7S</span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="font-mono text-3xl font-bold tabular-nums text-slate-900">
              {{ dashboard()?.completed_workouts_this_week ?? 0 }}
            </span>
            <span class="text-sm font-medium text-slate-500">sessions</span>
          </div>
          <p class="mt-1 text-xs text-slate-500">Synced activities since Monday 00:00</p>
        </div>
      </section>

      <!-- Range Selector + ECharts Weekly Diagrams -->
      <section class="rounded-lg border border-slate-200 bg-white p-5">
        <div
          class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4"
        >
          <div>
            <h2 class="text-base font-semibold text-slate-900">Weekly training progression</h2>
            <p class="text-xs text-slate-500">
              ISO-8601 weekly running kilometers and strength training minutes
            </p>
          </div>

          <div
            class="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5"
            role="group"
            aria-label="Training history window"
          >
            @for (w of weekOptions; track w) {
              <button
                type="button"
                (click)="weeksChange.emit(w)"
                [attr.data-testid]="'weeks-btn-' + w"
                [class]="
                  selectedWeeks() === w
                    ? 'cursor-pointer rounded bg-white px-3 py-1 font-mono text-xs font-semibold text-sky-700 shadow-xs'
                    : 'cursor-pointer rounded px-3 py-1 font-mono text-xs font-medium text-slate-600 hover:text-slate-900'
                "
              >
                {{ w }}w
              </button>
            }
          </div>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div class="rounded-md border border-slate-100 p-3">
            <h3 class="mb-2 text-xs font-semibold text-slate-700">Weekly running volume (km)</h3>
            <div
              echarts
              [initOpts]="{ renderer: 'svg' }"
              [options]="runningChartOptions()"
              class="h-64 w-full"
              data-testid="chart-weekly-running"
            ></div>
          </div>

          <div class="rounded-md border border-slate-100 p-3">
            <h3 class="mb-2 text-xs font-semibold text-slate-700">
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

      <!-- Current Week Completed Workouts Ledger -->
      <section class="rounded-lg border border-slate-200 bg-white">
        <div class="border-b border-slate-200 px-5 py-4">
          <h2 class="text-base font-semibold text-slate-900">Completed workouts this week</h2>
          <p class="text-xs text-slate-500">
            Individual Fenix 7S sessions recorded between
            {{ dashboard()?.current_week_start ?? '-' }} and
            {{ dashboard()?.current_week_end ?? '-' }}
          </p>
        </div>

        @if ((dashboard()?.current_week_activities ?? []).length === 0) {
          <div
            class="px-5 py-8 text-center text-sm text-slate-500"
            data-testid="empty-week-workouts"
          >
            No completed workouts synced for the current week yet. Sync your Fenix 7S after your
            next session.
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table
              class="w-full border-collapse text-left text-sm"
              data-testid="week-workouts-table"
            >
              <thead>
                <tr
                  class="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600"
                >
                  <th class="px-4 py-3">Date</th>
                  <th class="px-4 py-3">Discipline</th>
                  <th class="px-4 py-3">Activity</th>
                  <th class="px-4 py-3 text-right">Distance</th>
                  <th class="px-4 py-3 text-right">Duration</th>
                  <th class="px-4 py-3 text-right">Avg / Max HR</th>
                  <th class="px-4 py-3 text-right">Load</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 font-mono text-xs">
                @for (act of dashboard()?.current_week_activities ?? []; track act.activity_id) {
                  <tr class="hover:bg-slate-50/80">
                    <td class="px-4 py-3 tabular-nums text-slate-700">{{ act.date_local }}</td>
                    <td class="px-4 py-3 font-sans">
                      @if (act.sport_type === 'running') {
                        <span
                          class="inline-flex items-center rounded bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700"
                        >
                          Running
                        </span>
                      } @else if (act.sport_type === 'strength_training') {
                        <span
                          class="inline-flex items-center rounded bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700"
                        >
                          Strength
                        </span>
                      } @else {
                        <span
                          class="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                        >
                          {{ act.sport_type }}
                        </span>
                      }
                    </td>
                    <td class="px-4 py-3 font-sans font-medium text-slate-900">
                      {{ act.activity_name }}
                    </td>
                    <td class="px-4 py-3 text-right tabular-nums text-slate-700">
                      {{ act.distance_km > 0 ? act.distance_km.toFixed(2) + ' km' : '-' }}
                    </td>
                    <td class="px-4 py-3 text-right tabular-nums text-slate-700">
                      {{ act.duration_min.toFixed(0) }} min
                    </td>
                    <td class="px-4 py-3 text-right tabular-nums text-slate-700">
                      {{ act.avg_hr ?? '-' }} / {{ act.max_hr ?? '-' }} bpm
                    </td>
                    <td class="px-4 py-3 text-right tabular-nums text-slate-700">
                      {{ act.training_load !== null ? act.training_load.toFixed(0) : '-' }}
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
  readonly selectedWeeks = input<TrainingWeekWindow>(12);
  readonly weeksChange = output<TrainingWeekWindow>();

  readonly weekOptions: readonly TrainingWeekWindow[] = [4, 12, 26];

  readonly weekRangeLabel = computed(() => {
    const d = this.dashboard();
    if (!d) {
      return 'ISO Week';
    }
    return `${d.current_week_start.slice(5)} .. ${d.current_week_end.slice(5)}`;
  });

  readonly runningChartOptions = computed<EChartsCoreOption>(() =>
    buildRunningWeeklyChartOptions(this.dashboard()?.weekly_series ?? []),
  );

  readonly strengthChartOptions = computed<EChartsCoreOption>(() =>
    buildStrengthWeeklyChartOptions(this.dashboard()?.weekly_series ?? []),
  );
}
