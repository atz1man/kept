import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHECKED_ON, STORE_POLICIES, checkedCount, shopCheckedOn, windowChecked, policyFor, type StorePolicy } from '../src/lib/stores';
// @ts-expect-error - a small JS helper, run as `npm run check:retailers`
import { siteOf } from '../scripts/retailer-check-lib.mjs';
import sources from '../store/retailer-sources.json';

/**
 * A shop is "checked" only with evidence, and the evidence is the reports the
 * retailer check commits. Without this, `CHECKED_ON` is a list somebody typed,
 * which is the claim `TABLE_CHECKED_ON` was introduced to stop the app making.
 */
const ROOT = join(__dirname, '..');
const DIR = join(ROOT, 'store/retailer-check');
const reports = readdirSync(DIR).filter((f) => f.endsWith('.md')).map((f) => ({ f, text: readFileSync(join(DIR, f), 'utf8') }));
const own = (sources as { sources: Record<string, string[]> }).sources;

/** The quoted sentences under a shop's section, page by page, with each page's URL. */
function quotesFor(name: string, text: string): { url: string; quote: string }[] {
  const out: { url: string; quote: string }[] = [];
  for (const section of text.split('\n## ').slice(1)) {
    const heading = section.split('\n')[0];
    if (heading !== name && !heading.startsWith(`${name} — `)) continue;
    let url = '';
    for (const line of section.split('\n')) {
      const page = /^- (https?:\/\/\S+)/.exec(line);
      if (page) url = page[1];
      else if (line.startsWith('  - > ') && url) out.push({ url, quote: line.slice(6) });
    }
  }
  return out;
}

const names = (days: number) => new RegExp(`\\b${days}(?:[- ](?:calendar|working))?[- ]days?\\b`, 'i');

function evidence(store: StorePolicy, on: string) {
  const site = siteOf(new URL(own[store.name][0]).hostname);
  const quotes = reports
    .filter((r) => r.f.startsWith(on))
    .flatMap((r) => quotesFor(store.name, r.text))
    .filter((q) => siteOf(new URL(q.url).hostname) === site);
  const windows = [store.windowDays, ...(store.onlineWindowDays ? [store.onlineWindowDays] : [])];
  return windows.every((d) => quotes.some((q) => names(d).test(q.quote)));
}

describe('a shop called checked', () => {
  it('names only shops in the table', () => {
    for (const name of Object.keys(CHECKED_ON)) expect(STORE_POLICIES.map((s) => s.name), name).toContain(name);
  });

  it.each(Object.entries(CHECKED_ON))('%s: was quoted from its own site, that day, naming its window', (name, on) => {
    const store = STORE_POLICIES.find((s) => s.name === name)!;
    expect(evidence(store, on), `${name}: no quote from its own site on ${on} names ${store.windowDays} days`).toBe(true);
  });

  it('finds no evidence where there is none', () => {
    // The sweep above passing for every shop proves nothing unless it can
    // fail: Currys' pages refused every run, so no report quotes it.
    const currys = STORE_POLICIES.find((s) => s.name === 'Currys')!;
    expect(evidence(currys, '2026-10-03')).toBe(false);
    // And a quote from someone else's site is not the shop's word: Joules'
    // 28 days came from a help centre on zendesk.com.
    const joulesLike = { ...STORE_POLICIES.find((s) => s.name === 'ASOS')!, name: 'Joules', windowDays: 28 } as StorePolicy;
    own.Joules = ['https://www.joules.com/faq/faqReturnsAndRefunds'];
    expect(evidence(joulesLike, '2026-10-03')).toBe(false);
    delete own.Joules;
  });
});

describe('what a reminder may say about a shop nobody has checked', () => {
  const r = (store: string, windowDays: number) => ({ store, windowDays, distance: false, policy: policyFor(store, windowDays, undefined, false) });
  const today = new Date(2026, 9, 10);

  it('calls a checked shop\'s window the shop\'s', () => {
    expect(windowChecked(r('IKEA', 365), today)).toBe(true);
  });

  it('does not, for a shop whose page has not been read — whatever the table says', () => {
    // Currys' row says 14 days and is the likeliest in the table to be wrong.
    expect(windowChecked(r('Currys', 14), today)).toBe(false);
  });

  it('stops calling a check current after a year', () => {
    expect(shopCheckedOn('IKEA', new Date(2027, 9, 3))).not.toBeNull();
    expect(shopCheckedOn('IKEA', new Date(2027, 9, 5))).toBeNull();
    expect(windowChecked(r('IKEA', 365), new Date(2027, 11, 1))).toBe(false);
  });

  it('counts what is and is not checked', () => {
    const c = checkedCount(today);
    expect(c.total).toBe(STORE_POLICIES.length);
    expect(c.checked + c.unchecked.length).toBe(c.total);
    expect(c.unchecked).toContain('Currys');
    expect(c.unchecked).not.toContain('IKEA');
  });
});
