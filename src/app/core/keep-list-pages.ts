import { ComponentRef, inject, Injectable, Injector } from '@angular/core';
import { ActivatedRouteSnapshot, DetachedRouteHandle, Router, RouteReuseStrategy } from '@angular/router';

/** Route data marking a list page that comes back as it was (loaded videos, scroll position) on "back". */
export const keptOnBack = { keepOnBack: true };

const maxKeptPages = 5;

/**
 * Keeps the last few list pages alive when leaving them. Going back or forward puts the kept page
 * back, so its videos are there at once and the browser's scroll position fits again; any other
 * way to the page builds it fresh.
 */
@Injectable({ providedIn: 'root' })
export class KeepListPages implements RouteReuseStrategy {
  // The router itself needs this strategy, so it is looked up only when used.
  private readonly injector = inject(Injector);
  private readonly kept = new Map<string, DetachedRouteHandle>();

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return isKeptOnBack(route);
  }

  // The router calls this with null right after putting a kept page back: from then on that page is
  // in use again, so it is only let go of here, never destroyed.
  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const key = pageKey(route);
    if (!handle) {
      this.kept.delete(key);
      return;
    }
    if (this.kept.get(key) !== handle) {
      this.destroy(key);
    }
    this.kept.delete(key);
    this.kept.set(key, handle);
    const oldest = this.kept.keys().next().value;
    if (this.kept.size > maxKeptPages && oldest !== undefined) {
      this.destroy(oldest);
    }
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const throughHistory = this.injector.get(Router).currentNavigation()?.trigger === 'popstate';
    return isKeptOnBack(route) && throughHistory && this.kept.has(pageKey(route));
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    return isKeptOnBack(route) ? (this.kept.get(pageKey(route)) ?? null) : null;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, current: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === current.routeConfig;
  }

  /** For a kept page that won't come back: it has to be destroyed by hand, or it stays in memory. */
  private destroy(key: string): void {
    const handle = this.kept.get(key) as { componentRef?: ComponentRef<unknown> } | undefined;
    handle?.componentRef?.destroy();
    this.kept.delete(key);
  }
}

function isKeptOnBack(route: ActivatedRouteSnapshot): boolean {
  return route.routeConfig?.data?.['keepOnBack'] === true;
}

/** The page's full address: /results?search_query=a and ?search_query=b are different pages. */
export function pageKey(route: ActivatedRouteSnapshot): string {
  const path = route.pathFromRoot.flatMap((part) => part.url.map((segment) => segment.path)).join('/');
  const query = new URLSearchParams(route.queryParams as Record<string, string>).toString();
  return `/${path}?${query}`;
}
