import { DestroyRef, Directive, effect, ElementRef, inject, input } from '@angular/core';
import { LoadsMore } from './pager';

/** Put on an element after a list: loads the next page whenever it comes close to the screen. */
@Directive({ selector: '[appNearEnd]' })
export class NearEnd {
  readonly list = input.required<LoadsMore>({ alias: 'appNearEnd' });

  constructor() {
    const element: HTMLElement = inject(ElementRef).nativeElement;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          this.list().loadMore();
        }
      },
      { rootMargin: '0px 0px 1000px 0px' },
    );

    // Observing again after each page makes the observer report once more, so a short page keeps loading.
    effect(() => {
      const list = this.list();
      observer.disconnect();
      if (!list.loading() && !list.done() && !list.error()) {
        observer.observe(element);
      }
    });
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }
}
