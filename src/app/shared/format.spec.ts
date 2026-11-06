import { formatDuration, initialsOf, parseTimestamp, shortAgo } from './format';

describe('formatDuration', () => {
  it('shows minutes and seconds, and hours when there are any', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3723)).toBe('1:02:03');
    expect(formatDuration(0)).toBe('');
  });
});

describe('parseTimestamp', () => {
  it('reads the forms YouTube uses for t', () => {
    expect(parseTimestamp('90')).toBe(90);
    expect(parseTimestamp('90s')).toBe(90);
    expect(parseTimestamp('1h2m3s')).toBe(3723);
    expect(parseTimestamp('2m')).toBe(120);
    expect(parseTimestamp('nonsense')).toBe(0);
    expect(parseTimestamp(undefined)).toBe(0);
  });
});

describe('shortAgo', () => {
  it('shortens the units like YouTube', () => {
    expect(shortAgo('1 hour ago')).toBe('1h ago');
    expect(shortAgo('3 days ago')).toBe('3d ago');
    expect(shortAgo('2 weeks ago')).toBe('2w ago');
    expect(shortAgo('5 months ago')).toBe('5mo ago');
    expect(shortAgo('17 years ago')).toBe('17y ago');
  });

  it('leaves other texts alone', () => {
    expect(shortAgo('Streamed 2 days ago')).toBe('Streamed 2 days ago');
    expect(shortAgo(undefined)).toBeUndefined();
  });
});

describe('initialsOf', () => {
  it('takes the first letters of the first two words', () => {
    expect(initialsOf('Soft White Underbelly')).toBe('SW');
    expect(initialsOf('Fireship')).toBe('F');
    expect(initialsOf('@HouseofEl')).toBe('H');
    expect(initialsOf('')).toBe('');
  });
});
