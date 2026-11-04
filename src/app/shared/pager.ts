import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { map, Observable, Subscription } from 'rxjs';

export interface Page<T, Cursor> {
  items: T[];
  next?: Cursor;
}

/** What the infinite-scroll sentinel needs to know about a list. */
export interface LoadsMore {
  loading(): boolean;
  done(): boolean;
  error(): string | null;
  loadMore(): void;
}

/** A list that grows page by page; repeated items (same key) are dropped. */
export class Pager<T, Cursor = unknown> implements LoadsMore {
  readonly items = signal<T[]>([]);
  readonly loading = signal(false);
  readonly done = signal(false);
  readonly error = signal<string | null>(null);

  private cursor: Cursor | undefined;
  private readonly seenKeys = new Set<string>();
  private request?: Subscription;

  constructor(
    private readonly fetchPage: (cursor: Cursor | undefined) => Observable<Page<T, Cursor>>,
    private readonly keyOf?: (item: T) => string,
  ) {}

  loadMore(): void {
    if (this.loading() || this.done()) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.request = this.fetchPage(this.cursor).subscribe({
      next: (page) => this.append(page),
      error: (error) => {
        this.error.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  cancel(): void {
    this.request?.unsubscribe();
  }

  private append(page: Page<T, Cursor>): void {
    const keyOf = this.keyOf;
    const newItems = !keyOf ? page.items : page.items.filter((item) => {
      const key = keyOf(item);
      const isNew = !this.seenKeys.has(key);
      this.seenKeys.add(key);
      return isNew;
    });
    this.items.update((items) => [...items, ...newItems]);
    this.cursor = page.next;
    // A page with nothing new ends the list, so a server that repeats itself can't cause a loop.
    this.done.set(page.next === undefined || newItems.length === 0);
    this.loading.set(false);
  }
}

/** Adapts an endpoint that takes `page=1,2,…` and returns a plain array. */
export function numberedPages<T>(fetch: (page: number) => Observable<T[]>) {
  return (page: number | undefined): Observable<Page<T, number>> => {
    const current = page ?? 1;
    return fetch(current).pipe(map((items) => ({ items, next: items.length ? current + 1 : undefined })));
  };
}

export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    return error.error?.error ?? `The server answered ${error.status || 'nothing'}.`;
  }
  return 'Something went wrong.';
}
