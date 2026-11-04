import { inject } from '@angular/core';
import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';
import { Auth } from './core/auth';

/** Matches `/@handle`, the way YouTube links to channels. */
function channelHandle(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments.length === 1 && segments[0].path.startsWith('@')) {
    return { consumed: segments, posParams: { id: segments[0] } };
  }
  return null;
}

// The paths copy YouTube's, so a YouTube link with its host swapped opens here.
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => (inject(Auth).signedIn() ? '/feed/subscriptions' : '/feed/trending'),
  },
  {
    path: 'feed/trending',
    title: 'Trending – invi',
    loadComponent: () => import('./pages/home-page').then((m) => m.HomePage),
  },
  { path: 'results', loadComponent: () => import('./pages/search-page').then((m) => m.SearchPage) },
  { path: 'watch', loadComponent: () => import('./pages/watch/watch-page').then((m) => m.WatchPage) },
  { path: 'shorts/:id', redirectTo: ({ params }) => `/watch?v=${params['id']}` },
  { path: 'channel/:id', loadComponent: () => import('./pages/channel-page').then((m) => m.ChannelPage) },
  { matcher: channelHandle, loadComponent: () => import('./pages/channel-page').then((m) => m.ChannelPage) },
  { path: 'playlist', loadComponent: () => import('./pages/playlist-page').then((m) => m.PlaylistPage) },
  {
    path: 'feed/subscriptions',
    title: 'Subscriptions – invi',
    loadComponent: () => import('./pages/subscriptions-page').then((m) => m.SubscriptionsPage),
  },
  {
    path: 'feed/library',
    title: 'Library – invi',
    loadComponent: () => import('./pages/library-page').then((m) => m.LibraryPage),
  },
  {
    path: 'feed/history',
    title: 'History – invi',
    loadComponent: () => import('./pages/history-page').then((m) => m.HistoryPage),
  },
  { path: 'auth/callback', loadComponent: () => import('./pages/auth-callback').then((m) => m.AuthCallback) },
  { path: '**', redirectTo: '' },
];
