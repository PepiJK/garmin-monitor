import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideEchartsCore } from 'ngx-echarts';
import { echarts } from '../../core/echarts/echarts-core';
import { TrainingPageComponent } from './training-page.component';

describe('TrainingPageComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrainingPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideEchartsCore({ echarts })],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('defaults to Dashboard tab and switches to Plan tab on click', async () => {
    const fixture = TestBed.createComponent(TrainingPageComponent);
    await fixture.whenStable();

    httpMock.expectOne('/api/training/dashboard?weeks=12').flush({
      reference_date: '2026-11-03',
      current_week_start: '2026-11-02',
      current_week_end: '2026-11-08',
      ran_km_this_week: 12.5,
      strength_minutes_this_week: 45,
      completed_workouts_this_week: 2,
      current_week_activities: [],
      weekly_series: [],
    });
    httpMock.expectOne('/api/training/plan').flush({
      has_active_plan: true,
      plan_id: 1,
      name: 'Active Plan',
      start_date: '2026-11-02',
      end_date: '2026-11-08',
      notes: null,
      updated_at: '2026-11-03T08:00:00Z',
      days: [],
    });

    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-training-dashboard-tab')).not.toBeNull();
    expect(el.querySelector('app-training-plan-tab')).toBeNull();

    const planTabBtn = el.querySelector('[data-testid="tab-plan"]') as HTMLButtonElement;
    planTabBtn.click();
    await fixture.whenStable();

    expect(el.querySelector('app-training-plan-tab')).not.toBeNull();
    expect(el.querySelector('app-training-dashboard-tab')).toBeNull();

    const dashTabBtn = el.querySelector('[data-testid="tab-dashboard"]') as HTMLButtonElement;
    dashTabBtn.click();
    await fixture.whenStable();
    expect(el.querySelector('app-training-dashboard-tab')).not.toBeNull();
  });
});
