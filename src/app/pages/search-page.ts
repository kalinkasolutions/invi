import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { InvidiousApi } from '../api/invidious-api';
import { ListItem, SearchType } from '../api/types';
import { ItemList } from '../shared/item-list';
import { ListStatus } from '../shared/list-status';
import { numberedPages, Pager } from '../shared/pager';

const types: { value: SearchType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Videos' },
  { value: 'channel', label: 'Channels' },
  { value: 'playlist', label: 'Playlists' },
];

function itemKey(item: ListItem): string {
  switch (item.type) {
    case 'channel':
      return item.authorId;
    case 'playlist':
      return item.playlistId;
    default:
      return item.videoId;
  }
}

@Component({
  selector: 'app-search-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ItemList, ListStatus],
  template: `
    <nav class="chips">
      @for (option of types; track option.value) {
        <a routerLink="/results" [queryParams]="{ search_query: query(), type: option.value }"
           [class.active]="activeType() === option.value">{{ option.label }}</a>
      }
    </nav>
    <app-item-list [items]="pager().items()" />
    <app-list-status [list]="pager()" [isEmpty]="!pager().items().length" emptyText="No results." />
  `,
})
export class SearchPage {
  readonly query = input('', { alias: 'search_query' });
  readonly type = input<SearchType>();

  protected readonly types = types;
  private readonly api = inject(InvidiousApi);
  protected readonly activeType = computed(() => this.type() ?? 'all');

  protected readonly pager = computed(() => {
    const query = this.query();
    const type = this.activeType();
    return new Pager(
      numberedPages((page) => this.api.search(query, page, type)),
      itemKey,
    );
  });

  constructor() {
    const title = inject(Title);
    effect(() => title.setTitle(`${this.query()} – invi`));
  }
}
