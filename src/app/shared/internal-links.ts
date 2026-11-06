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

const youtubeLinkStart = /^(https?:\/\/)?((www|m|music)\.)?(youtube\.com|youtu\.be)\//i;

/** What was typed into the search box, when it is a YouTube link: the app's own page for it. */
export function pageForTypedLink(typed: string): string | null {
  const text = typed.trim();
  if (!youtubeLinkStart.test(text)) {
    return null;
  }
  return toInternalPath(/^https?:\/\//i.test(text) ? text : `https://${text}`);
}
