import type { Plan } from './quota';

/**
 * The unlock on iPhone, sold through the App Store: what StoreKit's answers
 * mean for the person's plan, and what the app says after each one.
 *
 * The native half is packages/purchases (StoreKit 2). It only asks StoreKit and
 * passes on what it was told. Every DECISION is here, where it can be tested
 * without a phone. That is all of it, because the money path is the one where
 * an untested branch costs someone money: they are charged and stay locked, or
 * they are locked out of what they paid for.
 *
 * Three rules are worth stating outright.
 *
 * Only a verified transaction unlocks. StoreKit checks the App Store's
 * signature on the device; an answer that fails that check unlocks nothing,
 * whatever else it says.
 *
 * Nothing relocks on silence. "No record of a purchase" is what a new phone
 * says before its records arrive, so only an explicit revocation (a refund,
 * or family sharing withdrawn) takes the unlock away. Being wrong in that
 * direction costs one refunded £9.99; being wrong the other way locks a paying
 * customer out of their own library.
 *
 * And no wall without a door. The free tier's cap stands only where the
 * unlock can be bought: where the App Store has said it sells it, now or at
 * its last answer. That last part matters. Offline the App Store cannot
 * answer, and "offline lifts the cap" would make airplane mode the way to
 * unlimited. So the price it last quoted is remembered, and the cap stands on
 * it: the door is still there, and it opens once the phone is online.
 */

/** The unlock's product id in App Store Connect and in ios/App/Kept.storekit. Never reused once live, and not renamed with the app: a product id is permanent in App Store Connect. */
export const UNLOCK_PRODUCT_ID = 'kept.unlimited';

/** How long to wait for the App Store to say what it sells, or what was bought, before treating it as unreachable. */
export const ASK_BUDGET_MS = 20_000;

/** What the App Store said about selling the unlock, this launch. */
export type Shelf =
  /** Asked; no answer yet. */
  | { kind: 'asking' }
  /** No StoreKit here: a build without the plugin, or iOS 13 or 14. Nothing can be bought. */
  | { kind: 'absent' }
  /** Asked, and no answer came: offline, or the App Store is down. */
  | { kind: 'unreachable' }
  /** The App Store answered without the unlock: not on sale in this storefront, or not live yet. */
  | { kind: 'not-for-sale' }
  /** On sale, at the App Store's own price for this storefront. `canPay` is false when Screen Time or a device manager turns purchases off. */
  | { kind: 'for-sale'; price: string; canPay: boolean };

/** Whether this Apple ID owns the unlock, as StoreKit knows it on this phone. `unknown` decides nothing. */
export type Ownership = 'owned' | 'revoked' | 'none' | 'unknown';

/** The failures the app words differently. */
export type FailReason = 'network' | 'not-allowed' | 'not-for-sale' | 'unknown';

export type Outcome =
  | { kind: 'purchased' }
  /** Ask to Buy, or a bank's check: the answer comes later, by itself. */
  | { kind: 'pending' }
  | { kind: 'cancelled' }
  /** The App Store's answer did not carry a signature that checks. */
  | { kind: 'unverified' }
  | { kind: 'failed'; reason: FailReason }
  | { kind: 'restored' }
  | { kind: 'nothing-to-restore' }
  | { kind: 'restore-failed'; reason: FailReason };

/** Longer than any price the App Store writes ("CHF 10.00", "9,99 €"), and short enough that nothing else fits. */
const MAX_PRICE_CHARS = 24;

/** A price as the App Store wrote it, shown as it is; or null if it is not one. */
export function readPrice(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const price = raw.trim();
  return price.length > 0 && price.length <= MAX_PRICE_CHARS && /\d/.test(price) ? price : null;
}

/** The plugin's answer to `products`. A malformed answer is no answer: it changes nothing that was remembered. */
export function readShelf(raw: unknown): Shelf {
  const r = typeof raw === 'object' && raw !== null ? (raw as { products?: unknown; canPay?: unknown }) : null;
  if (!r || !Array.isArray(r.products)) return { kind: 'unreachable' };
  const unlock = r.products.find(
    (p): p is { displayPrice?: unknown } => typeof p === 'object' && p !== null && (p as { id?: unknown }).id === UNLOCK_PRODUCT_ID,
  );
  const price = readPrice(unlock?.displayPrice);
  if (price === null) return { kind: 'not-for-sale' };
  // Only an explicit "no" turns the button off: a missing flag is not a refusal.
  return { kind: 'for-sale', price, canPay: r.canPay !== false };
}

/**
 * A call that threw. Not in this build (`UNIMPLEMENTED`) or not on this iOS
 * (`UNAVAILABLE`) means there is nothing here to buy with. Anything else is a
 * failure to reach the App Store, which says nothing about whether it sells.
 */
export function shelfFromError(e: unknown): Shelf {
  const code = errorCode(e);
  return code === 'UNIMPLEMENTED' || code === 'UNAVAILABLE' ? { kind: 'absent' } : { kind: 'unreachable' };
}

export function readOwnership(raw: unknown): Ownership {
  const state = typeof raw === 'object' && raw !== null ? (raw as { state?: unknown }).state : undefined;
  // `unverified` is deliberately not here: it decides nothing either way.
  return state === 'owned' || state === 'revoked' || state === 'none' ? state : 'unknown';
}

function readReason(raw: unknown): FailReason {
  return raw === 'network' || raw === 'not-allowed' || raw === 'not-for-sale' ? raw : 'unknown';
}

function errorCode(e: unknown): unknown {
  return typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
}

/** A thrown call, as a reason: the plugin rejects `products` with the reason as its code. */
export function reasonFromError(e: unknown): FailReason {
  return readReason(errorCode(e));
}

/** The plugin's answer to `purchase`. Anything unrecognised is a failure, never a purchase. */
export function readPurchase(raw: unknown): Outcome {
  const r = typeof raw === 'object' && raw !== null ? (raw as { outcome?: unknown; reason?: unknown }) : {};
  switch (r.outcome) {
    case 'purchased':
      return { kind: 'purchased' };
    case 'pending':
      return { kind: 'pending' };
    case 'cancelled':
      return { kind: 'cancelled' };
    case 'unverified':
      return { kind: 'unverified' };
    default:
      return { kind: 'failed', reason: readReason(r.reason) };
  }
}

/**
 * Restore: the App Store synced, and then what StoreKit holds. A sync that
 * finds no purchase is said as such. It is a real answer, and the most likely
 * one for someone checking whether they ever paid. A sync followed by no
 * answer at all is not that answer, so it is reported as a failure.
 */
export function readRestore(raw: unknown, after: Ownership): Outcome {
  const r = typeof raw === 'object' && raw !== null ? (raw as { outcome?: unknown; reason?: unknown }) : {};
  if (r.outcome === 'cancelled') return { kind: 'cancelled' };
  if (r.outcome !== 'synced') return { kind: 'restore-failed', reason: readReason(r.reason) };
  if (after === 'owned') return { kind: 'restored' };
  return after === 'unknown' ? { kind: 'restore-failed', reason: 'unknown' } : { kind: 'nothing-to-restore' };
}

/** The plan after StoreKit's answer. Owned unlocks, revoked relocks, and anything else leaves the plan as it was. */
export function planAfter(plan: Plan, ownership: Ownership): Plan {
  if (ownership === 'owned') return 'pro';
  if (ownership === 'revoked') return 'free';
  return plan;
}

/**
 * The price to remember, which is what keeps the cap standing while the App
 * Store cannot be asked: its own price when it sells the unlock, nothing once
 * it says it does not (or there is no StoreKit to ask), and otherwise
 * whatever it said last.
 */
export function rememberedPrice(shelf: Shelf, before: string | null): string | null {
  switch (shelf.kind) {
    case 'for-sale':
      return shelf.price;
    case 'not-for-sale':
    case 'absent':
      return null;
    case 'asking':
    case 'unreachable':
      return before;
  }
}

const UNREACHABLE = 'Couldn’t reach the App Store. Check your connection and try again.';
const UNLOCKED = 'Unlocked — there’s no limit on receipts now. Thank you.';

/**
 * The App Store, this launch: what it sells, what the person is doing with it,
 * and what was last said. Never persisted, because StoreKit is asked again on
 * every launch. What IS kept between launches is in Settings: the plan, and
 * the price last quoted.
 */
export interface StoreView {
  shelf: Shelf;
  /** A purchase or a restore in flight: its button waits, and the other is not offered twice. */
  busy: 'buying' | 'restoring' | null;
  note: StoreNote | null;
}

export const STORE_ASKING: StoreView = { shelf: { kind: 'asking' }, busy: null, note: null };

/**
 * What an ownership answer says, when it changes something by itself: an Ask
 * to Buy approval, a purchase on another device, a refund. Said because each
 * one moves the cap, and a limit that moves without a word reads as a fault.
 */
export function ownershipNote(before: Plan, after: Plan): StoreNote | null {
  if (before === 'free' && after === 'pro') return { tone: 'ok', text: UNLOCKED };
  if (before === 'pro' && after === 'free') {
    return { tone: 'bad', text: 'The unlock was refunded, or is no longer shared with you, so the free limit applies again. Nothing you’ve saved is lost.' };
  }
  return null;
}

/** What the app says once something has happened. `wait` is neither good nor bad news: it is coming. */
export interface StoreNote {
  tone: 'ok' | 'wait' | 'bad';
  text: string;
}

/** Said in place of the button, where purchases are switched off. */
export const PURCHASES_OFF =
  'In-app purchases are turned off on this iPhone. They can be allowed in Settings → Screen Time → Content & Privacy Restrictions.';

/**
 * What each outcome says. A cancelled sheet says nothing: cancelling was the
 * person's own answer, and repeating it back to them is noise.
 *
 * Every failure is careful about money, because the person's next question is
 * "was I charged?". Where the answer is certainly no, because the purchase
 * never started, it says so. Where it cannot be certain, as with a dropped
 * connection mid-purchase, it says what happens if they were: the App Store
 * finishes the transaction, StoreKit delivers it, and the app unlocks by
 * itself.
 */
export function noteFor(outcome: Outcome): StoreNote | null {
  switch (outcome.kind) {
    case 'purchased':
      return { tone: 'ok', text: UNLOCKED };
    case 'pending':
      return { tone: 'wait', text: 'Waiting for approval. Quids In unlocks by itself as soon as the purchase is approved.' };
    case 'cancelled':
      return null;
    case 'unverified':
      return {
        tone: 'bad',
        text: 'The App Store’s confirmation couldn’t be checked, so nothing has unlocked. If you were charged, Restore purchase will find it.',
      };
    case 'failed':
      return { tone: 'bad', text: failedWords(outcome.reason) };
    case 'restored':
      return { tone: 'ok', text: 'Restored — there’s no limit on receipts on this iPhone.' };
    case 'nothing-to-restore':
      return { tone: 'wait', text: 'There’s no unlock on this Apple ID to restore.' };
    case 'restore-failed':
      return { tone: 'bad', text: outcome.reason === 'network' ? UNREACHABLE : 'The App Store couldn’t restore purchases just now. Try again in a moment.' };
  }
}

function failedWords(reason: FailReason): string {
  switch (reason) {
    case 'network':
      return `${UNREACHABLE} If the purchase went through, Quids In unlocks by itself.`;
    case 'not-allowed':
      return PURCHASES_OFF;
    case 'not-for-sale':
      // Certain: the purchase never started, because there was nothing to buy.
      return 'The App Store isn’t selling the unlock here right now, so nothing was charged.';
    case 'unknown':
      return 'The purchase didn’t go through. If you were charged, Quids In unlocks by itself as soon as the App Store confirms it.';
  }
}
