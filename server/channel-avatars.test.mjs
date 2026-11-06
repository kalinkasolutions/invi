import assert from 'node:assert/strict';
import { test } from 'node:test';
import { avatarPathOf, isChannelId, keepAvatarsForMs, knownAvatar, withAvatar } from './channel-avatars.mjs';

test('takes the largest picture, at 176 px, and serves it through /ggpht/', () => {
  const channel = {
    authorThumbnails: [
      { url: 'https://yt3.googleusercontent.com/abc=s100-c', width: 100 },
      { url: 'https://yt3.googleusercontent.com/abc=s512-c', width: 512 },
      { url: 'https://yt3.ggpht.com/abc=s176-c', width: 176 },
    ],
  };
  assert.equal(avatarPathOf(channel), '/ggpht/abc=s176-c');
});

test('finds nothing without pictures, or with pictures from elsewhere', () => {
  assert.equal(avatarPathOf({ authorThumbnails: [] }), null);
  assert.equal(avatarPathOf({}), null);
  assert.equal(avatarPathOf({ authorThumbnails: [{ url: 'https://example.com/x.jpg', width: 10 }] }), null);
});

test('keeps a picture for 30 days', () => {
  const avatars = withAvatar({}, 'UCsBjURrPoezykLs9EqgamOA', '/ggpht/abc', 1000);
  assert.equal(knownAvatar(avatars, 'UCsBjURrPoezykLs9EqgamOA', 1000 + keepAvatarsForMs - 1), '/ggpht/abc');
  assert.equal(knownAvatar(avatars, 'UCsBjURrPoezykLs9EqgamOA', 1000 + keepAvatarsForMs), null);
  assert.equal(knownAvatar(avatars, 'UCxxxxxxxxxxxxxxxxxxxxxx', 1000), null);
});

test('accepts only channel ids', () => {
  assert.equal(isChannelId('UCsBjURrPoezykLs9EqgamOA'), true);
  assert.equal(isChannelId('@Fireship'), false);
  assert.equal(isChannelId('UC../../etc'), false);
});
