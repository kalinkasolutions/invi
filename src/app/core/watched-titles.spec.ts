import { searchWatched } from './watched-titles';

describe('searchWatched', () => {
  const videos = [
    { videoId: 'a', title: 'Never Gonna Give You Up', author: 'Rick Astley', authorId: 'UC1' },
    { videoId: 'b', title: 'Rust in 100 Seconds', author: 'Fireship', authorId: 'UC2' },
  ];

  it('matches every word in title or channel, ignoring case', () => {
    expect(searchWatched(videos, 'rick never').map((video) => video.videoId)).toEqual(['a']);
    expect(searchWatched(videos, 'FIRESHIP rust').map((video) => video.videoId)).toEqual(['b']);
    expect(searchWatched(videos, 'rust rick')).toEqual([]);
  });
});
