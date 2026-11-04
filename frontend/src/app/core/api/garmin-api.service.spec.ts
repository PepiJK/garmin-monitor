import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GarminApiService } from './garmin-api.service';

describe('GarminApiService', () => {
  let service: GarminApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GarminApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GarminApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads status and computes syncBadgeState', () => {
    expect(service.syncBadgeState()).toBe('never');

    service.loadStatus();
    const req = httpMock.expectOne('/api/status');
    req.flush({
      is_syncing: false,
      last_sync_started_at: '2026-11-03T07:00:00Z',
      last_sync_finished_at: '2026-11-03T07:01:00Z',
      last_sync_status: 'success',
      activities_synced: 4,
      health_days_synced: 2,
      error_message: null,
      timezone: 'Europe/Vienna',
    });

    expect(service.status()?.last_sync_status).toBe('success');
    expect(service.syncBadgeState()).toBe('ok');

    service.status.set({
      is_syncing: false,
      last_sync_started_at: '2026-11-03T07:00:00Z',
      last_sync_finished_at: '2026-11-03T07:01:00Z',
      last_sync_status: 'error',
      activities_synced: 0,
      health_days_synced: 0,
      error_message: 'Failed',
      timezone: 'Europe/Vienna',
    });
    expect(service.syncBadgeState()).toBe('error');
  });

  it('triggers manual sync and refreshes training and status', () => {
    service.triggerSync(2);
    expect(service.isSyncing()).toBe(true);
    expect(service.syncBadgeState()).toBe('syncing');

    const syncReq = httpMock.expectOne('/api/sync');
    expect(syncReq.request.method).toBe('POST');
    expect(syncReq.request.body).toEqual({ days: 2 });
    syncReq.flush({
      run_id: 5,
      days_synced: 2,
      activities_synced: 1,
      health_days_synced: 2,
      start_date: '2026-11-02',
      end_date: '2026-11-03',
    });

    expect(service.isSyncing()).toBe(false);
    httpMock.expectOne('/api/status').flush({
      is_syncing: false,
      last_sync_started_at: null,
      last_sync_finished_at: null,
      last_sync_status: 'success',
      activities_synced: 1,
      health_days_synced: 2,
      error_message: null,
      timezone: 'Europe/Vienna',
    });
    httpMock.expectOne('/api/training/dashboard?days=30').flush({
      reference_date: '2026-11-03',
      current_week_start: '2026-11-02',
      current_week_end: '2026-11-08',
      ran_km_this_week: 8.5,
      strength_minutes_this_week: 40,
      completed_workouts_this_week: 2,
      current_week_activities: [],
      weekly_series: [],
    });
    httpMock.expectOne('/api/training/plan').flush({
      has_active_plan: false,
      plan_id: null,
      name: null,
      start_date: null,
      end_date: null,
      notes: null,
      updated_at: null,
      days: [],
    });
  });

  it('loads health dashboard and syncs plan to watch', () => {
    service.loadHealthDashboard(7);
    expect(service.selectedHealthDays()).toBe(7);
    httpMock.expectOne('/api/health/dashboard?days=7').flush({
      days_requested: 7,
      latest_date: '2026-11-03',
      warnings: [],
      kpis: {
        hrv_nightly_avg: 62,
        hrv_weekly_avg: 61,
        hrv_baseline_low: 54,
        hrv_baseline_high: 68,
        hrv_status: 'BALANCED',
        sleep_score: 84,
        sleep_qualifier: 'GOOD',
        sleep_total_min: 465,
        resting_hr: 47,
        resting_hr_30d_mean: 48,
        body_battery_high: 85,
        body_battery_low: 30,
        stress_avg: 25,
        training_readiness_score: 78,
        training_readiness_level: 'HIGH',
        spo2_avg: 96,
        respiration_avg: 14.2,
        steps: 10200,
      },
      series: [],
    });
    expect(service.healthDashboard()?.kpis.hrv_nightly_avg).toBe(62);

    service.syncPlanToWatch(true);
    httpMock.expectOne('/api/training/plan/sync?force=true').flush({ uploaded_workouts: 2 });
    httpMock.expectOne('/api/training/plan').flush({
      has_active_plan: true,
      plan_id: 1,
      name: 'Plan',
      start_date: '2026-11-02',
      end_date: '2026-11-08',
      notes: null,
      updated_at: '2026-11-03T08:00:00Z',
      days: [],
    });
  });

  it('handles HTTP error states gracefully', () => {
    service.loadStatus();
    httpMock.expectOne('/api/status').error(new ProgressEvent('error'));
    expect(service.errorMessage()).toContain('/api/status');

    service.loadTrainingDashboard(4);
    httpMock.expectOne('/api/training/dashboard?weeks=4').error(new ProgressEvent('error'));
    expect(service.errorMessage()).toContain('training dashboard');

    service.loadTrainingPlan();
    httpMock.expectOne('/api/training/plan').error(new ProgressEvent('error'));
    expect(service.errorMessage()).toContain('training plan');

    service.loadHealthDashboard(30);
    httpMock.expectOne('/api/health/dashboard?days=30').error(new ProgressEvent('error'));
    expect(service.errorMessage()).toContain('health telemetry');

    service.triggerSync();
    httpMock.expectOne('/api/sync').error(new ProgressEvent('error'));
    httpMock.expectOne('/api/status').flush({
      is_syncing: false,
      last_sync_started_at: null,
      last_sync_finished_at: null,
      last_sync_status: 'error',
      activities_synced: 0,
      health_days_synced: 0,
      error_message: 'Failed',
      timezone: 'Europe/Vienna',
    });
  });
});
