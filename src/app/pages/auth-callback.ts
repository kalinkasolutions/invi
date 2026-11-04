import { ChangeDetectionStrategy, Component, inject, OnInit, input } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../core/auth';

/** Where Invidious sends the user back to, with the new token in the query. */
@Component({
  selector: 'app-auth-callback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="spinner" role="status" aria-label="Signing in"></div>`,
})
export class AuthCallback implements OnInit {
  readonly token = input<string>();
  readonly username = input<string>();

  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const token = this.token();
    // Invidious encodes the username twice; the router undid only the outer layer.
    if (token) {
      this.auth.completeSignIn(token, decodeURIComponent(this.username() ?? ''));
    }
    this.router.navigateByUrl(token ? '/feed/subscriptions' : '/feed/library', { replaceUrl: true });
  }
}
