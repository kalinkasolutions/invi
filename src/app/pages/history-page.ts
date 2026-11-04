import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InvidiousApi } from '../api/invidious-api';
import { videoThumbnail } from '../api/private-urls';
import { Auth } from '../core/auth';
import { searchWatched, watchedTitles } from '../core/watched-titles';
import { Icon } from '../shared/icon';
import { ListStatus } from '../shared/list-status';
import { numberedPages, Pager } from '../shared/pager';
import { SignInPrompt } from '../shared/sign-in-prompt';
import { VideoCard } from '../shared/video-card';

// Invidious keeps only the ids of watched videos, so the full history is a wall of thumbnails.
// Search works on the titles this app saved while playing (see watched-titles.ts).
@Component({
  selector: 'app-history-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, ListStatus, SignInPrompt, VideoCard],
  templateUrl: './history-page.html',
  styleUrl: './history-page.css',
})
export class HistoryPage {
  private readonly api = inject(InvidiousApi);
  private readonly auth = inject(Auth);

  protected readonly query = signal('');
  private readonly saved = watchedTitles();
  protected readonly results = computed(() => searchWatched(this.saved, this.query()));
  protected readonly searching = computed(() => this.query().trim() !== '');

  protected readonly pager = computed(() =>
    this.auth.signedIn() ? new Pager(numberedPages((page) => this.api.history(page)), (id: string) => id) : null,
  );

  protected thumbnail(videoId: string): string {
    return videoThumbnail(videoId, 'mq');
  }
}
