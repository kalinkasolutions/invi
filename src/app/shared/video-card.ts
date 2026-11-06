import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { largestImage, videoThumbnail } from '../api/private-urls';
import { VideoItem } from '../api/types';
import { Avatar } from './avatar';
import { formatCount, formatDuration, joinNonEmpty, shortAgo } from './format';

@Component({
  selector: 'app-video-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Avatar],
  host: { '[class.row]': 'layout() === "row"' },
  template: `
    <a class="thumbnail" routerLink="/watch" [queryParams]="watchParams()" tabindex="-1">
      <img [src]="thumbnail()" alt="" loading="lazy" />
      @if (video().liveNow) {
        <span class="badge live">Live</span>
      } @else if (duration()) {
        <span class="badge">{{ duration() }}</span>
      }
    </a>
    <div class="details">
      @if (showAuthor() && layout() === 'card') {
        <a class="channel" [routerLink]="['/channel', video().authorId]" tabindex="-1" [attr.aria-label]="video().author">
          <app-avatar [src]="authorAvatar()" [name]="video().author" />
        </a>
      }
      <div class="text">
        <a class="title" routerLink="/watch" [queryParams]="watchParams()">{{ video().title }}</a>
        <p class="meta">
          @if (showAuthor()) {
            <a [routerLink]="['/channel', video().authorId]">{{ video().author }}</a>
          }
          <span>{{ details() }}</span>
        </p>
      </div>
    </div>
  `,
  styleUrl: './video-card.css',
})
export class VideoCard {
  readonly video = input.required<VideoItem>();
  readonly layout = input<'card' | 'row'>('card');
  readonly playlistId = input<string>();
  readonly showAuthor = input(true);

  protected readonly thumbnail = computed(() =>
    videoThumbnail(this.video().videoId, this.layout() === 'row' ? 'mq' : 'hq'),
  );
  protected readonly duration = computed(() => formatDuration(this.video().lengthSeconds));
  // The subscription feed carries no channel pictures; this app's server looks them up once for
  // everyone and redirects to the picture. Should it have none, the avatar shows initials.
  protected readonly authorAvatar = computed(
    () => largestImage(this.video().authorThumbnails) || `/invi-api/channel-avatar/${this.video().authorId}`,
  );
  protected readonly watchParams = computed(() => ({ v: this.video().videoId, list: this.playlistId() }));
  protected readonly details = computed(() => {
    const video = this.video();
    // Where YouTube gives no numbers (trending, some live streams) Invidious sends 0 and "0 seconds ago".
    const views = video.viewCount ? `${formatCount(video.viewCount)} views` : undefined;
    const published = video.publishedText === '0 seconds ago' ? undefined : shortAgo(video.publishedText);
    return joinNonEmpty([views, published]);
  });
}
