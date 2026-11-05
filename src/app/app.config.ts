import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, RouteReuseStrategy, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { AppConfig } from './core/app-config';
import { authInterceptor } from './core/auth';
import { KeepListPages } from './core/keep-list-pages';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppInitializer(() => inject(AppConfig).load()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    { provide: RouteReuseStrategy, useExisting: KeepListPages },
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
  ],
};
