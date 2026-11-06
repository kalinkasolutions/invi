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
  const toPositionServer = request.url.startsWith('/invi-api/');
  if (!token || !(request.url.startsWith('/api/v1/auth/') || toPositionServer)) {
    return next(request);
  }
  // Invidious hands the token over still form-encoded and decodes the header itself.
  // The position server checks the token with Invidious, which can't tell it whose it is.
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (toPositionServer) {
    headers['X-Invi-User'] = auth.username() ?? '';
  }
  const authorized = request.clone({ setHeaders: headers });
  return next(authorized).pipe(
    catchError((error) => {
      if (isTokenRejection(error.status, error.error?.error)) {
        auth.forget();
      }
      return throwError(() => error);
    }),
  );
};

// Invidious' messages for a token it won't take. Its token check wraps the whole request, so any
// other failure (a channel YouTube won't describe, say) also comes back as 403 and must not sign out.
const tokenRejections = [
  'Erroneous token',
  'Invalid signature',
  'Request must be authenticated',
  'Token is expired, please try again',
  'Cannot use token as SID',
];

export function isTokenRejection(status: number, message: unknown): boolean {
  return status === 403 && typeof message === 'string' && tokenRejections.includes(message);
}
