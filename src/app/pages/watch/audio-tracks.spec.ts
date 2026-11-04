import { originalAudioTrack } from './audio-tracks';

describe('originalAudioTrack', () => {
  const dub = (label: string) => ({ roles: ['alternate', 'dub'], label });

  it('picks the plain original over the dubs and the Stable Volume copy', () => {
    const tracks = [
      dub('German (DE)'),
      { roles: ['main', 'enhanced-audio-intelligibility'], label: 'English (US) original (Stable Volume)' },
      { roles: ['main'], label: 'English (US) original' },
      dub('French (FR)'),
    ];
    expect(originalAudioTrack(tracks)?.label).toBe('English (US) original');
  });

  it('takes the Stable Volume copy when it is the only original', () => {
    const tracks = [dub('German (DE)'), { roles: ['main', 'enhanced-audio-intelligibility'], label: 'English original' }];
    expect(originalAudioTrack(tracks)?.label).toBe('English original');
  });

  it('finds nothing in a video with only dubs or no roles', () => {
    expect(originalAudioTrack([dub('German (DE)')])).toBeUndefined();
    expect(originalAudioTrack([{ roles: [], label: null }])).toBeUndefined();
  });
});
