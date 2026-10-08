import { afterEach, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { capsLibrary, offerFor, unlockLabel, UNLOCK, restoreOnlyOffered } from '../src/lib/pricing';
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
  const forSale = { kind: 'for-sale', price: '£9.99', canPay: true } as const;

  it('sells the web’s unlock at the one price, whatever the App Store says', () => {
    expect(offerFor(false, { kind: 'absent' }, null)).toEqual({ kind: 'web', price: UNLOCK.price });
    expect(offerFor(false, forSale, '£9.99')).toEqual({ kind: 'web', price: UNLOCK.price });
  });

  it('sells on iPhone exactly what the App Store sells, at its price', () => {
    expect(offerFor(true, forSale, null)).toEqual({ kind: 'app-store', price: '£9.99', canPay: true });
    // Another storefront's price is shown as Apple wrote it, not as £9.99.
    expect(offerFor(true, { kind: 'for-sale', price: '9,99 €', canPay: true }, '£9.99')).toEqual({ kind: 'app-store', price: '9,99 €', canPay: true });
    expect(offerFor(true, { kind: 'for-sale', price: '£9.99', canPay: false }, null)).toEqual({ kind: 'app-store', price: '£9.99', canPay: false });
  });

  it('sells nothing on iPhone with no StoreKit, or where the App Store does not sell the unlock', () => {
    // Even with a price remembered: those are answers, not silence.
    expect(offerFor(true, { kind: 'absent' }, '£9.99')).toEqual({ kind: 'none' });
    expect(offerFor(true, { kind: 'not-for-sale' }, '£9.99')).toEqual({ kind: 'none' });
  });

  it('keeps the offer, at the last price, while the App Store cannot be asked', () => {
    expect(offerFor(true, { kind: 'unreachable' }, '£9.99')).toEqual({ kind: 'app-store', price: '£9.99', canPay: true });
    expect(offerFor(true, { kind: 'asking' }, '£9.99')).toEqual({ kind: 'app-store', price: '£9.99', canPay: true });
  });

  it('offers nothing before the App Store has ever answered', () => {
    expect(offerFor(true, { kind: 'unreachable' }, null)).toEqual({ kind: 'none' });
    expect(offerFor(true, { kind: 'asking' }, null)).toEqual({ kind: 'none' });
  });

  it('caps the library exactly where something is offered', () => {
    expect(capsLibrary({ kind: 'web', price: UNLOCK.price })).toBe(true);
    expect(capsLibrary({ kind: 'app-store', price: null, canPay: true })).toBe(true);
    // Purchases switched off still caps: the door is there, and its key is in
    // Screen Time, which the button's place says.
    expect(capsLibrary({ kind: 'app-store', price: '£9.99', canPay: false })).toBe(true);
    expect(capsLibrary({ kind: 'none' })).toBe(false);
  });

  it('words the button the same way wherever it is', () => {
    expect(unlockLabel('£9.99')).toBe('Unlock unlimited · £9.99 once');
    expect(unlockLabel(UNLOCK.price)).toBe(`Unlock unlimited · ${UNLOCK.price}${UNLOCK.suffix}`);
    expect(unlockLabel(null)).toBe('Unlock unlimited');
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

  it('holds the cap on an iPhone where the App Store sells the unlock', () => {
    withPlatform(true);
    expect(quotaFull(overFull({ store: { shelf: forSale, busy: null, note: null } }))).toBe(true);
  });

  it('holds the cap offline on an iPhone the App Store has answered before', () => {
    withPlatform(true);
    expect(quotaFull(overFull({ store: { shelf: { kind: 'unreachable' }, busy: null, note: null } }, 'free', '£9.99'))).toBe(true);
  });

  it('lifts the cap for someone who bought the unlock', () => {
    withPlatform(true);
    expect(quotaFull(overFull({ store: { shelf: forSale, busy: null, note: null } }, 'pro', '£9.99'))).toBe(false);
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
    const forSale = { kind: 'for-sale', price: '£9.99', canPay: true } as const;
    expect(restoreOnlyOffered(true, offerFor(true, forSale, null), forSale, true)).toBe(false);
  });
});
