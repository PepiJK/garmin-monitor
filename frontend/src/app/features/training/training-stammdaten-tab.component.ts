import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { StammdatenItem } from '../../core/api/garmin-api.models';
import { StickyTableHeaderDirective } from '../../shared/directives/sticky-table-header.directive';

@Component({
  selector: 'app-training-stammdaten-tab',
  imports: [StickyTableHeaderDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-6">
      <!-- Stammdaten Header -->
      <section class="rounded-lg border border-slate-800 bg-slate-900/90 p-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex flex-wrap items-center gap-3">
              <h2 class="text-lg font-semibold text-slate-100" data-testid="stammdaten-title">
                Stammdaten &amp; Leistungsdiagnostik
              </h2>
              <span
                class="rounded border border-teal-500/30 bg-teal-500/15 px-2.5 py-0.5 font-mono text-xs font-medium text-teal-300"
              >
                Sportordination 10.08.2026
              </span>
            </div>
            <p class="mt-1 text-sm text-slate-400">
              Athleten-Profil, Laktat- &amp; Schwellendiagnostik, Garmin-Trainingszonen und Hardware
            </p>
          </div>

          <div
            class="rounded border border-slate-700 bg-slate-950/80 px-3 py-1.5 font-mono text-xs text-slate-400"
          >
            Read-only · Updates via CLI / AI (<code class="text-sky-300"
              >garmin_monitor stammdaten apply</code
            >)
          </div>
        </div>
      </section>

      @if (!items() || items().length === 0) {
        <section
          class="rounded-lg border border-slate-800 bg-slate-900/90 p-8 text-center"
          data-testid="no-stammdaten"
        >
          <h3 class="text-base font-semibold text-slate-100">Keine Stammdaten hinterlegt</h3>
          <p class="mt-1 text-sm text-slate-400">
            Importiere Stammdaten am Server via
            <code
              class="rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-mono text-xs text-sky-300"
            >
              python -m garmin_monitor plan apply data/plan.yaml
            </code>
          </p>
        </section>
      } @else {
        <section class="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/90">
          <div class="relative overflow-auto">
            <table class="w-full border-collapse text-left text-sm" data-testid="stammdaten-table">
              <thead appStickyHeader class="sticky top-0 z-20 bg-emerald-950">
                <tr
                  class="border-b border-slate-800 bg-emerald-950 text-xs font-semibold tracking-wide text-emerald-100 shadow-[inset_0_-1px_0_0_#1e293b]"
                >
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-4 py-3 shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Kategorie
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-4 py-3 shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Parameter
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-4 py-3 shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Wert
                  </th>
                  <th
                    class="sticky top-0 z-20 whitespace-nowrap bg-emerald-950 px-4 py-3 shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Einheit / Bereich
                  </th>
                  <th
                    class="sticky top-0 z-20 bg-emerald-950 px-4 py-3 shadow-[inset_0_-1px_0_0_#1e293b]"
                  >
                    Hinweis / Referenz (Sportordination 10.08.2026)
                  </th>
                </tr>
              </thead>
              <tbody class="relative z-0 divide-y divide-slate-800/80 text-xs">
                @for (row of items(); track row.category + '-' + row.parameter) {
                  <tr class="transition-colors hover:bg-slate-800/50" data-testid="stammdaten-row">
                    <td class="whitespace-nowrap px-4 py-3">
                      <span [class]="categoryBadgeClass(row.category)">
                        {{ row.category }}
                      </span>
                    </td>
                    <td class="whitespace-nowrap px-4 py-3 font-medium text-slate-100">
                      {{ row.parameter }}
                    </td>
                    <td
                      class="whitespace-nowrap px-4 py-3 font-mono font-semibold tabular-nums text-sky-300"
                    >
                      {{ row.value }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-3 font-mono tabular-nums text-slate-300">
                      {{ row.unit_or_range || '-' }}
                    </td>
                    <td class="px-4 py-3 text-slate-300">
                      {{ row.reference_note || '-' }}
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
export class TrainingStammdatenTabComponent {
  readonly items = input<StammdatenItem[]>([]);

  categoryBadgeClass(category: string): string {
    const base = 'inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium';
    if (category.includes('Athleten-Profil')) {
      return `${base} border-sky-500/30 bg-sky-500/15 text-sky-300`;
    }
    if (category.includes('Leistungsdiagnostik')) {
      return `${base} border-amber-500/30 bg-amber-500/15 text-amber-300`;
    }
    if (category.includes('Trainingszonen')) {
      return `${base} border-teal-500/30 bg-teal-500/15 text-teal-300`;
    }
    return `${base} border-slate-700 bg-slate-800 text-slate-300`;
  }
}
