import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NearEnd } from './near-end';
import { LoadsMore } from './pager';

/** The end of a growing list: loads more on scroll or from a button, shows a spinner, an error with retry, or "nothing". */
@Component({
  selector: 'app-list-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NearEnd],
  template: `
    <!-- With a more button, only the first page loads by itself. -->
    @if (!moreText() || isEmpty()) {
      <div [appNearEnd]="list()"></div>
    }
    @if (list().loading()) {
      <div class="spinner" role="status" aria-label="Loading"></div>
    } @else if (list().error(); as error) {
      <p class="message">{{ error }}</p>
      <button class="button" (click)="list().loadMore()">Try again</button>
    } @else if (list().done() && isEmpty()) {
      <p class="message">{{ emptyText() }}</p>
    } @else if (moreText() && !list().done()) {
      <button class="button" (click)="list().loadMore()">{{ moreText() }}</button>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; align-items: center; gap: .75rem; padding: 1.5rem 0; }
    .message { color: var(--text-muted); margin: 0; text-align: center; }
  `,
})
export class ListStatus {
  readonly list = input.required<LoadsMore>();
  readonly isEmpty = input(false);
  readonly emptyText = input('Nothing here.');
  /** When set, pages after the first load from a button with this text instead of on scroll. */
  readonly moreText = input<string>();
}
