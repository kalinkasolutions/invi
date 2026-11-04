import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { videoThumbnail } from '../api/private-urls';
import { VideoItem } from '../api/types';
import { formatCount, formatDuration, joinNonEmpty } from './format';

@Component({
  selector: 'app-video-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
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
    <div class="text">
      <a class="title" routerLink="/watch" [queryParams]="watchParams()">{{ video().title }}</a>
      <p class="meta">
        @if (showAuthor()) {
          <a [routerLink]="['/channel', video().authorId]">{{ video().author }}</a>
        }
        <span>{{ details() }}</span>
      </p>
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
  protected readonly watchParams = computed(() => ({ v: this.video().videoId, list: this.playlistId() }));
  protected readonly details = computed(() => {
    const video = this.video();
    // Where YouTube gives no numbers (trending, some live streams) Invidious sends 0 and "0 seconds ago".
    const views = video.viewCount ? `${formatCount(video.viewCount)} views` : undefined;
    const published = video.publishedText === '0 seconds ago' ? undefined : video.publishedText;
    return joinNonEmpty([views, published]);
  });
}
