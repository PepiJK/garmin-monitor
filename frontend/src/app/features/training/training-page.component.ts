import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HealthDayWindow, TrainingWeekWindow } from '../../core/api/garmin-api.models';
import { GarminApiService } from '../../core/api/garmin-api.service';
import { formatGermanDate } from '../../core/format/german-format';
import { TrainingDashboardTabComponent } from './training-dashboard-tab.component';
import { TrainingPlanTabComponent } from './training-plan-tab.component';
import { TrainingStammdatenTabComponent } from './training-stammdaten-tab.component';

export type TrainingTab = 'dashboard' | 'plan' | 'stammdaten';

@Component({
  selector: 'app-training-page',
  imports: [
    TrainingDashboardTabComponent,
    TrainingPlanTabComponent,
    TrainingStammdatenTabComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-100">Training</h1>
          <p class="mt-1 text-sm text-slate-400">
            Running &amp; strength telemetry and Fenix 7S training plan execution ({{
              windowRangeSummary()
            }})
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-4">
          <!-- Prominent 7d / 30d / 90d Toggle -->
          <div
            class="flex items-center gap-3 rounded-xl border-2 border-sky-500/40 bg-slate-900 px-3 py-1.5 shadow-lg shadow-sky-950/50"
            role="group"
            aria-label="Global time window"
            data-testid="global-days-toggle"
          >
            <div class="hidden sm:block">
              <span class="block text-[11px] font-semibold tracking-wide text-sky-400">
                Time Window
              </span>
              <span class="block font-mono text-[11px] tabular-nums text-slate-400">
                Last {{ api.selectedDays() }} days
              </span>
            </div>
            <div class="inline-flex rounded-lg bg-slate-950 p-1">
              @for (d of dayOptions; track d) {
                <button
                  type="button"
                  (click)="onDaysChange(d)"
                  [attr.data-testid]="'days-btn-' + d"
                  [attr.aria-pressed]="api.selectedDays() === d"
                  [class]="
                    api.selectedDays() === d
                      ? 'cursor-pointer rounded-md bg-sky-500 px-4 py-1.5 font-mono text-sm font-bold text-slate-950 shadow-md shadow-sky-500/25 transition-all'
                      : 'cursor-pointer rounded-md px-4 py-1.5 font-mono text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white'
                  "
                >
                  {{ d }}d
                </button>
              }
            </div>
          </div>

          <div
            class="inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1.5"
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
                  ? 'cursor-pointer rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-semibold text-sky-400 shadow-xs'
                  : 'cursor-pointer rounded-lg px-4 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-100'
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
                  ? 'cursor-pointer rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-semibold text-sky-400 shadow-xs'
                  : 'cursor-pointer rounded-lg px-4 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-100'
              "
            >
              Plan
            </button>
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeTab() === 'stammdaten'"
              (click)="setTab('stammdaten')"
              data-testid="tab-stammdaten"
              [class]="
                activeTab() === 'stammdaten'
                  ? 'cursor-pointer rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-semibold text-sky-400 shadow-xs'
                  : 'cursor-pointer rounded-lg px-4 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-100'
              "
            >
              Stammdaten
            </button>
          </div>
        </div>
      </div>

      @if (activeTab() === 'dashboard') {
        <app-training-dashboard-tab
          [dashboard]="api.trainingDashboard()"
          [selectedWeeks]="api.selectedDays()"
          (weeksChange)="onWeeksChange($event)"
        />
      } @else if (activeTab() === 'plan') {
        <app-training-plan-tab
          [plan]="api.trainingPlan()"
          [selectedDays]="api.selectedDays()"
          (syncPlan)="onSyncPlanToWatch()"
          (updateNotes)="onUpdateDayNotes($event)"
        />
      } @else {
        <app-training-stammdaten-tab [items]="api.stammdaten()" />
      }
    </div>
  `,
})
export class TrainingPageComponent implements OnInit {
  readonly api = inject(GarminApiService);
  readonly activeTab = signal<TrainingTab>('dashboard');
  readonly dayOptions: readonly HealthDayWindow[] = [7, 30, 90];

  readonly windowRangeSummary = computed(() => {
    const d = this.api.trainingDashboard();
    const start = d?.window_start || d?.current_week_start;
    const end = d?.window_end || d?.current_week_end;
    if (start && end) {
      return `${formatGermanDate(start)} – ${formatGermanDate(end)}`;
    }
    return `${this.api.selectedDays()}d window`;
  });

  ngOnInit(): void {
    this.api.loadTrainingDashboard(this.api.selectedDays());
    this.api.loadTrainingPlan();
  }

  setTab(tab: TrainingTab): void {
    this.activeTab.set(tab);
  }

  onDaysChange(days: HealthDayWindow): void {
    this.api.setDaysWindow(days);
  }

  onWeeksChange(weeks: TrainingWeekWindow): void {
    if (weeks === 7 || weeks === 30 || weeks === 90) {
      this.api.setDaysWindow(weeks);
    } else {
      this.api.loadTrainingDashboard(weeks);
    }
  }

  onSyncPlanToWatch(): void {
    this.api.syncPlanToWatch(false);
  }

  onUpdateDayNotes(event: { date: string; notes: string }): void {
    this.api.updatePlanDayNotes(event.date, event.notes);
  }
}
