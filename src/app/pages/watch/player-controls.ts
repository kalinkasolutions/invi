import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Icon } from '../../shared/icon';
import { formatDuration } from '../../shared/format';
import { frameAt, StoryboardFrame } from './storyboard';
import { speeds, VideoState } from './video-state';

export interface CaptionChoice {
  label: string;
}

type Menu = 'settings' | 'captions' | null;

const hideAfterMs = 2500;
const doubleTapMs = 300;
const skipSeconds = 5;

/** The player's own controls: a timeline with preview thumbnails, and the buttons below it. */
@Component({
  selector: 'app-player-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: {
    '[class.visible]': 'visible()',
    '(pointermove)': 'onPointerMove($event)',
  },
  templateUrl: './player-controls.html',
  styleUrl: './player-controls.css',
})
export class PlayerControls {
  readonly state = input.required<VideoState>();
  readonly frames = input<StoryboardFrame[]>([]);
  readonly qualities = input<number[]>([]);
  readonly quality = input(0);
  readonly captions = input<CaptionChoice[]>([]);
  readonly caption = input(-1);
  readonly fullscreen = input(false);
  readonly qualityChange = output<number>();
  readonly captionChange = output<number>();
  readonly fullscreenToggle = output<void>();

  protected readonly speeds = speeds;
  protected readonly pictureInPicture = 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;
  protected readonly menu = signal<Menu>(null);
  private readonly shownByUser = signal(true);
  private readonly scrubTime = signal<number | null>(null);
  private readonly hoverTime = signal<number | null>(null);
  private readonly hoverX = signal(0);
  protected readonly pointerOnBar = signal(false);

  private readonly timeline = viewChild.required<ElementRef<HTMLElement>>('timeline');
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private hideTimer?: ReturnType<typeof setTimeout>;
  private tapTimer?: ReturnType<typeof setTimeout>;
  private lastPointerType = '';

  // Paused, scrubbing, pointed at or with a menu open, the controls stay; while playing they fade after a while.
  protected readonly visible = computed(
    () =>
      this.shownByUser() ||
      !this.state().playing() ||
      this.menu() !== null ||
      this.scrubTime() !== null ||
      this.pointerOnBar(),
  );
  protected readonly shownTime = computed(() => this.scrubTime() ?? this.state().currentTime());
  protected readonly playedPercent = computed(() => percentOf(this.shownTime(), this.state().duration()));
  protected readonly bufferedPercent = computed(() => percentOf(this.state().bufferedEnd(), this.state().duration()));
  protected readonly timeText = computed(
    () => `${clockTime(this.shownTime())} / ${clockTime(this.state().duration())}`,
  );

  /** Where the preview sits above the timeline, and which thumbnail it shows. */
  protected readonly preview = computed(() => {
    const time = this.scrubTime() ?? this.hoverTime();
    if (time === null) {
      return null;
    }
    const frame = frameAt(this.frames(), time);
    const width = frame?.width ?? 60;
    const barWidth = this.host.clientWidth;
    const left = Math.min(Math.max(this.hoverX() - width / 2, 8), barWidth - width - 8);
    return { left, frame, time: clockTime(time) };
  });

  constructor() {
    // Starting to play starts the countdown; otherwise the controls would stay until the first touch.
    effect(() => {
      if (this.state().playing()) {
        untracked(() => this.reveal());
      }
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.hideTimer);
      clearTimeout(this.tapTimer);
    });
  }

  /** Shows the controls and starts the countdown to hide them again. */
  reveal(): void {
    this.shownByUser.set(true);
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.shownByUser.set(false), hideAfterMs);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (event.pointerType === 'mouse') {
      this.reveal();
    }
  }

  /** A click plays or pauses; on touch a tap shows or hides the controls. A double tap or click skips. */
  protected onSurfaceTap(event: PointerEvent): void {
    this.lastPointerType = event.pointerType;
    if (this.menu()) {
      this.menu.set(null);
      return;
    }
    if (event.pointerType === 'mouse') {
      this.state().togglePlay();
      this.reveal();
      return;
    }
    if (this.tapTimer) {
      clearTimeout(this.tapTimer);
      this.tapTimer = undefined;
      this.skip(event);
      return;
    }
    this.tapTimer = setTimeout(() => {
      this.tapTimer = undefined;
      if (this.visible()) {
        clearTimeout(this.hideTimer);
        this.shownByUser.set(false);
      } else {
        this.reveal();
      }
    }, doubleTapMs);
  }

  protected startScrub(event: PointerEvent): void {
    this.timeline().nativeElement.setPointerCapture(event.pointerId);
    this.scrubTime.set(this.timeAt(event));
    this.menu.set(null);
  }

  protected moveOverTimeline(event: PointerEvent): void {
    const time = this.timeAt(event);
    if (this.scrubTime() !== null) {
      this.scrubTime.set(time);
    } else if (event.pointerType === 'mouse') {
      this.hoverTime.set(time);
    }
  }

  protected endScrub(event: PointerEvent): void {
    const time = this.scrubTime();
    if (time !== null) {
      this.state().seekTo(time);
    }
    this.scrubTime.set(null);
    if (event.pointerType !== 'mouse') {
      this.hoverTime.set(null);
    }
    this.reveal();
  }

  protected cancelScrub(): void {
    this.scrubTime.set(null);
    this.hoverTime.set(null);
  }

  protected leaveTimeline(): void {
    if (this.scrubTime() === null) {
      this.hoverTime.set(null);
    }
  }

  protected toggleMenu(menu: Menu): void {
    this.menu.set(this.menu() === menu ? null : menu);
  }

  protected chooseSpeed(speed: number): void {
    this.state().setSpeed(speed);
    this.menu.set(null);
  }

  protected chooseQuality(quality: number): void {
    this.qualityChange.emit(quality);
    this.menu.set(null);
  }

  protected chooseCaption(index: number): void {
    this.captionChange.emit(index);
    this.menu.set(null);
  }

  protected togglePictureInPicture(): void {
    const element = this.state().element;
    const request = document.pictureInPictureElement
      ? document.exitPictureInPicture()
      : element.requestPictureInPicture();
    request.catch(() => undefined);
  }

  protected setVolume(event: Event): void {
    this.state().setVolume(Number((event.target as HTMLInputElement).value));
  }

  // Phones fire dblclick after a double tap too; that one was already handled in onSurfaceTap.
  protected onDoubleClick(event: MouseEvent): void {
    if (this.lastPointerType === 'mouse') {
      this.skip(event);
    }
  }

  /** Forward, or back when it lands on the left part of the video. */
  private skip(event: MouseEvent): void {
    const backwards = event.offsetX / this.host.clientWidth < 0.4;
    this.state().seekBy(backwards ? -skipSeconds : skipSeconds);
    this.reveal();
  }

  private timeAt(event: PointerEvent): number {
    const timeline = this.timeline().nativeElement.getBoundingClientRect();
    const fraction = Math.min(Math.max((event.clientX - timeline.left) / timeline.width, 0), 1);
    this.hoverX.set(event.clientX - this.host.getBoundingClientRect().left);
    return fraction * this.state().duration();
  }
}

function percentOf(part: number, whole: number): number {
  return whole > 0 ? Math.min((part / whole) * 100, 100) : 0;
}

function clockTime(seconds: number): string {
  return formatDuration(Math.floor(seconds)) || '0:00';
}
