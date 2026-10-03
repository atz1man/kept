import { afterEach, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { sellsPaidTiers, UNLOCK } from '../src/lib/pricing';
import { quotaFull, type AppState } from '../src/app/state';
import { FREE_TIER_LIMIT } from '../src/lib/quota';
import { DEFAULT_SETTINGS } from '../src/lib/storage';
import { toPence } from '../src/lib/money';
import type { Receipt } from '../src/lib/types';

/**
 * One price, paid once.
 *
 * The product sold three — monthly, yearly and lifetime — for an app whose
 * whole job is a handful of dates a month, and the agreement suite had to hold
 * three figures together across two entry points. Now there is one unlock,
 * and the claim printed beside it everywhere is "no subscription", so what is
 * worth asserting is that the claim stays true: the price is a single figure
 * paid once, and nothing a person can read offers a period to pay by.
 */
describe('what kept costs', () => {
  it('is one figure in pounds, paid once', () => {
    expect(UNLOCK.price).toMatch(/^£\d+\.\d{2}$/);
    expect(UNLOCK.suffix.trim()).toBe('once');
  });

  const SRC = join(__dirname, '..', 'src');
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : [];
    });
  // Comments are history and may name the old tiers; what a person reads is
  // a string or JSX text, and comments are blanked before matching.
  const uncommented = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const PERIOD = /£\d+(?:\.\d{2})?\s*(?:\/\s*(?:mo|month|yr|year)\b|a month|a year|per month|per year)|['"]\/\s*(?:mo|month|yr|year)['"]|\b(?:monthly|yearly|annual) (?:plan|price|subscription)\b/i;

  it('is never offered by the month or the year, anywhere in the product', () => {
    const offenders = walk(SRC).filter((f) => PERIOD.test(uncommented(readFileSync(f, 'utf8'))));
    expect(offenders.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });

  it('would notice a period if one came back', () => {
    // The sweep over an empty match is the sweep that reports success for a
    // question it never asked: each shape the old tiers wore is caught.
    for (const s of ["{ price: '£2.99', suffix: '/mo' }", '£16.99/yr', '£2.99 a month', 'the yearly plan']) {
      expect(PERIOD.test(s), s).toBe(true);
    }
    expect(walk(SRC).length).toBeGreaterThan(20);
  });
});

/**
 * What the iOS build sells: nothing, and so it caps nothing (APN-18).
 *
 * The tiers unlock a local flag with no payment. Fine on the web, where the
 * sheet says nothing was charged; a guideline 3.1.1 rejection on the App Store.
 * And a cap with no way past it is a wall, so where nothing is sold the
 * library is unlimited. The price half is also checked against the bundle
 * booted as native, in scripts/ios-bundle.mjs; the cap half is checked here,
 * through the same `quotaFull` the add screen reads.
 */
describe('what the iOS build sells', () => {
  it('sells the tiers on the web and nothing on iOS', () => {
    expect(sellsPaidTiers(false)).toBe(true);
    expect(sellsPaidTiers(true)).toBe(false);
  });

  const withPlatform = (native: boolean) => {
    (globalThis as { window?: unknown }).window = native
      ? { Capacitor: { isNativePlatform: () => true } }
      : {};
  };
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  /** A free library one past the cap, none of it sample data. */
  const overFull = (): AppState => {
    const receipts: Receipt[] = Array.from({ length: FREE_TIER_LIMIT + 1 }, (_, i) => ({
      id: `r${i}`, store: 'Argos', item: `Thing ${i}`, cat: 'kitchen', amount: toPence(10),
      purchasedOn: '2026-08-20', windowDays: 30, policy: 'p', distance: false, status: 'active',
    }));
    return {
      version: 1, receipts, updates: [], onboardingSeen: true,
      settings: { ...DEFAULT_SETTINGS, plan: 'free' }, alertsSent: [],
      screen: 'home', selId: null, obStep: 0, celebrating: null, shared: 'no', upgrading: false,
      sharedText: null, embedded: false, justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null,
    };
  };

  it('holds the free cap on the web', () => {
    // The other half of the pair: without it, "never full" would pass the iOS
    // case below by breaking the cap everywhere.
    withPlatform(false);
    expect(quotaFull(overFull())).toBe(true);
  });

  it('caps nothing on iOS, where there is no way past a cap', () => {
    withPlatform(true);
    expect(quotaFull(overFull())).toBe(false);
  });
});
