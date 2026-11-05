import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, retry, throwError, timer } from 'rxjs';
import { rewriteGoogleUrls } from './private-urls';
import {
  Channel,
  ChannelPlaylists,
  ChannelVideos,
  ChannelVideoTab,
  CommentPage,
  Feed,
  ListItem,
  Playlist,
  PlaylistItem,
  ResolvedUrl,
  SearchType,
  Subscription,
  Suggestions,
  Video,
  VideoItem,
} from './types';

type QueryParams = Record<string, string | number | undefined>;

// Invidious answers 500 to 504 while Companion restarts or YouTube hiccups; a moment later it works.
const passingFaults = [500, 502, 503, 504];
const retryDelaysMs = [1500, 3000];

/** Retries a request that failed with a passing server fault; other errors come through at once. */
export function retryPassingFaults<T>(request: Observable<T>): Observable<T> {
  return request.pipe(
    retry({
      count: retryDelaysMs.length,
      delay: (error, attempt) =>
        error instanceof HttpErrorResponse && passingFaults.includes(error.status)
          ? timer(retryDelaysMs[attempt - 1])
          : throwError(() => error),
    }),
  );
}

/** Invidious' /api/v1, reached through the container's proxy on this same origin. */
@Injectable({ providedIn: 'root' })
export class InvidiousApi {
  private readonly http = inject(HttpClient);

  trending(): Observable<VideoItem[]> {
    return this.get('trending');
  }

  popular(): Observable<VideoItem[]> {
    return this.get('popular');
  }

  search(query: string, page: number, type: SearchType): Observable<ListItem[]> {
    return this.get('search', { q: query, page, type });
  }

  suggestions(query: string): Observable<string[]> {
    return this.get<Suggestions>('search/suggestions', { q: query }).pipe(map((result) => result.suggestions));
  }

  video(id: string): Observable<Video> {
    return this.get(`videos/${id}`, { local: 'true' });
  }

  comments(videoId: string, continuation?: string): Observable<CommentPage> {
    return this.get(`comments/${videoId}`, { continuation });
  }

  channel(id: string): Observable<Channel> {
    return this.get(`channels/${id}`);
  }

  channelVideos(id: string, tab: ChannelVideoTab, continuation?: string): Observable<ChannelVideos> {
    return this.get(`channels/${id}/${tab}`, { continuation });
  }

  channelPlaylists(id: string, continuation?: string): Observable<ChannelPlaylists> {
    return this.get(`channels/${id}/playlists`, { continuation });
  }

  /** The channel id behind a handle such as `@name`. */
  resolveHandle(handle: string): Observable<string | undefined> {
    return this.get<ResolvedUrl>('resolveurl', { url: `https://www.youtube.com/${handle}` }).pipe(
      map((resolved) => resolved.ucid),
    );
  }

  playlist(id: string, page: number): Observable<Playlist> {
    // Playlists made on Invidious (IV…) can be private, so they are read with the token.
    const path = id.startsWith('IV') ? `auth/playlists/${id}` : `playlists/${id}`;
    return this.get(path, { page });
  }

  feed(page: number): Observable<Feed> {
    return this.get('auth/feed', { page });
  }

  subscriptions(): Observable<Subscription[]> {
    return this.get('auth/subscriptions');
  }

  subscribe(channelId: string): Observable<unknown> {
    return this.http.post(`/api/v1/auth/subscriptions/${channelId}`, null);
  }

  unsubscribe(channelId: string): Observable<unknown> {
    return this.http.delete(`/api/v1/auth/subscriptions/${channelId}`);
  }

  /** Watched video ids, newest first. */
  history(page: number): Observable<string[]> {
    return this.get('auth/history', { page });
  }

  markWatched(videoId: string): Observable<unknown> {
    return this.http.post(`/api/v1/auth/history/${videoId}`, null);
  }

  myPlaylists(): Observable<PlaylistItem[]> {
    return this.get('auth/playlists');
  }

  revokeToken(): Observable<unknown> {
    return this.http.post('/api/v1/auth/tokens/unregister', {});
  }

  private get<T>(path: string, query: QueryParams = {}): Observable<T> {
    const definedQuery = Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined));
    const params = new HttpParams({ fromObject: definedQuery as Record<string, string | number> });
    return retryPassingFaults(this.http.get<T>(`/api/v1/${path}`, { params })).pipe(map(rewriteGoogleUrls));
  }
}
