import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Auth } from '../core/auth';
import { Subscriptions } from '../core/subscriptions';

@Component({
  selector: 'app-subscribe-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.signedIn()) {
      <button class="button" [class.primary]="!subscribed()" (click)="toggle()">
        {{ subscribed() ? 'Subscribed' : 'Subscribe' }}
      </button>
      @if (failed()) {
        <small role="alert">Didn’t work, Invidious couldn’t reach the channel. Try again later.</small>
      }
    }
  `,
  styles: `
    :host { display: inline-flex; flex-direction: column; align-items: flex-end; gap: .25rem; }
    small { max-width: 14rem; color: var(--text-muted); font-size: .75rem; text-align: right; }
  `,
})
export class SubscribeButton {
  readonly channelId = input.required<string>();
  readonly channelName = input.required<string>();

  protected readonly auth = inject(Auth);
  private readonly subscriptions = inject(Subscriptions);
  protected readonly subscribed = computed(() => this.subscriptions.isSubscribed(this.channelId()));
  protected readonly failed = computed(() => this.subscriptions.failedChannel() === this.channelId());

  protected toggle(): void {
    this.subscriptions.toggle({ authorId: this.channelId(), author: this.channelName() });
  }
}
