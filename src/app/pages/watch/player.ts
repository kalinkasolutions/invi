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
import { positionToKeep, WatchPositions } from '../../core/watch-positions';
import { originalAudioTrack } from './audio-tracks';
import { CaptionChoice, PlayerControls } from './player-controls';
import { autoQuality, closestQuality, qualitiesOf, savedQuality, saveQuality, variantWithQuality } from './quality';
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
    '(document:visibilitychange)': 'onVisibilityChange()',
  },
  template: `
    <video #video playsinline autoplay [poster]="poster()" (ended)="ended.emit()"
           (timeupdate)="keepCurrentPosition()" (pause)="keepCurrentPosition(true)"></video>
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
  private readonly positions = inject(WatchPositions);
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
  private reloadedAt: number[] = [];
  private reloading = false;

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
      const requestedStart = untracked(this.startAt);
      let cancelled = false;

      this.poster.set(videoThumbnail(video.videoId, 'hq'));
      this.qualities.set([]);
      this.quality.set(autoQuality);
      this.captions.set([]);
      this.caption.set(-1);
      this.frames.set([]);
      this.problem.set(null);
      const state = untracked(this.state);
      if (state) {
        setMediaSession(video, state);
      }
      this.play(video, element, requestedStart, () => cancelled);
      const storyboard = this.loadStoryboard(video.videoId);

      onCleanup(() => {
        cancelled = true;
        this.keepPosition(video.videoId, true);
        storyboard.unsubscribe();
        this.player?.destroy();
        this.player = null;
      });
    });

    inject(DestroyRef).onDestroy(() => {
      if (document.fullscreenElement === this.host) {
        document.exitFullscreen().catch(() => undefined);
      }
      clearMediaSession();
    });
  }

  seekTo(seconds: number): void {
    const element = this.element().nativeElement;
    element.currentTime = seconds;
    element.play().catch(() => undefined);
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /** From the menu: applies the quality and keeps it for the next videos. */
  protected chooseQuality(quality: number): void {
    saveQuality(quality);
    this.applyQuality(quality);
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

  /** For "watch on YouTube": where the video is now. */
  currentTime(): number {
    return this.element().nativeElement.currentTime;
  }

  pause(): void {
    this.element().nativeElement.pause();
  }

  protected keepCurrentPosition(now = false): void {
    this.keepPosition(this.video().videoId, now);
  }

  /** Every few seconds while playing, and at once on pause or when leaving the video. */
  private keepPosition(videoId: string, now = false): void {
    const element = this.element().nativeElement;
    // A reload or a failed video stands at 0:00 for a while; that must not replace where you were.
    if (!element.duration || this.reloading || this.problem()) {
      return;
    }
    const second = Math.floor(element.currentTime);
    if (!now && Math.abs(second - this.lastSavedSecond) < 5) {
      return;
    }
    this.lastSavedSecond = second;
    this.positions.remember(videoId, positionToKeep(element.currentTime, element.duration), now);
  }

  // With the screen off, the browser runs the page's timers rarely; a longer buffer bridges the gaps.
  protected onVisibilityChange(): void {
    this.player?.configure({ streaming: { bufferingGoal: bufferSeconds() } });
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

  private applyQuality(quality: number): void {
    const player = this.player;
    if (!player) {
      return;
    }
    this.quality.set(quality);
    player.configure({ abr: { enabled: quality === autoQuality } });
    const track = variantWithQuality(player.getVariantTracks(), quality);
    if (track) {
      player.selectVariantTrack(track, true);
    }
  }

  private loadStoryboard(videoId: string) {
    return this.http
      .get(`/api/v1/storyboards/${videoId}?height=90`, { responseType: 'text' })
      .subscribe({ next: (vtt) => this.frames.set(parseStoryboard(vtt)), error: () => undefined });
  }

  private async play(video: Video, element: HTMLVideoElement, requestedStart: number, isCancelled: () => boolean) {
    // Invidious Companion gives no HLS link for live streams, and their DASH manifest is empty.
    if (video.liveNow && !video.hlsUrl) {
      this.problem.set('Live streams can’t be played: your Invidious server gives no stream for them.');
      return;
    }
    const startAt = requestedStart || (await this.positions.startOf(video.videoId));
    if (isCancelled()) {
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
      this.reloadedAt = [];
      await player.attach(element);
      // Auto quality stays at the player's size: no 4K for a phone screen.
      // Audio starts in the original language, not an AI dub matching the browser's language.
      player.configure({
        streaming: { bufferingGoal: bufferSeconds(), retryParameters: patientRetries },
        manifest: { retryParameters: patientRetries },
        abr: { restrictToElementSize: true },
        preferredAudio: [{ role: 'main' }],
      });
      player.addEventListener('error', (event) =>
        this.recover(player, video, (event as unknown as { detail: { severity: number } }).detail, isCancelled),
      );
      await this.load(player, video, startAt, savedQuality());
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

  /** Loads the video into the player at `startAt`, then sets up audio, captions and quality. */
  private async load(player: ShakaPlayer, video: Video, startAt: number, wantedQuality: number): Promise<void> {
    await player.load(manifestUrl(video), startAt || null);
    const original = originalAudioTrack(player.getAudioTracks());
    if (original && !original.active) {
      player.selectAudioTrack(original);
    }
    this.textTracks = await Promise.all(
      video.captions.map((caption) =>
        player.addTextTrackAsync(caption.url, caption.language_code, 'subtitles', 'text/vtt', undefined, caption.label),
      ),
    );
    player.selectTextTrack(this.textTracks[this.caption()] ?? null);
    this.captions.set(video.captions.map((caption) => ({ label: caption.label })));
    const qualities = qualitiesOf(player.getVariantTracks());
    this.qualities.set(qualities);
    // A chosen quality replaces Auto, or the closest this video has.
    if (wantedQuality !== autoQuality) {
      this.applyQuality(closestQuality(qualities, wantedQuality) ?? autoQuality);
    }
  }

  /**
   * A request that still fails after the player's own retries stops playback (Companion answers 500
   * or 503 at times). The video is then loaded again with fresh links where it stopped, at most a few
   * times a minute, so a lasting fault ends with a message instead of a loop of requests.
   */
  private async recover(player: ShakaPlayer, video: Video, error: { severity: number }, isCancelled: () => boolean) {
    if (error.severity !== criticalError || isCancelled() || this.player !== player) {
      return;
    }
    const now = Date.now();
    this.reloadedAt = this.reloadedAt.filter((time) => now - time < 60_000);
    if (this.reloadedAt.length >= maxReloadsPerMinute) {
      this.problem.set('This video keeps failing to load. Try again in a moment.');
      return;
    }
    this.reloadedAt.push(now);
    const element = this.element().nativeElement;
    const resumeAt = element.currentTime;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (isCancelled() || this.player !== player) {
      return;
    }
    this.reloading = true;
    try {
      await this.load(player, video, resumeAt, this.quality());
      element.play().catch(() => undefined);
    } catch (reloadError) {
      this.recover(player, video, reloadError as { severity: number }, isCancelled);
    } finally {
      this.reloading = false;
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

// shaka's own default gives up after two tries a second apart; a busy Companion needs longer.
const patientRetries = { maxAttempts: 5, baseDelay: 1000, backoffFactor: 2, fuzzFactor: 0.5, timeout: 30_000 };
// shaka.util.Error.Severity.CRITICAL: playback has stopped.
const criticalError = 2;
const maxReloadsPerMinute = 3;

function bufferSeconds(): number {
  return document.hidden ? 180 : 30;
}

// Android often shows only "previous" and "next" on the lock screen; here they jump back and forward.
const mediaSessionActions: MediaSessionAction[] = [
  'play',
  'pause',
  'seekbackward',
  'seekforward',
  'seekto',
  'previoustrack',
  'nexttrack',
];
const lockScreenJumpSeconds = 10;

/**
 * Title, picture and buttons on the lock screen and in the notification shade. Without the buttons,
 * playback that the phone paused (a notification sound, a call) can't be resumed from there.
 */
function setMediaSession(video: Video, state: VideoState): void {
  if (!('mediaSession' in navigator)) {
    return;
  }
  navigator.mediaSession.metadata = new MediaMetadata({
    title: video.title,
    artist: video.author,
    artwork: [{ src: new URL(videoThumbnail(video.videoId, 'hq'), location.origin).href }],
  });
  const handlers: Record<string, MediaSessionActionHandler> = {
    play: () => state.element.play().catch(() => undefined),
    pause: () => state.element.pause(),
    seekbackward: (details) => state.seekBy(-(details.seekOffset ?? lockScreenJumpSeconds)),
    seekforward: (details) => state.seekBy(details.seekOffset ?? lockScreenJumpSeconds),
    seekto: (details) => state.seekTo(details.seekTime ?? state.element.currentTime),
    previoustrack: () => state.seekBy(-lockScreenJumpSeconds),
    nexttrack: () => state.seekBy(lockScreenJumpSeconds),
  };
  for (const action of mediaSessionActions) {
    try {
      navigator.mediaSession.setActionHandler(action, handlers[action]);
    } catch {
      // Older browsers don't know every action.
    }
  }
}

function clearMediaSession(): void {
  if (!('mediaSession' in navigator)) {
    return;
  }
  navigator.mediaSession.metadata = null;
  for (const action of mediaSessionActions) {
    try {
      navigator.mediaSession.setActionHandler(action, null);
    } catch {
      // See setMediaSession.
    }
  }
}
