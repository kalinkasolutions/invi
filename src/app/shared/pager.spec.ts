import { of } from 'rxjs';
import { Pager } from './pager';

describe('Pager', () => {
  it('stops when a page brings nothing new, even if the server offers more', () => {
    let requests = 0;
    const pager = new Pager<string, number>(
      (page = 1) => {
        requests++;
        return of({ items: ['same', 'items'], next: page + 1 });
      },
      (item) => item,
    );

    pager.loadMore();
    pager.loadMore();
    pager.loadMore();

    expect(pager.items()).toEqual(['same', 'items']);
    expect(pager.done()).toBe(true);
    expect(requests).toBe(2);
  });

  it('stops when there is no next page', () => {
    const pager = new Pager<string, number>(() => of({ items: ['a'] }));
    pager.loadMore();
    pager.loadMore();
    expect(pager.items()).toEqual(['a']);
    expect(pager.done()).toBe(true);
  });
});
