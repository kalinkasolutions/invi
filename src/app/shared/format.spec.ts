import { formatDuration, parseTimestamp } from './format';

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
