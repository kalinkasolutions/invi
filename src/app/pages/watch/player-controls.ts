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
import { jumpSeconds, tapZone, TapZone } from './jumps';
import { frameAt, StoryboardFrame } from './storyboard';
import { speeds, VideoState } from './video-state';

export interface CaptionChoice {
  label: string;
}

type Menu = 'settings' | 'captions' | null;

type Direction = 1 | -1;

interface JumpShown {
  id: number;
  direction: Direction;
  text: string;
}

const hideAfterMs = 2500;
const doubleTapMs = 300;
// Taps this close after a jump, on the same side, jump again and further.
const jumpSeriesMs = 800;

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
  private jumpSeries: { direction: Direction; count: number; at: number } | null = null;
  private jumpShownTimer?: ReturnType<typeof setTimeout>;
  private jumpId = 0;
  private readonly jumpShown = signal<JumpShown | null>(null);
  // A list of one, so each jump gets a fresh element and its fade starts over.
  protected readonly jumpsShown = computed(() => {
    const shown = this.jumpShown();
    return shown ? [shown] : [];
  });

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
      clearTimeout(this.jumpShownTimer);
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

  /**
   * A tap or click plays or pauses. A double tap jumps (left and right third) or goes full screen
   * (middle third); taps right after a jump keep jumping. A single tap waits to see whether a second
   * one follows; a mouse has dblclick for that, so a click acts at once.
   */
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
    const zone = tapZone(event.offsetX, this.host.clientWidth);
    if (this.continuesJumps(zone)) {
      this.jump(zone);
      return;
    }
    if (this.tapTimer) {
      clearTimeout(this.tapTimer);
      this.tapTimer = undefined;
      this.onDoubleTap(zone);
      return;
    }
    this.tapTimer = setTimeout(() => {
      this.tapTimer = undefined;
      this.state().togglePlay();
      this.reveal();
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
      this.onDoubleTap(tapZone(event.offsetX, this.host.clientWidth));
    }
  }

  private onDoubleTap(zone: TapZone): void {
    if (zone === 'middle') {
      this.fullscreenToggle.emit();
    } else {
      this.jump(zone);
    }
  }

  private continuesJumps(zone: TapZone): zone is Exclude<TapZone, 'middle'> {
    const series = this.jumpSeries;
    return (
      series !== null &&
      zone !== 'middle' &&
      directionOf(zone) === series.direction &&
      Date.now() - series.at < jumpSeriesMs
    );
  }

  /** 5, 10, 15, 20, then 30 seconds for each jump in a row; the amount shows on that side. */
  private jump(zone: Exclude<TapZone, 'middle'>): void {
    const direction = directionOf(zone);
    const count = this.continuesJumps(zone) ? this.jumpSeries!.count + 1 : 1;
    this.jumpSeries = { direction, count, at: Date.now() };
    const seconds = jumpSeconds(count);
    this.state().seekBy(direction * seconds);
    this.jumpShown.set({ id: ++this.jumpId, direction, text: `${direction > 0 ? '+' : '−'}${seconds}` });
    clearTimeout(this.jumpShownTimer);
    this.jumpShownTimer = setTimeout(() => this.jumpShown.set(null), jumpSeriesMs);
  }

  private timeAt(event: PointerEvent): number {
    const timeline = this.timeline().nativeElement.getBoundingClientRect();
    const fraction = Math.min(Math.max((event.clientX - timeline.left) / timeline.width, 0), 1);
    this.hoverX.set(event.clientX - this.host.getBoundingClientRect().left);
    return fraction * this.state().duration();
  }
}

function directionOf(zone: TapZone): Direction {
  return zone === 'back' ? -1 : 1;
}

function percentOf(part: number, whole: number): number {
  return whole > 0 ? Math.min((part / whole) * 100, 100) : 0;
}

function clockTime(seconds: number): string {
  return formatDuration(Math.floor(seconds)) || '0:00';
}
