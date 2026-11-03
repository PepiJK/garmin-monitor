import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-health-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-7xl px-4 py-8">
      <h1 class="text-2xl font-semibold text-slate-900">Health</h1>
      <p class="mt-2 text-sm text-slate-600">
        Physiological recovery telemetry, HRV baseline monitoring, and health alerts.
      </p>
    </section>
  `,
})
export class HealthPageComponent {}
