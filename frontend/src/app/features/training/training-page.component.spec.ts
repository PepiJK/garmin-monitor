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

    httpMock.expectOne('/api/training/dashboard?days=30').flush({
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

    const stammTabBtn = el.querySelector('[data-testid="tab-stammdaten"]') as HTMLButtonElement;
    stammTabBtn.click();
    await fixture.whenStable();
    expect(el.querySelector('app-training-stammdaten-tab')).not.toBeNull();

    const dashTabBtn = el.querySelector('[data-testid="tab-dashboard"]') as HTMLButtonElement;
    dashTabBtn.click();
    await fixture.whenStable();
    expect(el.querySelector('app-training-dashboard-tab')).not.toBeNull();

    const btn7 = el.querySelector('[data-testid="days-btn-7"]') as HTMLButtonElement;
    btn7.click();
    httpMock.expectOne('/api/training/dashboard?days=7').flush({
      reference_date: '2026-11-03',
      days_requested: 7,
      window_start: '2026-10-28',
      window_end: '2026-11-03',
      ran_km_window: 12.1,
      strength_minutes_window: 39,
      completed_workouts_window: 3,
      window_activities: [],
      current_week_start: '2026-11-02',
      current_week_end: '2026-11-08',
      ran_km_this_week: 4.7,
      strength_minutes_this_week: 0,
      completed_workouts_this_week: 1,
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
    await fixture.whenStable();
    expect(fixture.componentInstance.api.selectedDays()).toBe(7);

    fixture.componentInstance.onWeeksChange(90);
    httpMock.expectOne('/api/training/dashboard?days=90').flush({});
    httpMock.expectOne('/api/health/dashboard?days=90').flush({});

    fixture.componentInstance.onSyncPlanToWatch();
    httpMock.expectOne('/api/training/plan/sync?force=false').flush({ uploaded_workouts: 1 });
    httpMock.expectOne('/api/training/plan').flush({
      has_active_plan: true,
      plan_id: 1,
      name: 'Active Plan',
      start_date: '2026-11-02',
      end_date: '2026-11-08',
      notes: null,
      updated_at: '2026-11-03T08:00:00Z',
      days: [
        {
          date: '2026-11-03',
          sport_type: 'strength_training',
          workout_title: 'Kraft A: Unterkörper',
          focus: 'Split Squats',
          goal_km: null,
          goal_duration_min: 40,
          hr_goal_label: null,
          hr_min: null,
          hr_max: null,
          actual_km: null,
          actual_duration_min: null,
          actual_avg_hr: null,
          actual_max_hr: null,
          notes: 'Alte Notiz',
          garmin_workout_id: 100,
          garmin_schedule_id: 200,
          status: 'pending',
        },
      ],
    });

    fixture.componentInstance.onUpdateDayNotes({
      date: '2026-11-03',
      notes: 'Neue Notiz gespeichert',
    });
    const patchReq = httpMock.expectOne('/api/training/plan/days/2026-11-03/notes');
    expect(patchReq.request.method).toBe('PATCH');
    expect(patchReq.request.body).toEqual({ notes: 'Neue Notiz gespeichert' });
    patchReq.flush({
      date: '2026-11-03',
      sport_type: 'strength_training',
      workout_title: 'Kraft A: Unterkörper',
      focus: 'Split Squats',
      goal_km: null,
      goal_duration_min: 40,
      hr_goal_label: null,
      hr_min: null,
      hr_max: null,
      actual_km: null,
      actual_duration_min: null,
      actual_avg_hr: null,
      actual_max_hr: null,
      notes: 'Neue Notiz gespeichert',
      garmin_workout_id: 100,
      garmin_schedule_id: 200,
      status: 'pending',
    });
    expect(fixture.componentInstance.api.trainingPlan()?.days[0]?.notes).toBe(
      'Neue Notiz gespeichert',
    );
  });
});
