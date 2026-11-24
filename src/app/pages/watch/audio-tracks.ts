interface AudioTrackInfo {
  roles: string[];
  label: string | null;
}

/**
 * The DASH manifest with only the original audio. Shaka checks every audio and video pair with the
 * browser before it starts; with 20 dubs that took over a minute on Firefox for Android.
 */
export function withoutDubs(manifest: string): string {
  const document = new DOMParser().parseFromString(manifest, 'application/xml');
  const audioSets = [...document.getElementsByTagName('AdaptationSet')].filter(
    (set) => set.getAttribute('contentType') === 'audio' || set.getAttribute('mimeType')?.startsWith('audio/'),
  );
  const isOriginal = (set: Element) =>
    [...set.getElementsByTagName('Role')].some((role) => role.getAttribute('value') === 'main');
  // Without a marked original, keeping everything beats a video without sound.
  if (!audioSets.some(isOriginal)) {
    return manifest;
  }
  audioSets.filter((set) => !isOriginal(set)).forEach((dub) => dub.remove());
  return new XMLSerializer().serializeToString(document);
}

// YouTube marks its AI dubs with the role "dub" and the original with "main"; the original can
// also come as a "Stable Volume" copy (enhanced-audio-intelligibility), which is skipped.
export function originalAudioTrack<T extends AudioTrackInfo>(tracks: T[]): T | undefined {
  const originals = tracks.filter(
    (track) => track.roles.includes('main') || /\boriginal\b/i.test(track.label ?? ''),
  );
  return originals.find((track) => !track.roles.includes('enhanced-audio-intelligibility')) ?? originals[0];
}
