import { TestBed } from '@angular/core/testing';
import { provideEchartsCore } from 'ngx-echarts';
import { TrainingDashboardResponse, TrainingWeekWindow } from '../../core/api/garmin-api.models';
import { echarts } from '../../core/echarts/echarts-core';
import {
  TrainingDashboardTabComponent,
  buildRunningWeeklyChartOptions,
  buildStrengthWeeklyChartOptions,
} from './training-dashboard-tab.component';

const SAMPLE_DASHBOARD: TrainingDashboardResponse = {
  reference_date: '2026-11-03',
  current_week_start: '2026-11-02',
  current_week_end: '2026-11-08',
  ran_km_this_week: 18.4,
  strength_minutes_this_week: 85,
  completed_workouts_this_week: 3,
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
      avg_power_w: 245,
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
    },
    {
      iso_week_label: '2026-W45',
      week_start: '2026-11-02',
      week_end: '2026-11-08',
      running_km: 18.4,
      strength_minutes: 85,
      workout_count: 3,
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
    expect(el.textContent).toContain('Prater Hauptallee Tempo');
    expect(el.textContent).toContain('Barbell & Kettlebell Full Body');
    expect(el.textContent).toContain('Mon, 02.11.2026, 07:30');
    expect(el.textContent).toContain('4:37 /km');
    expect(el.textContent).toContain('168 / 184 spm');
    expect(el.textContent).toContain('1,12 m');
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

  it('builds ECharts options for weekly running and strength series', () => {
    const runOpts = buildRunningWeeklyChartOptions(SAMPLE_DASHBOARD.weekly_series) as {
      series: { data: number[] }[];
    };
    expect(runOpts.series[0].data).toEqual([34.2, 18.4]);

    const strengthOpts = buildStrengthWeeklyChartOptions(SAMPLE_DASHBOARD.weekly_series) as {
      series: { data: number[] }[];
    };
    expect(strengthOpts.series[0].data).toEqual([90, 85]);
  });
});
