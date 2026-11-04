// Watch positions per user: { [user]: { [videoId]: [seconds, savedAtMs] } }. Pure functions only.

export const maxVideosPerUser = 5000;
const videoIdPattern = /^[\w-]{11}$/;

export function isVideoId(value) {
  return typeof value === 'string' && videoIdPattern.test(value);
}

export function positionOf(positions, user, videoId) {
  return positions[user]?.[videoId]?.[0] ?? null;
}

/** A copy with the position set, or removed when `seconds` is null; old entries beyond the limit go. */
export function withPosition(positions, user, videoId, seconds, now, limit = maxVideosPerUser) {
  const videos = { ...positions[user] };
  delete videos[videoId];
  if (seconds !== null) {
    videos[videoId] = [Math.round(seconds), now];
  }
  return { ...positions, [user]: newestOnly(videos, limit) };
}

function newestOnly(videos, limit) {
  const entries = Object.entries(videos);
  if (entries.length <= limit) {
    return videos;
  }
  return Object.fromEntries(entries.sort(([, a], [, b]) => b[1] - a[1]).slice(0, limit));
}

/** The request body's seconds: a number from 0 up, or null to forget the position. */
export function parseSeconds(body) {
  let value;
  try {
    value = JSON.parse(body).seconds;
  } catch {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}
