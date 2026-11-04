import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { map, tap } from 'rxjs';
import { InvidiousApi } from '../api/invidious-api';
import { Playlist, PlaylistVideo } from '../api/types';
import { ListStatus } from '../shared/list-status';
import { Pager } from '../shared/pager';
import { VideoCard } from '../shared/video-card';

@Component({
  selector: 'app-playlist-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, VideoCard, ListStatus],
  template: `
    @if (playlist(); as playlist) {
      <header>
        <h1>{{ playlist.title }}</h1>
        <p>
          @if (playlist.authorId) {
            <a [routerLink]="['/channel', playlist.authorId]">{{ playlist.author }}</a> ·
          }
          {{ playlist.videoCount }} videos
        </p>
        @if (pager().items()[0]; as first) {
          <a class="button primary" routerLink="/watch" [queryParams]="{ v: first.videoId, list: list() }">Play all</a>
        }
      </header>
    }
    <div class="videos">
      @for (video of pager().items(); track video.index) {
        <app-video-card [video]="video" layout="row" [playlistId]="list()" />
      }
    </div>
    <app-list-status [list]="pager()" [isEmpty]="!pager().items().length" emptyText="This playlist is empty." />
  `,
  styles: `
    header { margin-bottom: 1.25rem; }
    h1 { margin: 0; font-size: 1.25rem; }
    p { margin: .35rem 0 1rem; color: var(--text-muted); }
    .videos { display: flex; flex-direction: column; gap: .9rem; max-width: 50rem; }
  `,
})
export class PlaylistPage {
  readonly list = input('');

  private readonly api = inject(InvidiousApi);
  private readonly loadedPlaylist = signal<Playlist | null>(null);
  protected readonly playlist = computed(() => {
    const loaded = this.loadedPlaylist();
    return loaded?.playlistId === this.list() ? loaded : null;
  });

  protected readonly pager = computed(() => {
    const id = this.list();
    return new Pager<PlaylistVideo, number>(
      (page = 1) =>
        this.api.playlist(id, page).pipe(
          tap((playlist) => this.loadedPlaylist.set(playlist)),
          map((playlist) => ({ items: playlist.videos, next: playlist.videos.length ? page + 1 : undefined })),
        ),
      (video) => String(video.index),
    );
  });

  constructor() {
    const title = inject(Title);
    effect(() => title.setTitle(`${this.playlist()?.title ?? 'Playlist'} – invi`));
  }
}
