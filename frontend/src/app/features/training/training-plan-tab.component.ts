import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PlanDayItem, PlanDayStatus, TrainingPlanResponse } from '../../core/api/garmin-api.models';

@Component({
  selector: 'app-training-plan-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Plan Header & Summary -->
      <section class="rounded-lg border border-slate-200 bg-white p-5">
        @if (!plan()?.has_active_plan) {
          <div class="py-6 text-center" data-testid="no-active-plan">
            <h2 class="text-base font-semibold text-slate-900">No active training plan</h2>
            <p class="mt-1 text-sm text-slate-600">
              Apply a training plan on the server using
              <code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
                python -m garmin_monitor plan apply plan.yaml
              </code>
              to schedule Fenix 7S workouts and track daily goals.
            </p>
          </div>
        } @else {
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div class="flex items-center gap-3">
                <h2 class="text-lg font-semibold text-slate-900" data-testid="plan-title">
                  {{ plan()?.name }}
                </h2>
                <span class="rounded bg-slate-100 px-2.5 py-0.5 font-mono text-xs text-slate-700">
                  {{ plan()?.start_date }} .. {{ plan()?.end_date }}
                </span>
              </div>
              @if (plan()?.notes) {
                <p class="mt-1 text-sm text-slate-600">{{ plan()?.notes }}</p>
              }
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <div class="flex items-center gap-2 text-xs font-medium">
                <span class="rounded bg-teal-50 px-2.5 py-1 text-teal-800">
                  Done: {{ statusCounts().done }}
                </span>
                <span class="rounded bg-amber-50 px-2.5 py-1 text-amber-800">
                  Partial: {{ statusCounts().partial }}
                </span>
                <span class="rounded bg-red-50 px-2.5 py-1 text-red-800">
                  Missed: {{ statusCounts().missed }}
                </span>
                <span class="rounded bg-sky-50 px-2.5 py-1 text-sky-800">
                  Pending: {{ statusCounts().pending }}
                </span>
              </div>

              <button
                type="button"
                (click)="syncPlan.emit()"
                data-testid="sync-plan-watch-btn"
                class="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Sync plan to watch
              </button>
            </div>
          </div>
        }
      </section>

      <!-- Structured Daily Plan Table -->
      @if (plan()?.has_active_plan) {
        <section class="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div class="overflow-x-auto">
            <table
              class="w-full border-collapse text-left text-sm"
              data-testid="training-plan-table"
            >
              <thead>
                <tr
                  class="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600"
                >
                  <th class="px-4 py-3">Date</th>
                  <th class="px-4 py-3">Type</th>
                  <th class="px-4 py-3">Workout / Focus</th>
                  <th class="px-4 py-3 text-right">Goal (km / min)</th>
                  <th class="px-4 py-3">HR Goal</th>
                  <th class="px-4 py-3 text-right">Actual (km / min)</th>
                  <th class="px-4 py-3 text-right">Actual Avg / Max HR</th>
                  <th class="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 text-xs">
                @for (day of plan()?.days ?? []; track day.date) {
                  <tr class="hover:bg-slate-50/80" [attr.data-testid]="'plan-row-' + day.date">
                    <td class="whitespace-nowrap px-4 py-3 font-mono tabular-nums text-slate-800">
                      {{ day.date }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-3">
                      @switch (day.sport_type) {
                        @case ('running') {
                          <span
                            class="inline-flex items-center rounded bg-sky-50 px-2 py-0.5 font-medium text-sky-700"
                          >
                            Running
                          </span>
                        }
                        @case ('strength_training') {
                          <span
                            class="inline-flex items-center rounded bg-teal-50 px-2 py-0.5 font-medium text-teal-700"
                          >
                            Strength
                          </span>
                        }
                        @default {
                          <span
                            class="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600"
                          >
                            Rest
                          </span>
                        }
                      }
                    </td>
                    <td class="px-4 py-3">
                      <div class="font-medium text-slate-900">{{ day.workout_title }}</div>
                      @if (day.focus) {
                        <div class="mt-0.5 text-slate-500">{{ day.focus }}</div>
                      }
                    </td>
                    <td
                      class="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-slate-700"
                    >
                      {{ formatGoal(day) }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-3 font-mono tabular-nums text-slate-600">
                      {{ formatHrGoal(day) }}
                    </td>
                    <td
                      class="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-slate-900"
                    >
                      {{ formatActual(day) }}
                    </td>
                    <td
                      class="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-slate-700"
                    >
                      {{ formatActualHr(day) }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-3 text-center">
                      <span
                        [class]="statusBadgeClass(day.status)"
                        [attr.data-testid]="'status-badge-' + day.status"
                      >
                        {{ day.status }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
    </div>
  `,
})
export class TrainingPlanTabComponent {
  readonly plan = input<TrainingPlanResponse | null>(null);
  readonly syncPlan = output<void>();

  readonly statusCounts = computed(() => {
    const counts: Record<PlanDayStatus, number> = {
      done: 0,
      partial: 0,
      missed: 0,
      pending: 0,
      rest: 0,
    };
    for (const d of this.plan()?.days ?? []) {
      counts[d.status] = (counts[d.status] ?? 0) + 1;
    }
    return counts;
  });

  formatGoal(day: PlanDayItem): string {
    const parts: string[] = [];
    if (day.goal_km !== null) {
      parts.push(`${day.goal_km.toFixed(1)} km`);
    }
    if (day.goal_duration_min !== null) {
      parts.push(`${day.goal_duration_min.toFixed(0)} min`);
    }
    return parts.length > 0 ? parts.join(' / ') : '-';
  }

  formatHrGoal(day: PlanDayItem): string {
    if (day.hr_goal_label) {
      return day.hr_goal_label;
    }
    if (day.hr_min !== null && day.hr_max !== null) {
      return `${day.hr_min}-${day.hr_max} bpm`;
    }
    return '-';
  }

  formatActual(day: PlanDayItem): string {
    const parts: string[] = [];
    if (day.actual_km !== null && day.actual_km > 0) {
      parts.push(`${day.actual_km.toFixed(1)} km`);
    }
    if (day.actual_duration_min !== null && day.actual_duration_min > 0) {
      parts.push(`${day.actual_duration_min.toFixed(0)} min`);
    }
    return parts.length > 0 ? parts.join(' / ') : '-';
  }

  formatActualHr(day: PlanDayItem): string {
    if (day.actual_avg_hr === null && day.actual_max_hr === null) {
      return '-';
    }
    return `${day.actual_avg_hr ?? '-'} / ${day.actual_max_hr ?? '-'} bpm`;
  }

  statusBadgeClass(status: PlanDayStatus): string {
    const base =
      'inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold';
    switch (status) {
      case 'done':
        return `${base} bg-teal-100 text-teal-900`;
      case 'partial':
        return `${base} bg-amber-100 text-amber-900`;
      case 'missed':
        return `${base} bg-red-100 text-red-900`;
      case 'pending':
        return `${base} bg-sky-100 text-sky-900`;
      case 'rest':
        return `${base} bg-slate-100 text-slate-700`;
    }
  }
}
