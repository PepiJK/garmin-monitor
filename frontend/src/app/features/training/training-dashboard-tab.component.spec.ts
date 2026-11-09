import { TestBed } from '@angular/core/testing';
import { provideEchartsCore } from 'ngx-echarts';
import { TrainingDashboardResponse, TrainingWeekWindow } from '../../core/api/garmin-api.models';
import { echarts } from '../../core/echarts/echarts-core';
import {
  TrainingDashboardTabComponent,
  buildHrZoneWeeklyChartOptions,
  buildRunningWeeklyChartOptions,
  buildStrengthWeeklyChartOptions,
  buildVo2MaxTrendChartOptions,
} from './training-dashboard-tab.component';

const SAMPLE_DASHBOARD: TrainingDashboardResponse = {
  reference_date: '2026-11-03',
  current_week_start: '2026-11-02',
  current_week_end: '2026-11-08',
  ran_km_this_week: 18.4,
  strength_minutes_this_week: 85,
  completed_workouts_this_week: 3,
  vo2_max_latest: 48.0,
  vo2_max_delta: -1.0,
  vo2_max_series: [
    { date: '2026-10-24', vo2_max: 49.0, sport_type: 'running' },
    { date: '2026-11-02', vo2_max: 48.0, sport_type: 'running' },
  ],
  race_predictions: {
    as_of_date: '2026-11-02',
    vo2_max_used: 48.0,
    source: 'vo2max_model',
    items: [
      {
        distance_key: '5k',
        label: '5 km',
        distance_km: 5.0,
        predicted_seconds: 1289,
        predicted_time_label: '21:29',
        predicted_pace_min_per_km: '4:18',
      },
      {
        distance_key: '10k',
        label: '10 km',
        distance_km: 10.0,
        predicted_seconds: 2676,
        predicted_time_label: '44:36',
        predicted_pace_min_per_km: '4:28',
      },
      {
        distance_key: 'half_marathon',
        label: 'Halbmarathon',
        distance_km: 21.0975,
        predicted_seconds: 5928,
        predicted_time_label: '1:38:48',
        predicted_pace_min_per_km: '4:41',
      },
      {
        distance_key: 'marathon',
        label: 'Marathon',
        distance_km: 42.195,
        predicted_seconds: 12558,
        predicted_time_label: '3:29:18',
        predicted_pace_min_per_km: '4:58',
      },
    ],
  },
  hr_zones_window: [
    {
      zone: 1,
      label: 'Z1 · Regeneration',
      bpm_range: '< 140 bpm',
      minutes: 3.3,
      percentage: 2.9,
      target_percentage: 10.0,
    },
    {
      zone: 2,
      label: 'Z2 · GAT1 Basis',
      bpm_range: '140-155 bpm',
      minutes: 104.2,
      percentage: 90.6,
      target_percentage: 65.0,
    },
    {
      zone: 3,
      label: 'Z3 · GAT2 Grauzone',
      bpm_range: '155-172 bpm',
      minutes: 5.2,
      percentage: 4.5,
      target_percentage: 10.0,
    },
    {
      zone: 4,
      label: 'Z4 · GAT3 Schwelle',
      bpm_range: '172-182 bpm',
      minutes: 1.4,
      percentage: 1.2,
      target_percentage: 10.0,
    },
    {
      zone: 5,
      label: 'Z5 · WSA VO2max',
      bpm_range: '> 182 bpm',
      minutes: 0.9,
      percentage: 0.8,
      target_percentage: 5.0,
    },
  ],
  current_week_activities: [
    {
      activity_id: 1,
      activity_name: 'Prater Hauptallee Tempo',
      sport_type: 'running',
      start_time_local: '2026-11-02T07:30:00+01:00',
      date_local: '2026-11-02',
      duration_min: 48,
      distance_km: 10.4,
      avg_pace_sec_per_km: 277,
      avg_pace_min_per_km: '4:37',
      avg_cadence_spm: 168,
      max_cadence_spm: 184,
      avg_stride_m: 1.12,
      avg_gct_ms: 298,
      avg_vertical_oscillation_cm: 7.6,
      avg_power_w: 245,
      norm_power_w: 256,
      vo2_max: 48.0,
      elevation_gain_m: 42,
      aerobic_te: 3.4,
      anaerobic_te: 1.2,
      avg_hr: 154,
      max_hr: 172,
      calories: 640,
      training_load: 112,
    },
    {
      activity_id: 2,
      activity_name: 'Barbell & Kettlebell Full Body',
      sport_type: 'strength_training',
      start_time_local: '2026-11-03T17:30:00+01:00',
      date_local: '2026-11-03',
      duration_min: 45,
      distance_km: 0,
      total_sets: 12,
      total_reps: 180,
      avg_hr: 122,
      max_hr: 146,
      calories: 320,
      training_load: 48,
    },
  ],
  weekly_series: [
    {
      iso_week_label: '2026-W44',
      week_start: '2026-10-26',
      week_end: '2026-11-01',
      running_km: 34.2,
      strength_minutes: 90,
      workout_count: 5,
      hr_zone_1_min: 2.5,
      hr_zone_2_min: 65.7,
      hr_zone_3_min: 0.9,
      hr_zone_4_min: 0.7,
      hr_zone_5_min: 0.0,
    },
    {
      iso_week_label: '2026-W45',
      week_start: '2026-11-02',
      week_end: '2026-11-08',
      running_km: 18.4,
      strength_minutes: 85,
      workout_count: 3,
      hr_zone_1_min: 0.8,
      hr_zone_2_min: 38.5,
      hr_zone_3_min: 4.3,
      hr_zone_4_min: 0.7,
      hr_zone_5_min: 0.9,
    },
  ],
};

describe('TrainingDashboardTabComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrainingDashboardTabComponent],
      providers: [provideEchartsCore({ echarts })],
    }).compileComponents();
  });

  it('renders KPI cards, completed workouts table, and emits range selection', async () => {
    const fixture = TestBed.createComponent(TrainingDashboardTabComponent);
    fixture.componentRef.setInput('dashboard', SAMPLE_DASHBOARD);
    fixture.componentRef.setInput('selectedWeeks', 30);

    const emitted: TrainingWeekWindow[] = [];
    fixture.componentInstance.weeksChange.subscribe((w) => emitted.push(w));

    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[data-testid="kpi-running-km"]')?.textContent).toContain('18,4');
    expect(el.querySelector('[data-testid="kpi-strength-min"]')?.textContent).toContain('85');
    expect(el.querySelector('[data-testid="kpi-completed-workouts"]')?.textContent).toContain('3');
    expect(el.querySelector('[data-testid="kpi-vo2max"]')?.textContent).toContain('48,0');
    expect(el.querySelector('[data-testid="race-predictions-panel"]')?.textContent).toContain(
      '21:29',
    );
    expect(el.querySelector('[data-testid="race-predictions-panel"]')?.textContent).toContain(
      '44:36',
    );
    expect(el.querySelector('[data-testid="race-predictions-panel"]')?.textContent).toContain(
      '1:38:48',
    );
    expect(el.querySelector('[data-testid="race-predictions-panel"]')?.textContent).toContain(
      '3:29:18',
    );
    expect(el.textContent).toContain('Prater Hauptallee Tempo');
    expect(el.textContent).toContain('Barbell & Kettlebell Full Body');
    expect(el.textContent).toContain('Mon, 02.11.2026, 07:30');
    expect(el.textContent).toContain('4:37 /km');
    expect(el.textContent).toContain('168 / 184 spm');
    expect(el.textContent).toContain('1,12 m');
    expect(el.textContent).toContain('298 ms');
    expect(el.textContent).toContain('12 sets · 180 reps');
    expect(el.textContent).toContain('245 W');
    expect(el.textContent).toContain('+42 m');
    expect(el.textContent).toContain('3,4 / 1,2');

    const table = el.querySelector('[data-testid="week-workouts-table"]') as HTMLTableElement;
    expect(table.querySelector('thead')?.classList.contains('sticky')).toBe(true);
    expect(table.querySelector('thead')?.classList.contains('top-0')).toBe(true);
    expect(table.querySelector('thead th')?.classList.contains('sticky')).toBe(true);

    const btn90 = el.querySelector('[data-testid="weeks-btn-90"]') as HTMLButtonElement;
    btn90.click();
    expect(emitted).toEqual([90]);
  });

  it('builds ECharts options for weekly running, strength, VO2 max, and HR zones', () => {
    const runOpts = buildRunningWeeklyChartOptions(SAMPLE_DASHBOARD.weekly_series) as {
      series: { data: number[] }[];
    };
    expect(runOpts.series[0].data).toEqual([34.2, 18.4]);

    const strengthOpts = buildStrengthWeeklyChartOptions(SAMPLE_DASHBOARD.weekly_series) as {
      series: { data: number[] }[];
    };
    expect(strengthOpts.series[0].data).toEqual([90, 85]);

    const vo2Opts = buildVo2MaxTrendChartOptions(SAMPLE_DASHBOARD.vo2_max_series ?? []) as {
      series: { data: number[] }[];
    };
    expect(vo2Opts.series[0].data).toEqual([49.0, 48.0]);

    const zoneOpts = buildHrZoneWeeklyChartOptions(SAMPLE_DASHBOARD.weekly_series) as {
      series: { name: string; data: number[] }[];
    };
    expect(zoneOpts.series.length).toBe(5);
    expect(zoneOpts.series[1].data).toEqual([65.7, 38.5]);
  });
});
