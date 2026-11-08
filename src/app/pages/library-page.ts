import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize, of } from 'rxjs';
import { InvidiousApi } from '../api/invidious-api';
import { AppConfig } from '../core/app-config';
import { Auth } from '../core/auth';
import { Icon } from '../shared/icon';
import { PlaylistCard } from '../shared/item-list';
import { loadedValue } from '../shared/loaded-value';
import { SignInPrompt } from '../shared/sign-in-prompt';

@Component({
  selector: 'app-library-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, PlaylistCard, SignInPrompt],
  template: `
    @if (auth.signedIn()) {
      <section class="account">
        <span>Signed in as <strong>{{ auth.username() }}</strong></span>
        <button class="button" (click)="signOut()"><app-icon name="logout" /> Sign out</button>
      </section>

      <a class="row-link" routerLink="/feed/history"><app-icon name="history" /> History</a>

      <h2>Playlists</h2>
      @if (loadedPlaylists(); as playlists) {
        <div class="playlists">
          @for (playlist of playlists; track playlist.playlistId) {
            <app-playlist-card [playlist]="playlist" />
          } @empty {
            <p class="empty">No playlists. You can make them on <a [href]="config.invidiousUrl">Invidious</a>.</p>
          }
        </div>
      } @else if (playlists.isLoading()) {
        <div class="spinner" role="status" aria-label="Loading"></div>
      }

      <p class="hint">Preferences, imports and playlists are managed on
        <a [href]="config.invidiousUrl + '/preferences'">your Invidious server</a>.</p>
    } @else {
      <app-sign-in-prompt reason="Sign in to see your history and playlists." />
    }

    <a class="row-link about" routerLink="/about"><app-icon name="info" /> About invi</a>
  `,
  styles: `
    .account { display: flex; align-items: center; justify-content: space-between; gap: 1rem;
               flex-wrap: wrap; margin-bottom: 1rem; }
    .row-link { display: flex; align-items: center; gap: .75rem; padding: .9rem 0;
                border-block: 1px solid var(--border); font-weight: 600; }
    .about { margin-top: 2rem; }
    h2 { font-size: 1rem; margin: 1.5rem 0 .75rem; }
    .playlists { display: flex; flex-direction: column; gap: .9rem; }
    .hint { margin-top: 2rem; color: var(--text-muted); font-size: .85rem; }
    .hint a, .empty a { color: var(--link); }
  `,
})
export class LibraryPage {
  protected readonly auth = inject(Auth);
  protected readonly config = inject(AppConfig);
  private readonly api = inject(InvidiousApi);

  protected readonly playlists = rxResource({
    params: () => this.auth.signedIn(),
    stream: ({ params: signedIn }) => (signedIn ? this.api.myPlaylists() : of([])),
  });
  protected readonly loadedPlaylists = computed(() => loadedValue(this.playlists));

  protected signOut(): void {
    this.api
      .revokeToken()
      .pipe(finalize(() => this.auth.forget()))
      .subscribe({ error: () => undefined });
  }
}
