import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { map } from 'rxjs';
import { InvidiousApi } from '../api/invidious-api';
import { VideoItem } from '../api/types';
import { Auth } from '../core/auth';
import { ItemList } from '../shared/item-list';
import { ListStatus } from '../shared/list-status';
import { Pager } from '../shared/pager';
import { SignInPrompt } from '../shared/sign-in-prompt';

@Component({
  selector: 'app-subscriptions-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ItemList, ListStatus, SignInPrompt],
  template: `
    @if (pager(); as pager) {
      <app-item-list [items]="pager.items()" />
      <app-list-status [list]="pager" [isEmpty]="!pager.items().length"
                       emptyText="No videos yet. Subscribe to channels to fill this page." />
    } @else {
      <app-sign-in-prompt reason="Sign in to see the newest videos from your subscriptions." />
    }
  `,
})
export class SubscriptionsPage {
  private readonly api = inject(InvidiousApi);
  private readonly auth = inject(Auth);

  // Invidious repeats the unseen videos ("notifications") on every page, so they are taken from
  // page 1 only, and paging follows the plain videos.
  protected readonly pager = computed(() => {
    if (!this.auth.signedIn()) {
      return null;
    }
    return new Pager<VideoItem, number>(
      (page = 1) =>
        this.api.feed(page).pipe(
          map((feed) => ({
            items: page === 1 ? [...feed.notifications, ...feed.videos] : feed.videos,
            next: feed.videos.length ? page + 1 : undefined,
          })),
        ),
      (video) => video.videoId,
    );
  });
}
