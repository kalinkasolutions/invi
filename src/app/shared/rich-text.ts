import { Directive, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { parseTimestamp } from './format';
import { toInternalPath } from './internal-links';

/**
 * For HTML from Invidious (descriptions, comments): YouTube links stay in the app,
 * timestamps of the current video seek, everything else opens in a new tab.
 */
@Directive({
  selector: '[appRichText]',
  host: { '(click)': 'onClick($event)' },
})
export class RichText {
  readonly currentVideoId = input<string>();
  readonly seek = output<number>();

  private readonly router = inject(Router);

  protected onClick(event: MouseEvent): void {
    const link = (event.target as HTMLElement).closest('a');
    const href = link?.getAttribute('href');
    if (!href || event.ctrlKey || event.metaKey) {
      return;
    }
    event.preventDefault();

    const path = toInternalPath(href);
    if (!path) {
      window.open(href, '_blank', 'noopener');
      return;
    }
    const target = new URL(path, location.origin);
    if (target.pathname === '/watch' && target.searchParams.get('v') === this.currentVideoId()) {
      this.seek.emit(parseTimestamp(target.searchParams.get('t')));
      return;
    }
    this.router.navigateByUrl(path);
  }
}
