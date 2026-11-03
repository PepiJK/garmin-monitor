import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[#f6f8fa] text-slate-900">
      <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div class="flex items-center gap-6">
            <span class="text-base font-semibold tracking-tight text-slate-900">{{ title() }}</span>
            <nav class="flex items-center gap-4 text-sm font-medium" aria-label="Main navigation">
              <a
                routerLink="/training"
                routerLinkActive="text-sky-600 font-semibold"
                class="text-slate-600 hover:text-slate-900"
              >
                Training
              </a>
              <a
                routerLink="/health"
                routerLinkActive="text-sky-600 font-semibold"
                class="text-slate-600 hover:text-slate-900"
              >
                Health
              </a>
            </nav>
          </div>
        </div>
      </header>
      <main>
        <router-outlet />
      </main>
    </div>
  `,
})
export class AppComponent {
  readonly title = signal('Garmin Monitor');
}
