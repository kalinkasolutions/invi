import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type shakaNamespace from 'shaka-player/dist/shaka-player.compiled-es2021';
import { videoThumbnail } from '../../api/private-urls';
import { Video } from '../../api/types';
import { readStored, writeStored } from '../../core/storage';
import { originalAudioTrack } from './audio-tracks';

type ShakaPlayer = shakaNamespace.Player;

const autoQuality = 0;

/** Plays a video through Invidious' DASH manifest (adaptive quality), or its 360p file as a fallback. */
@Component({
  selector: 'app-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <video #video [controls]="!problem()" playsinline autoplay [poster]="poster()" (ended)="ended.emit()"
           (timeupdate)="rememberPosition()"></video>
    @if (problem(); as problem) {
      <p class="problem">{{ problem }}</p>
    }
    @if (qualities().length > 1) {
      <label class="quality">
        <span class="visually-hidden">Quality</span>
        <select (change)="chooseQuality($any($event.target).value)">
          <option [value]="0">Auto</option>
          @for (height of qualities(); track height) {
            <option [value]="height">{{ height }}p</option>
          }
        </select>
      </label>
    }
  `,
  styleUrl: './player.css',
})
export class Player {
  readonly video = input.required<Video>();
  readonly startAt = input(0);
  readonly ended = output<void>();

  private readonly element = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  protected readonly qualities = signal<number[]>([]);
  protected readonly poster = signal('');
  protected readonly problem = signal<string | null>(null);
  private player: ShakaPlayer | null = null;
  private lastSavedSecond = 0;

  constructor() {
    effect((onCleanup) => {
      const video = this.video();
      const element = this.element().nativeElement;
      const startAt = untracked(this.startAt) || savedPosition(video.videoId);
      let cancelled = false;

      this.poster.set(videoThumbnail(video.videoId, 'hq'));
      this.qualities.set([]);
      this.problem.set(null);
      setMediaSession(video);
      this.play(video, element, startAt, () => cancelled);

      onCleanup(() => {
        cancelled = true;
        this.player?.destroy();
        this.player = null;
      });
    });
  }

  seekTo(seconds: number): void {
    const element = this.element().nativeElement;
    element.currentTime = seconds;
    element.play().catch(() => undefined);
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  protected chooseQuality(value: string): void {
    const player = this.player;
    if (!player) {
      return;
    }
    const height = Number(value);
    player.configure({ abr: { enabled: height === autoQuality } });
    if (height !== autoQuality) {
      const track = player.getVariantTracks().find((variant) => variant.height === height);
      if (track) {
        player.selectVariantTrack(track, true);
      }
    }
  }

  protected rememberPosition(): void {
    const element = this.element().nativeElement;
    const second = Math.floor(element.currentTime);
    if (Math.abs(second - this.lastSavedSecond) < 5) {
      return;
    }
    this.lastSavedSecond = second;
    const nearlyOver = element.duration - second < 30;
    writeStored(positionKey(this.video().videoId), second > 10 && !nearlyOver ? String(second) : null);
  }

  private async play(video: Video, element: HTMLVideoElement, startAt: number, isCancelled: () => boolean) {
    // Invidious Companion gives no HLS link for live streams, and their DASH manifest is empty.
    if (video.liveNow && !video.hlsUrl) {
      this.problem.set('Live streams can’t be played: your Invidious server gives no stream for them.');
      return;
    }
    try {
      const shaka = (await import('shaka-player/dist/shaka-player.compiled-es2021')).default;
      if (isCancelled()) {
        return;
      }
      if (!shaka.Player.isBrowserSupported()) {
        throw new Error('No adaptive streaming in this browser');
      }
      const player = new shaka.Player();
      this.player = player;
      await player.attach(element);
      // Auto quality stays at the player's size: no 4K for a phone screen.
      // Audio starts in the original language, not an AI dub matching the browser's language.
      player.configure({
        streaming: { bufferingGoal: 30 },
        abr: { restrictToElementSize: true },
        preferredAudio: [{ role: 'main' }],
      });
      await player.load(manifestUrl(video), startAt || null);
      if (isCancelled()) {
        return;
      }
      const original = originalAudioTrack(player.getAudioTracks());
      if (original && !original.active) {
        player.selectAudioTrack(original);
      }
      await Promise.all(
        video.captions.map((caption) =>
          player.addTextTrackAsync(caption.url, caption.language_code, 'subtitles', 'text/vtt', undefined, caption.label),
        ),
      );
      this.qualities.set(distinctHeights(player.getVariantTracks()));
    } catch {
      if (isCancelled()) {
        return;
      }
      this.player?.destroy();
      this.player = null;
      if (!playFile(video, element, startAt)) {
        this.problem.set('This video can’t be played.');
      }
    }
  }
}

function manifestUrl(video: Video): string {
  return video.hlsUrl
    ? video.hlsUrl
    : `/api/manifest/dash/id/${video.videoId}?local=true&unique_res=1`;
}

function playFile(video: Video, element: HTMLVideoElement, startAt: number): boolean {
  const file = video.formatStreams.at(-1);
  if (!file) {
    return false;
  }
  element.src = file.url;
  element.currentTime = startAt;
  element.play().catch(() => undefined);
  return true;
}

function distinctHeights(tracks: { height: number | null }[]): number[] {
  const heights = tracks.map((track) => track.height).filter((height): height is number => !!height);
  return [...new Set(heights)].sort((a, b) => b - a);
}

function positionKey(videoId: string): string {
  return `invi.position.${videoId}`;
}

function savedPosition(videoId: string): number {
  return Number(readStored(positionKey(videoId)) ?? 0);
}

/** Title and picture on the lock screen and in the notification shade. */
function setMediaSession(video: Video): void {
  if (!('mediaSession' in navigator)) {
    return;
  }
  navigator.mediaSession.metadata = new MediaMetadata({
    title: video.title,
    artist: video.author,
    artwork: [{ src: new URL(videoThumbnail(video.videoId, 'hq'), location.origin).href }],
  });
}
