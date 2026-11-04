import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HealthWarning } from '../../core/api/garmin-api.models';
import { formatGermanDate } from '../../core/format/german-format';

@Component({
  selector: 'app-health-warnings-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (warnings().length === 0) {
      <section
        aria-label="Physiological status"
        data-testid="healthy-baseline-banner"
        class="flex items-center justify-between rounded-lg border border-teal-500/30 bg-teal-950/40 px-5 py-4"
      >
        <div class="flex items-center gap-3">
          <span
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500 font-mono text-xs font-bold text-slate-950"
            aria-hidden="true"
          >
            OK
          </span>
          <div>
            <h2 class="text-sm font-semibold text-teal-200">
              All health indicators within baseline
            </h2>
            <p class="text-xs text-teal-300/80">
              Nightly HRV, sleep restorative quality, resting heart rate, and Body Battery are
              operating within your personal corridor.
            </p>
          </div>
        </div>
      </section>
    } @else {
      <section
        aria-label="Active physiological and sync warnings"
        data-testid="active-warnings-banner"
        class="flex flex-col gap-4"
      >
        @for (w of warnings(); track w.code + '-' + (w.date ?? '')) {
          <article
            [attr.data-testid]="'warning-card-' + w.code"
            [class]="
              w.severity === 'critical'
                ? 'rounded-lg border border-red-500/40 border-l-4 border-l-red-500 bg-red-950/40 p-4'
                : 'rounded-lg border border-amber-500/40 border-l-4 border-l-amber-500 bg-amber-950/40 p-4'
            "
          >
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="flex items-center gap-2.5">
                <span
                  [class]="
                    w.severity === 'critical'
                      ? 'rounded bg-red-500 px-2 py-0.5 font-mono text-xs font-bold text-slate-950'
                      : 'rounded bg-amber-400 px-2 py-0.5 font-mono text-xs font-bold text-slate-950'
                  "
                >
                  {{ w.severity === 'critical' ? 'Critical' : 'Warning' }}
                </span>
                <h3 class="text-sm font-semibold text-slate-100">{{ w.title }}</h3>
                @if (w.date) {
                  <span class="font-mono text-xs text-slate-400">{{ formatDate(w.date) }}</span>
                }
              </div>

              <div class="flex flex-wrap items-center gap-3 font-mono text-xs tabular-nums">
                <span
                  class="rounded border border-slate-700 bg-slate-900/90 px-2 py-0.5 text-slate-200"
                >
                  Observed: <strong>{{ w.observed_value }}</strong>
                </span>
                <span
                  class="rounded border border-slate-700 bg-slate-900/90 px-2 py-0.5 text-slate-400"
                >
                  Target: {{ w.baseline_or_threshold }}
                </span>
              </div>
            </div>
            <p class="mt-2 text-xs text-slate-300">{{ w.description }}</p>
          </article>
        }
      </section>
    }
  `,
})
export class HealthWarningsBannerComponent {
  readonly warnings = input<HealthWarning[]>([]);

  formatDate(isoDate: string | null | undefined): string {
    return formatGermanDate(isoDate);
  }
}
