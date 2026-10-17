import { APP_BASE_HREF } from '@angular/common';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode, provideZoneChangeDetection } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideSpartanHlm } from '@spartan-ng/helm/utils';
import { appBasePath } from './base-path';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideServiceWorker('custom-service-worker.js', {
            enabled: !isDevMode(),
            // Register the ServiceWorker as soon as the application is stable
            // or after 30 seconds (whichever comes first).
            registrationStrategy: 'registerWhenStable:30000'
          }),
    provideHttpClient(withXhr(), withInterceptorsFromDi()),
    provideSpartanHlm(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    { provide: APP_BASE_HREF, useFactory: () => appBasePath() },
  ]
};
