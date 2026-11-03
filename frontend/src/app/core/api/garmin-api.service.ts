import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  HealthDashboardResponse,
  HealthDayWindow,
  PlanSyncResponse,
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
  readonly healthDashboard = signal<HealthDashboardResponse | null>(null);

  readonly selectedWeeks = signal<TrainingWeekWindow>(12);
  readonly selectedHealthDays = signal<HealthDayWindow>(30);

  readonly isSyncing = signal<boolean>(false);
  readonly isLoadingTraining = signal<boolean>(false);
  readonly isLoadingPlan = signal<boolean>(false);
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
        this.loadTrainingDashboard(this.selectedWeeks());
        this.loadTrainingPlan();
        if (this.healthDashboard() !== null) {
          this.loadHealthDashboard(this.selectedHealthDays());
        }
      },
      error: (err: { error?: { detail?: string } }) => {
        this.isSyncing.set(false);
        this.errorMessage.set(err?.error?.detail ?? 'Manual synchronization failed');
        this.loadStatus();
      },
    });
  }

  loadTrainingDashboard(weeks: TrainingWeekWindow = this.selectedWeeks()): void {
    this.selectedWeeks.set(weeks);
    this.isLoadingTraining.set(true);
    this.http
      .get<TrainingDashboardResponse>('/api/training/dashboard', {
        params: { weeks: String(weeks) },
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
        this.isLoadingPlan.set(false);
      },
      error: () => {
        this.isLoadingPlan.set(false);
        this.errorMessage.set('Unable to load training plan');
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
