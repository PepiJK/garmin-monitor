import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { DailyHealthPoint } from '../../core/api/garmin-api.models';
import { formatGermanShortDate } from '../../core/format/german-format';

export function buildHrvBaselineChartOptions(series: DailyHealthPoint[]): EChartsCoreOption {
  const dates = series.map((d) => formatGermanShortDate(d.date));
  const baselineLow = series.map((d) => d.hrv_baseline_low ?? 0);
  const baselineSpan = series.map((d) => {
    if (d.hrv_baseline_low !== null && d.hrv_baseline_high !== null) {
      return Math.max(0, Number((d.hrv_baseline_high - d.hrv_baseline_low).toFixed(1)));
    }
    return 0;
  });
  const nightly = series.map((d) => d.hrv_nightly_avg);
  const weekly = series.map((d) => d.hrv_weekly_avg);

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 12 },
    },
    legend: {
      top: 0,
      textStyle: { color: '#cbd5e1', fontSize: 11 },
      data: ['Nightly HRV', '7d Avg', 'Personal Baseline Band'],
    },
    grid: { left: 44, right: 20, top: 34, bottom: 28 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: {
      type: 'value',
      name: 'ms',
      scale: true,
      nameTextStyle: { color: '#94a3b8', fontSize: 11 },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        name: 'Baseline Floor',
        type: 'line',
        data: baselineLow,
        stack: 'hrv-baseline-band',
        symbol: 'none',
        lineStyle: { opacity: 0 },
        tooltip: { show: false },
      },
      {
        name: 'Personal Baseline Band',
        type: 'line',
        data: baselineSpan,
        stack: 'hrv-baseline-band',
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { color: 'rgba(45, 212, 191, 0.22)' },
        itemStyle: { color: '#2dd4bf' },
      },
      {
        name: '7d Avg',
        type: 'line',
        data: weekly,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#38bdf8', width: 2, type: 'dashed' },
        itemStyle: { color: '#38bdf8' },
      },
      {
        name: 'Nightly HRV',
        type: 'line',
        data: nightly,
        smooth: false,
        symbolSize: 6,
        lineStyle: { color: '#f8fafc', width: 2.5 },
        itemStyle: { color: '#f8fafc' },
      },
    ],
  };
}

export function buildSleepStagesChartOptions(series: DailyHealthPoint[]): EChartsCoreOption {
  const dates = series.map((d) => formatGermanShortDate(d.date));
  const deepHrs = series.map((d) => Number(((d.sleep_deep_min ?? 0) / 60).toFixed(2)));
  const remHrs = series.map((d) => Number(((d.sleep_rem_min ?? 0) / 60).toFixed(2)));
  const lightHrs = series.map((d) => Number(((d.sleep_light_min ?? 0) / 60).toFixed(2)));
  const awakeHrs = series.map((d) => Number(((d.sleep_awake_min ?? 0) / 60).toFixed(2)));
  const scores = series.map((d) => d.sleep_score);

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 12 },
    },
    legend: {
      top: 0,
      textStyle: { color: '#cbd5e1', fontSize: 11 },
      data: ['Deep', 'REM', 'Light', 'Awake', 'Sleep Score'],
    },
    grid: { left: 44, right: 44, top: 34, bottom: 28 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: [
      {
        type: 'value',
        name: 'hrs',
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      {
        type: 'value',
        name: 'Score',
        min: 0,
        max: 100,
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Deep',
        type: 'bar',
        stack: 'sleep-stages',
        data: deepHrs,
        itemStyle: { color: '#3b82f6' },
      },
      {
        name: 'REM',
        type: 'bar',
        stack: 'sleep-stages',
        data: remHrs,
        itemStyle: { color: '#0ea5e9' },
      },
      {
        name: 'Light',
        type: 'bar',
        stack: 'sleep-stages',
        data: lightHrs,
        itemStyle: { color: '#7dd3fc' },
      },
      {
        name: 'Awake',
        type: 'bar',
        stack: 'sleep-stages',
        data: awakeHrs,
        itemStyle: { color: '#fbbf24' },
      },
      {
        name: 'Sleep Score',
        type: 'line',
        yAxisIndex: 1,
        data: scores,
        smooth: true,
        symbolSize: 5,
        lineStyle: { color: '#f8fafc', width: 2 },
        itemStyle: { color: '#f8fafc' },
      },
    ],
  };
}

export function buildRhrStressChartOptions(series: DailyHealthPoint[]): EChartsCoreOption {
  const dates = series.map((d) => formatGermanShortDate(d.date));
  const rhr = series.map((d) => d.resting_hr);
  const stress = series.map((d) =>
    d.stress_avg !== null && d.stress_avg >= 0 ? d.stress_avg : null,
  );

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 12 },
    },
    legend: {
      top: 0,
      textStyle: { color: '#cbd5e1', fontSize: 11 },
      data: ['Resting HR (bpm)', 'Avg Stress'],
    },
    grid: { left: 44, right: 44, top: 34, bottom: 28 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: [
      {
        type: 'value',
        name: 'bpm',
        scale: true,
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      {
        type: 'value',
        name: 'Stress',
        min: 0,
        max: 100,
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Resting HR (bpm)',
        type: 'line',
        data: rhr,
        smooth: true,
        symbolSize: 5,
        lineStyle: { color: '#f87171', width: 2 },
        itemStyle: { color: '#f87171' },
      },
      {
        name: 'Avg Stress',
        type: 'line',
        yAxisIndex: 1,
        data: stress,
        smooth: true,
        symbolSize: 5,
        lineStyle: { color: '#fbbf24', width: 2 },
        itemStyle: { color: '#fbbf24' },
      },
    ],
  };
}

export function buildReadinessBatteryChartOptions(series: DailyHealthPoint[]): EChartsCoreOption {
  const dates = series.map((d) => formatGermanShortDate(d.date));
  const bbHigh = series.map((d) => d.body_battery_high);
  const bbLow = series.map((d) => d.body_battery_low);
  const readiness = series.map((d) => d.training_readiness_score);
  const acuteLoad = series.map((d) => d.acute_load ?? null);

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 12 },
    },
    legend: {
      top: 0,
      textStyle: { color: '#cbd5e1', fontSize: 11 },
      data: ['Body Battery High', 'Body Battery Low', 'Morning Readiness', 'Acute Load (7d)'],
    },
    grid: { left: 44, right: 44, top: 34, bottom: 28 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: [
      {
        type: 'value',
        name: 'Score',
        min: 0,
        max: 100,
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        splitLine: { lineStyle: { color: '#1e293b' } },
      },
      {
        type: 'value',
        name: 'Load',
        scale: true,
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Body Battery High',
        type: 'line',
        data: bbHigh,
        smooth: true,
        symbolSize: 5,
        lineStyle: { color: '#2dd4bf', width: 2 },
        itemStyle: { color: '#2dd4bf' },
      },
      {
        name: 'Body Battery Low',
        type: 'line',
        data: bbLow,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#94a3b8', width: 1.5, type: 'dashed' },
        itemStyle: { color: '#94a3b8' },
      },
      {
        name: 'Morning Readiness',
        type: 'line',
        data: readiness,
        smooth: true,
        symbolSize: 5,
        lineStyle: { color: '#38bdf8', width: 2 },
        itemStyle: { color: '#38bdf8' },
      },
      {
        name: 'Acute Load (7d)',
        type: 'line',
        yAxisIndex: 1,
        data: acuteLoad,
        smooth: true,
        symbolSize: 4,
        lineStyle: { color: '#fbbf24', width: 2, type: 'dotted' },
        itemStyle: { color: '#fbbf24' },
      },
    ],
  };
}

@Component({
  selector: 'app-health-charts',
  imports: [NgxEchartsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section
      aria-label="Physiological recovery trend charts"
      class="grid grid-cols-1 gap-6 lg:grid-cols-2"
    >
      <div class="rounded-lg border border-slate-800 bg-slate-900/90 p-5">
        <h3 class="text-sm font-semibold text-slate-100">
          HRV trend &amp; personal baseline corridor
        </h3>
        <p class="mb-3 text-xs text-slate-400">
          Nightly HRV (ms) overlaid on shaded personal balanced range
        </p>
        <div
          echarts
          [initOpts]="{ renderer: 'svg' }"
          [options]="hrvOptions()"
          class="h-64 w-full"
          data-testid="chart-hrv"
        ></div>
      </div>

      <div class="rounded-lg border border-slate-800 bg-slate-900/90 p-5">
        <h3 class="text-sm font-semibold text-slate-100">
          Sleep score &amp; sleep stage architecture
        </h3>
        <p class="mb-3 text-xs text-slate-400">
          Stacked Deep, REM, Light, and Awake hours with overall Sleep Score
        </p>
        <div
          echarts
          [initOpts]="{ renderer: 'svg' }"
          [options]="sleepOptions()"
          class="h-64 w-full"
          data-testid="chart-sleep"
        ></div>
      </div>

      <div class="rounded-lg border border-slate-800 bg-slate-900/90 p-5">
        <h3 class="text-sm font-semibold text-slate-100">Resting heart rate &amp; daily stress</h3>
        <p class="mb-3 text-xs text-slate-400">
          Morning resting heart rate (bpm) and all-day physiological stress
        </p>
        <div
          echarts
          [initOpts]="{ renderer: 'svg' }"
          [options]="rhrStressOptions()"
          class="h-64 w-full"
          data-testid="chart-rhr-stress"
        ></div>
      </div>

      <div class="rounded-lg border border-slate-800 bg-slate-900/90 p-5">
        <h3 class="text-sm font-semibold text-slate-100">
          Body Battery, Morning Readiness &amp; Acute Load
        </h3>
        <p class="mb-3 text-xs text-slate-400">
          Peak/trough Body Battery reserve, morning readiness score, and 7-day EPOC acute load
        </p>
        <div
          echarts
          [initOpts]="{ renderer: 'svg' }"
          [options]="readinessOptions()"
          class="h-64 w-full"
          data-testid="chart-readiness"
        ></div>
      </div>
    </section>
  `,
})
export class HealthChartsComponent {
  readonly series = input<DailyHealthPoint[]>([]);

  readonly hrvOptions = computed<EChartsCoreOption>(() =>
    buildHrvBaselineChartOptions(this.series()),
  );
  readonly sleepOptions = computed<EChartsCoreOption>(() =>
    buildSleepStagesChartOptions(this.series()),
  );
  readonly rhrStressOptions = computed<EChartsCoreOption>(() =>
    buildRhrStressChartOptions(this.series()),
  );
  readonly readinessOptions = computed<EChartsCoreOption>(() =>
    buildReadinessBatteryChartOptions(this.series()),
  );
}
