export const invidiousUrl = process.env.INVIDIOUS_URL?.replace(/\/+$/, '');

if (!invidiousUrl) {
  console.error('Set INVIDIOUS_URL to your Invidious server, e.g. INVIDIOUS_URL=https://invidious.example.com npm start');
  process.exit(1);
}
