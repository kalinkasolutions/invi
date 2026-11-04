import { signal } from '@angular/core';
import { readStored, writeStored } from '../../core/storage';

const speedKey = 'invi.speed';
export const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

/** The <video> element's state as signals, and the few actions the controls need. */
export class VideoState {
  readonly playing = signal(false);
  readonly waiting = signal(false);
  readonly currentTime = signal(0);
  readonly duration = signal(0);
  readonly bufferedEnd = signal(0);
  readonly volume = signal(1);
  readonly muted = signal(false);
  readonly speed = signal(1);

  private readonly stopListening: () => void;

  constructor(readonly element: HTMLVideoElement) {
    const update = () => this.readElement();
    const events = ['play', 'pause', 'playing', 'waiting', 'timeupdate', 'durationchange', 'progress', 'volumechange', 'ratechange', 'seeking', 'emptied'];
    events.forEach((name) => element.addEventListener(name, update));
    // A new source resets the speed, so the remembered one is put back each time.
    const restoreSpeed = () => (element.playbackRate = savedSpeed());
    element.addEventListener('loadedmetadata', restoreSpeed);
    this.stopListening = () => {
      events.forEach((name) => element.removeEventListener(name, update));
      element.removeEventListener('loadedmetadata', restoreSpeed);
    };
  }

  dispose(): void {
    this.stopListening();
  }

  togglePlay(): void {
    if (this.element.paused) {
      this.element.play().catch(() => undefined);
    } else {
      this.element.pause();
    }
  }

  seekTo(seconds: number): void {
    this.element.currentTime = Math.min(Math.max(seconds, 0), this.duration() || seconds);
  }

  seekBy(seconds: number): void {
    this.seekTo(this.element.currentTime + seconds);
  }

  setVolume(volume: number): void {
    this.element.volume = Math.min(Math.max(volume, 0), 1);
    this.element.muted = this.element.volume === 0;
  }

  toggleMute(): void {
    this.element.muted = !this.element.muted;
  }

  setSpeed(speed: number): void {
    this.element.playbackRate = speed;
    writeStored(speedKey, speed === 1 ? null : String(speed));
  }

  private readElement(): void {
    const element = this.element;
    this.playing.set(!element.paused);
    this.waiting.set(element.readyState < HTMLMediaElement.HAVE_FUTURE_DATA && !element.paused);
    this.currentTime.set(element.currentTime);
    this.duration.set(Number.isFinite(element.duration) ? element.duration : 0);
    this.bufferedEnd.set(bufferedEndAt(element.buffered, element.currentTime));
    this.volume.set(element.volume);
    this.muted.set(element.muted);
    this.speed.set(element.playbackRate);
  }
}

function savedSpeed(): number {
  const speed = Number(readStored(speedKey));
  return speeds.includes(speed) ? speed : 1;
}

/** End of the buffered range the playhead is in; other ranges don't help playback. */
function bufferedEndAt(ranges: TimeRanges, time: number): number {
  for (let index = 0; index < ranges.length; index++) {
    if (ranges.start(index) <= time && time <= ranges.end(index)) {
      return ranges.end(index);
    }
  }
  return time;
}
