import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isVideoId, maxVideosPerUser, parseSeconds, positionOf, withPosition } from './positions.mjs';

test('stores, reads and forgets a position per user', () => {
  let positions = {};
  positions = withPosition(positions, 'anna', 'dQw4w9WgXcQ', 61.6, 1000);
  positions = withPosition(positions, 'ben', 'dQw4w9WgXcQ', 5, 1000);
  assert.equal(positionOf(positions, 'anna', 'dQw4w9WgXcQ'), 62);
  assert.equal(positionOf(positions, 'ben', 'dQw4w9WgXcQ'), 5);
  assert.equal(positionOf(positions, 'carl', 'dQw4w9WgXcQ'), null);

  positions = withPosition(positions, 'anna', 'dQw4w9WgXcQ', null, 2000);
  assert.equal(positionOf(positions, 'anna', 'dQw4w9WgXcQ'), null);
  assert.equal(positionOf(positions, 'ben', 'dQw4w9WgXcQ'), 5);
});

test('keeps only the newest videos per user', () => {
  let positions = {};
  for (const [index, videoId] of ['oldestVideo', 'middleVideo', 'newestVideo'].entries()) {
    positions = withPosition(positions, 'anna', videoId, 10, index, 2);
  }
  assert.deepEqual(Object.keys(positions.anna).sort(), ['middleVideo', 'newestVideo']);
  assert.ok(maxVideosPerUser >= 1000);
});

test('accepts only YouTube video ids', () => {
  assert.equal(isVideoId('dQw4w9WgXcQ'), true);
  assert.equal(isVideoId('../../etc/x'), false);
  assert.equal(isVideoId('short'), false);
});

test('reads seconds from the body', () => {
  assert.equal(parseSeconds('{"seconds": 12.5}'), 12.5);
  assert.equal(parseSeconds('{"seconds": null}'), null);
  assert.equal(parseSeconds('{"seconds": -1}'), undefined);
  assert.equal(parseSeconds('{"seconds": "12"}'), undefined);
  assert.equal(parseSeconds('not json'), undefined);
});
