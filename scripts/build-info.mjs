// Writes public/build-info.json for the About page. The Docker build has no .git, so the release
// workflow hands version and commit over as INVI_VERSION and INVI_COMMIT.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

function git(command) {
  try {
    return execSync(`git ${command}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

const version = process.env.INVI_VERSION || git('describe --tags --always --dirty') || 'unknown';
const commit = process.env.INVI_COMMIT || git('rev-parse HEAD');

writeFileSync('public/build-info.json', JSON.stringify({ version, commit }) + '\n');
