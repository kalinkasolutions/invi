import { pageForTypedLink, toInternalPath } from './internal-links';

describe('toInternalPath', () => {
  it('keeps YouTube links in the app', () => {
    expect(toInternalPath('https://www.youtube.com/watch?v=abc&t=10')).toBe('/watch?v=abc&t=10');
    expect(toInternalPath('https://youtu.be/abc?t=5')).toBe('/watch?t=5&v=abc');
    expect(toInternalPath('https://www.youtube.com/@Fireship')).toBe('/@Fireship');
  });

  it('keeps Invidious-relative links in the app', () => {
    expect(toInternalPath('/watch?v=abc&t=1m')).toBe('/watch?v=abc&t=1m');
    expect(toInternalPath('/hashtag/lofi')).toBe('/results?search_query=%23lofi');
    expect(toInternalPath('/search?q=cats')).toBe('/results?search_query=cats');
  });

  it('leaves other sites alone', () => {
    expect(toInternalPath('https://example.com/watch?v=abc')).toBeNull();
    expect(toInternalPath('https://www.youtube.com/about')).toBeNull();
  });
});

describe('pageForTypedLink', () => {
  it('opens pasted YouTube links instead of searching for them', () => {
    expect(pageForTypedLink('https://www.youtube.com/watch?v=5ernU9Vk6y0&t=2s')).toBe('/watch?v=5ernU9Vk6y0&t=2s');
    expect(pageForTypedLink('  https://www.youtube.com/@JustinSung ')).toBe('/@JustinSung');
    expect(pageForTypedLink('youtube.com/watch?v=5ernU9Vk6y0')).toBe('/watch?v=5ernU9Vk6y0');
    expect(pageForTypedLink('youtu.be/5ernU9Vk6y0?t=30')).toBe('/watch?t=30&v=5ernU9Vk6y0');
    expect(pageForTypedLink('https://m.youtube.com/playlist?list=PL123')).toBe('/playlist?list=PL123');
  });

  it('leaves ordinary searches alone', () => {
    expect(pageForTypedLink('justin sung learning')).toBeNull();
    expect(pageForTypedLink('youtube tips')).toBeNull();
  });
});
