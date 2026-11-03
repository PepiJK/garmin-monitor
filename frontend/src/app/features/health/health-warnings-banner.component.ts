import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HealthWarning } from '../../core/api/garmin-api.models';

@Component({
  selector: 'app-health-warnings-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (warnings().length === 0) {
      <section
        aria-label="Physiological status"
        data-testid="healthy-baseline-banner"
        class="flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50/70 px-5 py-4"
      >
        <div class="flex items-center gap-3">
          <span
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 font-mono text-xs font-bold text-white"
            aria-hidden="true"
          >
            OK
          </span>
          <div>
            <h2 class="text-sm font-semibold text-teal-950">
              All health indicators within baseline
            </h2>
            <p class="text-xs text-teal-800">
              Nightly HRV, sleep restorative quality, resting heart rate, and Body Battery are
              operating within your 30-day personal corridor.
            </p>
          </div>
        </div>
      </section>
    } @else {
      <section
        aria-label="Active physiological and sync warnings"
        data-testid="active-warnings-banner"
        class="space-y-3"
      >
        @for (w of warnings(); track w.code + '-' + (w.date ?? '')) {
          <article
            [attr.data-testid]="'warning-card-' + w.code"
            [class]="
              w.severity === 'critical'
                ? 'rounded-lg border border-red-200 border-l-4 border-l-red-600 bg-red-50/75 p-4'
                : 'rounded-lg border border-amber-200 border-l-4 border-l-amber-500 bg-amber-50/75 p-4'
            "
          >
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="flex items-center gap-2.5">
                <span
                  [class]="
                    w.severity === 'critical'
                      ? 'rounded bg-red-600 px-2 py-0.5 font-mono text-xs font-bold text-white'
                      : 'rounded bg-amber-500 px-2 py-0.5 font-mono text-xs font-bold text-white'
                  "
                >
                  {{ w.severity === 'critical' ? 'Critical' : 'Warning' }}
                </span>
                <h3 class="text-sm font-semibold text-slate-900">{{ w.title }}</h3>
              </div>

              <div class="flex flex-wrap items-center gap-3 font-mono text-xs tabular-nums">
                <span class="rounded bg-white/80 px-2 py-0.5 text-slate-800">
                  Observed: <strong>{{ w.observed_value }}</strong>
                </span>
                <span class="rounded bg-white/80 px-2 py-0.5 text-slate-600">
                  Target: {{ w.baseline_or_threshold }}
                </span>
              </div>
            </div>
            <p class="mt-2 text-xs text-slate-700">{{ w.description }}</p>
          </article>
        }
      </section>
    }
  `,
})
export class HealthWarningsBannerComponent {
  readonly warnings = input<HealthWarning[]>([]);
}
