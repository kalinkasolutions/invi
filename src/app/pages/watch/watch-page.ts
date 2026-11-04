import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, viewChild } from '@angular/core';
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
  protected readonly playlist = rxResource({
    params: () => this.list(),
    stream: ({ params }) => (params ? this.api.playlist(params, 1) : of(undefined)),
  });

  protected readonly startAt = computed(() => parseTimestamp(this.t()));
  protected readonly descriptionOpen = signal(false);
  protected readonly loadError = computed(() => {
    const error = this.video.error();
    return error ? errorMessage(error.cause ?? error) : null;
  });

  protected readonly details = computed(() => {
    const video = this.video.value();
    if (!video) {
      return '';
    }
    return joinNonEmpty([`${formatCount(video.viewCount)} views`, video.publishedText]);
  });
  protected readonly likes = computed(() => formatCount(this.video.value()?.likeCount));
  protected readonly authorAvatar = computed(() => largestImage(this.video.value()?.authorThumbnails));

  protected readonly playlistPosition = computed(() => {
    const videos = this.playlist.value()?.videos ?? [];
    return videos.findIndex((video) => video.videoId === this.v());
  });
  protected readonly upNextInPlaylist = computed(() => {
    const videos = this.playlist.value()?.videos ?? [];
    return videos.slice(this.playlistPosition() + 1, this.playlistPosition() + 6);
  });

  constructor() {
    const title = inject(Title);
    effect(() => {
      const video = this.video.value();
      title.setTitle(video ? video.title : 'invi');
      this.descriptionOpen.set(false);
    });

    // Invidious answers 409 when the user turned watch history off; that is fine.
    effect(() => {
      const video = this.video.value();
      if (video) {
        rememberWatched(video);
      }
      if (video && this.auth.signedIn()) {
        this.api.markWatched(video.videoId).subscribe({ error: () => undefined });
      }
    });
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
