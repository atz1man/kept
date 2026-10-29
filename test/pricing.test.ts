import { afterEach, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { capsLibrary, offerFor, planLabel, PLAN_PRICES, RENEWAL_TERMS, restoreOnlyOffered, WEB_PLANS } from '../src/lib/pricing';
import { quotaFull, type AppState } from '../src/app/state';
import { FREE_TIER_LIMIT } from '../src/lib/quota';
import { DEFAULT_SETTINGS } from '../src/lib/storage';
import { toPence } from '../src/lib/money';
import type { Receipt } from '../src/lib/types';

/**
 * Quids In Plus, by the month or the year, and Family by the year.
 *
 * The product sold one unlock, paid once, and earned nothing after the day it
 * was bought for an app that keeps checking shops' windows and the law for as
 * long as it is used. It is a subscription now. What is worth asserting is
 * what makes that honest: every figure a person reads comes from the one table
 * here, so the landing page, Settings and the add screen cannot disagree, and
 * nothing anywhere still promises "no subscription" or "pay once".
 */
describe('what kept costs', () => {
  it('is three figures in pounds, the year about half twelve months', () => {
    for (const price of Object.values(PLAN_PRICES)) expect(price).toMatch(/^£\d+\.\d{2}$/);
    const pence = (p: string) => Math.round(Number(p.slice(1)) * 100);
    expect(pence(PLAN_PRICES.yearly)).toBeLessThanOrEqual(pence(PLAN_PRICES.monthly) * 12 * 0.51);
    // Family costs more than one person's year: it is the same unlock, shared.
    expect(pence(PLAN_PRICES.family)).toBeGreaterThan(pence(PLAN_PRICES.yearly));
  });

  const SRC = join(__dirname, '..', 'src');
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : [];
    });
  // Comments are history and may name the old unlock; what a person reads is
  // a string or JSX text, and comments are blanked before matching.
  const uncommented = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const PRICES = new RegExp(Object.values(PLAN_PRICES).map((p) => p.replace(/[.$]/g, '\\$&')).join('|'));
  const STALE = /no subscription(?! here)|pay once|paid once|one payment|single payment|unlocks? [^.]*for good/i;

  it('writes each plan’s price in one place only', () => {
    const offenders = walk(SRC).filter((f) => !f.endsWith(join('lib', 'pricing.ts')) && PRICES.test(uncommented(readFileSync(f, 'utf8'))));
    expect(offenders.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });

  it('no longer promises the one-off unlock anywhere in the product', () => {
    const offenders = walk(SRC).filter((f) => STALE.test(uncommented(readFileSync(f, 'utf8'))));
    expect(offenders.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });

  it('would notice either if one came back', () => {
    // A sweep over an empty match reports success for a question it never asked.
    for (const p of Object.values(PLAN_PRICES)) expect(PRICES.test(`{ price: '${p}' }`), p).toBe(true);
    for (const s of ['One payment, no subscription', 'Pay once', 'a single payment unlocks unlimited receipts for good']) {
      expect(STALE.test(s), s).toBe(true);
    }
    // The web's own sentence is the one place "no subscription" is still true.
    expect(STALE.test('There is no subscription here to cancel.')).toBe(false);
    expect(walk(SRC).length).toBeGreaterThan(20);
  });

  it('says how a subscription renews and how to stop it', () => {
    expect(RENEWAL_TERMS).toMatch(/renew/i);
    expect(RENEWAL_TERMS).toMatch(/cancel/i);
    expect(RENEWAL_TERMS).toMatch(/24 hours/);
  });
});

/**
 * What each build sells, and so what it caps.
 *
 * The web sells its free local unlock at the one price. The iPhone app sells
 * only what the App Store says it sells, at the App Store's price: guideline
 * 3.1.1 allows nothing else, and before StoreKit it sold nothing (APN-18).
 * Where nothing is sold there is no cap, because a cap with no way past it is
 * a wall. And while the App Store cannot be asked, the price it last quoted
 * keeps the cap standing: otherwise airplane mode would be a way round it.
 *
 * The cap half is checked through the same `quotaFull` the add screen reads.
 * The price half is also checked against the bundle booted as native, with
 * StoreKit emulated, in scripts/ios-bundle.mjs.
 */
describe('what each build sells', () => {
  const plans = [{ id: 'yearly', price: '£29.99' }, { id: 'monthly', price: '£4.99' }, { id: 'family', price: '£49.99' }] as const;
  const forSale = { kind: 'for-sale', plans: [...plans], canPay: true } as const;

  it('sells the web’s plans at the landing page’s prices, whatever the App Store says', () => {
    expect(offerFor(false, { kind: 'absent' }, null)).toEqual({ kind: 'web', plans: WEB_PLANS });
    expect(offerFor(false, forSale, '£29.99')).toEqual({ kind: 'web', plans: WEB_PLANS });
    expect(WEB_PLANS.map((p) => p.id)).toEqual(['yearly', 'monthly', 'family']);
  });

  it('sells on iPhone exactly what the App Store sells, at its prices', () => {
    expect(offerFor(true, forSale, null)).toEqual({ kind: 'app-store', plans: [...plans], canPay: true });
    // Another storefront's price is shown as Apple wrote it.
    const euro = { kind: 'for-sale', plans: [{ id: 'monthly', price: '5,99 €' }], canPay: true } as const;
    expect(offerFor(true, euro, '£29.99')).toEqual({ kind: 'app-store', plans: [{ id: 'monthly', price: '5,99 €' }], canPay: true });
    expect(offerFor(true, { ...forSale, canPay: false }, null)).toEqual({ kind: 'app-store', plans: [...plans], canPay: false });
  });

  it('sells nothing on iPhone with no StoreKit, or where the App Store does not sell the unlock', () => {
    // Even with a price remembered: those are answers, not silence.
    expect(offerFor(true, { kind: 'absent' }, '£29.99')).toEqual({ kind: 'none' });
    expect(offerFor(true, { kind: 'not-for-sale' }, '£29.99')).toEqual({ kind: 'none' });
  });

  it('keeps the offer, at the last price, while the App Store cannot be asked', () => {
    const remembered = { kind: 'app-store', plans: [{ id: 'yearly', price: '£29.99' }], canPay: true };
    expect(offerFor(true, { kind: 'unreachable' }, '£29.99')).toEqual(remembered);
    expect(offerFor(true, { kind: 'asking' }, '£29.99')).toEqual(remembered);
  });

  it('offers nothing before the App Store has ever answered', () => {
    expect(offerFor(true, { kind: 'unreachable' }, null)).toEqual({ kind: 'none' });
    expect(offerFor(true, { kind: 'asking' }, null)).toEqual({ kind: 'none' });
  });

  it('caps the library exactly where something is offered', () => {
    expect(capsLibrary({ kind: 'web', plans: WEB_PLANS })).toBe(true);
    // Purchases switched off still caps: the door is there, and its key is in
    // Screen Time, which the button's place says.
    expect(capsLibrary({ kind: 'app-store', plans: [...plans], canPay: false })).toBe(true);
    expect(capsLibrary({ kind: 'none' })).toBe(false);
  });

  it('words each plan’s button the same way wherever it is', () => {
    expect(planLabel({ id: 'yearly', price: '£29.99' })).toBe('Plus · £29.99 a year');
    expect(planLabel({ id: 'monthly', price: '£4.99' })).toBe('Plus · £4.99 a month');
    expect(planLabel({ id: 'family', price: '£49.99' })).toBe('Family · £49.99 a year');
    expect(planLabel({ id: 'monthly', price: '5,99 €' })).toBe('Plus · 5,99 € a month');
  });

  const withPlatform = (native: boolean) => {
    (globalThis as { window?: unknown }).window = native
      ? { Capacitor: { isNativePlatform: () => true } }
      : {};
  };
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  /** A library one past the cap, none of it sample data. */
  const overFull = (over: Partial<AppState> = {}, plan: 'free' | 'pro' = 'free', appStorePrice: string | null = null): AppState => {
    const receipts: Receipt[] = Array.from({ length: FREE_TIER_LIMIT + 1 }, (_, i) => ({
      id: `r${i}`, store: 'Argos', item: `Thing ${i}`, cat: 'kitchen', amount: toPence(10),
      purchasedOn: '2026-08-20', windowDays: 30, policy: 'p', distance: false, status: 'active',
    }));
    return {
      version: 1, receipts, updates: [], onboardingSeen: true,
      settings: { ...DEFAULT_SETTINGS, plan, appStorePrice }, alertsLate: {}, reviewAsked: null, alertsSent: [],
      screen: 'home', selId: null, obStep: 0, celebrating: null, shared: 'no', upgrading: false, store: { shelf: { kind: 'asking' }, busy: null, note: null },
      sharedText: null, embedded: false, justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null, justUnswapped: null, restored: null,
      ...over,
    };
  };

  it('holds the free cap on the web', () => {
    // The other half of each pair below: without it, "never full" would pass
    // the iPhone cases by breaking the cap everywhere.
    withPlatform(false);
    expect(quotaFull(overFull())).toBe(true);
  });

  it('caps nothing on an iPhone with no StoreKit, where there is no way past a cap', () => {
    withPlatform(true);
    expect(quotaFull(overFull({ store: { shelf: { kind: 'absent' }, busy: null, note: null } }))).toBe(false);
  });

  it('holds the cap on an iPhone where the App Store sells Plus', () => {
    withPlatform(true);
    expect(quotaFull(overFull({ store: { shelf: forSale, busy: null, note: null } }))).toBe(true);
  });

  it('holds the cap offline on an iPhone the App Store has answered before', () => {
    withPlatform(true);
    expect(quotaFull(overFull({ store: { shelf: { kind: 'unreachable' }, busy: null, note: null } }, 'free', '£29.99'))).toBe(true);
  });

  it('lifts the cap for someone who holds Plus', () => {
    withPlatform(true);
    expect(quotaFull(overFull({ store: { shelf: forSale, busy: null, note: null } }, 'pro', '£29.99'))).toBe(false);
  });
});

describe('restore, when there is nothing to buy', () => {
  /*
   * Measured on main with the App Store withholding the product (offline on a
   * first launch, or the product not yet attached in App Store Connect):
   * Settings showed no plan, no price and no "Restore purchase" — the screen
   * App Review's own notes send the reviewer to was empty, and someone who had
   * bought on another iPhone had no way back to it.
   */
  const none = offerFor(true, { kind: 'not-for-sale' }, null);
  it('is offered on iPhone whenever StoreKit is there', () => {
    expect(none.kind).toBe('none');
    for (const shelf of [{ kind: 'not-for-sale' }, { kind: 'unreachable' }, { kind: 'asking' }] as const) {
      expect(restoreOnlyOffered(true, offerFor(true, shelf, null), shelf, true), shelf.kind).toBe(true);
    }
  });
  it('is not offered where StoreKit is absent, on the web, on a paid plan, or beside a real offer', () => {
    expect(restoreOnlyOffered(true, none, { kind: 'absent' }, true)).toBe(false);
    expect(restoreOnlyOffered(false, none, { kind: 'not-for-sale' }, true)).toBe(false);
    expect(restoreOnlyOffered(true, none, { kind: 'not-for-sale' }, false)).toBe(false);
    const plans = [{ id: 'yearly', price: '£29.99' }, { id: 'monthly', price: '£4.99' }, { id: 'family', price: '£49.99' }] as const;
  const forSale = { kind: 'for-sale', plans: [...plans], canPay: true } as const;
    expect(restoreOnlyOffered(true, offerFor(true, forSale, null), forSale, true)).toBe(false);
  });
});
