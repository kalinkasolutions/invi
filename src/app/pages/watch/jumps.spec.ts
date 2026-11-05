import { jumpSeconds, tapZone } from './jumps';

describe('jumpSeconds', () => {
  it('grows 5, 10, 15, 20 and then stays at 30', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(jumpSeconds)).toEqual([5, 10, 15, 20, 30, 30, 30, 30]);
  });
});

describe('tapZone', () => {
  it('splits the video in thirds', () => {
    expect(tapZone(10, 300)).toBe('back');
    expect(tapZone(150, 300)).toBe('middle');
    expect(tapZone(290, 300)).toBe('forward');
  });
});
