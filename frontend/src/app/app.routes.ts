import { Routes } from '@angular/router';
import { TrainingPageComponent } from './features/training/training-page.component';
import { HealthPageComponent } from './features/health/health-page.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'training',
  },
  {
    path: 'training',
    component: TrainingPageComponent,
    title: 'Training — Garmin Monitor',
  },
  {
    path: 'health',
    component: HealthPageComponent,
    title: 'Health — Garmin Monitor',
  },
  {
    path: '**',
    redirectTo: 'training',
  },
];
