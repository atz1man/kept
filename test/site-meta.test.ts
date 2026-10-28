import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * What the website tells link previews and search engines, held to the files
 * it names.
 *
 * A shared link to getquidsin.co.uk showed a bare URL: the page carried a
 * title and a description and nothing a messaging app reads for a preview.
 * These tags are the kind that rot without anyone noticing. An og:image that
 * 404s, or that declares a size it is not, shows as a grey box or nothing,
 * and no screen in the app would ever reveal it. So each claim is checked
 * against the thing it describes: the image against its own PNG header, every
 * URL against the one origin store/listing.json gives App Review, and the
 * sitemap against the pages that exist.
 */
const ROOT = join(__dirname, '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const ORIGIN = new URL(JSON.parse(read('store', 'listing.json')).urls.marketing).origin;

const meta = (html: string, key: string): string | undefined =>
  html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`))?.[1];
const canonical = (html: string) => html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];

/** The public pages, by the path each is served at. The app at /app/ is not one. */
const PAGES: [string, string][] = [
  ['/', 'index.html'],
  ['/rights/', 'rights/index.html'],
  ['/privacy/', 'privacy/index.html'],
];

/** Width and height out of a PNG's IHDR chunk. */
function pngSize(file: string): { width: number; height: number } {
  const b = readFileSync(file);
  expect(b.subarray(1, 4).toString('latin1')).toBe('PNG');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

describe('the link preview', () => {
  const html = read('index.html');

  it('is served from the site’s own origin, and the file exists', () => {
    const image = meta(html, 'og:image');
    expect(image, 'og:image').toBeDefined();
    const url = new URL(image!);
    expect(url.origin).toBe(ORIGIN);
    statSync(join(ROOT, 'public', url.pathname));
  });

  it('declares the size the image really is', () => {
    const file = join(ROOT, 'public', new URL(meta(html, 'og:image')!).pathname);
    const { width, height } = pngSize(file);
    expect(String(width)).toBe(meta(html, 'og:image:width'));
    expect(String(height)).toBe(meta(html, 'og:image:height'));
    // The size every major platform crops a large card to.
    expect(width / height).toBeCloseTo(1200 / 630, 2);
  });

  it('is small enough that a messaging app fetches it', () => {
    // WhatsApp gives up on previews much past this; a preview that is never
    // fetched is no preview.
    expect(statSync(join(ROOT, 'public', new URL(meta(html, 'og:image')!).pathname)).size).toBeLessThan(600_000);
  });

  it('says what the page says', () => {
    // The card's description is the page's, not a second pitch.
    expect(meta(html, 'og:description')).toBe(meta(html, 'description'));
    expect(meta(html, 'og:url')).toBe(`${ORIGIN}/`);
    expect(meta(html, 'og:image:alt')).toBeTruthy();
    expect(meta(html, 'twitter:card')).toBe('summary_large_image');
  });
});

describe('the canonical address of each page', () => {
  it('names the one origin, at the path the page is served from', () => {
    for (const [path, file] of PAGES) {
      expect(canonical(read(file)), file).toBe(`${ORIGIN}${path}`);
    }
  });
});

describe('the sitemap and robots.txt', () => {
  const sitemap = read('public', 'sitemap.xml');
  const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  it('lists exactly the public pages, and not the app', () => {
    expect(listed.sort()).toEqual(PAGES.map(([path]) => `${ORIGIN}${path}`).sort());
  });

  it('is where robots.txt says it is', () => {
    expect(read('public', 'robots.txt')).toMatch(new RegExp(`^Sitemap: ${ORIGIN}/sitemap\\.xml$`, 'm'));
  });
});
