import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { map, Observable, switchMap, throwError } from 'rxjs';
import { InvidiousApi } from '../api/invidious-api';
import { largestImage } from '../api/private-urls';
import { Channel, ChannelVideoTab, ListItem } from '../api/types';
import { Avatar } from '../shared/avatar';
import { formatCount } from '../shared/format';
import { ItemList } from '../shared/item-list';
import { ListStatus } from '../shared/list-status';
import { errorMessage, Page, Pager } from '../shared/pager';
import { SubscribeButton } from '../shared/subscribe-button';

type ChannelTab = ChannelVideoTab | 'playlists';
const tabLabels: Record<ChannelTab, string> = {
  videos: 'Videos',
  shorts: 'Shorts',
  streams: 'Live',
  playlists: 'Playlists',
};

@Component({
  selector: 'app-channel-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Avatar, ItemList, ListStatus, SubscribeButton],
  template: `
    @if (channel.value(); as channel) {
      @if (banner() && !bannerFailed()) {
        <img class="banner" [src]="banner()" alt="" (error)="bannerFailed.set(true)" />
      }
      <header>
        <app-avatar [src]="avatar()" [name]="channel.author" />
        <div class="name">
          <h1>{{ channel.author }}</h1>
          <small>{{ subscribers() }}</small>
        </div>
        <app-subscribe-button [channelId]="channel.authorId" [channelName]="channel.author" />
      </header>
      <nav class="chips">
        @for (tab of tabs(); track tab) {
          <a [routerLink]="[]" [queryParams]="{ tab }" [class.active]="activeTab() === tab">{{ tabLabels[tab] }}</a>
        }
      </nav>
      @if (pager(); as pager) {
        <app-item-list [items]="pager.items()" [showAuthor]="false" />
        <app-list-status [list]="pager" [isEmpty]="!pager.items().length" />
      }
    } @else if (channel.error()) {
      <p class="empty">{{ error() }}</p>
    } @else {
      <div class="spinner" role="status" aria-label="Loading"></div>
    }
  `,
  styles: `
    .banner { display: block; width: calc(100% + 2 * var(--gutter)); margin: calc(-1 * var(--page-top)) calc(-1 * var(--gutter)) 1rem;
              aspect-ratio: 6 / 1; object-fit: cover; }
    @media (min-width: 640px) { .banner { width: 100%; margin: 0 0 1rem; border-radius: var(--radius); } }
    header { display: flex; align-items: center; gap: .9rem; margin-bottom: 1rem; --size: 3.5rem; }
    .name { flex: 1; min-width: 0; }
    h1 { margin: 0; font-size: 1.25rem; }
    small { color: var(--text-muted); }
  `,
})
export class ChannelPage {
  /** A channel id (UC…) or a handle (@name). */
  readonly id = input.required<string>();
  readonly tab = input<ChannelTab>();

  private readonly api = inject(InvidiousApi);
  protected readonly tabLabels = tabLabels;

  protected readonly channel = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.channelFor(params),
  });
  protected readonly error = computed(() => errorMessage(this.channel.error()?.cause));
  protected readonly banner = computed(() => largestImage(this.channel.value()?.authorBanners));
  protected readonly bannerFailed = linkedSignal({ source: this.banner, computation: () => false });
  protected readonly avatar = computed(() => largestImage(this.channel.value()?.authorThumbnails));
  protected readonly subscribers = computed(() => `${formatCount(this.channel.value()?.subCount)} subscribers`);

  protected readonly tabs = computed(() => {
    const offered = this.channel.value()?.tabs ?? [];
    return (Object.keys(tabLabels) as ChannelTab[]).filter((tab) => offered.includes(tab));
  });
  protected readonly activeTab = computed(() => this.tab() ?? this.tabs()[0] ?? 'videos');

  protected readonly pager = computed(() => {
    const channelId = this.channel.value()?.authorId;
    if (!channelId) {
      return null;
    }
    const tab = this.activeTab();
    return new Pager<ListItem, string>((continuation) => this.tabPage(channelId, tab, continuation));
  });

  constructor() {
    const title = inject(Title);
    effect(() => title.setTitle(`${this.channel.value()?.author ?? 'Channel'} – invi`));
  }

  private channelFor(idOrHandle: string): Observable<Channel> {
    if (!idOrHandle.startsWith('@')) {
      return this.api.channel(idOrHandle);
    }
    return this.api.resolveHandle(idOrHandle).pipe(
      switchMap((id) => (id ? this.api.channel(id) : throwError(() => new Error('Channel not found')))),
    );
  }

  private tabPage(channelId: string, tab: ChannelTab, continuation?: string): Observable<Page<ListItem, string>> {
    if (tab === 'playlists') {
      return this.api
        .channelPlaylists(channelId, continuation)
        .pipe(map((page) => ({ items: page.playlists, next: page.continuation })));
    }
    return this.api
      .channelVideos(channelId, tab, continuation)
      .pipe(map((page) => ({ items: page.videos, next: page.continuation })));
  }
}
