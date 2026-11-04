import { closestQuality } from './quality';

describe('closestQuality', () => {
  const available = [1080, 720, 480, 360, 144];

  it('takes the wanted quality when the video has it', () => {
    expect(closestQuality(available, 720)).toBe(720);
  });

  it('takes the next lower one when the video has no such quality', () => {
    expect(closestQuality([720, 480], 1080)).toBe(720);
    expect(closestQuality(available, 600)).toBe(480);
  });

  it('takes the lowest one when every quality is higher than wanted', () => {
    expect(closestQuality([1080, 720], 480)).toBe(720);
  });

  it('finds nothing in a video without qualities', () => {
    expect(closestQuality([], 1080)).toBeUndefined();
  });
});
