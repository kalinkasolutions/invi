import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const writeDelayMs = 2000;

/**
 * A JSON value kept in a file: read once at start, written a moment after changes. Writes go to a
 * temporary file first, so a crash never leaves half a file.
 */
export async function jsonFile(path) {
  let value = await read(path);
  let writeTimer;
  return {
    get: () => value,
    set(next) {
      value = next;
      clearTimeout(writeTimer);
      writeTimer = setTimeout(() => write(path, value), writeDelayMs);
    },
  };
}

async function read(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`invi server: could not read ${path}, starting empty:`, error.message);
    }
    return {};
  }
}

async function write(path, value) {
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(`${path}.tmp`, JSON.stringify(value));
    await rename(`${path}.tmp`, path);
  } catch (error) {
    console.error(`invi server: could not write ${path}:`, error.message);
  }
}
