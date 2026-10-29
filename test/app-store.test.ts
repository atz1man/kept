import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  noteFor,
  ownershipNote,
  planAfter,
  PURCHASES_OFF,
  readOwnership,
  readPrice,
  readPurchase,
  readRestore,
  readShelf,
  reasonFromError,
  rememberedPrice,
  shelfFromError,
  STORE_ASKING,
  ENTITLEMENT_IDS,
  LEGACY_UNLOCK_ID,
  PLAN_ORDER,
  PLAN_PRODUCTS,
  type FailReason,
  type Outcome,
} from '../src/lib/app-store';
import { PLAN_PRICES } from '../src/lib/pricing';
import { reducer, type AppState } from '../src/app/state';
import { DEFAULT_SETTINGS } from '../src/lib/storage';

/**
 * The unlock on iPhone: every decision StoreKit's answers lead to.
 *
 * The money path is where an untested branch costs someone money, in one of
 * two ways: charged and still locked, or locked out of what they paid for.
 * The native half cannot run here, so the decisions live in lib/app-store.ts
 * and are pinned below. Then the Swift is held to the TypeScript by name,
 * because a renamed method on one side is invisible until a phone runs it.
 */

const ROOT = join(__dirname, '..');

describe('reading what StoreKit says', () => {
  it('takes a price exactly as the App Store wrote it, for any storefront', () => {
    expect(readPrice('£9.99')).toBe('£9.99');
    expect(readPrice('9,99 €')).toBe('9,99 €');
    expect(readPrice(' CHF 10.00 ')).toBe('CHF 10.00');
  });

  it('refuses anything that is not a price', () => {
    for (const raw of ['', '   ', 'free', 'x'.repeat(30) + '1', 9.99, null, undefined, {}]) expect(readPrice(raw), String(raw)).toBeNull();
  });

  it('finds each plan on the shelf, in the order they are offered, with whether purchases are allowed', () => {
    const products = [
      { id: 'something.else', displayPrice: '£1.99' },
      { id: PLAN_PRODUCTS.family, displayPrice: '£49.99' },
      { id: PLAN_PRODUCTS.monthly, displayPrice: '£4.99' },
      { id: PLAN_PRODUCTS.yearly, displayPrice: '£29.99' },
    ];
    const plans = [{ id: 'yearly', price: '£29.99' }, { id: 'monthly', price: '£4.99' }, { id: 'family', price: '£49.99' }];
    expect(readShelf({ products, canPay: true })).toEqual({ kind: 'for-sale', plans, canPay: true });
    expect(readShelf({ products, canPay: false })).toEqual({ kind: 'for-sale', plans, canPay: false });
    // Only an explicit refusal turns the buttons off.
    expect(readShelf({ products })).toEqual({ kind: 'for-sale', plans, canPay: true });
    // A plan the App Store does not sell here is simply not offered.
    expect(readShelf({ products: [{ id: PLAN_PRODUCTS.monthly, displayPrice: '5,99 €' }] })).toEqual({
      kind: 'for-sale', plans: [{ id: 'monthly', price: '5,99 €' }], canPay: true,
    });
  });

  it('reads an answer with no plan as not for sale: not live yet, or not in this storefront', () => {
    expect(readShelf({ products: [], canPay: true })).toEqual({ kind: 'not-for-sale' });
    expect(readShelf({ products: [{ id: 'something.else', displayPrice: '£1.99' }] })).toEqual({ kind: 'not-for-sale' });
    expect(readShelf({ products: [{ id: PLAN_PRODUCTS.yearly, displayPrice: '' }] })).toEqual({ kind: 'not-for-sale' });
    // The old one-off unlock is never sold again, even if the App Store still lists it.
    expect(readShelf({ products: [{ id: LEGACY_UNLOCK_ID, displayPrice: '£9.99' }] })).toEqual({ kind: 'not-for-sale' });
  });

  it('reads a malformed answer as no answer, so it cannot clear the remembered price', () => {
    for (const raw of [null, undefined, 'products', {}, { products: 'kept.plus.yearly' }]) expect(readShelf(raw)).toEqual({ kind: 'unreachable' });
  });

  it('tells "nothing to buy with here" from "could not reach the App Store"', () => {
    // Capacitor's codes: no plugin in this build, and StoreKit 2's iOS 15 floor.
    expect(shelfFromError({ code: 'UNIMPLEMENTED' })).toEqual({ kind: 'absent' });
    expect(shelfFromError({ code: 'UNAVAILABLE' })).toEqual({ kind: 'absent' });
    for (const e of [{ code: 'network' }, { code: 'unknown' }, new Error('timeout'), null]) expect(shelfFromError(e)).toEqual({ kind: 'unreachable' });
  });

  it('reads ownership, and treats an unverified or garbled answer as deciding nothing', () => {
    expect(readOwnership({ state: 'owned' })).toBe('owned');
    expect(readOwnership({ state: 'revoked' })).toBe('revoked');
    expect(readOwnership({ state: 'expired' })).toBe('expired');
    expect(readOwnership({ state: 'none' })).toBe('none');
    for (const raw of [{ state: 'unverified' }, { state: 'OWNED' }, { owned: true }, null, 'owned']) expect(readOwnership(raw)).toBe('unknown');
  });

  it('reads each purchase outcome', () => {
    expect(readPurchase({ outcome: 'purchased' })).toEqual({ kind: 'purchased' });
    expect(readPurchase({ outcome: 'pending' })).toEqual({ kind: 'pending' });
    expect(readPurchase({ outcome: 'cancelled' })).toEqual({ kind: 'cancelled' });
    expect(readPurchase({ outcome: 'unverified' })).toEqual({ kind: 'unverified' });
    expect(readPurchase({ outcome: 'failed', reason: 'network' })).toEqual({ kind: 'failed', reason: 'network' });
    expect(readPurchase({ outcome: 'failed', reason: 'not-allowed' })).toEqual({ kind: 'failed', reason: 'not-allowed' });
  });

  it('never reads anything unrecognised as a purchase', () => {
    for (const raw of [{ outcome: 'PURCHASED' }, { purchased: true }, { outcome: 'success' }, null, 'purchased', {}]) {
      expect(readPurchase(raw), JSON.stringify(raw)).toEqual({ kind: 'failed', reason: 'unknown' });
    }
  });

  it('reads a restore by what StoreKit holds after the sync', () => {
    expect(readRestore({ outcome: 'synced' }, 'owned')).toEqual({ kind: 'restored' });
    expect(readRestore({ outcome: 'synced' }, 'none')).toEqual({ kind: 'nothing-to-restore' });
    expect(readRestore({ outcome: 'synced' }, 'revoked')).toEqual({ kind: 'nothing-to-restore' });
    expect(readRestore({ outcome: 'synced' }, 'expired')).toEqual({ kind: 'nothing-to-restore' });
    // A sync followed by silence is not "you never bought it".
    expect(readRestore({ outcome: 'synced' }, 'unknown')).toEqual({ kind: 'restore-failed', reason: 'unknown' });
    expect(readRestore({ outcome: 'cancelled' }, 'owned')).toEqual({ kind: 'cancelled' });
    expect(readRestore({ outcome: 'failed', reason: 'network' }, 'unknown')).toEqual({ kind: 'restore-failed', reason: 'network' });
    expect(readRestore(null, 'owned')).toEqual({ kind: 'restore-failed', reason: 'unknown' });
  });

  it('reads the reason a call was refused with', () => {
    expect(reasonFromError({ code: 'network' })).toBe('network');
    expect(reasonFromError({ code: 'UNIMPLEMENTED' })).toBe('unknown');
    expect(reasonFromError(new Error('x'))).toBe('unknown');
  });
});

describe('what the answers decide', () => {
  it('unlocks on ownership and relocks only on a revocation or an expiry, never on silence', () => {
    expect(planAfter('free', 'owned')).toBe('pro');
    expect(planAfter('pro', 'revoked')).toBe('free');
    // A subscription whose paid period ended unrenewed is a verified answer.
    expect(planAfter('pro', 'expired')).toBe('free');
    expect(planAfter('free', 'expired')).toBe('free');
    // A new phone says "none" before its records arrive: a paying customer
    // must not be locked out by a record that is slow to arrive.
    expect(planAfter('pro', 'none')).toBe('pro');
    expect(planAfter('pro', 'unknown')).toBe('pro');
    expect(planAfter('free', 'none')).toBe('free');
    expect(planAfter('free', 'revoked')).toBe('free');
    // And silence never unlocks: an unverified or garbled answer is `unknown`.
    expect(planAfter('free', 'unknown')).toBe('free');
  });

  it('remembers the first plan’s price until the App Store says otherwise', () => {
    const shelf = (price: string) => ({ kind: 'for-sale', plans: [{ id: 'yearly', price }, { id: 'monthly', price: '£4.99' }], canPay: true }) as const;
    expect(rememberedPrice(shelf('£29.99'), null)).toBe('£29.99');
    expect(rememberedPrice(shelf('£34.99'), '£29.99')).toBe('£34.99');
    expect(rememberedPrice({ kind: 'not-for-sale' }, '£29.99')).toBeNull();
    expect(rememberedPrice({ kind: 'absent' }, '£29.99')).toBeNull();
    // Silence keeps it: this is what stops offline lifting the cap.
    expect(rememberedPrice({ kind: 'unreachable' }, '£29.99')).toBe('£29.99');
    expect(rememberedPrice({ kind: 'asking' }, '£29.99')).toBe('£29.99');
  });
});

describe('what the app says', () => {
  const failures: FailReason[] = ['network', 'not-allowed', 'not-for-sale', 'unknown'];
  const everyOutcome: Outcome[] = [
    { kind: 'purchased' }, { kind: 'pending' }, { kind: 'cancelled' }, { kind: 'unverified' },
    ...failures.map((reason) => ({ kind: 'failed' as const, reason })),
    { kind: 'restored' }, { kind: 'nothing-to-restore' },
    ...failures.map((reason) => ({ kind: 'restore-failed' as const, reason })),
  ];

  it('says nothing about a cancelled sheet, and something about everything else', () => {
    expect(noteFor({ kind: 'cancelled' })).toBeNull();
    for (const o of everyOutcome.filter((x) => x.kind !== 'cancelled')) expect(noteFor(o)?.text, JSON.stringify(o)).toBeTruthy();
  });

  it('claims nothing was charged only where that is certain', () => {
    /*
     * "Was I charged?" is the next question after any failure, and a wrong
     * "no" is a claim about somebody's bank account. It is certain only when
     * the purchase never started because the App Store had nothing to sell.
     * A dropped connection mid-purchase can still end in a charge.
     */
    const claims = everyOutcome.filter((o) => /nothing was charged|not been charged|weren’t charged/i.test(noteFor(o)?.text ?? ''));
    expect(claims).toEqual([{ kind: 'failed', reason: 'not-for-sale' }]);
  });

  it('says what happens if a failed purchase charged them after all', () => {
    for (const reason of ['network', 'unknown'] as const) {
      expect(noteFor({ kind: 'failed', reason })?.text).toMatch(/Quids In unlocks by itself/);
    }
    expect(noteFor({ kind: 'unverified' })?.text).toMatch(/Restore purchase/);
  });

  it('says where purchases are switched off, the one place to change it', () => {
    expect(noteFor({ kind: 'failed', reason: 'not-allowed' })?.text).toBe(PURCHASES_OFF);
    expect(PURCHASES_OFF).toMatch(/Screen Time/);
  });

  it('marks good news, waiting and failures apart', () => {
    expect(noteFor({ kind: 'purchased' })?.tone).toBe('ok');
    expect(noteFor({ kind: 'restored' })?.tone).toBe('ok');
    expect(noteFor({ kind: 'pending' })?.tone).toBe('wait');
    expect(noteFor({ kind: 'unverified' })?.tone).toBe('bad');
    for (const reason of failures) expect(noteFor({ kind: 'failed', reason })?.tone).toBe('bad');
  });

  it('says so when the plan moves by itself, and not otherwise', () => {
    expect(ownershipNote('free', 'pro')?.tone).toBe('ok');
    const relocked = ownershipNote('pro', 'free');
    expect(relocked?.tone).toBe('bad');
    expect(relocked?.text).toMatch(/Nothing you’ve saved is lost/);
    expect(ownershipNote('free', 'free')).toBeNull();
    expect(ownershipNote('pro', 'pro')).toBeNull();
  });
});

describe('the reducer, as StoreKit answers', () => {
  const base = (plan: 'free' | 'pro' = 'free', appStorePrice: string | null = null): AppState => ({
    version: 1, receipts: [], updates: [], onboardingSeen: true,
    settings: { ...DEFAULT_SETTINGS, plan, appStorePrice }, alertsLate: {}, reviewAsked: null, alertsSent: [],
    screen: 'settings', selId: null, obStep: 0, celebrating: null, shared: 'no', upgrading: false, store: STORE_ASKING,
    sharedText: null, embedded: false, justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null, justUnswapped: null, restored: null,
  });
  const today = new Date(2026, 9, 4);

  it('remembers the price the App Store quotes, and forgets it when Plus comes off sale', () => {
    const forSale = { kind: 'for-sale', plans: [{ id: 'yearly', price: '£29.99' }], canPay: true } as const;
    const shelved = reducer(base(), { type: 'store-shelf', shelf: forSale }, today);
    expect(shelved.settings.appStorePrice).toBe('£29.99');
    expect(shelved.store.shelf).toEqual(forSale);
    expect(reducer(shelved, { type: 'store-shelf', shelf: { kind: 'unreachable' } }, today).settings.appStorePrice).toBe('£29.99');
    expect(reducer(shelved, { type: 'store-shelf', shelf: { kind: 'not-for-sale' } }, today).settings.appStorePrice).toBeNull();
  });

  it('unlocks on a verified purchase or a restore that found one, and on nothing else', () => {
    for (const outcome of [{ kind: 'purchased' }, { kind: 'restored' }] as const) {
      expect(reducer(base(), { type: 'store-outcome', outcome }, today).settings.plan).toBe('pro');
    }
    const others: Outcome[] = [
      { kind: 'pending' }, { kind: 'cancelled' }, { kind: 'unverified' }, { kind: 'failed', reason: 'unknown' },
      { kind: 'nothing-to-restore' }, { kind: 'restore-failed', reason: 'network' },
    ];
    for (const outcome of others) expect(reducer(base(), { type: 'store-outcome', outcome }, today).settings.plan, outcome.kind).toBe('free');
  });

  it('ends the wait and says the outcome', () => {
    const busy = reducer(base(), { type: 'store-busy', busy: 'buying' }, today);
    expect(busy.store.busy).toBe('buying');
    const done = reducer(busy, { type: 'store-outcome', outcome: { kind: 'pending' } }, today);
    expect(done.store.busy).toBeNull();
    expect(done.store.note?.tone).toBe('wait');
    // A new request clears the old answer rather than leaving it beside the new wait.
    expect(reducer(done, { type: 'store-busy', busy: 'restoring' }, today).store.note).toBeNull();
  });

  it('follows ownership when StoreKit reports it: an approval unlocks, a refund relocks', () => {
    const approved = reducer(base('free'), { type: 'store-ownership', ownership: 'owned' }, today);
    expect(approved.settings.plan).toBe('pro');
    expect(approved.store.note?.tone).toBe('ok');
    const refunded = reducer(base('pro'), { type: 'store-ownership', ownership: 'revoked' }, today);
    expect(refunded.settings.plan).toBe('free');
    expect(refunded.store.note?.tone).toBe('bad');
    const lapsed = reducer(base('pro'), { type: 'store-ownership', ownership: 'expired' }, today);
    expect(lapsed.settings.plan).toBe('free');
    expect(lapsed.store.note?.text).toMatch(/subscription has ended/);
  });

  it('changes nothing at all on an answer that decides nothing', () => {
    // The same object, so a launch that confirms what was stored writes nothing.
    for (const ownership of ['none', 'unknown'] as const) {
      for (const plan of ['free', 'pro'] as const) {
        const s = base(plan);
        expect(reducer(s, { type: 'store-ownership', ownership }, today), `${plan} + ${ownership}`).toBe(s);
      }
    }
    const owned = base('pro');
    expect(reducer(owned, { type: 'store-ownership', ownership: 'owned' }, today)).toBe(owned);
  });

  it('keeps the purchase through Erase everything, which erases what is on the phone, not what was paid for', () => {
    const wiped = reducer(base('pro', '£29.99'), { type: 'wipe' }, today);
    expect(wiped.settings.plan).toBe('pro');
  });
});

describe('the Swift plugin and the TypeScript agree', () => {
  /*
   * The native half is never compiled or run here (CI's macOS job compiles it,
   * and nothing runs it but a phone). A method renamed on one side, an event
   * spelled differently, or an outcome the reader does not know would each
   * pass every other test and fail on the first real purchase, as a button
   * that does nothing or a payment that never unlocks. So each name crossing
   * the bridge is read out of both files and compared.
   */
  const swift = readFileSync(join(ROOT, 'packages', 'purchases', 'ios', 'Sources', 'PurchasesPlugin', 'PurchasesPlugin.swift'), 'utf8');
  const wrapper = readFileSync(join(ROOT, 'src', 'app', 'purchases.ts'), 'utf8');
  const lib = readFileSync(join(ROOT, 'src', 'lib', 'app-store.ts'), 'utf8');

  const swiftMethods = [...swift.matchAll(/CAPPluginMethod\(name: "(\w+)"/g)].map((m) => m[1]).sort();
  const swiftFuncs = [...swift.matchAll(/@objc func (\w+)\(_ call: CAPPluginCall\)/g)].map((m) => m[1]).sort();
  const tsMethods = [
    ...(wrapper.match(/interface PurchasesPlugin \{([\s\S]*?)\n\}/)?.[1] ?? '').matchAll(/^\s+(\w+)\(/gm),
  ].map((m) => m[1]).filter((name) => name !== 'addListener').sort();

  it('finds the names it is meant to be checking', () => {
    expect(swiftMethods.length).toBeGreaterThanOrEqual(4);
    expect(tsMethods.length).toBeGreaterThanOrEqual(4);
  });

  it('declares the same methods on both sides, each with an implementation', () => {
    expect(swiftMethods).toEqual(tsMethods);
    expect(swiftFuncs).toEqual(swiftMethods);
  });

  it('names the plugin and its one event the same way', () => {
    expect(swift).toContain('public let jsName = "Purchases"');
    expect(wrapper).toContain("registerPlugin<PurchasesPlugin>('Purchases')");
    const events = [...swift.matchAll(/notifyListeners\("(\w+)"/g)].map((m) => m[1]);
    expect(events).toEqual(['entitlementChanged']);
    expect(wrapper).toContain("addListener('entitlementChanged'");
  });

  it('answers only with outcomes, states and reasons the reader knows', () => {
    // Every string literal the Swift resolves under these keys.
    const said = (key: string) => [...swift.matchAll(new RegExp(`"${key}": "([\\w-]+)"`, 'g'))].map((m) => m[1]);
    const ternary = (key: string) =>
      [...swift.matchAll(new RegExp(`"${key}": [^\\]]*?\\? "([\\w-]+)" : "([\\w-]+)"`, 'g'))].flatMap((m) => [m[1], m[2]]);
    const outcomes = new Set([...said('outcome'), ...ternary('outcome')]);
    const states = new Set([...said('state'), ...ternary('state')]);
    const reasons = new Set([...said('reason'), ...[...swift.matchAll(/return "([\w-]+)"/g)].map((m) => m[1])]);
    expect([...outcomes].sort()).toEqual(['cancelled', 'failed', 'pending', 'purchased', 'synced', 'unverified']);
    for (const outcome of outcomes) {
      if (outcome === 'synced') expect(readRestore({ outcome }, 'owned').kind).toBe('restored');
      else if (outcome === 'failed') expect(readPurchase({ outcome, reason: 'network' })).toEqual({ kind: 'failed', reason: 'network' });
      else expect(readPurchase({ outcome }).kind, `"${outcome}" from Swift is not read`).toBe(outcome);
    }
    expect([...states].sort()).toEqual(['expired', 'none', 'owned', 'revoked', 'unverified']);
    for (const state of states) expect(readOwnership({ state })).toBe(state === 'unverified' ? 'unknown' : state);
    for (const reason of reasons) {
      if (reason === 'cancelled') continue;
      expect(reasonFromError({ code: reason }), `reason "${reason}" from Swift is not read`).toBe(reason);
    }
  });

  it('asks for each plan by the id App Store Connect and the StoreKit file use', () => {
    for (const id of PLAN_ORDER) expect(lib).toContain(`${id}: '${PLAN_PRODUCTS[id]}'`);
    expect(lib).toContain(`LEGACY_UNLOCK_ID = '${LEGACY_UNLOCK_ID}'`);
    expect(ENTITLEMENT_IDS).toEqual([...PLAN_ORDER.map((id) => PLAN_PRODUCTS[id]), LEGACY_UNLOCK_ID]);
    const config = JSON.parse(readFileSync(join(ROOT, 'ios', 'App', 'Kept.storekit'), 'utf8')) as {
      products: { productID: string; type: string }[];
      subscriptionGroups: {
        name: string;
        subscriptions: { productID: string; type: string; displayPrice: string; familyShareable: boolean; recurringSubscriptionPeriod: string }[];
      }[];
      settings: { _storefront: string };
    };
    // One group, so a person holds one plan and moving between them is Apple's upgrade, not a second charge.
    expect(config.subscriptionGroups).toHaveLength(1);
    const subs = config.subscriptionGroups[0].subscriptions;
    expect(subs.map((p) => p.productID)).toEqual(PLAN_ORDER.map((id) => PLAN_PRODUCTS[id]));
    for (const sub of subs) expect(sub.type).toBe('RecurringSubscription');
    const by = (id: string) => subs.find((p) => p.productID === id)!;
    // The prices someone testing in Xcode sees are the prices the landing page shows.
    for (const id of PLAN_ORDER) expect(`£${by(PLAN_PRODUCTS[id]).displayPrice}`, id).toBe(PLAN_PRICES[id]);
    expect(by(PLAN_PRODUCTS.monthly).recurringSubscriptionPeriod).toBe('P1M');
    expect(by(PLAN_PRODUCTS.yearly).recurringSubscriptionPeriod).toBe('P1Y');
    expect(by(PLAN_PRODUCTS.family).recurringSubscriptionPeriod).toBe('P1Y');
    // Family is Family because it is shared; the others are one person's.
    expect(subs.map((p) => [p.productID, p.familyShareable])).toEqual([
      [PLAN_PRODUCTS.yearly, false], [PLAN_PRODUCTS.monthly, false], [PLAN_PRODUCTS.family, true],
    ]);
    // The old unlock stays testable, so restoring it can be tried in Xcode.
    expect(config.products.map((p) => [p.productID, p.type])).toEqual([[LEGACY_UNLOCK_ID, 'NonConsumable']]);
    expect(config.settings._storefront).toBe('GBR');
  });
});
