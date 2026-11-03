import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { DailyHealthPoint } from '../../core/api/garmin-api.models';

export function buildHrvBaselineChartOptions(series: DailyHealthPoint[]): EChartsCoreOption {
  const dates = series.map((d) => d.date.slice(5));
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
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      textStyle: { color: '#475569', fontSize: 11 },
      data: ['Nightly HRV', '7d Avg', 'Personal Baseline Band'],
    },
    grid: { left: 44, right: 20, top: 34, bottom: 28 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: '#475569', fontSize: 11 },
      axisLine: { lineStyle: { color: '#CBD5E1' } },
    },
    yAxis: {
      type: 'value',
      name: 'ms',
      scale: true,
      nameTextStyle: { color: '#475569', fontSize: 11 },
      axisLabel: { color: '#475569', fontSize: 11 },
      splitLine: { lineStyle: { color: '#E2E8F0' } },
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
        areaStyle: { color: 'rgba(13, 148, 136, 0.20)' },
        itemStyle: { color: '#0D9488' },
      },
      {
        name: '7d Avg',
        type: 'line',
        data: weekly,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#0284C7', width: 2, type: 'dashed' },
        itemStyle: { color: '#0284C7' },
      },
      {
        name: 'Nightly HRV',
        type: 'line',
        data: nightly,
        smooth: false,
        symbolSize: 6,
        lineStyle: { color: '#0F172A', width: 2.5 },
        itemStyle: { color: '#0F172A' },
      },
    ],
  };
}

export function buildSleepStagesChartOptions(series: DailyHealthPoint[]): EChartsCoreOption {
  const dates = series.map((d) => d.date.slice(5));
  const deepHrs = series.map((d) => Number(((d.sleep_deep_min ?? 0) / 60).toFixed(2)));
  const remHrs = series.map((d) => Number(((d.sleep_rem_min ?? 0) / 60).toFixed(2)));
  const lightHrs = series.map((d) => Number(((d.sleep_light_min ?? 0) / 60).toFixed(2)));
  const awakeHrs = series.map((d) => Number(((d.sleep_awake_min ?? 0) / 60).toFixed(2)));
  const scores = series.map((d) => d.sleep_score);

  return {
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      textStyle: { color: '#475569', fontSize: 11 },
      data: ['Deep', 'REM', 'Light', 'Awake', 'Sleep Score'],
    },
    grid: { left: 44, right: 44, top: 34, bottom: 28 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: '#475569', fontSize: 11 },
      axisLine: { lineStyle: { color: '#CBD5E1' } },
    },
    yAxis: [
      {
        type: 'value',
        name: 'hours',
        nameTextStyle: { color: '#475569', fontSize: 11 },
        axisLabel: { color: '#475569', fontSize: 11 },
        splitLine: { lineStyle: { color: '#E2E8F0' } },
      },
      {
        type: 'value',
        name: 'score',
        min: 0,
        max: 100,
        nameTextStyle: { color: '#475569', fontSize: 11 },
        axisLabel: { color: '#475569', fontSize: 11 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'Deep',
        type: 'bar',
        stack: 'sleep-stages',
        data: deepHrs,
        itemStyle: { color: '#1E3A8A' },
      },
      {
        name: 'REM',
        type: 'bar',
        stack: 'sleep-stages',
        data: remHrs,
        itemStyle: { color: '#0284C7' },
      },
      {
        name: 'Light',
        type: 'bar',
        stack: 'sleep-stages',
        data: lightHrs,
        itemStyle: { color: '#7DD3FC' },
      },
      {
        name: 'Awake',
        type: 'bar',
        stack: 'sleep-stages',
        data: awakeHrs,
        itemStyle: { color: '#F59E0B' },
      },
      {
        name: 'Sleep Score',
        type: 'line',
        yAxisIndex: 1,
        data: scores,
        smooth: true,
        symbolSize: 5,
        lineStyle: { color: '#0F172A', width: 2 },
        itemStyle: { color: '#0F172A' },
      },
    ],
  };
}

export function buildRhrStressChartOptions(series: DailyHealthPoint[]): EChartsCoreOption {
  const dates = series.map((d) => d.date.slice(5));
  const rhr = series.map((d) => d.resting_hr);
  const stress = series.map((d) => d.stress_avg);

  return {
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      textStyle: { color: '#475569', fontSize: 11 },
      data: ['Resting HR (bpm)', 'Avg Stress'],
    },
    grid: { left: 44, right: 44, top: 34, bottom: 28 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: '#475569', fontSize: 11 },
      axisLine: { lineStyle: { color: '#CBD5E1' } },
    },
    yAxis: [
      {
        type: 'value',
        name: 'bpm',
        scale: true,
        nameTextStyle: { color: '#475569', fontSize: 11 },
        axisLabel: { color: '#475569', fontSize: 11 },
        splitLine: { lineStyle: { color: '#E2E8F0' } },
      },
      {
        type: 'value',
        name: 'stress',
        min: 0,
        max: 100,
        nameTextStyle: { color: '#475569', fontSize: 11 },
        axisLabel: { color: '#475569', fontSize: 11 },
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
        lineStyle: { color: '#DC2626', width: 2 },
        itemStyle: { color: '#DC2626' },
      },
      {
        name: 'Avg Stress',
        type: 'line',
        yAxisIndex: 1,
        data: stress,
        smooth: true,
        symbolSize: 5,
        lineStyle: { color: '#D97706', width: 2 },
        itemStyle: { color: '#D97706' },
      },
    ],
  };
}

export function buildReadinessBatteryChartOptions(series: DailyHealthPoint[]): EChartsCoreOption {
  const dates = series.map((d) => d.date.slice(5));
  const bbHigh = series.map((d) => d.body_battery_high);
  const bbLow = series.map((d) => d.body_battery_low);
  const readiness = series.map((d) => d.training_readiness_score);

  return {
    tooltip: { trigger: 'axis' },
    legend: {
      top: 0,
      textStyle: { color: '#475569', fontSize: 11 },
      data: ['Body Battery High', 'Body Battery Low', 'Training Readiness'],
    },
    grid: { left: 44, right: 20, top: 34, bottom: 28 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: '#475569', fontSize: 11 },
      axisLine: { lineStyle: { color: '#CBD5E1' } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { color: '#475569', fontSize: 11 },
      splitLine: { lineStyle: { color: '#E2E8F0' } },
    },
    series: [
      {
        name: 'Body Battery High',
        type: 'line',
        data: bbHigh,
        smooth: true,
        symbolSize: 5,
        lineStyle: { color: '#0D9488', width: 2 },
        itemStyle: { color: '#0D9488' },
      },
      {
        name: 'Body Battery Low',
        type: 'line',
        data: bbLow,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#94A3B8', width: 1.5, type: 'dashed' },
        itemStyle: { color: '#94A3B8' },
      },
      {
        name: 'Training Readiness',
        type: 'line',
        data: readiness,
        smooth: true,
        symbolSize: 5,
        lineStyle: { color: '#0284C7', width: 2 },
        itemStyle: { color: '#0284C7' },
      },
    ],
  };
}

@Component({
  selector: 'app-health-charts',
  imports: [NgxEchartsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      aria-label="Physiological recovery trend charts"
      class="grid grid-cols-1 gap-6 lg:grid-cols-2"
    >
      <div class="rounded-lg border border-slate-200 bg-white p-5">
        <h3 class="text-sm font-semibold text-slate-900">
          HRV trend &amp; personal baseline corridor
        </h3>
        <p class="mb-3 text-xs text-slate-500">
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

      <div class="rounded-lg border border-slate-200 bg-white p-5">
        <h3 class="text-sm font-semibold text-slate-900">
          Sleep score &amp; sleep stage architecture
        </h3>
        <p class="mb-3 text-xs text-slate-500">
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

      <div class="rounded-lg border border-slate-200 bg-white p-5">
        <h3 class="text-sm font-semibold text-slate-900">Resting heart rate &amp; daily stress</h3>
        <p class="mb-3 text-xs text-slate-500">
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

      <div class="rounded-lg border border-slate-200 bg-white p-5">
        <h3 class="text-sm font-semibold text-slate-900">Body Battery &amp; Training Readiness</h3>
        <p class="mb-3 text-xs text-slate-500">
          Peak/trough Body Battery reserve and morning readiness score
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
