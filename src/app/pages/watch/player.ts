import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
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
import { CaptionChoice, PlayerControls } from './player-controls';
import { autoQuality, closestQuality, savedQuality, saveQuality } from './quality';
import { parseStoryboard, StoryboardFrame } from './storyboard';
import { speeds, VideoState } from './video-state';

type ShakaPlayer = shakaNamespace.Player;
type TextTrack = shakaNamespace.extern.TextTrack;

/** Plays a video through Invidious' DASH manifest (adaptive quality), or its 360p file as a fallback. */
@Component({
  selector: 'app-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlayerControls],
  host: {
    '(document:keydown)': 'onKey($event)',
    '(document:fullscreenchange)': 'onFullscreenChange()',
  },
  template: `
    <video #video playsinline autoplay [poster]="poster()" (ended)="ended.emit()"
           (timeupdate)="rememberPosition()"></video>
    @if (problem(); as problem) {
      <p class="problem">{{ problem }}</p>
    } @else if (state(); as state) {
      <app-player-controls [state]="state" [frames]="frames()" [qualities]="qualities()" [quality]="quality()"
                           [captions]="captions()" [caption]="caption()" [fullscreen]="fullscreen()"
                           (qualityChange)="chooseQuality($event)" (captionChange)="chooseCaption($event)"
                           (fullscreenToggle)="toggleFullscreen()" />
    }
  `,
  styleUrl: './player.css',
})
export class Player {
  readonly video = input.required<Video>();
  readonly startAt = input(0);
  readonly ended = output<void>();

  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly http = inject(HttpClient);
  private readonly element = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly controls = viewChild(PlayerControls);

  protected readonly state = signal<VideoState | null>(null);
  protected readonly poster = signal('');
  protected readonly problem = signal<string | null>(null);
  protected readonly qualities = signal<number[]>([]);
  protected readonly quality = signal(autoQuality);
  protected readonly captions = signal<CaptionChoice[]>([]);
  protected readonly caption = signal(-1);
  protected readonly frames = signal<StoryboardFrame[]>([]);
  protected readonly fullscreen = signal(false);

  private player: ShakaPlayer | null = null;
  private textTracks: TextTrack[] = [];
  private lastSavedSecond = 0;

  constructor() {
    effect((onCleanup) => {
      const element = this.element().nativeElement;
      const state = new VideoState(element);
      this.state.set(state);
      onCleanup(() => state.dispose());
    });

    effect((onCleanup) => {
      const video = this.video();
      const element = this.element().nativeElement;
      const startAt = untracked(this.startAt) || savedPosition(video.videoId);
      let cancelled = false;

      this.poster.set(videoThumbnail(video.videoId, 'hq'));
      this.qualities.set([]);
      this.quality.set(autoQuality);
      this.captions.set([]);
      this.caption.set(-1);
      this.frames.set([]);
      this.problem.set(null);
      setMediaSession(video);
      this.play(video, element, startAt, () => cancelled);
      const storyboard = this.loadStoryboard(video.videoId);

      onCleanup(() => {
        cancelled = true;
        storyboard.unsubscribe();
        this.player?.destroy();
        this.player = null;
      });
    });

    inject(DestroyRef).onDestroy(() => {
      if (document.fullscreenElement === this.host) {
        document.exitFullscreen().catch(() => undefined);
      }
    });
  }

  seekTo(seconds: number): void {
    const element = this.element().nativeElement;
    element.currentTime = seconds;
    element.play().catch(() => undefined);
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /** From the menu: applies the quality and keeps it for the next videos. */
  protected chooseQuality(height: number): void {
    saveQuality(height);
    this.applyQuality(height);
  }

  protected chooseCaption(index: number): void {
    this.caption.set(index);
    this.player?.selectTextTrack(this.textTracks[index] ?? null);
  }

  toggleFullscreen(): void {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (this.host.requestFullscreen) {
      this.host
        .requestFullscreen()
        .then(() => lockLandscape(this.element().nativeElement))
        .catch(() => undefined);
    } else {
      // iPhones only allow the video element itself to go full screen.
      (this.element().nativeElement as HTMLVideoElement & { webkitEnterFullscreen?: () => void })
        .webkitEnterFullscreen?.();
    }
  }

  /** YouTube's shortcuts: space/k, j/l, arrows, m, f, c, < and >, and 0–9 to jump. */
  protected onKey(event: KeyboardEvent): void {
    const state = this.state();
    if (!state || this.problem() || event.ctrlKey || event.metaKey || event.altKey || typingIn(event.target)) {
      return;
    }
    const pressedButton = event.target instanceof HTMLButtonElement && (event.key === ' ' || event.key === 'Enter');
    if (pressedButton) {
      return;
    }
    const action = keyAction(event.key, state, this);
    if (action) {
      event.preventDefault();
      action();
      this.controls()?.reveal();
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

  protected onFullscreenChange(): void {
    this.fullscreen.set(document.fullscreenElement === this.host);
  }

  /** For the c key: the first caption track, or off again. */
  toggleCaptions(): void {
    if (this.textTracks.length) {
      this.chooseCaption(this.caption() >= 0 ? -1 : 0);
    }
  }

  private applyQuality(height: number): void {
    const player = this.player;
    if (!player) {
      return;
    }
    this.quality.set(height);
    player.configure({ abr: { enabled: height === autoQuality } });
    const track = player.getVariantTracks().find((variant) => variant.height === height);
    if (track) {
      player.selectVariantTrack(track, true);
    }
  }

  private loadStoryboard(videoId: string) {
    return this.http
      .get(`/api/v1/storyboards/${videoId}?height=90`, { responseType: 'text' })
      .subscribe({ next: (vtt) => this.frames.set(parseStoryboard(vtt)), error: () => undefined });
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
      this.textTracks = await Promise.all(
        video.captions.map((caption) =>
          player.addTextTrackAsync(caption.url, caption.language_code, 'subtitles', 'text/vtt', undefined, caption.label),
        ),
      );
      player.selectTextTrack(null);
      this.captions.set(video.captions.map((caption) => ({ label: caption.label })));
      const qualities = distinctHeights(player.getVariantTracks());
      this.qualities.set(qualities);
      // A quality chosen before replaces Auto, or the closest this video has.
      const wanted = savedQuality();
      if (wanted !== autoQuality) {
        this.applyQuality(closestQuality(qualities, wanted) ?? autoQuality);
      }
    } catch {
      if (isCancelled()) {
        return;
      }
      this.player?.destroy();
      this.player = null;
      this.textTracks = [];
      if (!playFile(video, element, startAt)) {
        this.problem.set('This video can’t be played.');
      }
    }
  }
}

function keyAction(key: string, state: VideoState, player: Player): (() => void) | null {
  // The element, not the signal: two quick presses come before the browser reports the first change.
  const speedIndex = speeds.indexOf(state.element.playbackRate);
  switch (key) {
    case ' ':
    case 'k':
      return () => state.togglePlay();
    case 'j':
      return () => state.seekBy(-10);
    case 'l':
      return () => state.seekBy(10);
    case 'ArrowLeft':
      return () => state.seekBy(-5);
    case 'ArrowRight':
      return () => state.seekBy(5);
    case 'ArrowUp':
      return () => state.setVolume(state.volume() + 0.1);
    case 'ArrowDown':
      return () => state.setVolume(state.volume() - 0.1);
    case 'm':
      return () => state.toggleMute();
    case 'f':
      return () => player.toggleFullscreen();
    case 'c':
      return () => player.toggleCaptions();
    case '<':
      return () => state.setSpeed(speeds[Math.max(speedIndex - 1, 0)]);
    case '>':
      return () => state.setSpeed(speeds[Math.min(speedIndex + 1, speeds.length - 1)]);
  }
  if (/^[0-9]$/.test(key)) {
    return () => state.seekTo((Number(key) / 10) * state.duration());
  }
  return null;
}

function typingIn(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/** Phones turn sideways for a wide video in full screen; elsewhere this quietly does nothing. */
function lockLandscape(element: HTMLVideoElement): void {
  const orientation = screen.orientation as ScreenOrientation & { lock?: (type: string) => Promise<void> };
  if (element.videoWidth > element.videoHeight) {
    orientation.lock?.('landscape').catch(() => undefined);
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
