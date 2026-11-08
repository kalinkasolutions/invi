import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed } from '@angular/core';

interface BuildInfo {
  version: string;
  commit: string;
}

const repository = 'https://github.com/kalinkasolutions/invi';

@Component({
  selector: 'app-about-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>About invi</h1>
    <p class="intro">A small, mobile-first frontend for Invidious.</p>
    <dl>
      <dt>Version</dt>
      <dd>
        @if (releaseUrl(); as url) {
          <a [href]="url">{{ version() }}</a>
        } @else {
          {{ version() }}
        }
      </dd>
      <dt>Commit</dt>
      <dd>
        @if (commit(); as commit) {
          <a [href]="repository + '/commit/' + commit"><code>{{ commit.slice(0, 7) }}</code></a>
        } @else {
          unknown
        }
      </dd>
      <dt>Source</dt>
      <dd><a [href]="repository">{{ repository.replace('https://', '') }}</a></dd>
    </dl>
  `,
  styles: `
    h1 { font-size: 1.3rem; margin: 0 0 .25rem; }
    .intro { color: var(--text-muted); margin: 0 0 1.5rem; }
    dl { display: grid; grid-template-columns: auto 1fr; gap: .75rem 1.5rem; margin: 0; }
    dt { color: var(--text-muted); }
    dd { margin: 0; overflow-wrap: anywhere; }
    a { color: var(--link); }
  `,
})
export class AboutPage {
  protected readonly repository = repository;
  private readonly buildInfo = httpResource<BuildInfo>(() => '/build-info.json');

  // A build without the file answers with index.html, which fails to parse: that reads as "unknown".
  protected readonly version = computed(() => (this.buildInfo.hasValue() && this.buildInfo.value().version) || 'unknown');
  protected readonly commit = computed(() => (this.buildInfo.hasValue() && this.buildInfo.value().commit) || '');
  protected readonly releaseUrl = computed(() =>
    /^\d+\.\d+\.\d+$/.test(this.version()) ? `${repository}/releases/tag/${this.version()}` : null,
  );
}
