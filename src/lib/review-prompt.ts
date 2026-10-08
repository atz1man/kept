import { daysBetween, fromISODate } from './dates';
import { refundOf } from './receipts';
import type { Receipt } from './types';

/**
 * When the iPhone app asks iOS for its App Store rating prompt.
 *
 * Asked at one moment only: as the person leaves the celebration of money
 * they have just had back. That is when the app has most plainly done its
 * job, and asking then is asking about something that happened rather than
 * interrupting something that is happening. Never over the celebration
 * itself, which is the thing worth seeing.
 *
 * Apple decides whether its dialog appears at all, at most three times a year
 * and possibly never, and says nothing back either way. So this decides only
 * whether to ASK, and the app treats every ask as made, whatever iOS did with
 * it. Lifted out of the effect that calls it because it is the judgement, and
 * the effect is the one place nothing here can render.
 */

/** Days between two asks, at the least: about a third of a year. */
export const REVIEW_GAP_DAYS = 120;

/**
 * The money-back moment that may first ask. Not the first: one refund could
 * be luck, and the first win is the person meeting the celebration, not
 * having a view of the app yet.
 */
export const WINS_BEFORE_ASKING = 2;

/** The last ask: the day it was made and the app version that made it. */
export interface ReviewAsked {
  /** ISO calendar date (YYYY-MM-DD), the UK's, as every date here is. */
  on: string;
  version: string;
}

/**
 * Whether this receipt is a real money-back moment: returned, refunded with
 * something more than nothing, and the person's own rather than a sample.
 * A swap brought back an item, not money (`refundOf`), and a sample's refund
 * is a demonstration of the app, not a use of it.
 */
export function isMoneyBack(r: Receipt): boolean {
  return r.status === 'returned' && !r.demo && refundOf(r) > 0;
}

/**
 * How many real money-back moments the library holds. Counted from the
 * receipts rather than kept as a tally, so an undone return stops counting
 * the moment it is undone, and a library from before this existed is
 * counted as it stands.
 */
export function moneyBackCount(receipts: readonly Receipt[]): number {
  return receipts.filter(isMoneyBack).length;
}

export interface ReviewMoment {
  /** Inside the iPhone app. There is no web equivalent. */
  native: boolean;
  /** The landing page's demo, which asks nobody anything. */
  embedded: boolean;
  /** The receipt whose celebration is being left, as it stands now; undefined if it has gone. */
  won: Receipt | undefined;
  receipts: readonly Receipt[];
  /** This build's version. */
  version: string;
  today: Date;
  last: ReviewAsked | null;
}

/**
 * Whether to ask, now. Only in the iPhone app, outside the demo, as a real
 * win is left (still a win: an undone return is not one), on the second real
 * win or later, and then at most once per app version and never within
 * REVIEW_GAP_DAYS of the last ask. Both of the last two: a new version a
 * week after an ask is not a reason to ask again, and neither is a year
 * passing on the same version.
 */
export function shouldAskForReview(m: ReviewMoment): boolean {
  if (!m.native || m.embedded) return false;
  if (!m.won || !isMoneyBack(m.won)) return false;
  if (moneyBackCount(m.receipts) < WINS_BEFORE_ASKING) return false;
  if (m.last === null) return true;
  if (m.last.version === m.version) return false;
  return daysBetween(fromISODate(m.last.on), m.today) >= REVIEW_GAP_DAYS;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The stored record, or null when there is none or it cannot be believed.
 * Null means "never asked", so the worst an unreadable record costs is one
 * more ask, which iOS caps in any case.
 */
export function readReviewAsked(raw: unknown): ReviewAsked | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { on, version } = raw as Record<string, unknown>;
  if (typeof on !== 'string' || !ISO_DAY.test(on) || Number.isNaN(fromISODate(on).getTime())) return null;
  if (typeof version !== 'string' || version.trim() === '') return null;
  return { on, version };
}
