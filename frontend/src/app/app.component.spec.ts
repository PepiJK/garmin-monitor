import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideEchartsCore } from 'ngx-echarts';
import { AppComponent } from './app.component';
import { routes } from './app.routes';
import { echarts } from './core/echarts/echarts-core';

describe('AppComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideEchartsCore({ echarts }),
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the app and render navbar with navigation links', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();

    const statusReq = httpMock.expectOne('/api/status');
    statusReq.flush({
      is_syncing: false,
      last_sync_started_at: '2026-11-03T08:00:00Z',
      last_sync_finished_at: '2026-11-03T08:01:00Z',
      last_sync_status: 'success',
      activities_synced: 5,
      health_days_synced: 2,
      error_message: null,
      timezone: 'Europe/Vienna',
    });

    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Garmin Monitor');
    expect(compiled.textContent).toContain('Training');
    expect(compiled.textContent).toContain('Health');
    expect(compiled.textContent).toContain('Last sync: 2026-11-03 08:01 UTC');
  });

  it('should redirect root path to /training and navigate to /health', async () => {
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);

    await harness.navigateByUrl('/');
    httpMock.match('/api/training/dashboard?weeks=12').forEach((r) =>
      r.flush({
        reference_date: '2026-11-03',
        current_week_start: '2026-11-02',
        current_week_end: '2026-11-08',
        ran_km_this_week: 0,
        strength_minutes_this_week: 0,
        completed_workouts_this_week: 0,
        current_week_activities: [],
        weekly_series: [],
      }),
    );
    httpMock.match('/api/training/plan').forEach((r) =>
      r.flush({
        has_active_plan: false,
        plan_id: null,
        name: null,
        start_date: null,
        end_date: null,
        notes: null,
        updated_at: null,
        days: [],
      }),
    );
    expect(router.url).toBe('/training');

    await harness.navigateByUrl('/health');
    expect(router.url).toBe('/health');
  });
});
