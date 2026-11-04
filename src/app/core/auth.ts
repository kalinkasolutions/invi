import { HttpInterceptorFn } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AppConfig } from './app-config';
import { readStored, writeStored } from './storage';

const tokenKey = 'invi.token';
const usernameKey = 'invi.username';

// Only what the app uses, so the token can't change preferences or import data.
const scopes = [
  'GET:feed',
  'GET;POST;DELETE:subscriptions*',
  'GET;POST:history*',
  'GET:playlists*',
  'POST:tokens/unregister',
];

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly config = inject(AppConfig);

  readonly token = signal(readStored(tokenKey));
  readonly username = signal(readStored(usernameKey));
  readonly signedIn = computed(() => this.token() !== null);

  /** Invidious' own page, where the user signs in and approves a token for this app. */
  signInUrl(): string {
    const callbackUrl = `${location.origin}/auth/callback`;
    const query = new URLSearchParams({ scopes: scopes.join(','), callback_url: callbackUrl });
    return `${this.config.invidiousUrl}/authorize_token?${query}`;
  }

  completeSignIn(token: string, username: string): void {
    this.store(token, username);
  }

  forget(): void {
    this.store(null, null);
  }

  private store(token: string | null, username: string | null): void {
    writeStored(tokenKey, token);
    writeStored(usernameKey, username);
    this.token.set(token);
    this.username.set(username);
  }
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(Auth);
  const token = auth.token();
  if (!token || !request.url.startsWith('/api/v1/auth/')) {
    return next(request);
  }
  // Invidious hands the token over still form-encoded and decodes the header itself.
  const authorized = request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  return next(authorized).pipe(
    catchError((error) => {
      if (error.status === 403 && error.error?.error !== 'Invalid scope') {
        auth.forget();
      }
      return throwError(() => error);
    }),
  );
};
