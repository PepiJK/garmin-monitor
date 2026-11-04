import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NavbarComponent } from './navbar.component';

describe('NavbarComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('renders brand, navigation links, and triggers sync on button click', async () => {
    const fixture = TestBed.createComponent(NavbarComponent);
    await fixture.whenStable();

    httpMock.expectOne('/api/status').flush({
      is_syncing: false,
      last_sync_started_at: '2026-11-03T08:15:00Z',
      last_sync_finished_at: '2026-11-03T08:16:00Z',
      last_sync_status: 'success',
      activities_synced: 3,
      health_days_synced: 2,
      error_message: null,
      timezone: 'Europe/Vienna',
    });

    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Last sync: 03.11.2026, 09:16');

    const syncBtn = el.querySelector('[data-testid="sync-now-btn"]') as HTMLButtonElement;
    syncBtn.click();
    await fixture.whenStable();
    expect(syncBtn.textContent).toContain('Syncing...');

    httpMock.expectOne('/api/sync').flush({
      run_id: 2,
      days_synced: 2,
      activities_synced: 1,
      health_days_synced: 2,
      start_date: '2026-11-02',
      end_date: '2026-11-03',
    });
    httpMock.match('/api/status').forEach((r) =>
      r.flush({
        is_syncing: false,
        last_sync_started_at: null,
        last_sync_finished_at: null,
        last_sync_status: 'error',
        activities_synced: 0,
        health_days_synced: 0,
        error_message: 'Auth error',
        timezone: 'Europe/Vienna',
      }),
    );
    httpMock.match('/api/training/dashboard?days=30').forEach((r) => r.flush({}));
    httpMock.match('/api/training/plan').forEach((r) => r.flush({}));

    await fixture.whenStable();
    expect(el.textContent).toContain('Last sync: failed');
  });
});
