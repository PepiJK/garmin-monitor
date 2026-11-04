import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { DailyHealthPoint, HealthDayWindow } from '../../core/api/garmin-api.models';
import { GarminApiService } from '../../core/api/garmin-api.service';
import {
  formatGermanDate,
  formatGermanDateWithWeekday,
  formatGermanHoursMinutes,
  formatGermanNumber,
} from '../../core/format/german-format';
import { HealthChartsComponent } from './health-charts.component';
import { HealthKpisComponent } from './health-kpis.component';
import { HealthWarningsBannerComponent } from './health-warnings-banner.component';
import { StickyTableHeaderDirective } from '../../shared/directives/sticky-table-header.directive';

@Component({
  selector: 'app-health-page',
  imports: [
    HealthWarningsBannerComponent,
    HealthKpisComponent,
    HealthChartsComponent,
    StickyTableHeaderDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-100">Health &amp; Recovery</h1>
          <p class="mt-1 text-sm text-slate-400">
            Autonomic HRV baseline monitoring, sleep architecture, and multi-signal recovery
            diagnostics ({{ windowRangeSummary() }})
          </p>
        </div>

        <!-- Prominent 7d / 30d / 90d Toggle -->
        <div
          class="flex items-center gap-3 rounded-xl border-2 border-sky-500/40 bg-slate-900 px-3 py-1.5 shadow-lg shadow-sky-950/50"
          role="group"
          aria-label="Health history window"
          data-testid="health-days-toggle"
        >
          <div class="hidden sm:block">
            <span class="block text-[11px] font-semibold tracking-wide text-sky-400">
              Time Window
            </span>
            <span class="block font-mono text-[11px] tabular-nums text-slate-400">
              Last {{ api.selectedHealthDays() }} days
            </span>
          </div>
          <div class="inline-flex rounded-lg bg-slate-950 p-1">
            @for (d of dayOptions; track d) {
              <button
                type="button"
                (click)="onDaysChange(d)"
                [attr.data-testid]="'days-btn-' + d"
                [attr.aria-pressed]="api.selectedHealthDays() === d"
                [class]="
                  api.selectedHealthDays() === d
                    ? 'cursor-pointer rounded-md bg-sky-500 px-4 py-1.5 font-mono text-sm font-bold text-slate-950 shadow-md shadow-sky-500/25 transition-all'
                    : 'cursor-pointer rounded-md px-4 py-1.5 font-mono text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white'
                "
              >
                {{ d }}d
              </button>
            }
          </div>
        </div>
      </div>

      <app-health-warnings-banner [warnings]="api.healthDashboard()?.warnings ?? []" />

      <app-health-kpis
        [kpis]="api.healthDashboard()?.kpis ?? null"
        [series]="api.healthDashboard()?.series ?? []"
        [selectedDays]="api.selectedHealthDays()"
      />

      <app-health-charts [series]="api.healthDashboard()?.series ?? []" />

      <!-- Daily Health Telemetry Ledger reflecting selected 7d / 30d / 90d window -->
      <section class="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/90">
        <div
          class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-5 py-4"
        >
          <div>
            <h2 class="text-base font-semibold text-slate-100">
              Daily recovery log ({{ api.selectedHealthDays() }}d)
            </h2>
            <p class="text-xs text-slate-400">
              Daily physiological measurements in the selected {{ api.selectedHealthDays() }}d
              window ({{ windowRangeSummary() }})
            </p>
          </div>
          <span
            class="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 font-mono text-xs text-sky-400"
          >
            {{ reversedSeries().length }} days
          </span>
        </div>

        @if (reversedSeries().length === 0) {
          <div class="px-5 py-8 text-center text-sm text-slate-400" data-testid="empty-health-log">
            No health records available for the selected time window.
          </div>
        } @else {
          <div class="relative overflow-auto">
            <table class="w-full border-collapse text-left text-sm" data-testid="health-days-table">
              <thead appStickyHeader class="sticky top-0 z-20 bg-slate-950">
                <tr
                  class="border-b border-slate-800 bg-slate-950 text-xs font-semibold text-slate-300 shadow-[inset_0_-1px_0_0_#1e293b]"
                >
                  <th
                    class="sticky top-0 z-20 bg-slate-950 px-4 py-3 shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Date
                  </th>
                  <th
                    class="sticky top-0 z-20 bg-slate-950 px-4 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Nightly HRV
                  </th>
                  <th
                    class="sticky top-0 z-20 bg-slate-950 px-4 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Sleep Score
                  </th>
                  <th
                    class="sticky top-0 z-20 bg-slate-950 px-4 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Sleep Duration
                  </th>
                  <th
                    class="sticky top-0 z-20 bg-slate-950 px-4 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Resting HR
                  </th>
                  <th
                    class="sticky top-0 z-20 bg-slate-950 px-4 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Body Battery
                  </th>
                  <th
                    class="sticky top-0 z-20 bg-slate-950 px-4 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Avg Stress
                  </th>
                  <th
                    class="sticky top-0 z-20 bg-slate-950 px-4 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Readiness
                  </th>
                  <th
                    class="sticky top-0 z-20 bg-slate-950 px-4 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Steps
                  </th>
                </tr>
              </thead>
              <tbody class="relative z-0 divide-y divide-slate-800/80 font-mono text-xs">
                @for (row of reversedSeries(); track row.date) {
                  <tr class="transition-colors hover:bg-slate-800/50">
                    <td class="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-200">
                      {{ formatDateWithWeekday(row.date) }}
                    </td>
                    <td
                      class="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-slate-200"
                    >
                      {{
                        row.hrv_nightly_avg !== null
                          ? formatNum(row.hrv_nightly_avg, 0) + ' ms'
                          : '-'
                      }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-sky-300">
                      {{ row.sleep_score !== null ? formatNum(row.sleep_score, 0) : '-' }}
                    </td>
                    <td
                      class="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-slate-300"
                    >
                      {{ formatSleepDuration(row.sleep_total_min) }}
                    </td>
                    <td
                      class="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-slate-200"
                    >
                      {{ row.resting_hr !== null ? formatNum(row.resting_hr, 0) + ' bpm' : '-' }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-teal-300">
                      {{ formatBodyBattery(row) }}
                    </td>
                    <td
                      class="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-slate-300"
                    >
                      {{
                        row.stress_avg !== null && row.stress_avg >= 0
                          ? formatNum(row.stress_avg, 0)
                          : '-'
                      }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-sky-300">
                      {{
                        row.training_readiness_score !== null
                          ? formatNum(row.training_readiness_score, 0)
                          : '-'
                      }}
                    </td>
                    <td
                      class="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-slate-200"
                    >
                      {{ row.steps !== null ? formatNum(row.steps, 0) : '-' }}
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
export class HealthPageComponent implements OnInit {
  readonly api = inject(GarminApiService);
  readonly dayOptions: readonly HealthDayWindow[] = [7, 30, 90];

  readonly reversedSeries = computed<DailyHealthPoint[]>(() => {
    const s = this.api.healthDashboard()?.series ?? [];
    return [...s].reverse();
  });

  readonly windowRangeSummary = computed(() => {
    const s = this.api.healthDashboard()?.series ?? [];
    if (s.length > 0) {
      return `${formatGermanDate(s[0].date)} – ${formatGermanDate(s[s.length - 1].date)}`;
    }
    return `${this.api.selectedHealthDays()}d window`;
  });

  ngOnInit(): void {
    this.api.loadHealthDashboard(this.api.selectedHealthDays());
  }

  onDaysChange(days: HealthDayWindow): void {
    this.api.setDaysWindow(days);
  }

  formatDateWithWeekday(isoDate: string): string {
    return formatGermanDateWithWeekday(isoDate);
  }

  formatNum(val: number | null | undefined, decimals: number): string {
    return formatGermanNumber(val, decimals);
  }

  formatSleepDuration(minutes: number | null): string {
    return formatGermanHoursMinutes(minutes);
  }

  formatBodyBattery(row: DailyHealthPoint): string {
    if (row.body_battery_high === null && row.body_battery_low === null) {
      return '-';
    }
    return `${row.body_battery_high ?? '-'} / ${row.body_battery_low ?? '-'}`;
  }
}
