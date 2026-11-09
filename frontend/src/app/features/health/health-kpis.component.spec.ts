import { TestBed } from '@angular/core/testing';
import { HealthKpiSummary } from '../../core/api/garmin-api.models';
import { HealthKpisComponent } from './health-kpis.component';

const SAMPLE_KPIS: HealthKpiSummary = {
  hrv_nightly_avg: 61,
  hrv_weekly_avg: 60,
  hrv_baseline_low: 54,
  hrv_baseline_high: 68,
  hrv_status: 'BALANCED',
  sleep_score: 84,
  sleep_qualifier: 'GOOD',
  sleep_total_min: 465,
  resting_hr: 47,
  resting_hr_30d_mean: 48.2,
  body_battery_high: 86,
  body_battery_low: 29,
  body_battery_charged: 64,
  body_battery_drained: 52,
  stress_avg: 24,
  training_readiness_score: 79,
  training_readiness_level: 'HIGH',
  acute_load: 126,
  recovery_time_hours: 5.4,
  spo2_avg: 96.5,
  respiration_avg: 14.2,
  steps: 11250,
};

describe('HealthKpisComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HealthKpisComponent],
    }).compileComponents();
  });

  it('renders all 6 physiological KPI cards with formatted values', async () => {
    const fixture = TestBed.createComponent(HealthKpisComponent);
    fixture.componentRef.setInput('kpis', SAMPLE_KPIS);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="kpi-hrv"]')?.textContent).toContain('61');
    expect(el.querySelector('[data-testid="kpi-hrv"]')?.textContent).toContain('54-68 ms');
    expect(el.querySelector('[data-testid="kpi-sleep"]')?.textContent).toContain('84');
    expect(el.querySelector('[data-testid="kpi-sleep"]')?.textContent).toContain('7h 45m');
    expect(el.querySelector('[data-testid="kpi-rhr"]')?.textContent).toContain('47');
    expect(el.querySelector('[data-testid="kpi-body-battery"]')?.textContent).toContain('86');
    expect(el.querySelector('[data-testid="kpi-body-battery"]')?.textContent).toContain('+64');
    expect(el.querySelector('[data-testid="kpi-stress"]')?.textContent).toContain('24');
    expect(el.querySelector('[data-testid="kpi-readiness"]')?.textContent).toContain('79');
    expect(el.querySelector('[data-testid="kpi-readiness"]')?.textContent).toContain('126');

    // Also test UNBALANCED and LOW HRV status badge classes
    fixture.componentRef.setInput('kpis', { ...SAMPLE_KPIS, hrv_status: 'UNBALANCED' });
    await fixture.whenStable();
    expect(fixture.componentInstance.hrvStatusClass()).toContain('amber');

    fixture.componentRef.setInput('kpis', { ...SAMPLE_KPIS, hrv_status: 'LOW' });
    await fixture.whenStable();
    expect(fixture.componentInstance.hrvStatusClass()).toContain('red');

    // Test computing averages from selected 7d / 30d / 90d series
    fixture.componentRef.setInput('selectedDays', 7);
    fixture.componentRef.setInput('series', [
      {
        date: '2026-11-02',
        sleep_score: 80,
        sleep_qualifier: 'GOOD',
        sleep_total_min: 420,
        sleep_deep_min: 80,
        sleep_light_min: 240,
        sleep_rem_min: 100,
        sleep_awake_min: 10,
        hrv_nightly_avg: 60,
        hrv_weekly_avg: 60,
        hrv_baseline_low: 54,
        hrv_baseline_high: 68,
        hrv_status: 'BALANCED',
        resting_hr: 48,
        min_hr: 44,
        max_hr: 150,
        stress_avg: 20,
        stress_max: 70,
        body_battery_high: 80,
        body_battery_low: 30,
        spo2_avg: 96,
        respiration_avg: 14,
        steps: 10000,
        training_readiness_score: 75,
        training_readiness_level: 'HIGH',
      },
      {
        date: '2026-11-03',
        sleep_score: 90,
        sleep_qualifier: 'EXCELLENT',
        sleep_total_min: 480,
        sleep_deep_min: 90,
        sleep_light_min: 270,
        sleep_rem_min: 120,
        sleep_awake_min: 5,
        hrv_nightly_avg: 70,
        hrv_weekly_avg: 62,
        hrv_baseline_low: 54,
        hrv_baseline_high: 68,
        hrv_status: 'BALANCED',
        resting_hr: 46,
        min_hr: 43,
        max_hr: 155,
        stress_avg: -2,
        stress_max: 60,
        body_battery_high: 90,
        body_battery_low: 40,
        spo2_avg: 97,
        respiration_avg: 14,
        steps: 12000,
        training_readiness_score: 85,
        training_readiness_level: 'HIGH',
      },
    ]);
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="kpi-hrv"]')?.textContent).toContain('65');
    expect(el.querySelector('[data-testid="kpi-sleep"]')?.textContent).toContain('85');
    expect(el.querySelector('[data-testid="kpi-rhr"]')?.textContent).toContain('47');
    expect(el.querySelector('[data-testid="kpi-stress"]')?.textContent).toContain('20');
    expect(el.querySelector('[data-testid="kpi-readiness"]')?.textContent).toContain('11.000');
  });
});
