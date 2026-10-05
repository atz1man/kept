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
 * One price, paid once. A subscription for a deadline tracker asks someone to
 * keep paying for an app whose whole job is a few dates a month; a single
 * unlock is the honest shape for that, and one figure is one thing that cannot
 * disagree with itself across the landing page, Settings and the add screen.
 */
export interface Unlock {
  /** As displayed, in pounds. */
  price: string;
  /** What follows the price where the two are shown together. */
  suffix: string;
}

export const UNLOCK: Unlock = { price: '£9.99', suffix: ' once' };

/**
 * What this build may offer, and at what price.
 *
 * - `web`: the browser's unlock. It flips a local flag with no payment, and
 *   the sheet in front of it says plainly that nothing is charged
 *   (`UpgradeNotice`).
 * - `app-store`: the iPhone's unlock, sold through In-App Purchase. Guideline
 *   3.1.1 requires that for anything that unlocks a feature, and before
 *   StoreKit the iOS build offered nothing at all (APN-18). The price is the
 *   App Store's own, for the person's storefront: a hard-coded "£9.99" would be
 *   wrong in every other country and could disagree with the sheet Apple shows
 *   next. It is null only while the App Store has not answered and nothing is
 *   remembered.
 * - `none`: nothing to buy: no StoreKit, or the App Store does not sell the
 *   unlock here.
 *
 * Where there is nothing to buy there is no CAP either. A limit with no way
 * past it is not a free tier, it is a wall: someone would add their eleventh
 * receipt and be told to "go unlimited" by an app with no way to let them.
 * Every surface that sells or limits reads this one decision.
 */
export type Offer =
  | { kind: 'web'; price: string }
  | { kind: 'app-store'; price: string | null; canPay: boolean }
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
  if (!native) return { kind: 'web', price: UNLOCK.price };
  if (shelf.kind === 'for-sale') return { kind: 'app-store', price: shelf.price, canPay: shelf.canPay };
  if ((shelf.kind === 'asking' || shelf.kind === 'unreachable') && remembered !== null) {
    return { kind: 'app-store', price: remembered, canPay: true };
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

/** The words on the button, priced: one string, so every surface says it the same way. */
export function unlockLabel(price: string | null): string {
  return price === null ? 'Unlock unlimited' : `Unlock unlimited · ${price}${UNLOCK.suffix}`;
}
