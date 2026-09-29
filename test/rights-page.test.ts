import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  COOLING_OFF_DAYS,
  LATER_FAULTS,
  PRESUMED_FAULT_RULE,
  LEGAL_DISCLAIMER,
  REJECT_DAYS,
  RETURN_AFTER_CANCEL_DAYS,
  UNTOLD_EXTENSION,
} from '../src/lib/legal';
import { STORE_COUNT } from '../src/lib/stores';
import { Rights } from '../src/rights/Rights';

/**
 * The rights page says nothing about the law the app does not already say.
 *
 * It is marketing about statute, which is the one kind of marketing where a
 * slip is somebody turned away at a counter. So it is held the way legal.ts is:
 * every period is a constant the detail screen computes with, and the two
 * sentences that carry the most — what remains after the right to reject, and
 * the extension for a trader who never gave the cancellation information — are
 * the app's own strings. Rendered, not read: what is checked is what a person
 * would see.
 */
const ROOT = join(__dirname, '..');
const html = renderToStaticMarkup(createElement(Rights));
const text = html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const source = readFileSync(join(ROOT, 'src', 'rights', 'Rights.tsx'), 'utf8');

describe('the rights page is a page', () => {
  it('is an entry in the build', () => {
    expect(existsSync(join(ROOT, 'rights', 'index.html'))).toBe(true);
    expect(readFileSync(join(ROOT, 'vite.config.ts'), 'utf8')).toMatch(/resolve\(__dirname, 'rights\/index\.html'\)/);
  });

  it('is linked from the landing page', () => {
    expect(readFileSync(join(ROOT, 'src', 'landing', 'Landing.tsx'), 'utf8')).toMatch(/href: '\/rights\/'|href="\/rights\/"/);
  });
});

describe('the periods it states', () => {
  /** Every number the reader sees with a unit after it. */
  const figures = [...text.matchAll(/\b(\d+)\s+(?:more\s+)?(days?|UK)\b/g)].map((m) => ({ n: Number(m[1]), unit: m[2] }));

  it('finds the ones it is meant to be checking', () => {
    expect(figures.length).toBeGreaterThanOrEqual(4);
  });

  it('are the constants the app computes with, and nothing else', () => {
    const known = new Set([REJECT_DAYS, COOLING_OFF_DAYS, RETURN_AFTER_CANCEL_DAYS]);
    expect(figures.filter((f) => (f.unit === 'UK' ? f.n !== STORE_COUNT : !known.has(f.n)))).toEqual([]);
  });

  it('are each actually said', () => {
    expect(text).toContain(`${REJECT_DAYS} days to reject it for a full refund`);
    expect(text).toContain(`${COOLING_OFF_DAYS} days to cancel`);
    expect(text).toContain(`${RETURN_AFTER_CANCEL_DAYS} more days to send it back`);
    expect(text).toContain(`${STORE_COUNT} UK retailers`);
  });

  it('are never typed out in the page’s own source', () => {
    // Digits or words. The page may only interpolate; the numbers live in
    // legal.ts, where the tests that pin them to statute are.
    // Up to two words, and any whitespace, between the number and the unit:
    // "14 more days" slipped past a check that wanted them adjacent, and "30
    // full" at the end of one JSX line with "days" on the next slipped past
    // one that wanted a single space. The rendered checks above cannot tell a
    // typed 14 from the constant while the two are equal.
    expect(source).not.toMatch(/\b\d+(?:[\s-]+\w+){0,2}[\s-]+(?:day|week|month|year)s?\b/i);
    expect(source).not.toMatch(/\b(?:one|two|three|five|six|twelve|fourteen|thirty)\s+(?:day|week|month|year)s?\b|\ba year\b/i);
  });
});

describe('the sentences it shares with the app', () => {
  it('says what remains after the right to reject in the detail screen’s words', () => {
    expect(text).toContain(LATER_FAULTS);
  });

  it('says who has to prove a fault, and for how long, in the app’s words', () => {
    expect(text).toContain(PRESUMED_FAULT_RULE);
  });

  it('says the extension for an untold buyer in the detail screen’s words', () => {
    expect(text).toContain(UNTOLD_EXTENSION);
  });

  it('carries the app’s disclaimer', () => {
    expect(text).toContain(LEGAL_DISCLAIMER);
  });
});

describe('where it sends people', () => {
  it('links only to the app and to the legislation itself', () => {
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThanOrEqual(3);
    expect(hrefs.filter((h) => !(h.startsWith('/') || h.startsWith('https://www.legislation.gov.uk/')))).toEqual([]);
    expect(hrefs).toContain('/app/');
  });
});
