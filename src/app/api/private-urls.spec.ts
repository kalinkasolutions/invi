import { rewriteGoogleUrls, toPrivateUrl } from './private-urls';

describe('toPrivateUrl', () => {
  it('sends channel pictures through the image proxy', () => {
    expect(toPrivateUrl('https://yt3.ggpht.com/abc=s88-c')).toBe('/ggpht/abc=s88-c');
    expect(toPrivateUrl('https://yt3.googleusercontent.com/abc=w2560')).toBe('/ggpht/abc=w2560');
    expect(toPrivateUrl('//yt3.ggpht.com/ytc/abc')).toBe('/ggpht/ytc/abc');
  });

  it('keeps video thumbnails from i.ytimg.com, without the tracking query', () => {
    expect(toPrivateUrl('https://i.ytimg.com/vi/a2i9h2ip-nY/hqdefault.jpg?sqp=x&rs=y')).toBe('/vi/a2i9h2ip-nY/hqdefault.jpg');
  });

  it('drops other i.ytimg.com images, which Invidious cannot proxy', () => {
    expect(toPrivateUrl('https://i.ytimg.com/tvfilm_banner/PL/16_9_.jpg')).toBe('');
  });

  it('leaves everything else alone', () => {
    expect(toPrivateUrl('https://invidious.example.com/vi/x/hq.jpg')).toBe('https://invidious.example.com/vi/x/hq.jpg');
    expect(toPrivateUrl('just text')).toBe('just text');
  });
});

describe('rewriteGoogleUrls', () => {
  it('rewrites URLs at any depth', () => {
    const input = { a: [{ url: 'https://yt3.ggpht.com/x' }], n: 3, missing: null };
    expect(rewriteGoogleUrls(input)).toEqual({ a: [{ url: '/ggpht/x' }], n: 3, missing: null });
  });
});
