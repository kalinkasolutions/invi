/** One preview thumbnail: a cut-out of a sprite image, shown for a stretch of the video. */
export interface StoryboardFrame {
  start: number;
  end: number;
  image: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const cuePattern = /^(\S+) --> (\S+)\s*\n(\S+)#xywh=(\d+),(\d+),(\d+),(\d+)/gm;

/**
 * Reads Invidious' storyboard WebVTT. Image URLs come back as same-origin paths, so they
 * load through this app's proxy whatever host Invidious puts in front of them.
 */
export function parseStoryboard(vtt: string): StoryboardFrame[] {
  return [...vtt.matchAll(cuePattern)].map(([, start, end, url, x, y, width, height]) => ({
    start: vttSeconds(start),
    end: vttSeconds(end),
    image: sameOriginPath(url),
    x: Number(x),
    y: Number(y),
    width: Number(width),
    height: Number(height),
  }));
}

export function frameAt(frames: StoryboardFrame[], seconds: number): StoryboardFrame | undefined {
  return frames.find((frame) => seconds >= frame.start && seconds < frame.end) ?? frames.at(-1);
}

function vttSeconds(timestamp: string): number {
  return timestamp.split(':').reduce((total, part) => total * 60 + Number(part), 0);
}

function sameOriginPath(url: string): string {
  const parsed = new URL(url, 'http://placeholder');
  return parsed.pathname + parsed.search;
}
