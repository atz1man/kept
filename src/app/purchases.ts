/**
 * The App Store on iPhone, asked through packages/purchases (StoreKit 2).
 *
 * This file only carries the questions and the answers. What the answers
 * mean (for the plan, the cap, and what the app says) is lib/app-store.ts,
 * where it is tested. Every call here turns a refusal into an answer, so
 * nothing on this path can throw into the app: a plugin missing from the
 * build, an older iOS and a dead connection each become something the app
 * knows how to say.
 */
import { useCallback, useEffect, useRef } from 'react';
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { isNative } from '../lib/mirror';
import {
  ASK_BUDGET_MS,
  readOwnership,
  readPurchase,
  readRestore,
  readShelf,
  reasonFromError,
  shelfFromError,
  UNLOCK_PRODUCT_ID,
  type Outcome,
  type Ownership,
  type Shelf,
} from '../lib/app-store';
import type { Action } from './state';

interface PurchasesPlugin {
  products(options: { ids: string[] }): Promise<unknown>;
  purchase(options: { id: string }): Promise<unknown>;
  entitlement(options: { id: string }): Promise<unknown>;
  restore(): Promise<unknown>;
  requestReview(): Promise<unknown>;
  addListener(eventName: 'entitlementChanged', listener: () => void): Promise<PluginListenerHandle>;
}

const Purchases = registerPlugin<PurchasesPlugin>('Purchases');

/**
 * A question that has to come back. A call the bridge never answers would
 * leave the app "asking" for good. That is harmless for the cap, which does
 * not stand on a question, but it is untrue, so after the budget it is no
 * answer.
 */
function within<T>(asked: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('The App Store did not answer in time.')), ms);
  });
  return Promise.race([asked, late]).finally(() => clearTimeout(timer));
}

export async function askShelf(): Promise<Shelf> {
  try {
    return readShelf(await within(Purchases.products({ ids: [UNLOCK_PRODUCT_ID] }), ASK_BUDGET_MS));
  } catch (e) {
    return shelfFromError(e);
  }
}

export async function askOwnership(): Promise<Ownership> {
  try {
    return readOwnership(await within(Purchases.entitlement({ id: UNLOCK_PRODUCT_ID }), ASK_BUDGET_MS));
  } catch {
    return 'unknown';
  }
}

/** No time limit: the App Store's sheet stays up for as long as the person takes to decide. */
export async function buyUnlock(): Promise<Outcome> {
  try {
    return readPurchase(await Purchases.purchase({ id: UNLOCK_PRODUCT_ID }));
  } catch (e) {
    return { kind: 'failed', reason: reasonFromError(e) };
  }
}

/** No time limit either: the App Store may ask the person to sign in first. */
export async function restoreUnlock(): Promise<Outcome> {
  let synced: unknown;
  try {
    synced = await Purchases.restore();
  } catch (e) {
    return { kind: 'restore-failed', reason: reasonFromError(e) };
  }
  return readRestore(synced, await askOwnership());
}

/**
 * Asks iOS for the App Store's rating prompt. When to ask is decided in
 * lib/review-prompt.ts; this only carries the request. Nothing comes back
 * that matters: Apple decides whether its dialog appears and does not say,
 * so a refusal, a build without the plugin and an older iOS are all the same
 * answer, which is none.
 */
export function askForReview(): void {
  // Inside a promise, so a throw on the way in is swallowed with a refusal.
  Promise.resolve()
    .then(() => Purchases.requestReview())
    .catch(() => {});
}

/**
 * Called whenever StoreKit says ownership may have changed: an Ask to Buy
 * approval, a purchase on another device, a refund. A build without the
 * plugin has nothing to listen to, which is not an error.
 */
function onOwnershipChange(changed: () => void): () => void {
  let handle: PluginListenerHandle | undefined;
  let stopped = false;
  Purchases.addListener('entitlementChanged', changed).then(
    (h) => {
      if (stopped) void h.remove();
      else handle = h;
    },
    () => {},
  );
  return () => {
    stopped = true;
    void handle?.remove();
  };
}

/**
 * Asks the App Store, on iPhone, what it sells and whether this Apple ID owns
 * the unlock: once at launch, and again whenever StoreKit says ownership
 * changed. Returns the two things a person can do about it.
 *
 * Never in the landing page's demo, which is the web anyway, and never on the
 * web, where the unlock is the honest free flag (`UpgradeNotice`).
 */
export function useAppStore(dispatch: (action: Action) => void, embedded: boolean): { buy: () => void; restore: () => void } {
  const native = isNative() && !embedded;

  useEffect(() => {
    if (!native) return undefined;
    let live = true;
    const ownership = () => {
      void askOwnership().then((o) => {
        if (live) dispatch({ type: 'store-ownership', ownership: o });
      });
    };
    // Listening before asking, so a change landing between the two is not missed.
    const stop = onOwnershipChange(ownership);
    void askShelf().then((shelf) => {
      if (live) dispatch({ type: 'store-shelf', shelf });
    });
    ownership();
    return () => {
      live = false;
      stop();
    };
  }, [native, dispatch]);

  /*
   * One request at a time. The buttons wait while one is in flight, but a
   * double tap lands before the re-render that disables them, and two
   * purchase sheets for one unlock is a real way to be confused about what
   * you paid.
   */
  const inFlight = useRef(false);
  const once = useCallback(
    (busy: 'buying' | 'restoring', ask: () => Promise<Outcome>) => {
      if (inFlight.current) return;
      inFlight.current = true;
      dispatch({ type: 'store-busy', busy });
      void ask()
        .then((outcome) => dispatch({ type: 'store-outcome', outcome }))
        .finally(() => {
          inFlight.current = false;
        });
    },
    [dispatch],
  );
  const buy = useCallback(() => once('buying', buyUnlock), [once]);
  const restore = useCallback(() => once('restoring', restoreUnlock), [once]);
  return { buy, restore };
}
