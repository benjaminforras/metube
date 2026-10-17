import { Routes } from '@angular/router';
import { SettingsPageComponent } from './components/settings-page.component';

// The downloads page is App's own template, shown whenever the Settings route
// is not active; anything else (the root, the PWA share-target path) lands on
// it without a component of its own.
export const routes: Routes = [
  {
    path: 'settings',
    component: SettingsPageComponent,
    title: 'Settings · MeTube',
    canDeactivate: [(page: SettingsPageComponent) => page.confirmLeave()],
  },
  { path: '**', children: [], title: 'MeTube' },
];
