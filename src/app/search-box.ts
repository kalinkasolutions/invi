import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, filter, of, switchMap } from 'rxjs';
import { InvidiousApi } from './api/invidious-api';
import { Icon } from './shared/icon';

@Component({
  selector: 'app-search-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <form role="search" (submit)="search($event)">
      <app-icon name="search" />
      <input type="search" name="q" placeholder="Search" autocomplete="off" enterkeyhint="search"
             aria-label="Search" [value]="query()" (input)="query.set($any($event.target).value)"
             (focus)="focused.set(true)" (blur)="focused.set(false)" />
    </form>
    @if (focused() && suggestions().length) {
      <ul role="listbox">
        @for (suggestion of suggestions(); track suggestion) {
          <!-- mousedown fires before the input's blur hides the list. -->
          <li role="option" (mousedown)="go(suggestion)">{{ suggestion }}</li>
        }
      </ul>
    }
  `,
  styleUrl: './search-box.css',
})
export class SearchBox {
  private readonly api = inject(InvidiousApi);
  private readonly router = inject(Router);

  protected readonly query = signal('');
  protected readonly focused = signal(false);
  protected readonly suggestions = signal<string[]>([]);

  constructor() {
    toObservable(this.query)
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        switchMap((query) => (query.trim() ? this.api.suggestions(query).pipe(catchError(() => of([]))) : of([]))),
        takeUntilDestroyed(),
      )
      .subscribe((suggestions) => this.suggestions.set(suggestions.slice(0, 8)));

    // Keeps the box showing the current search after back and forward.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        const params = this.router.parseUrl(this.router.url).queryParams;
        this.query.set(params['search_query'] ?? '');
      });
  }

  protected search(event: Event): void {
    event.preventDefault();
    this.go(this.query());
  }

  protected go(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    this.query.set(trimmed);
    this.suggestions.set([]);
    (document.activeElement as HTMLElement | null)?.blur();
    this.router.navigate(['/results'], { queryParams: { search_query: trimmed } });
  }
}
