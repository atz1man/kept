import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { resolveConfig } from 'vite';
import { describe, expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY } from '../src/lib/csp';

/**
 * What the static host sends with each file, from `public/_headers`.
 *
 * There is no server of this app's own, so the headers a browser sees are the
 * ones this file asks the host for — Cloudflare Pages reads it, and Netlify
 * reads the same format. Before it existed none of them were asked for, and
 * the one header the build cannot write (frame-ancestors, which a <meta>
 * cannot carry) was a line on a checklist.
 *
 * The checks are asked of what a PATH receives, not of what a rule says,
 * because the host sends the headers of every rule that matches and joins the
 * same header named twice into one value: a `Cache-Control: no-cache` on /*
 * would reach /assets/ as "no-cache, public, max-age=31536000, immutable".
 */
const ROOT = join(__dirname, '..');
const HEADERS_FILE = join(ROOT, 'public', '_headers');

interface Rule {
  pattern: string;
  headers: [string, string][];
}

/** The rules of a `_headers` file: a path at column 0, its headers indented under it. */
export function parseHeaders(text: string): Rule[] {
  const rules: Rule[] = [];
  for (const raw of text.split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      rules.push({ pattern: raw.trim(), headers: [] });
      continue;
    }
    const at = raw.indexOf(':');
    const rule = rules[rules.length - 1];
    if (!rule || at < 0) throw new Error(`_headers: a header line with no path above it, or no colon: ${raw}`);
    rule.headers.push([raw.slice(0, at).trim().toLowerCase(), raw.slice(at + 1).trim()]);
  }
  return rules;
}

/** Whether a rule's pattern matches a path. `*` is a splat; nothing else is special here. */
function matches(pattern: string, path: string): boolean {
  const re = new RegExp(`^${pattern.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  return re.test(path);
}

/** Every value of a header a path is sent, one per matching rule — the host joins them. */
function received(rules: Rule[], path: string, header: string): string[] {
  return rules
    .filter((r) => matches(r.pattern, path))
    .flatMap((r) => r.headers.filter(([n]) => n === header).map(([, v]) => v));
}

const text = existsSync(HEADERS_FILE) ? readFileSync(HEADERS_FILE, 'utf8') : '';
const rules = parseHeaders(text);

/** Each built page, as the url it is served at, read from the build's own entries. */
async function pageUrls(): Promise<{ config: Awaited<ReturnType<typeof resolveConfig>>; pages: string[] }> {
  const config = await resolveConfig({ root: ROOT, configFile: join(ROOT, 'vite.config.ts'), logLevel: 'silent' }, 'build', 'production');
  const input = config.build.rollupOptions.input as Record<string, string>;
  const pages = Object.values(input).map((file) => `/${relative(ROOT, file).replace(/index\.html$/, '')}`);
  return { config, pages };
}

/** A sample of what the build serves, one of each kind. */
const SAMPLE = [
  '/',
  '/app/',
  '/privacy/',
  '/rights/',
  '/sw.js',
  '/manifest.webmanifest',
  '/policy-feed.json',
  '/policy-feed.sig',
  '/assets/index-AbC123.js',
  '/assets/index-AbC123.css',
  '/fonts/geist.woff2',
  '/icons/icon.svg',
  '/ocr/worker.min.js',
];

/** Must be asked about again on every use: these change at a fixed url. */
const REVALIDATED = ['/sw.js', '/manifest.webmanifest', '/policy-feed.json', '/policy-feed.sig'];

function cacheControl(path: string): string {
  const values = received(rules, path, 'cache-control');
  expect(values.length, `${path} is sent ${values.length} Cache-Control headers: ${values.join(' + ')}`).toBe(1);
  return values[0];
}

function maxAge(value: string): number {
  return Number(/max-age=(\d+)/.exec(value)?.[1] ?? 0);
}

describe('the headers file', () => {
  it('exists, and finds the rules it is meant to be reading', () => {
    // A file that stopped parsing would leave every check below asking about
    // no rules and passing.
    expect(existsSync(HEADERS_FILE), 'public/_headers is missing').toBe(true);
    expect(rules.map((r) => r.pattern)).toEqual(expect.arrayContaining(['/*', '/assets/*', '/sw.js']));
    expect(rules.every((r) => r.headers.length > 0)).toBe(true);
  });

  it('reads a planted file the way the host does, merged duplicates included', () => {
    const planted = parseHeaders('# c\n/*\n  Cache-Control: no-cache\n  X-A: 1\n\n/assets/*\n  Cache-Control: immutable\n');
    expect(received(planted, '/assets/a.js', 'cache-control')).toEqual(['no-cache', 'immutable']);
    expect(received(planted, '/sw.js', 'cache-control')).toEqual(['no-cache']);
    expect(received(planted, '/sw.js', 'x-a')).toEqual(['1']);
  });

  it("says frame-ancestors 'self' on every path", () => {
    for (const path of SAMPLE) {
      const csp = received(rules, path, 'content-security-policy');
      expect(csp.some((v) => /(^|;)\s*frame-ancestors 'self'\s*(;|$)/.test(v)), path).toBe(true);
    }
  });

  it('sends one Cache-Control per path, never two joined into one', () => {
    for (const path of SAMPLE) cacheControl(path);
  });

  it('keeps hashed assets for a year, as immutable', () => {
    const value = cacheControl('/assets/index-AbC123.js');
    expect(value).toContain('immutable');
    expect(maxAge(value)).toBe(31536000);
  });

  it('never long-caches the worker, the pages, the manifest or the feed', async () => {
    const { pages } = await pageUrls();
    expect(pages).toEqual(expect.arrayContaining(['/', '/app/', '/privacy/', '/rights/']));
    for (const path of [...REVALIDATED, ...pages, ...pages.map((p) => `${p}index.html`)]) {
      const value = cacheControl(path);
      expect(value, path).toMatch(/\bno-cache\b/);
      expect(value, path).not.toContain('immutable');
      expect(maxAge(value), path).toBe(0);
    }
  });

  it('caches the fonts and icons, which are not hashed, for no more than a day', () => {
    for (const path of ['/fonts/geist.woff2', '/icons/icon.svg', '/icons/icon-192.png']) {
      const value = cacheControl(path);
      expect(value, path).not.toContain('immutable');
      expect(maxAge(value), path).toBeLessThanOrEqual(86400);
    }
  });

  it('allows the camera to this origin and nothing it does not use', () => {
    const [policy, ...more] = received(rules, '/app/', 'permissions-policy');
    expect(more).toEqual([]);
    const features = new Map(policy.split(',').map((f) => f.trim().split('=') as [string, string]));
    expect(features.get('camera')).toBe('(self)');
    expect(features.get('microphone')).toBe('()');
    expect(features.get('geolocation')).toBe('()');
    expect(features.get('payment')).toBe('()');
    // The win card and the letters share and copy; denying these would break them.
    expect(features.get('web-share')).not.toBe('()');
    expect(features.get('clipboard-write')).not.toBe('()');
  });

  it('asks for HTTPS without preloading, which is the owner’s one-way decision', () => {
    const [hsts] = received(rules, '/', 'strict-transport-security');
    expect(maxAge(hsts)).toBeGreaterThanOrEqual(15552000);
    for (const rule of rules) for (const [, v] of rule.headers) expect(v).not.toMatch(/\bpreload\b/i);
  });

  it('carries no part of the content security policy that differs from the <meta>', () => {
    // frame-ancestors is the header's own; anything else must be the whole
    // policy, word for word, because a header and a meta are both enforced.
    for (const rule of rules) {
      for (const [name, value] of rule.headers) {
        if (name !== 'content-security-policy') continue;
        const rest = value
          .split(';')
          .map((d) => d.trim())
          .filter((d) => d && !d.startsWith('frame-ancestors'))
          .join('; ');
        if (rest) expect(rest, rule.pattern).toBe(CONTENT_SECURITY_POLICY);
      }
    }
  });

  it('is copied into the build, because the build copies public/ into dist/', async () => {
    const { config } = await pageUrls();
    expect(config.publicDir).toBe(join(ROOT, 'public'));
    expect(config.build.copyPublicDir).not.toBe(false);
    expect(config.build.outDir).toBe('dist');
  });
});

describe('the feed, for the iPhone app', () => {
  it('may be read from capacitor://localhost, and from nowhere else in particular', () => {
    // A feed host set for the iOS build (VITE_FEED_ORIGIN) is fetched from
    // the app's own origin; without this WKWebView refuses the answer and the
    // app silently keeps the list it shipped with.
    for (const path of ['/policy-feed.json', '/policy-feed.sig']) {
      expect(received(rules, path, 'access-control-allow-origin'), path).toEqual(['capacitor://localhost']);
    }
    expect(received(rules, '/app/', 'access-control-allow-origin')).toEqual([]);
  });
});

/*
 * Vercel does not read `_headers`; it reads `vercel.json`. The rules are
 * written once, with their reasons, in `_headers`, and this holds the Vercel
 * copy to it path by path — the same headers, the same values, for every
 * sample path and every built page — so the two hosts cannot drift apart.
 * Vercel sends every matching rule and lets a later one replace an earlier
 * one's same header rather than joining them; `_headers` never names one
 * header twice on a path (checked above), so the two read the same.
 */
const VERCEL_FILE = join(ROOT, 'vercel.json');
const vercel = existsSync(VERCEL_FILE)
  ? (JSON.parse(readFileSync(VERCEL_FILE, 'utf8')) as {
      buildCommand?: string;
      outputDirectory?: string;
      framework?: string | null;
      trailingSlash?: boolean;
      headers?: { source: string; headers: { key: string; value: string }[] }[];
    })
  : {};

/** A Vercel `source` as the host matches it: `(.*)` is any run of characters, all else literal. */
function vercelMatches(source: string, path: string): boolean {
  const re = new RegExp(`^${source.split('(.*)').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  return re.test(path);
}

function vercelReceived(path: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const rule of vercel.headers ?? []) {
    if (!vercelMatches(rule.source, path)) continue;
    for (const h of rule.headers) out.set(h.key.toLowerCase(), h.value);
  }
  return out;
}

function headersReceived(path: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const rule of rules) if (matches(rule.pattern, path)) for (const [n, v] of rule.headers) out.set(n, v);
  return out;
}

describe('vercel.json', () => {
  it('exists, builds the site, and serves dist with each page at its own directory', () => {
    expect(existsSync(VERCEL_FILE), 'vercel.json is missing').toBe(true);
    expect(vercel.buildCommand).toBe('npm run build');
    expect(vercel.outputDirectory).toBe('dist');
    // No framework preset: a preset rewrites routes for a single-page app,
    // and every page here is a real directory with its own index.html.
    expect(vercel.framework).toBeNull();
    expect(vercel.trailingSlash).toBe(true);
  });

  it('sends every path exactly the headers _headers sends it', async () => {
    const { pages } = await pageUrls();
    const paths = [...new Set([...SAMPLE, ...pages, ...pages.map((p) => `${p}index.html`), '/icons/icon-192.png'])];
    expect((vercel.headers ?? []).length).toBeGreaterThan(5);
    for (const path of paths) {
      expect(Object.fromEntries(vercelReceived(path)), path).toEqual(Object.fromEntries(headersReceived(path)));
    }
  });

  it('notices a header that is missing from it', () => {
    // The comparison above, against a copy with one header taken out.
    const without = (vercel.headers ?? []).map((r) => ({ ...r, headers: r.headers.filter((h) => h.key !== 'Referrer-Policy') }));
    const got = new Map<string, string>();
    for (const rule of without) if (vercelMatches(rule.source, '/app/')) for (const h of rule.headers) got.set(h.key.toLowerCase(), h.value);
    expect(Object.fromEntries(got)).not.toEqual(Object.fromEntries(headersReceived('/app/')));
  });
});
