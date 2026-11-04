import { headTags, manifest, serviceWorker } from '../build/pwa';
import { detectInAppBrowser } from '@/lib/inApp';
import { shareLink } from '@/lib/share';

const meta = { title: 'Gia Phả Họ Trịnh', shortName: 'Gia phả', description: 'Mô tả "đặc biệt"', siteUrl: 'https://x.web.app/', pwa: true };

describe('Open Graph and manifest', () => {
  it('writes absolute Open Graph URLs and escapes text', () => {
    const html = headTags(meta);
    expect(html).toContain('<meta property="og:title" content="Gia Phả Họ Trịnh" />');
    expect(html).toContain('<meta property="og:image" content="https://x.web.app/og-image.png" />');
    expect(html).toContain('<meta property="og:url" content="https://x.web.app/" />');
    expect(html).toContain('content="Mô tả &quot;đặc biệt&quot;"');
    expect(html).toContain('rel="manifest"');
  });

  it('builds an installable manifest', () => {
    const m = JSON.parse(manifest(meta)) as { name: string; display: string; icons: Array<{ sizes: string; purpose: string }> };
    expect(m.name).toBe('Gia Phả Họ Trịnh');
    expect(m.display).toBe('standalone');
    expect(m.icons.map((i) => `${i.sizes}/${i.purpose}`)).toEqual(['192x192/any', '512x512/any', '512x512/maskable']);
  });

  it('produces a service worker that precaches the shell', () => {
    const sw = serviceWorker('abc', ['/index.html', '/assets/a.js']);
    expect(sw).toContain('"/assets/a.js"');
    expect(sw).toContain("caches.match('/index.html'");
    expect(() => new Function(sw)).not.toThrow();
  });
});

describe('in-app browsers', () => {
  it.each([
    ['Mozilla/5.0 (Linux; Android 12; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 Zalo android/12100', 'zalo'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/474', 'zalo'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/440.0.0]', 'facebook'],
    ['Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/440.0.0.0]', 'facebook'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/440.0]', 'messenger'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', null],
  ])('%s → %s', (ua, expected) => {
    expect(detectInAppBrowser(ua)).toBe(expected);
  });
});

describe('shareLink', () => {
  const nav = navigator as Navigator & { share?: unknown; clipboard?: unknown };
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'share');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });

  it('uses the share sheet when present', async () => {
    const calls: unknown[] = [];
    nav.share = async (d: unknown) => void calls.push(d);
    expect(await shareLink({ title: 't', url: 'https://x/person/p1' })).toEqual({ kind: 'shared' });
    expect(calls).toHaveLength(1);
  });

  it('copies when there is no share sheet', async () => {
    let copied = '';
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t: string) => void (copied = t) }, configurable: true });
    expect(await shareLink({ title: 't', url: 'https://x/' })).toEqual({ kind: 'copied' });
    expect(copied).toBe('https://x/');
  });

  it('hands the link back when everything is blocked (in-app browsers)', async () => {
    nav.share = async () => {
      throw new Error('NotAllowedError');
    };
    expect(await shareLink({ title: 't', url: 'https://x/' })).toEqual({ kind: 'manual', url: 'https://x/' });
  });
});
