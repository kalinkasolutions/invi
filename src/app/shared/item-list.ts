import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { largestImage, videoThumbnail } from '../api/private-urls';
import { ChannelItem, ListItem, PlaylistItem } from '../api/types';
import { Avatar } from './avatar';
import { formatCount } from './format';
import { VideoCard } from './video-card';

@Component({
  selector: 'app-channel-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Avatar],
  template: `
    <a class="channel" [routerLink]="['/channel', channel().authorId]">
      <app-avatar [src]="avatar()" [name]="channel().author" />
      <span>
        <strong>{{ channel().author }}</strong>
        <small>{{ subscribers() }}</small>
      </span>
    </a>
  `,
  styles: `
    .channel { display: flex; align-items: center; gap: .9rem; padding: .25rem 0; --size: 3.5rem; }
    strong, small { display: block; }
    small { color: var(--text-muted); font-size: .8rem; margin-top: .15rem; }
  `,
})
export class ChannelCard {
  readonly channel = input.required<ChannelItem>();
  protected readonly avatar = computed(() => largestImage(this.channel().authorThumbnails));
  protected readonly subscribers = computed(() => `${formatCount(this.channel().subCount)} subscribers`);
}

@Component({
  selector: 'app-playlist-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <a class="playlist" routerLink="/playlist" [queryParams]="{ list: playlist().playlistId }">
      <span class="thumbnail">
        @if (thumbnail()) {
          <img [src]="thumbnail()" alt="" loading="lazy" />
        }
        <span class="count">{{ playlist().videoCount }} videos</span>
      </span>
      <span class="text">
        <strong>{{ playlist().title }}</strong>
        <small>{{ playlist().author }}</small>
      </span>
    </a>
  `,
  styles: `
    .playlist { display: flex; gap: .75rem; }
    .thumbnail { position: relative; flex: 0 0 42%; max-width: 11rem; aspect-ratio: 16 / 9;
                 border-radius: var(--radius-small); overflow: hidden; background: var(--surface-strong); }
    img { width: 100%; height: 100%; object-fit: cover; }
    .count { position: absolute; inset: auto 0 0 0; padding: .2rem .4rem; background: rgb(0 0 0 / .75);
             color: #fff; font-size: .75rem; font-weight: 600; }
    .text { min-width: 0; }
    strong { display: block; line-height: 1.3; }
    small { color: var(--text-muted); font-size: .8rem; }
  `,
})
export class PlaylistCard {
  readonly playlist = input.required<PlaylistItem>();
  protected readonly thumbnail = computed(() => {
    const playlist = this.playlist();
    const firstVideo = playlist.videos?.[0]?.videoId;
    return playlist.playlistThumbnail || (firstVideo ? videoThumbnail(firstVideo, 'mq') : '');
  });
}

/** Search results and other mixed lists: videos, channels and playlists. */
@Component({
  selector: 'app-item-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [VideoCard, ChannelCard, PlaylistCard],
  template: `
    <!-- Search also returns kinds this app doesn't show (hashtags, movies); they are skipped. -->
    @for (item of items(); track $index) {
      @if (item.type === 'channel') {
        <app-channel-card [channel]="item" />
      } @else if (item.type === 'playlist') {
        <app-playlist-card [playlist]="item" />
      } @else if (item.type === 'video' || item.type === 'shortVideo' || !item.type) {
        <app-video-card [video]="item" [showAuthor]="showAuthor()" />
      }
    }
  `,
  styleUrl: './item-list.css',
})
export class ItemList {
  readonly items = input.required<ListItem[]>();
  readonly showAuthor = input(true);
}
