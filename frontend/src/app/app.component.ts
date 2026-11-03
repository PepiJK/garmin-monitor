import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/layout/navbar.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-[#f6f8fa] text-slate-900">
      <app-navbar />
      <main>
        <router-outlet />
      </main>
    </div>
  `,
})
export class AppComponent {
  readonly title = signal('Garmin Monitor');
}
