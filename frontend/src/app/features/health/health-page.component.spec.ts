import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideEchartsCore } from 'ngx-echarts';
import { echarts } from '../../core/echarts/echarts-core';
import { HealthPageComponent } from './health-page.component';

describe('HealthPageComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HealthPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideEchartsCore({ echarts })],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads 30d health telemetry by default and switches to 7d / 90d on click', async () => {
    const fixture = TestBed.createComponent(HealthPageComponent);
    await fixture.whenStable();

    httpMock.expectOne('/api/health/dashboard?days=30').flush({
      days_requested: 30,
      latest_date: '2026-11-03',
      warnings: [],
      kpis: {
        hrv_nightly_avg: 62,
        hrv_weekly_avg: 61,
        hrv_baseline_low: 55,
        hrv_baseline_high: 69,
        hrv_status: 'BALANCED',
        sleep_score: 83,
        sleep_qualifier: 'GOOD',
        sleep_total_min: 460,
        resting_hr: 47,
        resting_hr_30d_mean: 48,
        body_battery_high: 85,
        body_battery_low: 30,
        stress_avg: 24,
        training_readiness_score: 79,
        training_readiness_level: 'HIGH',
        spo2_avg: 96.5,
        respiration_avg: 14.2,
        steps: 10500,
      },
      series: [
        {
          date: '2026-11-03',
          sleep_score: 83,
          sleep_qualifier: 'GOOD',
          sleep_total_min: 460,
          sleep_deep_min: 90,
          sleep_light_min: 260,
          sleep_rem_min: 110,
          sleep_awake_min: 10,
          hrv_nightly_avg: 62,
          hrv_weekly_avg: 61,
          hrv_baseline_low: 55,
          hrv_baseline_high: 69,
          hrv_status: 'BALANCED',
          resting_hr: 47,
          min_hr: 44,
          max_hr: 160,
          stress_avg: 24,
          stress_max: 72,
          body_battery_high: 85,
          body_battery_low: 30,
          spo2_avg: 96.5,
          respiration_avg: 14.2,
          steps: 10500,
          training_readiness_score: 79,
          training_readiness_level: 'HIGH',
        },
      ],
    });

    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="healthy-baseline-banner"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="health-days-table"]')?.textContent).toContain(
      'Tue, 03.11.2026',
    );
    expect(el.querySelector('[data-testid="health-days-table"]')?.textContent).toContain('10.500');
    const healthTable = el.querySelector('[data-testid="health-days-table"]') as HTMLTableElement;
    expect(healthTable.querySelector('thead')?.classList.contains('sticky')).toBe(true);
    expect(healthTable.querySelector('thead')?.classList.contains('top-0')).toBe(true);
    expect(healthTable.querySelector('thead th')?.classList.contains('sticky')).toBe(true);

    const btn7 = el.querySelector('[data-testid="days-btn-7"]') as HTMLButtonElement;
    btn7.click();
    httpMock.expectOne('/api/training/dashboard?days=7').flush({
      reference_date: '2026-11-03',
      current_week_start: '2026-11-02',
      current_week_end: '2026-11-08',
      ran_km_this_week: 0,
      strength_minutes_this_week: 0,
      completed_workouts_this_week: 0,
      current_week_activities: [],
      weekly_series: [],
    });
    httpMock.expectOne('/api/health/dashboard?days=7').flush({
      days_requested: 7,
      latest_date: '2026-11-03',
      warnings: [],
      kpis: {},
      series: [],
    });
  });
});
