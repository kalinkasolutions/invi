import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Auth } from '../core/auth';

@Component({
  selector: 'app-sign-in-prompt',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>{{ reason() }}</p>
    <a class="button primary" [href]="auth.signInUrl()">Sign in</a>
    <small>You sign in on your Invidious server and allow this app to use your account.</small>
  `,
  styles: `
    :host { display: flex; flex-direction: column; align-items: center; gap: 1rem;
            padding: 3rem 1rem; text-align: center; }
    p { margin: 0; font-size: 1.05rem; }
    small { color: var(--text-muted); max-width: 22rem; }
  `,
})
export class SignInPrompt {
  readonly reason = input('Sign in to see this.');
  protected readonly auth = inject(Auth);
}
