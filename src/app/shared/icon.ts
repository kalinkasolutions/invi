import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const paths = {
  trending: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  subscriptions: 'M5 7h14M7 3h10M3 11h18v10H3zm7.5 3v4l3.5-2z',
  library: 'M4 4v16M9 4v16M14 4.5l6 15',
  search: 'M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM21 21l-5.2-5.2',
  close: 'M6 6l12 12M18 6 6 18',
  back: 'M15 18l-6-6 6-6',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3',
  playlist: 'M3 6h12M3 12h12M3 18h7M17 14v6l4-3z',
  check: 'M5 12.5l4.5 4.5L19 7',
  chevron: 'M6 9l6 6 6-6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  play: 'M7 4.5v15l12-7.5z',
  pause: 'M8 5v14M16 5v14',
  volume: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
  muted: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 10l5 5M21 10l-5 5',
  captions: 'M3 5h18v14H3zM10.5 10a2.5 2.5 0 1 0 0 4M17.5 10a2.5 2.5 0 1 0 0 4',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4',
  pip: 'M3 5h18v14H3zM12 12h7v5h-7z',
  fullscreen: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  'fullscreen-exit': 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5',
} as const;

export type IconName = keyof typeof paths;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="path()" /></svg>`,
  styles: `
    :host { display: inline-flex; width: 1.5rem; height: 1.5rem; flex: none; }
    svg { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 1.8;
          stroke-linecap: round; stroke-linejoin: round; }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  protected readonly path = computed(() => paths[this.name()]);
}
