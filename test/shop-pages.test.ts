import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ORIGIN, SHOP_PAGES_DIR, allShopPages, policyWords, shopFiles, shopPage, shopsWithPages, slugFor, windowLine } from '../src/landing/shop-pages';
import { CHECKED_ON, STORE_POLICIES, findStore, shopCheckedOn } from '../src/lib/stores';
import { returnsPageFor } from '../src/lib/returns-pages';
import { CONTENT_SECURITY_POLICY } from '../src/lib/csp';
import { fmtDateLong, fromISODate } from '../src/lib/dates';

/*
 * A page per shop, for the search people actually make: "ASOS returns
 * policy". Each one states a fact somebody could act on, so each is held to
 * where the fact came from: only a shop read off its own returns page, and
 * recently, gets a page, and the page names that page and that date.
 */
const ROOT = join(__dirname, '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const TODAY = fromISODate('2026-11-03');
const shop = (name: string) => findStore(name)!;

describe('which shops get a page', () => {
  it('exactly those with a current check and a returns page of their own to cite', () => {
    const want = STORE_POLICIES.filter((s) => shopCheckedOn(s.name, TODAY) !== null && returnsPageFor(s.name) !== null).map((s) => s.name);
    expect(want.length).toBeGreaterThan(50);
    expect(shopsWithPages(TODAY).map((s) => s.name)).toEqual(want);
  });

  it('none for a shop nobody has read, so a guess never gets a URL', () => {
    const unchecked = STORE_POLICIES.filter((s) => !CHECKED_ON[s.name]);
    for (const s of unchecked) expect(shopsWithPages(TODAY)).not.toContain(s);
  });

  it('and none at all once every check has gone stale', () => {
    // A build long after the last check writes the index and no shop pages,
    // rather than pages stating windows nobody has re-read.
    expect(shopsWithPages(fromISODate('2031-01-01'))).toEqual([]);
    expect(allShopPages(fromISODate('2031-01-01'))).toHaveLength(1);
  });
});

describe('the addresses', () => {
  it('are on the site’s one origin', () => {
    expect(ORIGIN).toBe(new URL(JSON.parse(read('store', 'listing.json')).urls.marketing).origin);
  });

  it('are one per shop, and safe in a URL', () => {
    const slugs = STORE_POLICIES.map((s) => slugFor(s.name));
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(slugFor('M&S')).toBe('m-and-s');
    expect(slugFor('Snow+Rock')).toBe('snow-rock');
  });

  it('end in a slash, as the host serves them, and the canonical says so', () => {
    for (const p of allShopPages(TODAY)) {
      expect(p.path).toMatch(/^\/returns\/(?:[a-z0-9-]+\/)?$/);
      expect(p.file).toBe(`${p.path.slice(1)}index.html`);
      expect(p.html).toContain(`<link rel="canonical" href="${ORIGIN}${p.path}" />`);
    }
  });
});

describe('a shop’s page', () => {
  it('answers the search in its title and first line', () => {
    const p = shopPage(shop('ASOS'), TODAY);
    expect(p.title).toBe('ASOS returns policy: 28 days from delivery');
    expect(p.html).toContain('<title>ASOS returns policy: 28 days from delivery — Quids In</title>');
    expect(p.html).toContain('<p class="answer"><strong>28 days from delivery.</strong></p>');
  });

  it('says both windows where a shop gives different ones online and in store', () => {
    const liberty = shop('Liberty');
    expect(windowLine(liberty)).toEqual({
      headline: '30 days from delivery',
      detail: 'Online: 30 days from delivery. In a shop: 14 days from the day you buy it.',
    });
    expect(windowLine(shop('IKEA')).detail).toBeNull();
  });

  it('names the shop’s own page and the day it was read', () => {
    for (const s of shopsWithPages(TODAY)) {
      const { html } = shopPage(s, TODAY);
      const source = returnsPageFor(s.name)!;
      const href = source.url.replace(/&/g, '&amp;');
      expect(html, s.name).toContain(`<a href="${href}" rel="nofollow">${source.host}</a>`);
      expect(html, s.name).toContain(fmtDateLong(fromISODate(CHECKED_ON[s.name])));
    }
  });

  it('carries the shop’s catch, and its policy without its name said twice', () => {
    const asos = shopPage(shop('ASOS'), TODAY).html;
    expect(asos).toContain('<h2>The small print</h2>');
    expect(policyWords(shop('Zara'))).toBe('30 days from dispatch, not delivery. Postal returns now £1.95 — in-store drop-off still free.');
    expect(policyWords(shop('Dunelm'))).toMatch(/^Change your mind within 28 days/);
    for (const s of shopsWithPages(TODAY)) expect(shopPage(s, TODAY).html, s.name).not.toContain(`<p>${s.name} · `);
  });

  it('shows a Christmas date while it is still to come, and not after', () => {
    expect(shopPage(shop('Dunelm'), TODAY).html).toContain('back until <strong>31 January 2027</strong>');
    expect(shopPage(shop('Dunelm'), fromISODate('2027-02-01')).html).not.toContain('Christmas returns');
    expect(shopPage(shop('IKEA'), TODAY).html).not.toContain('Christmas returns');
  });

  it('escapes what it prints, so a shop called M&S is still valid HTML', () => {
    for (const p of allShopPages(TODAY)) expect(p.html.replace(/&(?:amp|lt|gt|quot);/g, ''), p.path).not.toContain('&');
    expect(shopPage(shop('M&S'), TODAY).html).toContain('<h1>M&amp;S returns policy</h1>');
  });
});

describe('what the build writes', () => {
  const files = shopFiles(TODAY, CONTENT_SECURITY_POLICY);
  const html = files.filter((f) => f.fileName.endsWith('.html'));

  it('a page per shop and the index, each under the same policy as every other page', () => {
    expect(html).toHaveLength(shopsWithPages(TODAY).length + 1);
    for (const f of html) expect(f.source, f.fileName).toContain(`<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`);
  });

  it('nothing the policy would refuse: no script, no inline style', () => {
    for (const f of html) {
      expect(f.source, f.fileName).not.toMatch(/<script|\sstyle=|<style|\son\w+=/);
    }
  });

  it('links only to what exists', () => {
    const pages = new Set(files.map((f) => `/${f.fileName.replace(/index\.html$/, '')}`));
    const exists = (path: string) =>
      pages.has(path) ||
      existsSync(join(ROOT, 'public', path)) ||
      existsSync(join(ROOT, path, 'index.html'));
    for (const f of [...html, ...files.filter((x) => x.fileName.endsWith('.css'))]) {
      for (const [, path] of f.source.matchAll(/(?:href="|url\(')(\/[^"']*)/g)) expect(exists(path), `${f.fileName} → ${path}`).toBe(true);
    }
  });

  it('a sitemap of every page, named in robots.txt', () => {
    const sitemap = files.find((f) => f.fileName === `${SHOP_PAGES_DIR}/sitemap.xml`)!.source;
    const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(listed.sort()).toEqual(allShopPages(TODAY).map((p) => `${ORIGIN}${p.path}`).sort());
    expect(read('public', 'robots.txt')).toMatch(new RegExp(`^Sitemap: ${ORIGIN}/${SHOP_PAGES_DIR}/sitemap\\.xml$`, 'm'));
  });

  it('and the landing page links to them', () => {
    expect(read('src', 'landing', 'Landing.tsx')).toMatch(/href="\/returns\/"|\['\/returns\/'/);
  });

  it('but not into the iPhone bundle', () => {
    expect(read('vite.config.ts')).toMatch(/mode === IOS_MODE \? \[\] : \[shopPages\(policy\)\]/);
  });
});
