import { TestBed } from '@angular/core/testing';
import { HealthWarning } from '../../core/api/garmin-api.models';
import { HealthWarningsBannerComponent } from './health-warnings-banner.component';

describe('HealthWarningsBannerComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HealthWarningsBannerComponent],
    }).compileComponents();
  });

  it('renders healthy baseline banner when warnings list is empty', async () => {
    const fixture = TestBed.createComponent(HealthWarningsBannerComponent);
    fixture.componentRef.setInput('warnings', []);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="healthy-baseline-banner"]')).not.toBeNull();
    expect(el.textContent).toContain('All health indicators within baseline');
  });

  it('renders critical and warning alert cards when warnings exist', async () => {
    const warnings: HealthWarning[] = [
      {
        code: 'sleep_consecutive_low',
        severity: 'critical',
        title: 'Sleep score below 60 for 2 consecutive nights',
        metric: 'Sleep Score',
        observed_value: '54',
        baseline_or_threshold: '>= 60',
        description: 'Restorative sleep deficit detected.',
        date: '2026-11-03',
      },
      {
        code: 'hrv_status',
        severity: 'warning',
        title: 'Garmin HRV status is UNBALANCED',
        metric: 'HRV Status',
        observed_value: 'UNBALANCED (46 ms)',
        baseline_or_threshold: 'BALANCED',
        description: 'Weekly HRV drifted outside balanced range.',
        date: '2026-11-03',
      },
    ];

    const fixture = TestBed.createComponent(HealthWarningsBannerComponent);
    fixture.componentRef.setInput('warnings', warnings);
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="active-warnings-banner"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="warning-card-sleep_consecutive_low"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="warning-card-hrv_status"]')).not.toBeNull();
    expect(el.textContent).toContain('Critical');
    expect(el.textContent).toContain('Warning');
  });
});
