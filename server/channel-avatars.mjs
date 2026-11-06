// Channel pictures by channel id: { [channelId]: [imagePath, savedAtMs] }. Pure functions only.

export const keepAvatarsForMs = 30 * 24 * 60 * 60 * 1000;
const channelIdPattern = /^UC[\w-]{22}$/;
const googleImageHost = /^(?:https?:)?\/\/(?:yt\d?\.ggpht\.com|yt\d?\.googleusercontent\.com)\//;

export function isChannelId(value) {
  return typeof value === 'string' && channelIdPattern.test(value);
}

/**
 * The channel's picture as a path the app's /ggpht/ proxy serves, asked for at 176 px: sharp in a
 * small circle on a phone, and a quarter of the 512 px original.
 */
export function avatarPathOf(channel) {
  const images = Array.isArray(channel?.authorThumbnails) ? channel.authorThumbnails : [];
  const largest = images.reduce((best, image) => (image.width > (best?.width ?? -1) ? image : best), null);
  if (!largest || !googleImageHost.test(largest.url)) {
    return null;
  }
  return largest.url.replace(googleImageHost, '/ggpht/').replace(/=s\d+/, '=s176');
}

export function knownAvatar(avatars, channelId, now) {
  const entry = avatars[channelId];
  return entry && now - entry[1] < keepAvatarsForMs ? entry[0] : null;
}

export function withAvatar(avatars, channelId, path, now) {
  return { ...avatars, [channelId]: [path, now] };
}
