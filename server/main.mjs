// The app's own small server, behind /invi-api/.
//
// Watch positions, so they follow a user from device to device. Requests carry the user's
// Invidious token (checked with Invidious) and the username from sign-in.
//   GET  /invi-api/positions/<videoId>  → { "seconds": 61 } or { "seconds": null }
//   PUT  /invi-api/positions/<videoId>  ← { "seconds": 61 }, or null to forget it
//
// Channel pictures for lists that come without them (the subscription feed): looked up once from
// Invidious for everyone, kept 30 days, and answered with a redirect to the picture.
//   GET  /invi-api/channel-avatar/<channelId>  → 302 to /ggpht/…, or 404
import { createServer } from 'node:http';
import { avatarPathOf, isChannelId, knownAvatar, withAvatar } from './channel-avatars.mjs';
import { jsonFile } from './json-file.mjs';
import { isVideoId, parseSeconds, positionOf, withPosition } from './positions.mjs';

const port = Number(process.env.POSITIONS_PORT ?? 8081);
const dataDirectory = process.env.DATA_DIRECTORY ?? '/data';
const invidiousUrl = (process.env.INVIDIOUS_URL ?? '').replace(/\/+$/, '');
const tokenCheckMs = 60 * 60 * 1000;
const avatarLookupsAtOnce = 3;
const missingAvatarRetryMs = 60 * 60 * 1000;

const positions = await jsonFile(`${dataDirectory}/positions.json`);
const avatars = await jsonFile(`${dataDirectory}/channel-avatars.json`);
const checkedTokens = new Map();
const avatarLookups = new Map();
const missingAvatars = new Map();
let runningLookups = 0;
const waitingLookups = [];

createServer(async (request, response) => {
  const url = request.url ?? '';
  const videoId = url.match(/^\/invi-api\/positions\/([^/?]+)$/)?.[1];
  if (videoId !== undefined) {
    return handlePosition(request, response, videoId);
  }
  const channelId = url.match(/^\/invi-api\/channel-avatar\/([^/?]+)$/)?.[1];
  if (channelId !== undefined && request.method === 'GET') {
    return handleAvatar(response, channelId);
  }
  return reply(response, 404, { error: 'Not found' });
}).listen(port, '127.0.0.1', () => console.log(`invi server: listening on 127.0.0.1:${port}`));

async function handlePosition(request, response, videoId) {
  if (!isVideoId(videoId)) {
    return reply(response, 404, { error: 'Not found' });
  }
  const user = request.headers['x-invi-user'];
  if (typeof user !== 'string' || !user || !(await tokenIsValid(request.headers.authorization))) {
    return reply(response, 401, { error: 'Sign in again' });
  }
  if (request.method === 'GET') {
    return reply(response, 200, { seconds: positionOf(positions.get(), user, videoId) });
  }
  if (request.method === 'PUT') {
    const seconds = parseSeconds(await readBody(request));
    if (seconds === undefined) {
      return reply(response, 400, { error: 'Expected {"seconds": number or null}' });
    }
    positions.set(withPosition(positions.get(), user, videoId, seconds, Date.now()));
    return reply(response, 204);
  }
  return reply(response, 405, { error: 'Method not allowed' });
}

async function handleAvatar(response, channelId) {
  if (!isChannelId(channelId)) {
    return reply(response, 404, { error: 'Not found' });
  }
  const path = knownAvatar(avatars.get(), channelId, Date.now()) ?? (await lookUpAvatar(channelId));
  if (!path) {
    response.writeHead(404, { 'cache-control': 'public, max-age=3600' });
    return response.end();
  }
  response.writeHead(302, { location: path, 'cache-control': 'public, max-age=604800' });
  response.end();
}

/** One lookup per channel at a time, a few channels at once; a channel without a picture rests an hour. */
function lookUpAvatar(channelId) {
  if (Date.now() - (missingAvatars.get(channelId) ?? 0) < missingAvatarRetryMs) {
    return Promise.resolve(null);
  }
  if (!avatarLookups.has(channelId)) {
    const lookup = whenLookupSlotFree()
      .then(() => fetchAvatarPath(channelId))
      .finally(() => {
        avatarLookups.delete(channelId);
        runningLookups--;
        waitingLookups.shift()?.();
      });
    avatarLookups.set(channelId, lookup);
  }
  return avatarLookups.get(channelId);
}

function whenLookupSlotFree() {
  if (runningLookups < avatarLookupsAtOnce) {
    runningLookups++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waitingLookups.push(() => (runningLookups++, resolve())));
}

async function fetchAvatarPath(channelId) {
  try {
    const answer = await fetch(`${invidiousUrl}/api/v1/channels/${channelId}`, { signal: AbortSignal.timeout(15000) });
    const path = answer.ok ? avatarPathOf(await answer.json()) : null;
    if (path) {
      avatars.set(withAvatar(avatars.get(), channelId, path, Date.now()));
      return path;
    }
  } catch (error) {
    console.error(`invi server: could not look up the picture of ${channelId}:`, error.message);
  }
  missingAvatars.set(channelId, Date.now());
  return null;
}

/** A token counts when Invidious accepts it; the answer is kept for an hour. */
async function tokenIsValid(authorization) {
  if (!authorization?.startsWith('Bearer ')) {
    return false;
  }
  const checkedAt = checkedTokens.get(authorization);
  if (checkedAt && Date.now() - checkedAt < tokenCheckMs) {
    return true;
  }
  try {
    const answer = await fetch(`${invidiousUrl}/api/v1/auth/history?max_results=1`, {
      headers: { authorization },
      signal: AbortSignal.timeout(5000),
    });
    if (!answer.ok) {
      return false;
    }
  } catch (error) {
    console.error('invi server: could not reach Invidious to check a token:', error.message);
    return false;
  }
  checkedTokens.set(authorization, Date.now());
  return true;
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1000) {
      break;
    }
  }
  return body;
}

function reply(response, status, body) {
  response.writeHead(status, body ? { 'content-type': 'application/json' } : {});
  response.end(body ? JSON.stringify(body) : undefined);
}
