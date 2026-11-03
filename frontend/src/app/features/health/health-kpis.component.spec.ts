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
  stress_avg: 24,
  training_readiness_score: 79,
  training_readiness_level: 'HIGH',
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
    expect(el.querySelector('[data-testid="kpi-stress"]')?.textContent).toContain('24');
    expect(el.querySelector('[data-testid="kpi-readiness"]')?.textContent).toContain('79');

    // Also test UNBALANCED and LOW HRV status badge classes
    fixture.componentRef.setInput('kpis', { ...SAMPLE_KPIS, hrv_status: 'UNBALANCED' });
    await fixture.whenStable();
    expect(fixture.componentInstance.hrvStatusClass()).toContain('amber');

    fixture.componentRef.setInput('kpis', { ...SAMPLE_KPIS, hrv_status: 'LOW' });
    await fixture.whenStable();
    expect(fixture.componentInstance.hrvStatusClass()).toContain('red');
  });
});
