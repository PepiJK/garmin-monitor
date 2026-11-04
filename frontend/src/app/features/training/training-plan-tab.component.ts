import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import {
  HealthDayWindow,
  PlanDayItem,
  PlanDayStatus,
  TrainingPlanResponse,
} from '../../core/api/garmin-api.models';
import {
  formatGermanDate,
  formatGermanDateWithWeekday,
  formatGermanNumber,
  formatGermanWeekdayFull,
} from '../../core/format/german-format';
import { StickyTableHeaderDirective } from '../../shared/directives/sticky-table-header.directive';

@Component({
  selector: 'app-training-plan-tab',
  imports: [StickyTableHeaderDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-6">
      <!-- Plan Header & Summary -->
      <section class="rounded-lg border border-slate-800 bg-slate-900/90 p-5">
        @if (!plan()?.has_active_plan) {
          <div class="py-6 text-center" data-testid="no-active-plan">
            <h2 class="text-base font-semibold text-slate-100">No active training plan</h2>
            <p class="mt-1 text-sm text-slate-400">
              Apply a training plan on the server using
              <code
                class="rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-mono text-xs text-sky-300"
              >
                python -m garmin_monitor plan apply data/plan.yaml
              </code>
              to schedule Fenix 7S workouts and track daily goals.
            </p>
          </div>
        } @else {
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div class="flex flex-wrap items-center gap-3">
                <h2 class="text-lg font-semibold text-slate-100" data-testid="plan-title">
                  {{ plan()?.name }}
                </h2>
                <span
                  class="rounded border border-slate-700 bg-slate-950 px-2.5 py-0.5 font-mono text-xs text-slate-300"
                >
                  {{ formatDate(plan()?.start_date) }} – {{ formatDate(plan()?.end_date) }}
                </span>
                <span
                  class="rounded border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 font-mono text-xs font-semibold text-sky-300"
                >
                  {{ displayedDays().length }} Tage
                </span>
              </div>
              @if (plan()?.notes) {
                <p class="mt-1 text-sm text-slate-400">{{ plan()?.notes }}</p>
              }
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <div class="flex flex-wrap items-center gap-2 text-xs font-medium">
                <span
                  class="rounded border border-teal-500/30 bg-teal-500/15 px-2.5 py-1 text-teal-300"
                >
                  Erledigt: {{ statusCounts().done }}
                </span>
                @if (statusCounts().partial > 0) {
                  <span
                    class="rounded border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-amber-300"
                  >
                    Teilweise: {{ statusCounts().partial }}
                  </span>
                }
                <span
                  class="rounded border border-red-500/30 bg-red-500/15 px-2.5 py-1 text-red-300"
                >
                  Ausgefallen: {{ statusCounts().missed }}
                </span>
                <span
                  class="rounded border border-sky-500/30 bg-sky-500/15 px-2.5 py-1 text-sky-300"
                >
                  Offen: {{ statusCounts().pending }}
                </span>
              </div>

              <button
                type="button"
                (click)="syncPlan.emit()"
                data-testid="sync-plan-watch-btn"
                class="cursor-pointer rounded-md border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500 hover:text-slate-950"
              >
                Sync plan to watch
              </button>
            </div>
          </div>
        }
      </section>

      <!-- Structured Daily Plan Table (Sheet Layout) -->
      @if (plan()?.has_active_plan) {
        <section class="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/90">
          <div class="relative overflow-auto">
            <table
              class="w-full border-collapse text-left text-sm"
              data-testid="training-plan-table"
            >
              <thead appStickyHeader class="sticky top-0 z-20 bg-emerald-950">
                <tr
                  class="border-b border-slate-800 bg-emerald-950 text-xs font-semibold tracking-wide text-emerald-100 shadow-[inset_0_-1px_0_0_#1e293b]"
                >
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-3 py-3 shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    DATUM
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-3 py-3 shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    TAG
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-3 py-3 shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    KATEGORIE
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-3 py-3 shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    EINHEIT / FOKUS
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-3 py-3 shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Zone
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-3 py-3 shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    BPM
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-3 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    MIN
                  </th>
                  <th
                    class="sticky top-0 z-20 min-w-[260px] bg-emerald-950 px-3 py-3 shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    TRAININGSDETAILS &amp; VORGABEN
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-3 py-3 text-left shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    STATUS
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-3 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    IST MN
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-3 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    IST KM
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-3 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    AVG / MAX BPM
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-3 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    AVG PACE (MIN/KM)
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-3 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    SPM
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-3 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    LOAD
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-3 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    TE (AER/ANA)
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-3 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    WATT
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-3 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    KCAL
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-3 py-3 text-right shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    RPE
                  </th>
                  <th
                    class="sticky top-0 z-20 min-w-[260px] bg-emerald-950 px-3 py-3 shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    NOTIZEN / GEFÜHL
                  </th>
                </tr>
              </thead>
              <tbody class="relative z-0 divide-y divide-slate-800/80 text-xs">
                @for (day of displayedDays(); track day.date) {
                  <tr [class]="rowClass(day)" [attr.data-testid]="'plan-row-' + day.date">
                    <!-- DATUM -->
                    <td
                      class="relative whitespace-nowrap px-3 py-2.5 font-mono tabular-nums text-slate-200"
                    >
                      <span>{{ day.date }}</span>
                      <span class="sr-only"> {{ formatDateWithWeekday(day.date) }}</span>
                    </td>

                    <!-- TAG -->
                    <td class="whitespace-nowrap px-3 py-2.5">
                      <span [class]="weekdayBadgeClass(day.date)">
                        {{ formatWeekdayFull(day.date) }}
                      </span>
                    </td>

                    <!-- KATEGORIE -->
                    <td class="whitespace-nowrap px-3 py-2.5">
                      @switch (day.sport_type) {
                        @case ('running') {
                          <span
                            class="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 font-medium text-amber-200"
                          >
                            Laufen
                          </span>
                        }
                        @case ('strength_training') {
                          <span
                            class="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/15 px-2.5 py-0.5 font-medium text-sky-200"
                          >
                            Kraft
                          </span>
                        }
                        @default {
                          <span
                            class="inline-flex items-center rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 font-medium text-slate-300"
                          >
                            Regeneration
                          </span>
                        }
                      }
                    </td>

                    <!-- EINHEIT / FOKUS -->
                    <td class="whitespace-nowrap px-3 py-2.5 font-medium text-slate-100">
                      {{ day.workout_title }}
                    </td>

                    <!-- Zone -->
                    <td class="whitespace-nowrap px-3 py-2.5 text-slate-300">
                      {{ formatZoneLabel(day) }}
                    </td>

                    <!-- BPM -->
                    <td class="whitespace-nowrap px-3 py-2.5 font-mono tabular-nums text-slate-300">
                      {{ formatBpmRange(day) }}
                    </td>

                    <!-- MIN -->
                    <td
                      class="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-slate-200"
                    >
                      {{ formatGoalMin(day) }}
                    </td>

                    <!-- TRAININGSDETAILS & VORGABEN -->
                    <td class="px-3 py-2.5 text-slate-300">
                      {{ day.focus || '' }}
                    </td>

                    <!-- STATUS -->
                    <td class="relative whitespace-nowrap px-3 py-2.5 text-left">
                      <div class="inline-flex items-center gap-1.5">
                        <span
                          [class]="statusBadgeClass(day)"
                          [attr.data-testid]="'status-badge-' + day.status"
                        >
                          {{ formatStatusLabel(day) }}
                          <span class="sr-only"> {{ day.status }}</span>
                        </span>
                        @if (day.garmin_workout_id) {
                          <span
                            class="rounded border border-sky-500/30 bg-slate-950 px-1 py-0.5 font-mono text-[10px] text-sky-400"
                            title="Scheduled on Fenix 7S watch calendar"
                          >
                            F7S
                          </span>
                        }
                      </div>
                    </td>

                    <!-- IST MN -->
                    <td
                      class="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-slate-100"
                    >
                      {{ formatActualMin(day) }}
                    </td>

                    <!-- IST KM -->
                    <td
                      class="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-slate-100"
                    >
                      {{ formatActualKm(day) }}
                    </td>

                    <!-- AVG / MAX BPM -->
                    <td
                      class="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-slate-200"
                    >
                      @if (day.actual_avg_hr !== null) {
                        <span>{{ day.actual_avg_hr }}</span>
                        @if (day.actual_max_hr !== null) {
                          <span class="text-slate-500"> / {{ day.actual_max_hr }}</span>
                        }
                      }
                    </td>

                    <!-- AVG PACE (MIN/KM) -->
                    <td
                      class="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-slate-200"
                    >
                      {{ formatActualPace(day) }}
                    </td>

                    <!-- SPM -->
                    <td
                      class="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-slate-200"
                    >
                      {{ formatCadence(day) }}
                    </td>

                    <!-- LOAD -->
                    <td
                      class="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-slate-200"
                    >
                      {{ formatLoad(day) }}
                    </td>

                    <!-- TE (AER/ANA) -->
                    <td
                      class="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-slate-300"
                    >
                      {{ formatTrainingEffect(day) }}
                    </td>

                    <!-- WATT -->
                    <td
                      class="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-slate-200"
                    >
                      {{
                        day.actual_power_w !== null && day.actual_power_w !== undefined
                          ? day.actual_power_w
                          : ''
                      }}
                    </td>

                    <!-- KCAL -->
                    <td
                      class="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-slate-300"
                    >
                      {{
                        day.actual_calories !== null && day.actual_calories !== undefined
                          ? day.actual_calories
                          : ''
                      }}
                    </td>

                    <!-- RPE -->
                    <td
                      class="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-slate-200"
                    >
                      {{ day.rpe !== null && day.rpe !== undefined ? day.rpe : '' }}
                    </td>

                    <!-- NOTIZEN / GEFÜHL (Editable, saves on blur) -->
                    <td class="min-w-[260px] px-2 py-1.5">
                      <div class="grid">
                        <div
                          aria-hidden="true"
                          class="pointer-events-none invisible col-start-1 row-start-1 w-full min-w-[240px] whitespace-pre-wrap break-words rounded border border-transparent px-2 py-1 font-sans text-xs leading-relaxed"
                        >
                          {{ ((draftNotes()[day.date] ?? day.notes) || ' ') + ' ' }}
                        </div>
                        <textarea
                          rows="1"
                          [value]="day.notes ?? ''"
                          (input)="onNotesInput(day.date, $event)"
                          (blur)="onNotesBlur(day, $event)"
                          [attr.aria-label]="'Notizen für ' + day.date"
                          [attr.data-testid]="'notes-input-' + day.date"
                          placeholder="Notiz eingeben..."
                          class="col-start-1 row-start-1 h-full w-full min-w-[240px] resize-none overflow-hidden rounded border border-transparent bg-transparent px-2 py-1 font-sans text-xs leading-relaxed text-slate-200 placeholder-slate-600 transition-colors [field-sizing:content] hover:border-slate-700/80 hover:bg-slate-950/60 focus:border-sky-500/60 focus:bg-slate-950 focus:outline-none"
                        ></textarea>
                      </div>
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
  readonly selectedDays = input<HealthDayWindow>(30);
  readonly syncPlan = output<void>();
  readonly updateNotes = output<{ date: string; notes: string }>();
  readonly draftNotes = signal<Record<string, string>>({});

  readonly displayedDays = computed<PlanDayItem[]>(() => {
    return this.plan()?.days ?? [];
  });

  onNotesInput(date: string, event: Event): void {
    const target = event.target as HTMLTextAreaElement | null;
    if (!target) {
      return;
    }
    this.draftNotes.update((prev) => ({ ...prev, [date]: target.value }));
  }

  onNotesBlur(day: PlanDayItem, event: Event): void {
    const target = event.target as HTMLTextAreaElement | null;
    if (!target) {
      return;
    }
    const nextNotes = target.value.trim();
    const prevNotes = (day.notes ?? '').trim();
    this.draftNotes.update((prev) => ({ ...prev, [day.date]: nextNotes }));
    if (nextNotes !== prevNotes) {
      this.updateNotes.emit({ date: day.date, notes: nextNotes });
    }
  }

  readonly statusCounts = computed(() => {
    const counts: Record<PlanDayStatus, number> = {
      done: 0,
      partial: 0,
      missed: 0,
      pending: 0,
      rest: 0,
    };
    for (const d of this.displayedDays()) {
      counts[d.status] = (counts[d.status] ?? 0) + 1;
    }
    return counts;
  });

  formatDate(isoDate: string | null | undefined): string {
    return formatGermanDate(isoDate);
  }

  formatDateWithWeekday(isoDate: string | null | undefined): string {
    return formatGermanDateWithWeekday(isoDate);
  }

  formatWeekdayFull(isoDate: string | null | undefined): string {
    return formatGermanWeekdayFull(isoDate);
  }

  formatZoneLabel(day: PlanDayItem): string {
    if (!day.hr_goal_label) {
      return '';
    }
    if (/^\d+\s*-\s*\d+\s*bpm$/i.test(day.hr_goal_label.trim())) {
      return '';
    }
    return day.hr_goal_label;
  }

  formatBpmRange(day: PlanDayItem): string {
    if (day.hr_min !== null && day.hr_max !== null) {
      return `${day.hr_min} - ${day.hr_max}`;
    }
    return '';
  }

  formatGoalMin(day: PlanDayItem): string {
    if (day.goal_duration_min !== null && day.goal_duration_min !== undefined) {
      return formatGermanNumber(day.goal_duration_min, 0);
    }
    if (day.goal_km !== null && day.goal_km !== undefined) {
      return `${formatGermanNumber(day.goal_km, 1)} km`;
    }
    return '';
  }

  formatActualMin(day: PlanDayItem): string {
    if (day.actual_duration_min !== null && day.actual_duration_min > 0) {
      return formatGermanNumber(day.actual_duration_min, 0);
    }
    return '';
  }

  formatActualKm(day: PlanDayItem): string {
    if (day.actual_km !== null && day.actual_km > 0) {
      return formatGermanNumber(day.actual_km, 2);
    }
    return '';
  }

  formatActualPace(day: PlanDayItem): string {
    if (day.actual_pace_min_per_km) {
      return day.actual_pace_min_per_km;
    }
    if (
      day.sport_type === 'running' &&
      day.actual_km &&
      day.actual_km > 0 &&
      day.actual_duration_min &&
      day.actual_duration_min > 0
    ) {
      const sec = Math.round((day.actual_duration_min * 60) / day.actual_km);
      if (sec >= 60 && sec <= 3600) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      }
    }
    return '';
  }

  formatCadence(day: PlanDayItem): string {
    if (
      day.actual_cadence_spm !== null &&
      day.actual_cadence_spm !== undefined &&
      day.actual_cadence_spm > 0
    ) {
      return `${day.actual_cadence_spm}`;
    }
    return '';
  }

  formatLoad(day: PlanDayItem): string {
    if (day.actual_training_load !== null && day.actual_training_load !== undefined) {
      return formatGermanNumber(day.actual_training_load, 0);
    }
    return '';
  }

  formatTrainingEffect(day: PlanDayItem): string {
    if (day.actual_aerobic_te === null || day.actual_aerobic_te === undefined) {
      return '';
    }
    const aer = formatGermanNumber(day.actual_aerobic_te, 1);
    if (day.actual_anaerobic_te !== null && day.actual_anaerobic_te !== undefined) {
      const ana = formatGermanNumber(day.actual_anaerobic_te, 1);
      return `${aer} / ${ana}`;
    }
    return aer;
  }

  formatStatusLabel(day: PlanDayItem): string {
    switch (day.status) {
      case 'done':
        return 'Erledigt';
      case 'partial':
        return 'Teilweise';
      case 'missed':
        return 'Ausgefallen';
      case 'pending':
        return 'Offen';
      case 'rest': {
        const todayIso = new Date().toISOString().slice(0, 10);
        return day.date < todayIso ? 'Erledigt' : 'Offen';
      }
    }
  }

  rowClass(day: PlanDayItem): string {
    const todayIso = new Date().toISOString().slice(0, 10);
    if (day.date === todayIso) {
      return 'bg-sky-950/35 transition-colors hover:bg-sky-950/50';
    }
    return 'transition-colors hover:bg-slate-800/50';
  }

  weekdayBadgeClass(isoDate: string): string {
    const name = formatGermanWeekdayFull(isoDate);
    const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium';
    switch (name) {
      case 'Montag':
      case 'Freitag':
      case 'Sonntag':
        return `${base} bg-emerald-500/15 text-emerald-300`;
      default:
        return `${base} bg-sky-500/15 text-sky-300`;
    }
  }

  statusBadgeClass(day: PlanDayItem): string {
    const base =
      'inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold';
    const label = this.formatStatusLabel(day);
    if (label === 'Erledigt') {
      return `${base} border-teal-500/40 bg-teal-500/15 text-teal-300`;
    }
    if (label === 'Teilweise') {
      return `${base} border-amber-500/40 bg-amber-500/15 text-amber-300`;
    }
    if (label === 'Ausgefallen') {
      return `${base} border-red-500/40 bg-red-500/15 text-red-300`;
    }
    return `${base} border-slate-700 bg-slate-800 text-slate-300`;
  }
}
