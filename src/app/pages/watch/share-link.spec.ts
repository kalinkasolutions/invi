import { parseTimestamp } from '../../shared/format';
import { watchLink } from './share-link';

describe('watchLink', () => {
  it('links the video without a time', () => {
    expect(watchLink('https://yt.example', 'abc123')).toBe('https://yt.example/watch?v=abc123');
  });

  it('adds whole seconds, which the watch page reads back', () => {
    const link = watchLink('https://yt.example', 'abc123', 205.7);
    expect(link).toBe('https://yt.example/watch?v=abc123&t=205s');
    expect(parseTimestamp(new URL(link).searchParams.get('t'))).toBe(205);
  });

  it('leaves the time out at the very start', () => {
    expect(watchLink('https://yt.example', 'abc123', 0.4)).toBe('https://yt.example/watch?v=abc123');
  });
});
