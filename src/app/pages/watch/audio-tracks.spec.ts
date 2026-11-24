import { originalAudioTrack, withoutDubs } from './audio-tracks';

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

describe('withoutDubs', () => {
  const audioSet = (lang: string, role: string) =>
    `<AdaptationSet mimeType="audio/mp4" lang="${lang}" contentType="audio"><Role schemeIdUri="urn:mpeg:dash:role:2011" value="${role}"/><Representation id="140-${lang}"/></AdaptationSet>`;
  const videoSet = '<AdaptationSet mimeType="video/mp4" contentType="video"><Representation id="137"/></AdaptationSet>';
  const manifest = (...sets: string[]) =>
    `<?xml version="1.0" encoding="UTF-8"?><MPD xmlns="urn:mpeg:dash:schema:mpd:2011"><Period>${sets.join('')}</Period></MPD>`;
  const languages = (mpd: string) => [...mpd.matchAll(/lang="([^"]+)"/g)].map((match) => match[1]);

  it('keeps only the original audio and all the video', () => {
    const result = withoutDubs(
      manifest(audioSet('de-DE', 'alternate'), audioSet('en-US', 'main'), audioSet('fr-FR', 'alternate'), videoSet),
    );
    expect(languages(result)).toEqual(['en-US']);
    expect(result).toContain('id="137"');
  });

  it('leaves a manifest without a marked original alone', () => {
    const mpd = manifest(audioSet('de-DE', 'alternate'), audioSet('fr-FR', 'alternate'), videoSet);
    expect(withoutDubs(mpd)).toBe(mpd);
  });
});
