import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  DailyHealthPoint,
  HealthDayWindow,
  HealthKpiSummary,
} from '../../core/api/garmin-api.models';
import { formatGermanHoursMinutes, formatGermanNumber } from '../../core/format/german-format';

function meanOf(values: (number | null | undefined)[]): number | null {
  const valid = values.filter(
    (v): v is number => v !== null && v !== undefined && !Number.isNaN(v),
  );
  if (valid.length === 0) {
    return null;
  }
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

@Component({
  selector: 'app-health-kpis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section
      aria-label="Current physiological vitals"
      class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6"
    >
      <!-- HRV Card -->
      <div class="rounded-lg border border-slate-800 bg-slate-900/90 p-4" data-testid="kpi-hrv">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-300">
            Nightly HRV ({{ selectedDays() }}d)
          </span>
          <span [class]="hrvStatusClass()">{{ kpis()?.hrv_status ?? 'N/A' }}</span>
        </div>
        <div class="mt-2 flex items-baseline gap-1.5">
          <span class="font-mono text-2xl font-bold tabular-nums text-slate-100">
            {{ formatNum(hrvAvg(), 0) }}
          </span>
          <span class="text-xs text-slate-400">ms</span>
        </div>
        <p class="mt-1 font-mono text-xs tabular-nums text-slate-400">
          Baseline: {{ formatBaseline() }}
        </p>
      </div>

      <!-- Sleep Score Card -->
      <div class="rounded-lg border border-slate-800 bg-slate-900/90 p-4" data-testid="kpi-sleep">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-300">
            Sleep score ({{ selectedDays() }}d)
          </span>
          <span class="font-mono text-xs font-medium text-sky-400">
            {{ kpis()?.sleep_qualifier ?? '-' }}
          </span>
        </div>
        <div class="mt-2 flex items-baseline gap-1.5">
          <span class="font-mono text-2xl font-bold tabular-nums text-slate-100">
            {{ formatNum(sleepScoreAvg(), 0) }}
          </span>
          <span class="text-xs text-slate-400">/ 100</span>
        </div>
        <p class="mt-1 font-mono text-xs tabular-nums text-slate-400">
          Avg duration: {{ formatSleepDuration(sleepTotalMinAvg()) }}
        </p>
      </div>

      <!-- Resting HR Card -->
      <div class="rounded-lg border border-slate-800 bg-slate-900/90 p-4" data-testid="kpi-rhr">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-300">
            Resting HR ({{ selectedDays() }}d)
          </span>
          <span class="font-mono text-xs text-slate-400">bpm</span>
        </div>
        <div class="mt-2 flex items-baseline gap-1.5">
          <span class="font-mono text-2xl font-bold tabular-nums text-slate-100">
            {{ formatNum(restingHrAvg(), 0) }}
          </span>
          <span class="text-xs text-slate-400">bpm</span>
        </div>
        <p class="mt-1 font-mono text-xs tabular-nums text-slate-400">
          30d avg: {{ formatNum(kpis()?.resting_hr_30d_mean, 1) }} bpm
        </p>
      </div>

      <!-- Body Battery Card -->
      <div
        class="rounded-lg border border-slate-800 bg-slate-900/90 p-4"
        data-testid="kpi-body-battery"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-300">
            Body Battery ({{ selectedDays() }}d)
          </span>
          <span class="font-mono text-xs text-teal-400">Peak / Low</span>
        </div>
        <div class="mt-2 flex items-baseline gap-1.5">
          <span class="font-mono text-2xl font-bold tabular-nums text-slate-100">
            {{ formatNum(bodyBatteryHighAvg(), 0) }}
          </span>
          <span class="font-mono text-xs tabular-nums text-slate-400">
            / {{ formatNum(bodyBatteryLowAvg(), 0) }}
          </span>
        </div>
        <p class="mt-1 font-mono text-xs tabular-nums text-slate-400">
          {{ formatBodyBatteryDelta() }}
        </p>
      </div>

      <!-- Stress Card -->
      <div class="rounded-lg border border-slate-800 bg-slate-900/90 p-4" data-testid="kpi-stress">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-300">
            Daily stress ({{ selectedDays() }}d)
          </span>
          <span class="font-mono text-xs text-slate-400">Avg</span>
        </div>
        <div class="mt-2 flex items-baseline gap-1.5">
          <span class="font-mono text-2xl font-bold tabular-nums text-slate-100">
            {{ formatNum(stressAvg(), 0) }}
          </span>
          <span class="text-xs text-slate-400">/ 100</span>
        </div>
        <p class="mt-1 font-mono text-xs tabular-nums text-slate-400">
          SpO2: {{ formatNum(spo2Avg(), 1) }}%
        </p>
      </div>

      <!-- Training Readiness Card -->
      <div
        class="rounded-lg border border-slate-800 bg-slate-900/90 p-4"
        data-testid="kpi-readiness"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-slate-300">
            Morning Readiness ({{ selectedDays() }}d)
          </span>
          <span class="font-mono text-xs font-medium text-sky-400">
            {{ kpis()?.training_readiness_level ?? '-' }}
          </span>
        </div>
        <div class="mt-2 flex items-baseline gap-1.5">
          <span class="font-mono text-2xl font-bold tabular-nums text-slate-100">
            {{ formatNum(readinessAvg(), 0) }}
          </span>
          <span class="text-xs text-slate-400">/ 100</span>
        </div>
        <p class="mt-1 font-mono text-xs tabular-nums text-slate-400">
          {{ formatReadinessContext() }}
        </p>
      </div>
    </section>
  `,
})
export class HealthKpisComponent {
  readonly kpis = input<HealthKpiSummary | null>(null);
  readonly series = input<DailyHealthPoint[]>([]);
  readonly selectedDays = input<HealthDayWindow>(30);

  readonly hrvAvg = computed(() => {
    const s = this.series();
    if (s.length > 0) {
      return meanOf(s.map((d) => d.hrv_nightly_avg)) ?? this.kpis()?.hrv_nightly_avg ?? null;
    }
    return this.kpis()?.hrv_nightly_avg ?? null;
  });

  readonly sleepScoreAvg = computed(() => {
    const s = this.series();
    if (s.length > 0) {
      return meanOf(s.map((d) => d.sleep_score)) ?? this.kpis()?.sleep_score ?? null;
    }
    return this.kpis()?.sleep_score ?? null;
  });

  readonly sleepTotalMinAvg = computed(() => {
    const s = this.series();
    if (s.length > 0) {
      return meanOf(s.map((d) => d.sleep_total_min)) ?? this.kpis()?.sleep_total_min ?? null;
    }
    return this.kpis()?.sleep_total_min ?? null;
  });

  readonly restingHrAvg = computed(() => {
    const s = this.series();
    if (s.length > 0) {
      return meanOf(s.map((d) => d.resting_hr)) ?? this.kpis()?.resting_hr ?? null;
    }
    return this.kpis()?.resting_hr ?? null;
  });

  readonly bodyBatteryHighAvg = computed(() => {
    const s = this.series();
    if (s.length > 0) {
      return meanOf(s.map((d) => d.body_battery_high)) ?? this.kpis()?.body_battery_high ?? null;
    }
    return this.kpis()?.body_battery_high ?? null;
  });

  readonly bodyBatteryLowAvg = computed(() => {
    const s = this.series();
    if (s.length > 0) {
      return meanOf(s.map((d) => d.body_battery_low)) ?? this.kpis()?.body_battery_low ?? null;
    }
    return this.kpis()?.body_battery_low ?? null;
  });

  readonly stressAvg = computed(() => {
    const s = this.series();
    if (s.length > 0) {
      const validStress = s
        .map((d) => d.stress_avg)
        .filter((v): v is number => v !== null && v >= 0);
      return meanOf(validStress) ?? this.kpis()?.stress_avg ?? null;
    }
    return this.kpis()?.stress_avg ?? null;
  });

  readonly spo2Avg = computed(() => {
    const s = this.series();
    if (s.length > 0) {
      return meanOf(s.map((d) => d.spo2_avg)) ?? this.kpis()?.spo2_avg ?? null;
    }
    return this.kpis()?.spo2_avg ?? null;
  });

  readonly readinessAvg = computed(() => {
    const s = this.series();
    if (s.length > 0) {
      return (
        meanOf(s.map((d) => d.training_readiness_score)) ??
        this.kpis()?.training_readiness_score ??
        null
      );
    }
    return this.kpis()?.training_readiness_score ?? null;
  });

  readonly stepsAvg = computed(() => {
    const s = this.series();
    if (s.length > 0) {
      return meanOf(s.map((d) => d.steps)) ?? this.kpis()?.steps ?? null;
    }
    return this.kpis()?.steps ?? null;
  });

  readonly hrvStatusClass = computed(() => {
    const status = (this.kpis()?.hrv_status ?? '').toUpperCase();
    const base = 'rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold';
    if (status === 'BALANCED') {
      return `${base} border-teal-500/40 bg-teal-500/15 text-teal-300`;
    }
    if (status === 'UNBALANCED') {
      return `${base} border-amber-500/40 bg-amber-500/15 text-amber-300`;
    }
    if (status === 'LOW' || status === 'POOR') {
      return `${base} border-red-500/40 bg-red-500/15 text-red-300`;
    }
    return `${base} border-slate-700 bg-slate-800 text-slate-300`;
  });

  formatNum(val: number | null | undefined, decimals: number): string {
    return formatGermanNumber(val, decimals);
  }

  formatBaseline(): string {
    const k = this.kpis();
    if (!k || k.hrv_baseline_low === null || k.hrv_baseline_high === null) {
      return '-';
    }
    return `${formatGermanNumber(k.hrv_baseline_low, 0)}-${formatGermanNumber(k.hrv_baseline_high, 0)} ms`;
  }

  formatSleepDuration(minutes: number | null): string {
    return formatGermanHoursMinutes(minutes);
  }

  formatBodyBatteryDelta(): string {
    const s = this.series();
    const charged =
      s.length > 0
        ? (meanOf(s.map((d) => d.body_battery_charged)) ?? this.kpis()?.body_battery_charged)
        : this.kpis()?.body_battery_charged;
    const drained =
      s.length > 0
        ? (meanOf(s.map((d) => d.body_battery_drained)) ?? this.kpis()?.body_battery_drained)
        : this.kpis()?.body_battery_drained;
    if (charged !== null && charged !== undefined && drained !== null && drained !== undefined) {
      return `+${formatGermanNumber(charged, 0)} charged / -${formatGermanNumber(drained, 0)} drained`;
    }
    return `Avg morning reserve (${this.selectedDays()}d)`;
  }

  formatReadinessContext(): string {
    const s = this.series();
    const acute =
      s.length > 0
        ? (meanOf(s.map((d) => d.acute_load)) ?? this.kpis()?.acute_load)
        : this.kpis()?.acute_load;
    const stepsStr = `${formatGermanNumber(this.stepsAvg(), 0)} steps`;
    if (acute !== null && acute !== undefined) {
      return `Acute load: ${formatGermanNumber(acute, 0)} · ${stepsStr}`;
    }
    return `Avg steps: ${formatGermanNumber(this.stepsAvg(), 0)}`;
  }
}
