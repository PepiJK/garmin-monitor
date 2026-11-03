import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { HealthDayWindow } from '../../core/api/garmin-api.models';
import { GarminApiService } from '../../core/api/garmin-api.service';
import { HealthChartsComponent } from './health-charts.component';
import { HealthKpisComponent } from './health-kpis.component';
import { HealthWarningsBannerComponent } from './health-warnings-banner.component';

@Component({
  selector: 'app-health-page',
  imports: [HealthWarningsBannerComponent, HealthKpisComponent, HealthChartsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <div class="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900">Health &amp; Recovery</h1>
          <p class="mt-1 text-sm text-slate-600">
            Autonomic HRV baseline monitoring, sleep architecture, and multi-signal recovery
            diagnostics
          </p>
        </div>

        <div
          class="inline-flex rounded-md border border-slate-200 bg-white p-0.5"
          role="group"
          aria-label="Health history window"
        >
          @for (d of dayOptions; track d) {
            <button
              type="button"
              (click)="onDaysChange(d)"
              [attr.data-testid]="'days-btn-' + d"
              [class]="
                api.selectedHealthDays() === d
                  ? 'cursor-pointer rounded bg-sky-600 px-3 py-1 font-mono text-xs font-semibold text-white'
                  : 'cursor-pointer rounded px-3 py-1 font-mono text-xs font-medium text-slate-600 hover:text-slate-900'
              "
            >
              {{ d }}d
            </button>
          }
        </div>
      </div>

      <app-health-warnings-banner [warnings]="api.healthDashboard()?.warnings ?? []" />

      <app-health-kpis [kpis]="api.healthDashboard()?.kpis ?? null" />

      <app-health-charts [series]="api.healthDashboard()?.series ?? []" />
    </div>
  `,
})
export class HealthPageComponent implements OnInit {
  readonly api = inject(GarminApiService);
  readonly dayOptions: readonly HealthDayWindow[] = [7, 30, 90];

  ngOnInit(): void {
    this.api.loadHealthDashboard(this.api.selectedHealthDays());
  }

  onDaysChange(days: HealthDayWindow): void {
    this.api.loadHealthDashboard(days);
  }
}
