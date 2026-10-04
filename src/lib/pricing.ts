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
 * Whether this build may offer a paid tier at all.
 *
 * Not on iOS, until StoreKit exists (APN-18). Guideline 3.1.1 requires
 * In-App Purchase for anything that unlocks a feature, and these tiers unlock
 * a local flag with no payment at all — honest on the web, where the sheet
 * says plainly that nothing was charged, and a likely rejection on the App
 * Store, where a priced button that bypasses IAP reads as circumventing it
 * whatever it actually does.
 *
 * And no CAP where there is nothing to buy. A limit with no way past it is not
 * a free tier, it is a wall: someone would add their eleventh receipt and be
 * told to "go unlimited" by an app with no way to let them. So on iOS the
 * library is unlimited, which is also where APN-34 was leaning — cap features,
 * not the library.
 *
 * A decision, not a fact about the world: the day StoreKit lands, this is the
 * function that changes, and every surface that sells or limits reads it.
 */
export function sellsPaidTiers(native: boolean): boolean {
  return !native;
}
