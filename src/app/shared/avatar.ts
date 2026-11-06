import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { initialsOf } from './format';

/** A round channel picture; shows the name's initials when there is none or it fails to load. */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showImage()) {
      <img [src]="src()" alt="" loading="lazy" (error)="failed.set(true)" />
    } @else {
      <span>{{ initials() }}</span>
    }
  `,
  styles: `
    :host { display: inline-grid; place-items: center; flex: none; width: var(--size, 2.25rem);
            height: var(--size, 2.25rem); border-radius: 50%; overflow: hidden;
            background: var(--surface-strong); color: var(--text-muted); font-weight: 600;
            font-size: calc(var(--size, 2.25rem) * .38); }
    img { width: 100%; height: 100%; object-fit: cover; }
  `,
})
export class Avatar {
  readonly src = input('');
  readonly name = input('');

  protected readonly failed = linkedSignal({ source: this.src, computation: () => false });
  protected readonly showImage = computed(() => !!this.src() && !this.failed());
  protected readonly initials = computed(() => initialsOf(this.name()));
}
