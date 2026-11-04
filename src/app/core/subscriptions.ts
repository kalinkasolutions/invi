import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { InvidiousApi } from '../api/invidious-api';
import { Subscription } from '../api/types';
import { Auth } from './auth';

/** The signed-in user's subscriptions, kept in step with the subscribe buttons. */
@Injectable({ providedIn: 'root' })
export class Subscriptions {
  private readonly api = inject(InvidiousApi);
  private readonly auth = inject(Auth);

  readonly channels = signal<Subscription[]>([]);
  private readonly channelIds = computed(() => new Set(this.channels().map((channel) => channel.authorId)));

  constructor() {
    effect(() => {
      if (this.auth.signedIn()) {
        this.api.subscriptions().subscribe({ next: (channels) => this.channels.set(channels) });
      } else {
        this.channels.set([]);
      }
    });
  }

  isSubscribed(channelId: string): boolean {
    return this.channelIds().has(channelId);
  }

  toggle(channel: Subscription): void {
    const before = this.channels();
    if (this.isSubscribed(channel.authorId)) {
      this.channels.set(before.filter((existing) => existing.authorId !== channel.authorId));
      this.api.unsubscribe(channel.authorId).subscribe({ error: () => this.channels.set(before) });
    } else {
      this.channels.set([...before, channel]);
      this.api.subscribe(channel.authorId).subscribe({ error: () => this.channels.set(before) });
    }
  }
}
