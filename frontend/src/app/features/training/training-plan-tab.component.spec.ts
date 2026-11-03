import { TestBed } from '@angular/core/testing';
import { TrainingPlanResponse } from '../../core/api/garmin-api.models';
import { TrainingPlanTabComponent } from './training-plan-tab.component';

const SAMPLE_PLAN: TrainingPlanResponse = {
  has_active_plan: true,
  plan_id: 1,
  name: 'Vienna Autumn 10K Plan',
  start_date: '2026-11-01',
  end_date: '2026-11-05',
  notes: 'Polarized block',
  updated_at: '2026-11-03T08:00:00Z',
  days: [
    {
      date: '2026-11-01',
      sport_type: 'running',
      workout_title: 'Long Aerobic Run',
      focus: 'Easy Zone 2',
      goal_km: 12.0,
      goal_duration_min: 66,
      hr_goal_label: '135-148 bpm',
      hr_min: 135,
      hr_max: 148,
      actual_km: 12.2,
      actual_duration_min: 65,
      actual_avg_hr: 143,
      actual_max_hr: 156,
      garmin_workout_id: 1001,
      garmin_schedule_id: 2001,
      status: 'done',
    },
    {
      date: '2026-11-02',
      sport_type: 'strength_training',
      workout_title: 'Strength A',
      focus: 'Squats & Pull-ups',
      goal_km: null,
      goal_duration_min: 45,
      hr_goal_label: null,
      hr_min: 100,
      hr_max: 135,
      actual_km: null,
      actual_duration_min: 30,
      actual_avg_hr: 118,
      actual_max_hr: 140,
      garmin_workout_id: 1002,
      garmin_schedule_id: 2002,
      status: 'partial',
    },
    {
      date: '2026-11-03',
      sport_type: 'running',
      workout_title: 'Intervals',
      focus: null,
      goal_km: 8.0,
      goal_duration_min: null,
      hr_goal_label: null,
      hr_min: null,
      hr_max: null,
      actual_km: null,
      actual_duration_min: null,
      actual_avg_hr: null,
      actual_max_hr: null,
      garmin_workout_id: null,
      garmin_schedule_id: null,
      status: 'missed',
    },
    {
      date: '2026-11-04',
      sport_type: 'rest',
      workout_title: 'Rest Day',
      focus: 'Mobility',
      goal_km: null,
      goal_duration_min: null,
      hr_goal_label: null,
      hr_min: null,
      hr_max: null,
      actual_km: null,
      actual_duration_min: null,
      actual_avg_hr: null,
      actual_max_hr: null,
      garmin_workout_id: null,
      garmin_schedule_id: null,
      status: 'rest',
    },
    {
      date: '2026-11-05',
      sport_type: 'running',
      workout_title: 'Tempo Run',
      focus: 'Threshold',
      goal_km: 9.0,
      goal_duration_min: 45,
      hr_goal_label: '160-170 bpm',
      hr_min: 160,
      hr_max: 170,
      actual_km: null,
      actual_duration_min: null,
      actual_avg_hr: null,
      actual_max_hr: null,
      garmin_workout_id: 1003,
      garmin_schedule_id: 2003,
      status: 'pending',
    },
  ],
};

describe('TrainingPlanTabComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrainingPlanTabComponent],
    }).compileComponents();
  });

  it('renders empty state when no active plan is present', async () => {
    const fixture = TestBed.createComponent(TrainingPlanTabComponent);
    fixture.componentRef.setInput('plan', {
      has_active_plan: false,
      plan_id: null,
      name: null,
      start_date: null,
      end_date: null,
      notes: null,
      updated_at: null,
      days: [],
    });
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="no-active-plan"]')).not.toBeNull();
  });

  it('renders plan table with goals, actuals, HR, and status badges', async () => {
    const fixture = TestBed.createComponent(TrainingPlanTabComponent);
    fixture.componentRef.setInput('plan', SAMPLE_PLAN);

    let syncClicked = false;
    fixture.componentInstance.syncPlan.subscribe(() => {
      syncClicked = true;
    });

    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[data-testid="plan-title"]')?.textContent).toContain(
      'Vienna Autumn 10K Plan',
    );
    expect(el.querySelector('[data-testid="status-badge-done"]')?.textContent).toContain('done');
    expect(el.querySelector('[data-testid="status-badge-partial"]')?.textContent).toContain(
      'partial',
    );
    expect(el.querySelector('[data-testid="status-badge-missed"]')?.textContent).toContain(
      'missed',
    );
    expect(el.querySelector('[data-testid="status-badge-rest"]')?.textContent).toContain('rest');
    expect(el.querySelector('[data-testid="status-badge-pending"]')?.textContent).toContain(
      'pending',
    );

    const syncBtn = el.querySelector('[data-testid="sync-plan-watch-btn"]') as HTMLButtonElement;
    syncBtn.click();
    expect(syncClicked).toBe(true);
  });
});
