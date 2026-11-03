import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { TrainingWeekWindow } from '../../core/api/garmin-api.models';
import { GarminApiService } from '../../core/api/garmin-api.service';
import { TrainingDashboardTabComponent } from './training-dashboard-tab.component';
import { TrainingPlanTabComponent } from './training-plan-tab.component';

export type TrainingTab = 'dashboard' | 'plan';

@Component({
  selector: 'app-training-page',
  imports: [TrainingDashboardTabComponent, TrainingPlanTabComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div
        class="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4"
      >
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900">Training</h1>
          <p class="mt-1 text-sm text-slate-600">
            Weekly running &amp; strength telemetry and Fenix 7S training plan execution
          </p>
        </div>

        <div
          class="inline-flex rounded-lg border border-slate-200 bg-white p-1"
          role="tablist"
          aria-label="Training views"
        >
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeTab() === 'dashboard'"
            (click)="setTab('dashboard')"
            data-testid="tab-dashboard"
            [class]="
              activeTab() === 'dashboard'
                ? 'cursor-pointer rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white'
                : 'cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900'
            "
          >
            Dashboard
          </button>
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeTab() === 'plan'"
            (click)="setTab('plan')"
            data-testid="tab-plan"
            [class]="
              activeTab() === 'plan'
                ? 'cursor-pointer rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white'
                : 'cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900'
            "
          >
            Plan
          </button>
        </div>
      </div>

      @if (activeTab() === 'dashboard') {
        <app-training-dashboard-tab
          [dashboard]="api.trainingDashboard()"
          [selectedWeeks]="api.selectedWeeks()"
          (weeksChange)="onWeeksChange($event)"
        />
      } @else {
        <app-training-plan-tab [plan]="api.trainingPlan()" (syncPlan)="onSyncPlanToWatch()" />
      }
    </div>
  `,
})
export class TrainingPageComponent implements OnInit {
  readonly api = inject(GarminApiService);
  readonly activeTab = signal<TrainingTab>('dashboard');

  ngOnInit(): void {
    this.api.loadTrainingDashboard(this.api.selectedWeeks());
    this.api.loadTrainingPlan();
  }

  setTab(tab: TrainingTab): void {
    this.activeTab.set(tab);
  }

  onWeeksChange(weeks: TrainingWeekWindow): void {
    this.api.loadTrainingDashboard(weeks);
  }

  onSyncPlanToWatch(): void {
    this.api.syncPlanToWatch(false);
  }
}
