import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { Auth } from './auth';
import { readStored, writeStored } from './storage';

const sendEveryMs = 15_000;
const askServerForMs = 1500;

/**
 * Where to continue a video. Signed in, positions go to this app's own small server
 * (server/main.mjs) so they follow you from device to device; this browser keeps a copy either way.
 */
@Injectable({ providedIn: 'root' })
export class WatchPositions {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly lastSent = new Map<string, { at: number; seconds: number | null }>();

  async startOf(videoId: string): Promise<number> {
    const local = Number(readStored(localKey(videoId)) ?? 0);
    if (!this.auth.signedIn()) {
      return local;
    }
    try {
      const saved = this.http.get<{ seconds: number | null }>(serverUrl(videoId)).pipe(timeout(askServerForMs));
      return (await firstValueFrom(saved)).seconds ?? local;
    } catch {
      return local;
    }
  }

  /** `null` forgets the video, as when it was watched to the end. `now` skips the wait between sends. */
  remember(videoId: string, seconds: number | null, now = false): void {
    writeStored(localKey(videoId), seconds === null ? null : String(seconds));
    if (!this.auth.signedIn()) {
      return;
    }
    const last = this.lastSent.get(videoId);
    if (last && last.seconds === seconds) {
      return;
    }
    if (last && !now && Date.now() - last.at < sendEveryMs) {
      return;
    }
    this.lastSent.set(videoId, { at: Date.now(), seconds });
    // keepalive lets the last position out even when the page is being left.
    this.http.put(serverUrl(videoId), { seconds }, { keepalive: true }).subscribe({ error: () => undefined });
  }
}

/** The position worth keeping: none in the first seconds or near the end, so those start fresh. */
export function positionToKeep(seconds: number, duration: number): number | null {
  const second = Math.floor(seconds);
  return second > 10 && duration - second >= 30 ? second : null;
}

function localKey(videoId: string): string {
  return `invi.position.${videoId}`;
}

function serverUrl(videoId: string): string {
  return `/invi-api/positions/${videoId}`;
}
