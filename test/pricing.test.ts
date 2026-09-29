import { afterEach, describe, expect, it } from 'vitest';
import { FEATURED_TIER, sellsPaidTiers, TIERS } from '../src/lib/pricing';
import { quotaFull, type AppState } from '../src/app/state';
import { FREE_TIER_LIMIT } from '../src/lib/quota';
import { DEFAULT_SETTINGS } from '../src/lib/storage';
import { toPence } from '../src/lib/money';
import type { Receipt } from '../src/lib/types';

/**
 * The tier every upsell points at.
 *
 * `TIERS.find((t) => t.featured) ?? TIERS[0]` — the fallback index was the only
 * mutation this file had and it survived, because the fallback is unreachable
 * while exactly one tier is featured. Which is the property worth asserting:
 * TWO featured tiers would make `find` pick whichever came first and the
 * fallback would still never run, so the mutation would stay invisible while
 * the page grew a second highlighted price.
 */
describe('the tier the app points at', () => {
  it('is exactly one of them, which is what makes the fallback unreachable', () => {
    expect(TIERS.filter((t) => t.featured)).toHaveLength(1);
  });

  it('is the one found, not the one at the front of the list', () => {
    // Only meaningful because the featured tier is NOT first: if it were, this
    // would pass whether `find` worked or not.
    expect(TIERS[0].featured).not.toBe(true);
    expect(FEATURED_TIER).toBe(TIERS.find((t) => t.featured));
  });

  it('offers a way to pay once, and says the price of each', () => {
    expect(TIERS.map((t) => t.period)).toContain('lifetime');
    expect(TIERS.every((t) => /^£\d/.test(t.price))).toBe(true);
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
      screen: 'home', selId: null, obStep: 0, celebrating: null, shared: 'no', upgrading: null,
      sharedText: null, embedded: false, justDeleted: null, justKept: null, justReturned: null,
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
