import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SearchBox } from './search-box';
import { Icon, IconName } from './shared/icon';

const sections: { path: string; label: string; icon: IconName; exact: boolean }[] = [
  { path: '/feed/subscriptions', label: 'Subscriptions', icon: 'subscriptions', exact: false },
  { path: '/feed/trending', label: 'Trending', icon: 'trending', exact: false },
  { path: '/feed/library', label: 'Library', icon: 'library', exact: false },
];

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SearchBox, Icon],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly sections = sections;
}
