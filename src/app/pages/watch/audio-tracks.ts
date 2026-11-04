interface AudioTrackInfo {
  roles: string[];
  label: string | null;
}

// YouTube marks its AI dubs with the role "dub" and the original with "main"; the original can
// also come as a "Stable Volume" copy (enhanced-audio-intelligibility), which is skipped.
export function originalAudioTrack<T extends AudioTrackInfo>(tracks: T[]): T | undefined {
  const originals = tracks.filter(
    (track) => track.roles.includes('main') || /\boriginal\b/i.test(track.label ?? ''),
  );
  return originals.find((track) => !track.roles.includes('enhanced-audio-intelligibility')) ?? originals[0];
}
