// Stores watch positions so they follow a user from device to device.
// GET  /invi-api/positions/<videoId>  → { "seconds": 61 } or { "seconds": null }
// PUT  /invi-api/positions/<videoId>  ← { "seconds": 61 }, or null to forget it
// Requests carry the user's Invidious token (checked with Invidious) and the username from sign-in.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname } from 'node:path';
import { isVideoId, parseSeconds, positionOf, withPosition } from './positions.mjs';

const port = Number(process.env.POSITIONS_PORT ?? 8081);
const dataFile = process.env.POSITIONS_FILE ?? '/data/positions.json';
const invidiousUrl = (process.env.INVIDIOUS_URL ?? '').replace(/\/+$/, '');
const tokenCheckMs = 60 * 60 * 1000;
const writeDelayMs = 2000;

let positions = await loadPositions();
let writeTimer;
const checkedTokens = new Map();

createServer(async (request, response) => {
  const videoId = request.url?.match(/^\/invi-api\/positions\/([^/?]+)$/)?.[1];
  if (!videoId || !isVideoId(videoId)) {
    return reply(response, 404, { error: 'Not found' });
  }
  const user = request.headers['x-invi-user'];
  if (typeof user !== 'string' || !user || !(await tokenIsValid(request.headers.authorization))) {
    return reply(response, 401, { error: 'Sign in again' });
  }
  if (request.method === 'GET') {
    return reply(response, 200, { seconds: positionOf(positions, user, videoId) });
  }
  if (request.method === 'PUT') {
    const seconds = parseSeconds(await readBody(request));
    if (seconds === undefined) {
      return reply(response, 400, { error: 'Expected {"seconds": number or null}' });
    }
    positions = withPosition(positions, user, videoId, seconds, Date.now());
    scheduleWrite();
    return reply(response, 204);
  }
  return reply(response, 405, { error: 'Method not allowed' });
}).listen(port, '127.0.0.1', () => console.log(`invi positions: listening on 127.0.0.1:${port}`));

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
    console.error('invi positions: could not reach Invidious to check a token:', error.message);
    return false;
  }
  checkedTokens.set(authorization, Date.now());
  return true;
}

async function loadPositions() {
  try {
    return JSON.parse(await readFile(dataFile, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`invi positions: could not read ${dataFile}, starting empty:`, error.message);
    }
    return {};
  }
}

// Writes are bunched, and go to a temporary file first so a crash never leaves half a file.
function scheduleWrite() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(async () => {
    try {
      await mkdir(dirname(dataFile), { recursive: true });
      await writeFile(`${dataFile}.tmp`, JSON.stringify(positions));
      await rename(`${dataFile}.tmp`, dataFile);
    } catch (error) {
      console.error(`invi positions: could not write ${dataFile}:`, error.message);
    }
  }, writeDelayMs);
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
