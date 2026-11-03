import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HealthKpiSummary } from '../../core/api/garmin-api.models';

@Component({
  selector: 'app-health-kpis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      aria-label="Current physiological vitals"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6"
    >
      <!-- HRV Card -->
      <div class="rounded-lg border border-slate-200 bg-white p-4" data-testid="kpi-hrv">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-600">Nightly HRV</span>
          <span [class]="hrvStatusClass()">{{ kpis()?.hrv_status ?? 'N/A' }}</span>
        </div>
        <div class="mt-2 flex items-baseline gap-1.5">
          <span class="font-mono text-2xl font-bold tabular-nums text-slate-900">
            {{ formatNum(kpis()?.hrv_nightly_avg, 0) }}
          </span>
          <span class="text-xs text-slate-500">ms</span>
        </div>
        <p class="mt-1 font-mono text-xs tabular-nums text-slate-500">
          Baseline: {{ formatBaseline() }}
        </p>
      </div>

      <!-- Sleep Score Card -->
      <div class="rounded-lg border border-slate-200 bg-white p-4" data-testid="kpi-sleep">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-600">Sleep score</span>
          <span class="font-mono text-xs font-medium text-sky-700">
            {{ kpis()?.sleep_qualifier ?? '-' }}
          </span>
        </div>
        <div class="mt-2 flex items-baseline gap-1.5">
          <span class="font-mono text-2xl font-bold tabular-nums text-slate-900">
            {{ formatNum(kpis()?.sleep_score, 0) }}
          </span>
          <span class="text-xs text-slate-500">/ 100</span>
        </div>
        <p class="mt-1 font-mono text-xs tabular-nums text-slate-500">
          Duration: {{ formatSleepDuration(kpis()?.sleep_total_min ?? null) }}
        </p>
      </div>

      <!-- Resting HR Card -->
      <div class="rounded-lg border border-slate-200 bg-white p-4" data-testid="kpi-rhr">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-600">Resting HR</span>
          <span class="font-mono text-xs text-slate-500">bpm</span>
        </div>
        <div class="mt-2 flex items-baseline gap-1.5">
          <span class="font-mono text-2xl font-bold tabular-nums text-slate-900">
            {{ formatNum(kpis()?.resting_hr, 0) }}
          </span>
          <span class="text-xs text-slate-500">bpm</span>
        </div>
        <p class="mt-1 font-mono text-xs tabular-nums text-slate-500">
          30d avg: {{ formatNum(kpis()?.resting_hr_30d_mean, 1) }} bpm
        </p>
      </div>

      <!-- Body Battery Card -->
      <div class="rounded-lg border border-slate-200 bg-white p-4" data-testid="kpi-body-battery">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-600">Body Battery</span>
          <span class="font-mono text-xs text-teal-700">Peak / Low</span>
        </div>
        <div class="mt-2 flex items-baseline gap-1.5">
          <span class="font-mono text-2xl font-bold tabular-nums text-slate-900">
            {{ formatNum(kpis()?.body_battery_high, 0) }}
          </span>
          <span class="font-mono text-xs tabular-nums text-slate-500">
            / {{ formatNum(kpis()?.body_battery_low, 0) }}
          </span>
        </div>
        <p class="mt-1 text-xs text-slate-500">Morning recharge level</p>
      </div>

      <!-- Stress Card -->
      <div class="rounded-lg border border-slate-200 bg-white p-4" data-testid="kpi-stress">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-600">Daily stress</span>
          <span class="font-mono text-xs text-slate-500">Avg</span>
        </div>
        <div class="mt-2 flex items-baseline gap-1.5">
          <span class="font-mono text-2xl font-bold tabular-nums text-slate-900">
            {{ formatNum(kpis()?.stress_avg, 0) }}
          </span>
          <span class="text-xs text-slate-500">/ 100</span>
        </div>
        <p class="mt-1 font-mono text-xs tabular-nums text-slate-500">
          SpO2: {{ formatNum(kpis()?.spo2_avg, 1) }}%
        </p>
      </div>

      <!-- Training Readiness Card -->
      <div class="rounded-lg border border-slate-200 bg-white p-4" data-testid="kpi-readiness">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-600">Readiness</span>
          <span class="font-mono text-xs font-medium text-sky-700">
            {{ kpis()?.training_readiness_level ?? '-' }}
          </span>
        </div>
        <div class="mt-2 flex items-baseline gap-1.5">
          <span class="font-mono text-2xl font-bold tabular-nums text-slate-900">
            {{ formatNum(kpis()?.training_readiness_score, 0) }}
          </span>
          <span class="text-xs text-slate-500">/ 100</span>
        </div>
        <p class="mt-1 font-mono text-xs tabular-nums text-slate-500">
          Steps: {{ kpis()?.steps ?? '-' }}
        </p>
      </div>
    </section>
  `,
})
export class HealthKpisComponent {
  readonly kpis = input<HealthKpiSummary | null>(null);

  readonly hrvStatusClass = computed(() => {
    const status = (this.kpis()?.hrv_status ?? '').toUpperCase();
    const base = 'rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold';
    if (status === 'BALANCED') {
      return `${base} bg-teal-50 text-teal-800`;
    }
    if (status === 'UNBALANCED') {
      return `${base} bg-amber-50 text-amber-800`;
    }
    if (status === 'LOW' || status === 'POOR') {
      return `${base} bg-red-50 text-red-800`;
    }
    return `${base} bg-slate-100 text-slate-600`;
  });

  formatNum(val: number | null | undefined, decimals: number): string {
    if (val === null || val === undefined) {
      return '-';
    }
    return val.toFixed(decimals);
  }

  formatBaseline(): string {
    const k = this.kpis();
    if (!k || k.hrv_baseline_low === null || k.hrv_baseline_high === null) {
      return '-';
    }
    return `${k.hrv_baseline_low.toFixed(0)}-${k.hrv_baseline_high.toFixed(0)} ms`;
  }

  formatSleepDuration(minutes: number | null): string {
    if (minutes === null || minutes <= 0) {
      return '-';
    }
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hrs}h ${mins}m`;
  }
}
