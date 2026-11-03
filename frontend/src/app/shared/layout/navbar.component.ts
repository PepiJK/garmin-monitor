import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { GarminApiService } from '../../core/api/garmin-api.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="border-b border-slate-200 bg-white">
      <div
        class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6"
      >
        <div class="flex items-center gap-8">
          <a routerLink="/training" class="flex items-center gap-3 text-slate-900 no-underline">
            <span
              class="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 font-mono text-xs font-bold text-sky-400"
              aria-hidden="true"
            >
              F7S
            </span>
            <div>
              <span class="block text-base font-semibold tracking-tight text-slate-900">
                Garmin Monitor
              </span>
              <span class="block text-xs text-slate-500">Fenix 7S Telemetry &amp; Plan Engine</span>
            </div>
          </a>

          <nav class="flex items-center gap-1" aria-label="Primary navigation">
            <a
              routerLink="/training"
              routerLinkActive="bg-sky-50 text-sky-700 border-sky-600"
              class="rounded-md border-b-2 border-transparent px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
              data-testid="nav-training"
            >
              Training
            </a>
            <a
              routerLink="/health"
              routerLinkActive="bg-sky-50 text-sky-700 border-sky-600"
              class="rounded-md border-b-2 border-transparent px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
              data-testid="nav-health"
            >
              Health
            </a>
          </nav>
        </div>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2 text-xs text-slate-600" data-testid="sync-status">
            @switch (api.syncBadgeState()) {
              @case ('ok') {
                <span class="h-2 w-2 rounded-full bg-teal-600" aria-hidden="true"></span>
              }
              @case ('syncing') {
                <span
                  class="h-2 w-2 animate-pulse rounded-full bg-amber-500"
                  aria-hidden="true"
                ></span>
              }
              @case ('error') {
                <span class="h-2 w-2 rounded-full bg-red-600" aria-hidden="true"></span>
              }
              @default {
                <span class="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true"></span>
              }
            }
            <span class="font-mono tabular-nums">{{ lastSyncLabel() }}</span>
          </div>

          <button
            type="button"
            (click)="onSyncNow()"
            [disabled]="api.isSyncing()"
            data-testid="sync-now-btn"
            class="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            @if (api.isSyncing()) {
              <span>Syncing...</span>
            } @else {
              <span>Sync now</span>
            }
          </button>
        </div>
      </div>
    </header>
  `,
})
export class NavbarComponent implements OnInit {
  readonly api = inject(GarminApiService);

  readonly lastSyncLabel = computed(() => {
    const s = this.api.status();
    if (this.api.isSyncing() || s?.is_syncing) {
      return 'Sync in progress...';
    }
    if (!s || !s.last_sync_status) {
      return 'Last sync: never';
    }
    if (s.last_sync_status === 'error') {
      return 'Last sync: failed';
    }
    const ts = s.last_sync_finished_at ?? s.last_sync_started_at;
    if (!ts) {
      return 'Last sync: ok';
    }
    return `Last sync: ${ts.slice(0, 16).replace('T', ' ')} UTC`;
  });

  ngOnInit(): void {
    if (this.api.status() === null) {
      this.api.loadStatus();
    }
  }

  onSyncNow(): void {
    this.api.triggerSync();
  }
}
