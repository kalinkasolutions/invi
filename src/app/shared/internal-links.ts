const youtubeHost = /^(?:www\.|m\.|music\.)?youtube\.com$/;
const appPaths = /^\/(watch|channel\/|playlist|results|shorts\/|@)/;

/** The app's own path for a link in a description or comment, or null when it leads elsewhere. */
export function toInternalPath(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href, 'https://www.youtube.com');
  } catch {
    return null;
  }
  const isRelative = href.startsWith('/') && !href.startsWith('//');

  if (url.hostname === 'youtu.be') {
    const params = new URLSearchParams(url.search);
    params.set('v', url.pathname.slice(1));
    return `/watch?${params}`;
  }
  if (!isRelative && !youtubeHost.test(url.hostname)) {
    return null;
  }
  if (url.pathname.startsWith('/hashtag/')) {
    const tag = decodeURIComponent(url.pathname.slice('/hashtag/'.length));
    return `/results?search_query=${encodeURIComponent('#' + tag)}`;
  }
  if (url.pathname === '/search') {
    return `/results?search_query=${encodeURIComponent(url.searchParams.get('q') ?? '')}`;
  }
  return appPaths.test(url.pathname) ? url.pathname + url.search : null;
}
