import type { Shelf } from './app-store';

/**
 * What the product costs, in one place.
 *
 * The prices were literals in four places across two entry points — the
 * landing page's pricing cards, the Settings tiers, the upsell on the add
 * screen — and the free tier's size was a bare "10" written twice more in the
 * marketing copy beside a `FREE_TIER_LIMIT` the app actually enforced. Nothing
 * checked that any of them agreed, and nothing could: the agreement suite
 * walks the app, and half of these are on the landing page.
 *
 * A price that says one thing on the page someone bought from and another in
 * the app is not a cosmetic drift.
 *
 * Only the price lives here. The copy around it is genuinely different on a
 * marketing page and in a settings sheet, and forcing those to be the same
 * string would be sharing for its own sake.
 */

/**
 * Quids In Plus: by the month, or by the year for about half as much, and
 * Family by the year for a household. A subscription, because the product
 * keeps working for as long as someone has things to send back: shops'
 * windows are re-checked, the law beside them is kept current, and deadlines
 * keep arriving. A single unlock paid for none of that after the day it was
 * bought.
 *
 * These are the landing page's and the web's figures. On iPhone the App
 * Store's own price for the person's storefront is shown instead (`Offer`).
 */
export type PlanId = 'yearly' | 'monthly' | 'family';

/** The order every surface offers the plans in: the yearly first, as the better buy. */
export const PLAN_ORDER: readonly PlanId[] = ['yearly', 'monthly', 'family'];

/** One plan as offered, at the price shown: the App Store's for the storefront on iPhone, ours on the web. */
export interface PlanOffer {
  id: PlanId;
  price: string;
}

export const PLAN_PRICES: Record<PlanId, string> = {
  yearly: '£29.99',
  monthly: '£4.99',
  family: '£49.99',
};

/** What each plan is called, and how often it is paid for. */
export const PLAN_TERMS: Record<PlanId, { name: string; period: 'month' | 'year' }> = {
  yearly: { name: 'Plus', period: 'year' },
  monthly: { name: 'Plus', period: 'month' },
  family: { name: 'Family', period: 'year' },
};

/** The most people one Family plan reaches: Apple Family Sharing's own limit, organiser included. */
export const FAMILY_SIZE = 6;

/** The web's plans, in the order every surface offers them. */
export const WEB_PLANS: readonly PlanOffer[] = PLAN_ORDER.map((id) => ({ id, price: PLAN_PRICES[id] }));

/**
 * What an auto-renewing subscription owes the person before they buy it
 * (App Store Review Guideline 3.1.2): that it renews, until when, and how to
 * stop it. Said beside every button that starts one.
 */
export const RENEWAL_TERMS =
  'Plans renew automatically until cancelled. Cancel at least 24 hours before the renewal date in your Apple ID’s subscription settings and you won’t be charged again.';

/** Apple's standard licence, which governs a subscription sold without a custom one. */
export const TERMS_OF_USE_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/** Where an Apple ID's subscriptions are managed and cancelled. */
export const MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

/**
 * What this build may offer, and at what price.
 *
 * - `web`: the browser's plans. Choosing one flips a local flag with no
 *   payment, and the sheet in front of it says plainly that nothing is
 *   charged (`UpgradeNotice`).
 * - `app-store`: the iPhone's plans, sold through In-App Purchase as
 *   auto-renewable subscriptions. Guideline 3.1.1 requires that for anything
 *   that unlocks a feature, and before StoreKit the iOS build offered nothing
 *   at all (APN-18). Each price is the App Store's own, for the person's
 *   storefront: a hard-coded "£4.99" would be wrong in every other country and
 *   could disagree with the sheet Apple shows next. Never empty.
 * - `none`: nothing to buy: no StoreKit, or the App Store sells none of the
 *   plans here.
 *
 * Where there is nothing to buy there is no CAP either. A limit with no way
 * past it is not a free tier, it is a wall: someone would add their eleventh
 * receipt and be told to "go unlimited" by an app with no way to let them.
 * Every surface that sells or limits reads this one decision.
 */
export type Offer =
  | { kind: 'web'; plans: readonly PlanOffer[] }
  | { kind: 'app-store'; plans: readonly PlanOffer[]; canPay: boolean }
  | { kind: 'none' };

/**
 * The offer for this build.
 *
 * `remembered` is the App Store's price at its last answer (`rememberedPrice`
 * in lib/app-store.ts). It keeps the offer, and so the cap, in place while the
 * App Store cannot be asked: otherwise airplane mode would lift the cap. Where
 * the App Store has never answered, nothing is remembered and nothing is
 * capped: a first launch offline is not the moment to put up a wall.
 */
export function offerFor(native: boolean, shelf: Shelf, remembered: string | null): Offer {
  if (!native) return { kind: 'web', plans: WEB_PLANS };
  if (shelf.kind === 'for-sale') return { kind: 'app-store', plans: shelf.plans, canPay: shelf.canPay };
  // Offline, only the first plan's price is remembered, so only it is offered:
  // the door stays visible, and pressing it says the App Store is unreachable.
  if ((shelf.kind === 'asking' || shelf.kind === 'unreachable') && remembered !== null) {
    return { kind: 'app-store', plans: [{ id: PLAN_ORDER[0], price: remembered }], canPay: true };
  }
  return { kind: 'none' };
}

/**
 * Whether Settings offers "Restore purchase" with no unlock beside it.
 *
 * `offerFor` answers `none` when the App Store would not show the product —
 * offline on a first launch, or a product not yet attached in App Store
 * Connect — and Settings then showed no plan, no price and no restore at all.
 * Measured with the product withheld: nothing on the screen App Review's own
 * notes point at. Someone who bought the unlock on another iPhone has no other
 * way back to it, and restoring does not need the product to be on sale: it
 * asks for what this Apple ID already owns. So on iPhone, wherever StoreKit
 * exists (`absent` is iOS 13 and 14, which cannot buy or restore), a free plan
 * keeps the restore even when there is nothing to buy.
 */
export function restoreOnlyOffered(native: boolean, offer: Offer, shelf: Shelf, free: boolean): boolean {
  return native && free && offer.kind === 'none' && shelf.kind !== 'absent';
}

/** Whether the free tier's cap applies: only where there is a way past it. */
export function capsLibrary(offer: Offer): boolean {
  return offer.kind !== 'none';
}

/** The words on a plan's button: one string, so every surface says it the same way. */
export function planLabel(plan: PlanOffer): string {
  const t = PLAN_TERMS[plan.id];
  return `${t.name} · ${plan.price} a ${t.period}`;
}
