import { closestQuality, qualitiesOf, variantWithQuality } from './quality';

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

describe('qualitiesOf', () => {
  it('names qualities by the shorter side, so vertical videos read like YouTube', () => {
    const vertical = [
      { width: 1080, height: 1920 },
      { width: 720, height: 1280 },
      { width: 1080, height: 1920 },
    ];
    expect(qualitiesOf(vertical)).toEqual([1080, 720]);
    expect(qualitiesOf([{ width: 1920, height: 1080 }, { width: null, height: null }])).toEqual([1080]);
  });
});

describe('variantWithQuality', () => {
  const variants = [
    { id: 1, width: 1920, height: 1080, audioId: 10, active: false }, // Arabic dub, listed first
    { id: 2, width: 1280, height: 720, audioId: 20, active: true }, // original, playing now
    { id: 3, width: 1920, height: 1080, audioId: 20, active: false }, // original
  ];

  it('keeps the audio that plays now', () => {
    expect(variantWithQuality(variants, 1080)?.id).toBe(3);
  });

  it('takes any with the quality when the playing audio has none', () => {
    const only480 = { id: 4, width: 854, height: 480, audioId: 30, active: false };
    expect(variantWithQuality([only480, ...variants], 480)?.id).toBe(4);
  });

  it('matches vertical videos by their shorter side', () => {
    const vertical = { id: 5, width: 1080, height: 1920, audioId: 20, active: false };
    expect(variantWithQuality([vertical], 1080)?.id).toBe(5);
  });

  it('finds nothing for a missing quality', () => {
    expect(variantWithQuality(variants, 2160)).toBeUndefined();
  });
});
