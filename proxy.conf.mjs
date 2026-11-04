import { invidiousUrl } from './scripts/invidious-url.mjs';

const toInvidious = { target: invidiousUrl, changeOrigin: true, secure: true };

export default Object.fromEntries(
  ['/api', '/companion', '/vi', '/ggpht', '/sb', '/videoplayback'].map((path) => [path, toInvidious]),
);
