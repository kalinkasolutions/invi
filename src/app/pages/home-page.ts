import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { InvidiousApi } from '../api/invidious-api';
import { ItemList } from '../shared/item-list';
import { errorMessage } from '../shared/pager';

type HomeTab = 'trending' | 'popular';

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ItemList],
  template: `
    <nav class="chips">
      <a routerLink="/feed/trending" [class.active]="activeTab() === 'trending'">Trending</a>
      <a routerLink="/feed/trending" [queryParams]="{ tab: 'popular' }" [class.active]="activeTab() === 'popular'">Popular here</a>
    </nav>
    @if (videos.value(); as videos) {
      <app-item-list [items]="videos" />
    } @else if (videos.error()) {
      <p class="empty">{{ error() }}</p>
    } @else {
      <div class="spinner" role="status" aria-label="Loading"></div>
    }
  `,
})
export class HomePage {
  readonly tab = input<HomeTab>();

  private readonly api = inject(InvidiousApi);
  protected readonly activeTab = computed(() => this.tab() ?? 'trending');
  protected readonly videos = rxResource({
    params: () => this.activeTab(),
    stream: ({ params }) => (params === 'popular' ? this.api.popular() : this.api.trending()),
  });
  protected readonly error = computed(() => errorMessage(this.videos.error()?.cause));
}
