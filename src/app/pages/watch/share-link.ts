/** A link to this video in invi; with seconds, it starts there, like YouTube's `t` parameter. */
export function watchLink(origin: string, videoId: string, seconds = 0): string {
  const wholeSeconds = Math.floor(seconds);
  const time = wholeSeconds > 0 ? `&t=${wholeSeconds}s` : '';
  return `${origin}/watch?v=${videoId}${time}`;
}
