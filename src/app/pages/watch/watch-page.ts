import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { InvidiousApi } from '../../api/invidious-api';
import { largestImage } from '../../api/private-urls';
import { Auth } from '../../core/auth';
import { rememberWatched } from '../../core/watched-titles';
import { Avatar } from '../../shared/avatar';
import { formatCount, joinNonEmpty, parseTimestamp } from '../../shared/format';
import { loadedValue } from '../../shared/loaded-value';
import { errorMessage } from '../../shared/pager';
import { RichText } from '../../shared/rich-text';
import { SubscribeButton } from '../../shared/subscribe-button';
import { VideoCard } from '../../shared/video-card';
import { Comments } from './comments';
import { Player } from './player';

@Component({
  selector: 'app-watch-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Player, Comments, VideoCard, Avatar, RichText, SubscribeButton],
  templateUrl: './watch-page.html',
  styleUrl: './watch-page.css',
})
export class WatchPage {
  /** Query parameters, named as on YouTube so its links work here. */
  readonly v = input('');
  readonly t = input<string>();
  readonly list = input<string>();

  private readonly api = inject(InvidiousApi);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly player = viewChild(Player);

  protected readonly video = rxResource({ params: () => this.v(), stream: ({ params }) => this.api.video(params) });
  protected readonly loadedVideo = computed(() => loadedValue(this.video));
  protected readonly playlist = rxResource({
    params: () => this.list(),
    stream: ({ params }) => (params ? this.api.playlist(params, 1) : of(undefined)),
  });
  protected readonly loadedPlaylist = computed(() => loadedValue(this.playlist));

  protected readonly startAt = computed(() => parseTimestamp(this.t()));
  protected readonly descriptionOpen = signal(false);
  /** Stays on screen during an automatic retry, so the page doesn't flicker back to the spinner. */
  protected readonly loadError = linkedSignal<string, string | null>({ source: this.v, computation: () => null });
  protected readonly retryingByItself = signal(false);

  protected readonly details = computed(() => {
    const video = this.loadedVideo();
    if (!video) {
      return '';
    }
    return joinNonEmpty([`${formatCount(video.viewCount)} views`, video.publishedText]);
  });
  protected readonly likes = computed(() => formatCount(this.loadedVideo()?.likeCount));
  protected readonly authorAvatar = computed(() => largestImage(this.loadedVideo()?.authorThumbnails));

  protected readonly playlistPosition = computed(() => {
    const videos = this.loadedPlaylist()?.videos ?? [];
    return videos.findIndex((video) => video.videoId === this.v());
  });
  protected readonly upNextInPlaylist = computed(() => {
    const videos = this.loadedPlaylist()?.videos ?? [];
    return videos.slice(this.playlistPosition() + 1, this.playlistPosition() + 6);
  });

  constructor() {
    const title = inject(Title);

    // A 5xx is usually Invidious or its companion (re)starting; it tends to pass by itself.
    effect((onCleanup) => {
      const error = this.video.error();
      if (this.video.hasValue()) {
        this.loadError.set(null);
      }
      if (!error) {
        return;
      }
      const cause = error.cause ?? error;
      this.loadError.set(errorMessage(cause));
      this.retryingByItself.set(isServerError(cause));
      if (isServerError(cause)) {
        const retry = setTimeout(() => this.video.reload(), serverErrorRetryMs);
        onCleanup(() => clearTimeout(retry));
      }
    });
    effect(() => {
      const video = this.loadedVideo();
      title.setTitle(video ? video.title : 'invi');
      this.descriptionOpen.set(false);
    });

    // Invidious answers 409 when the user turned watch history off; that is fine.
    effect(() => {
      const video = this.loadedVideo();
      if (video) {
        rememberWatched(video);
      }
      if (video && this.auth.signedIn()) {
        this.api.markWatched(video.videoId).subscribe({ error: () => undefined });
      }
    });
  }

  protected youtubeUrl(videoId: string, seconds: number): string {
    const time = Math.floor(seconds);
    return `https://www.youtube.com/watch?v=${videoId}${time > 0 ? `&t=${time}s` : ''}`;
  }

  /** The link opens YouTube where the video is now; this player pauses so the two don't overlap. */
  protected openOnYouTube(event: MouseEvent, videoId: string): void {
    const player = this.player();
    if (!player) {
      return;
    }
    (event.currentTarget as HTMLAnchorElement).href = this.youtubeUrl(videoId, player.currentTime());
    player.pause();
  }

  protected seek(seconds: number): void {
    this.player()?.seekTo(seconds);
  }

  protected playNext(): void {
    const next = this.upNextInPlaylist()[0];
    if (next) {
      this.router.navigate(['/watch'], { queryParams: { v: next.videoId, list: this.list() } });
    }
  }
}

const serverErrorRetryMs = 10_000;

function isServerError(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status >= 500;
}
