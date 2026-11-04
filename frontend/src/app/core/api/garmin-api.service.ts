import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  HealthDashboardResponse,
  HealthDayWindow,
  PlanDayItem,
  PlanSyncResponse,
  StammdatenItem,
  StammdatenResponse,
  SyncResultResponse,
  SyncStatusResponse,
  TrainingDashboardResponse,
  TrainingPlanResponse,
  TrainingWeekWindow,
} from './garmin-api.models';

@Injectable({
  providedIn: 'root',
})
export class GarminApiService {
  private readonly http = inject(HttpClient);

  readonly status = signal<SyncStatusResponse | null>(null);
  readonly trainingDashboard = signal<TrainingDashboardResponse | null>(null);
  readonly trainingPlan = signal<TrainingPlanResponse | null>(null);
  readonly stammdaten = signal<StammdatenItem[]>([]);
  readonly healthDashboard = signal<HealthDashboardResponse | null>(null);

  readonly selectedDays = signal<HealthDayWindow>(30);
  readonly selectedHealthDays = this.selectedDays;
  readonly selectedWeeks = signal<TrainingWeekWindow>(30);

  readonly isSyncing = signal<boolean>(false);
  readonly isLoadingTraining = signal<boolean>(false);
  readonly isLoadingPlan = signal<boolean>(false);
  readonly isLoadingStammdaten = signal<boolean>(false);
  readonly isLoadingHealth = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  readonly syncBadgeState = computed<'ok' | 'syncing' | 'error' | 'never'>(() => {
    if (this.isSyncing() || this.status()?.is_syncing) {
      return 'syncing';
    }
    const s = this.status();
    if (!s || !s.last_sync_status) {
      return 'never';
    }
    if (s.last_sync_status === 'error') {
      return 'error';
    }
    return 'ok';
  });

  loadStatus(): void {
    this.http.get<SyncStatusResponse>('/api/status').subscribe({
      next: (res) => {
        this.status.set(res);
      },
      error: () => {
        this.errorMessage.set('Unable to reach /api/status');
      },
    });
  }

  triggerSync(days?: number): void {
    this.isSyncing.set(true);
    this.errorMessage.set(null);
    const body = days !== undefined ? { days } : {};
    this.http.post<SyncResultResponse>('/api/sync', body).subscribe({
      next: () => {
        this.isSyncing.set(false);
        this.loadStatus();
        this.loadTrainingDashboard(this.selectedDays());
        this.loadTrainingPlan();
        if (this.healthDashboard() !== null) {
          this.loadHealthDashboard(this.selectedDays());
        }
      },
      error: (err: { error?: { detail?: string } }) => {
        this.isSyncing.set(false);
        this.errorMessage.set(err?.error?.detail ?? 'Manual synchronization failed');
        this.loadStatus();
      },
    });
  }

  setDaysWindow(days: HealthDayWindow): void {
    this.selectedDays.set(days);
    this.selectedWeeks.set(days);
    this.loadTrainingDashboard(days);
    this.loadHealthDashboard(days);
  }

  loadTrainingDashboard(windowVal: TrainingWeekWindow = this.selectedDays()): void {
    this.selectedWeeks.set(windowVal);
    if (windowVal === 7 || windowVal === 30 || windowVal === 90) {
      this.selectedDays.set(windowVal);
    }
    this.isLoadingTraining.set(true);
    const params: Record<string, string> =
      windowVal === 4 || windowVal === 12 || windowVal === 26
        ? { weeks: String(windowVal) }
        : { days: String(windowVal) };
    this.http
      .get<TrainingDashboardResponse>('/api/training/dashboard', {
        params,
      })
      .subscribe({
        next: (res) => {
          this.trainingDashboard.set(res);
          this.isLoadingTraining.set(false);
        },
        error: () => {
          this.isLoadingTraining.set(false);
          this.errorMessage.set('Unable to load training dashboard data');
        },
      });
  }

  loadTrainingPlan(): void {
    this.isLoadingPlan.set(true);
    this.http.get<TrainingPlanResponse>('/api/training/plan').subscribe({
      next: (res) => {
        this.trainingPlan.set(res);
        if (res.stammdaten && res.stammdaten.length > 0) {
          this.stammdaten.set(res.stammdaten);
        }
        this.isLoadingPlan.set(false);
      },
      error: () => {
        this.isLoadingPlan.set(false);
        this.errorMessage.set('Unable to load training plan');
      },
    });
  }

  loadStammdaten(): void {
    this.isLoadingStammdaten.set(true);
    this.http.get<StammdatenResponse>('/api/training/stammdaten').subscribe({
      next: (res) => {
        this.stammdaten.set(res.items ?? []);
        this.isLoadingStammdaten.set(false);
      },
      error: () => {
        this.isLoadingStammdaten.set(false);
        this.errorMessage.set('Unable to load Stammdaten');
      },
    });
  }

  syncPlanToWatch(force = false): void {
    this.isSyncing.set(true);
    this.http
      .post<PlanSyncResponse>('/api/training/plan/sync', null, {
        params: { force: String(force) },
      })
      .subscribe({
        next: () => {
          this.isSyncing.set(false);
          this.loadTrainingPlan();
        },
        error: () => {
          this.isSyncing.set(false);
          this.errorMessage.set('Failed to push training plan workouts to Garmin Connect');
        },
      });
  }

  updatePlanDayNotes(date: string, notes: string): void {
    this.http.patch<PlanDayItem>(`/api/training/plan/days/${date}/notes`, { notes }).subscribe({
      next: (updatedDay) => {
        const current = this.trainingPlan();
        if (!current) {
          return;
        }
        this.trainingPlan.set({
          ...current,
          days: current.days.map((d) => (d.date === date ? updatedDay : d)),
        });
      },
      error: () => {
        this.errorMessage.set(`Unable to save notes for ${date}`);
      },
    });
  }

  loadHealthDashboard(days: HealthDayWindow = this.selectedHealthDays()): void {
    this.selectedHealthDays.set(days);
    this.isLoadingHealth.set(true);
    this.http
      .get<HealthDashboardResponse>('/api/health/dashboard', {
        params: { days: String(days) },
      })
      .subscribe({
        next: (res) => {
          this.healthDashboard.set(res);
          this.isLoadingHealth.set(false);
        },
        error: () => {
          this.isLoadingHealth.set(false);
          this.errorMessage.set('Unable to load health telemetry');
        },
      });
  }
}
