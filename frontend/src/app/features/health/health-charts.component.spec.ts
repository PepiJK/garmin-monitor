import { TestBed } from '@angular/core/testing';
import { provideEchartsCore } from 'ngx-echarts';
import { DailyHealthPoint } from '../../core/api/garmin-api.models';
import { echarts } from '../../core/echarts/echarts-core';
import {
  HealthChartsComponent,
  buildHrvBaselineChartOptions,
  buildReadinessBatteryChartOptions,
  buildRhrStressChartOptions,
  buildSleepStagesChartOptions,
} from './health-charts.component';

const SAMPLE_SERIES: DailyHealthPoint[] = [
  {
    date: '2026-11-02',
    sleep_score: 82,
    sleep_qualifier: 'GOOD',
    sleep_total_min: 470,
    sleep_deep_min: 90,
    sleep_light_min: 270,
    sleep_rem_min: 110,
    sleep_awake_min: 10,
    hrv_nightly_avg: 63,
    hrv_weekly_avg: 61,
    hrv_baseline_low: 55,
    hrv_baseline_high: 69,
    hrv_status: 'BALANCED',
    resting_hr: 47,
    min_hr: 44,
    max_hr: 162,
    stress_avg: 25,
    stress_max: 76,
    body_battery_high: 88,
    body_battery_low: 32,
    spo2_avg: 96.5,
    respiration_avg: 14.1,
    steps: 10900,
    training_readiness_score: 80,
    training_readiness_level: 'HIGH',
  },
];

describe('HealthChartsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HealthChartsComponent],
      providers: [provideEchartsCore({ echarts })],
    }).compileComponents();
  });

  it('renders all 4 recovery ECharts containers and builds chart configurations', async () => {
    const fixture = TestBed.createComponent(HealthChartsComponent);
    fixture.componentRef.setInput('series', SAMPLE_SERIES);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="chart-hrv"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="chart-sleep"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="chart-rhr-stress"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="chart-readiness"]')).not.toBeNull();

    const hrvOpts = buildHrvBaselineChartOptions(SAMPLE_SERIES) as {
      series: { name: string; data: number[] }[];
    };
    expect(hrvOpts.series.map((s) => s.name)).toContain('Personal Baseline Band');
    expect(hrvOpts.series[1].data).toEqual([14]);

    const sleepOpts = buildSleepStagesChartOptions(SAMPLE_SERIES) as {
      series: { name: string }[];
    };
    expect(sleepOpts.series.map((s) => s.name)).toEqual([
      'Deep',
      'REM',
      'Light',
      'Awake',
      'Sleep Score',
    ]);

    const rhrOpts = buildRhrStressChartOptions(SAMPLE_SERIES) as {
      series: { name: string }[];
    };
    expect(rhrOpts.series.length).toBe(2);

    const readyOpts = buildReadinessBatteryChartOptions(SAMPLE_SERIES) as {
      series: { name: string }[];
    };
    expect(readyOpts.series.length).toBe(3);
  });
});
