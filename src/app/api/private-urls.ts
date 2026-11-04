// Images on Google's hosts go through Invidious' image proxy, so the browser never contacts Google.
const googleImageHost = /^(?:https?:)?\/\/(?:yt\d?\.ggpht\.com|yt\d?\.googleusercontent\.com)\//;
const ytimgHost = /^(?:https?:)?\/\/i\d?\.ytimg\.com\//;
const ytimgVideoThumbnail = /^(?:https?:)?\/\/i\d?\.ytimg\.com(\/vi\/[\w-]{11}\/[\w.]+)/;

export function toPrivateUrl(url: string): string {
  if (googleImageHost.test(url)) {
    return url.replace(googleImageHost, '/ggpht/');
  }
  if (ytimgHost.test(url)) {
    return url.match(ytimgVideoThumbnail)?.[1] ?? '';
  }
  return url;
}

export function rewriteGoogleUrls<T>(value: T): T {
  if (typeof value === 'string') {
    return toPrivateUrl(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map(rewriteGoogleUrls) as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, field]) => [key, rewriteGoogleUrls(field)]),
    ) as T;
  }
  return value;
}

export function videoThumbnail(videoId: string, quality: 'mq' | 'hq' = 'hq'): string {
  return `/vi/${videoId}/${quality}default.jpg`;
}

export function largestImage(images: { url: string; width: number }[] | undefined): string {
  if (!images?.length) {
    return '';
  }
  return images.reduce((largest, image) => (image.width > largest.width ? image : largest)).url;
}
