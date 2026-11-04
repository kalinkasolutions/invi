// Writes public/config.json for `npm start`; in the container nginx serves it from its settings.
import { writeFileSync } from 'node:fs';
import { invidiousUrl } from './invidious-url.mjs';

writeFileSync('public/config.json', JSON.stringify({ invidiousUrl }) + '\n');
