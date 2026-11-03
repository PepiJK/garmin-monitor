import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-training-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-7xl px-4 py-8">
      <h1 class="text-2xl font-semibold text-slate-900">Training</h1>
      <p class="mt-2 text-sm text-slate-600">
        Weekly training load, completed sessions, and Fenix 7S training plan.
      </p>
    </section>
  `,
})
export class TrainingPageComponent {}
