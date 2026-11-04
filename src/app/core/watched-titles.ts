import { VideoItem } from '../api/types';
import { readStored, writeStored } from './storage';

// Invidious keeps only the ids of watched videos. To make history searchable without
// one YouTube lookup per video, the app remembers the titles of what it plays.
const storageKey = 'invi.watched-titles';
const maxEntries = 5000;

type SavedVideo = Pick<VideoItem, 'videoId' | 'title' | 'author' | 'authorId' | 'lengthSeconds'>;

/** Newest first. */
export function watchedTitles(): SavedVideo[] {
  try {
    const saved: SavedVideo[] = JSON.parse(readStored(storageKey) ?? '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function rememberWatched(video: SavedVideo): void {
  const { videoId, title, author, authorId, lengthSeconds } = video;
  const others = watchedTitles().filter((saved) => saved.videoId !== videoId);
  const updated = [{ videoId, title, author, authorId, lengthSeconds }, ...others].slice(0, maxEntries);
  writeStored(storageKey, JSON.stringify(updated));
}

export function searchWatched(videos: SavedVideo[], query: string): SavedVideo[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return videos.filter((video) => {
    const text = `${video.title} ${video.author}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
