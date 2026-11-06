export interface Image {
  url: string;
  width: number;
  height: number;
}

export interface VideoItem {
  type?: 'video' | 'shortVideo'; // shortVideo: Invidious' name for feed videos
  videoId: string;
  title: string;
  author: string;
  authorId: string;
  authorThumbnails?: Image[];
  lengthSeconds?: number;
  viewCount?: number;
  viewCountText?: string;
  publishedText?: string;
  liveNow?: boolean;
  isUpcoming?: boolean;
}

export interface ChannelItem {
  type: 'channel';
  author: string;
  authorId: string;
  authorThumbnails: Image[];
  subCount: number;
  videoCount?: number;
  authorVerified?: boolean;
}

export interface PlaylistItem {
  type: 'playlist';
  title: string;
  playlistId: string;
  playlistThumbnail?: string;
  author: string;
  authorId?: string;
  videoCount: number;
  videos?: { videoId: string }[];
}

export type ListItem = VideoItem | ChannelItem | PlaylistItem;

export interface Caption {
  label: string;
  language_code: string;
  url: string;
}

export interface FormatStream {
  url: string;
  itag: string;
  qualityLabel?: string;
}

export interface Video {
  videoId: string;
  title: string;
  description: string;
  descriptionHtml: string;
  author: string;
  authorId: string;
  authorThumbnails: Image[];
  authorVerified: boolean;
  subCountText: string;
  viewCount: number;
  likeCount: number;
  publishedText: string;
  lengthSeconds: number;
  liveNow: boolean;
  isUpcoming: boolean;
  hlsUrl?: string;
  formatStreams: FormatStream[];
  captions: Caption[];
  recommendedVideos: VideoItem[];
}

export interface Channel {
  author: string;
  authorId: string;
  authorBanners: Image[];
  authorThumbnails: Image[];
  authorVerified: boolean;
  subCount: number;
  description: string;
  tabs: string[];
}

export interface ChannelVideos {
  videos: VideoItem[];
  continuation?: string;
}

export interface ChannelPlaylists {
  playlists: PlaylistItem[];
  continuation?: string;
}

export interface Comment {
  commentId: string;
  author: string;
  authorId: string;
  authorThumbnail: string;
  authorIsChannelOwner: boolean;
  contentHtml: string;
  likeCount: number;
  publishedText: string;
  isPinned: boolean;
  isEdited: boolean;
  replies?: { replyCount: number; continuation: string };
}

export interface CommentPage {
  comments: Comment[];
  commentCount?: number;
  continuation?: string;
}

export interface PlaylistVideo extends VideoItem {
  index: number;
}

export interface Playlist {
  playlistId: string;
  title: string;
  author: string;
  authorId?: string;
  description?: string;
  videoCount: number;
  videos: PlaylistVideo[];
}

export interface Feed {
  notifications: VideoItem[];
  videos: VideoItem[];
}

export interface Subscription {
  author: string;
  authorId: string;
}

export interface ResolvedUrl {
  ucid?: string;
  pageType: string;
}

export interface Suggestions {
  suggestions: string[];
}

export type SearchType = 'all' | 'video' | 'channel' | 'playlist';
export type ChannelVideoTab = 'videos' | 'shorts' | 'streams';
