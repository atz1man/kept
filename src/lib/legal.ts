import { addDays, daysBetween, fmtDate, fromISODate, lastDayOfMonthsBeginning } from './dates';
import type { Receipt } from './types';

/**
 * The statutory clocks, stated in the words a person could actually use at a
 * counter. This is guidance, not legal advice — the disclaimer in Settings
 * says so, and every string here stays descriptive of the rights the app
 * tracks rather than telling anyone what will happen in their case.
 *
 * Two rights, and the important thing about them is that they are CUMULATIVE:
 *
 *  - 30 days to reject FAULTY goods for a full refund (Consumer Rights Act
 *    2015, s.22). Every purchase carries this, in a shop or online.
 *  - 14 days to cancel a DISTANCE or off-premises purchase for any reason at
 *    all (Consumer Contracts (Information, Cancellation and Additional
 *    Charges) Regulations 2013, reg. 29-30), then 14 more days to send it
 *    back. This one is additional, and it does not exist for something bought
 *    over a counter.
 *
 * This file previously chose ONE of them from a `legalDays: 14 | 30` field,
 * which was wrong in both directions and wrong for money. A receipt marked 14
 * — which was every receipt the add screen created — was never told about the
 * 30-day right to reject that it also had, and if it had been bought in a shop
 * it was told about a cooling-off period that does not exist there. Someone
 * acting on either is someone turned away at a counter, or someone who let a
 * refund lapse believing they only had a repair coming.
 *
 * The prototype's wording had a third fault, kept fixed here: a live 14-day
 * cooling-off period rendered as "ended". Telling someone a right they still
 * hold has expired is the one failure mode this screen must not have.
 *
 * Which is also why the DATE these clocks run from is stated rather than
 * quietly assumed. Both of them legally start the day the goods came into the
 * buyer's hands, not the day they were paid for. On a counter purchase those
 * are the same day and the arithmetic below is exact. On a distance purchase
 * they are not, and the app does not know when the parcel landed — so what it
 * computes from the order date is the EARLIEST the right could end, and it
 * says so. The old comment here claimed "counted from delivery" while the code
 * counted from purchase, which is how a screen ends up asserting a right has
 * expired on a day it may well still be live.
 */
export interface LegalRight {
  /** Which statute, for the chip. */
  chip: string;
  body: string;
  /** True while this statutory clock is still running. */
  live: boolean;
}

/**
 * Consumer Rights Act 2015, s.22 — every purchase, faulty goods only.
 *
 * Exported because the landing page states it in prose, and a statutory number
 * quoted in two places is a number that can disagree with itself. Pinned by a
 * test as a literal, on this codebase's rule that a threshold WE chose is not
 * a fact but one Parliament chose is — the same call as `MAX_PENDING` at 64
 * because that is iOS's, and `AA_TEXT` at 4.5 because that is WCAG's.
 */
export const REJECT_DAYS = 30;
/** Consumer Contracts Regs 2013 — distance and off-premises only, any reason. */
export const COOLING_OFF_DAYS = 14;
/**
 * And how long there is to actually send it back once cancelled — reg. 35(4):
 * without undue delay, and no later than 14 days after telling the trader.
 *
 * Its own constant although it is also fourteen, because it is a DIFFERENT
 * fourteen. The cancellation period and the return period are separate
 * provisions that could move apart, and one constant serving both would
 * quietly rewrite the sentence about sending the goods back the day somebody
 * changed the sentence about cancelling.
 */
export const RETURN_AFTER_CANCEL_DAYS = 14;
/**
 * How long after something went back it is worth asking whether the money
 * came. Fourteen days is the Consumer Contracts Regulations' limit for
 * refunding a cancelled online order once the goods are back (reg. 34), and a
 * common shop promise besides; after it, a missing refund is worth chasing.
 *
 * Here with the statute's other periods rather than in alerts.ts, where it
 * started: the refund reminder now asks refund-chase.ts whether reg. 34
 * applies, and refund-chase.ts and cancel-notice.ts read this number, so
 * keeping it in alerts.ts would have made those files import each other.
 */
export const REFUND_CHASE_DAYS = 14;
/** Reg. 28(1)(e), in the words the cooling-off sentence carries for toiletries and cosmetics. */
export const SEALED_EXCEPTION = 'Not for sealed toiletries or cosmetics once the seal is broken.';

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** What a computed end date is worth when the arrival date is unknown. */
const AFTER_ARRIVAL = 'The clock starts the day it arrived, so a parcel that came later runs later.';
const CHECK_ARRIVAL = 'but it starts the day the parcel arrived, so check that date';

/**
 * The extension nobody is told about, said where it is worth money.
 *
 * Regulation 31 of the 2013 Regulations: if the trader did not give the
 * consumer the cancellation information the Regulations require, the
 * cancellation period does not simply end. Supply it late and the period runs
 * 14 days from then; never supply it and the period ends twelve months after
 * it otherwise would have. So an expired cooling-off is not always an expired
 * cooling-off, and the app was closing the door on it.
 *
 * Stated only in the EXPIRED case, and as something to check rather than a
 * conclusion, because whether the shop gave that information is a fact only
 * the buyer has. While the right is plainly live there is nothing here worth
 * the words.
 */
export const UNTOLD_EXTENSION =
  'If the shop never told you about this right in writing, the law can extend it by up to a year — worth checking what came with the order.';

/**
 * What remains once the short-term right to reject has passed.
 *
 * Both jurisdictions, because the app is sold UK-wide and a Scottish reader
 * given only "six years in England and Wales" is given no number at all. The
 * periods are the Limitation Act 1980's six years and the Prescription and
 * Limitation (Scotland) Act 1973's five. Exported so the rights page says the
 * same sentence the detail screen does, rather than a second telling of it.
 */
export const LATER_FAULTS =
  'you can still ask for a free repair or replacement if a fault appears, for up to six years in England and Wales, five in Scotland.';

/**
 * Consumer Rights Act 2015, s.19(14)-(15): goods that turn out faulty within
 * this many months of delivery are taken not to have been right on the day
 * they were delivered, unless the shop proves otherwise. After it, proving
 * the fault was there from the start falls to the buyer.
 *
 * The most useful date in the second half of a purchase's life, and the app
 * never said it: once the thirty days went, the screen offered "a free repair
 * or replacement for up to six years" as if those years were all alike, when
 * in the first stretch of them the shop has to disprove the fault and after
 * it the buyer has to prove it. Parliament's number, pinned as a literal.
 */
export const PRESUMED_FAULT_MONTHS = 6;

/**
 * The rule in general, for the rights page, which states it without a
 * purchase to date it from. Exported for the same reason `LATER_FAULTS` is:
 * one telling of a legal rule, not two.
 */
export const PRESUMED_FAULT_RULE =
  `For the first ${PRESUMED_FAULT_MONTHS} months after you have it, a fault is taken to have been there from the start, so it is for the shop to show it was not. After that, it is for you to show it was.`;

/**
 * The last day a fault is taken to have been there from the start.
 *
 * Section 19(14) runs "the period of six months beginning with the day on
 * which the goods were delivered", so the day of delivery is the FIRST of
 * those days: goods delivered on 15 January are presumed faulty from the start
 * through 14 July, and not on the 15th. The thirty days to reject (s.22(3)),
 * and the six months in which a final rejection costs nothing for use
 * (s.24(10)), are counted from the day after delivery instead; this one is
 * not.
 *
 * The one count of it, for the rights panel, the fault letter and the claim
 * pack. Each had its own `addMonths(delivered, 6)`, a day too long wherever
 * the month six on has the same date: on 15 July the panel said "Until 15 Jul
 * (0 days left)", and the letter written that day told the shop the fault was
 * presumed under section 19(14).
 */
export function presumedFaultEnds(delivered: Date): Date {
  return lastDayOfMonthsBeginning(delivered, PRESUMED_FAULT_MONTHS);
}

/**
 * The sentence for the stretch between the two, or nothing once it has gone
 * (from then on the plain repair right is the whole story).
 */
function presumedFault(bought: Date, today: Date, hedged: boolean): string {
  const ends = presumedFaultEnds(bought);
  const left = daysBetween(today, ends);
  if (left < 0) return '';
  return hedged
    ? ` Until at least ${fmtDate(ends)}, a fault is taken to have been there when it arrived, so it is for the shop to show it was not.`
    : ` Until ${fmtDate(ends)} (${days(left)} left), a fault is taken to have been there when you got it, so it is for the shop to show it was not.`;
}

/** @param hedged True when the arrival date is unknown, so the end is a floor. */
function shortTermRejectRight(bought: Date, today: Date, hedged: boolean): LegalRight {
  const ends = addDays(bought, REJECT_DAYS);
  const left = daysBetween(today, ends);
  const repair = `${LATER_FAULTS}${presumedFault(bought, today, hedged)}`;
  return {
    chip: 'Consumer Rights Act',
    live: left >= 0,
    body:
      left >= 0
        ? hedged
          ? `${REJECT_DAYS}-day right to reject faulty goods for a full refund — at least until ${fmtDate(ends)} (${days(left)} left). ${AFTER_ARRIVAL}`
          : `${REJECT_DAYS}-day right to reject faulty goods for a full refund — ends ${fmtDate(ends)} (${days(left)} left). This one applies wherever you bought it.`
        : hedged
          ? `Counting from your order, the ${REJECT_DAYS}-day window to reject faulty goods has run out — ${CHECK_ARRIVAL}. Once it has, ${repair}`
          : `The ${REJECT_DAYS}-day window to reject faulty goods has passed — ${repair}`,
  };
}

function coolingOffRight(bought: Date, today: Date, storeWindowOpen: boolean, hedged: boolean, sealedGoods: boolean): LegalRight {
  const ends = addDays(bought, COOLING_OFF_DAYS);
  const left = daysBetween(today, ends);
  const shopStillOpen = storeWindowOpen ? ' The shop’s own window above is still open either way.' : '';
  // Reg. 28(1)(e): sealed goods not fit to return for health or hygiene
  // reasons, once unsealed after delivery, cannot be cancelled. Said as the
  // rule it is, not as a verdict on this item — kept cannot see the seal.
  const sealed = sealedGoods ? ` ${SEALED_EXCEPTION}` : '';
  return {
    chip: 'Consumer Contracts Regs',
    live: left >= 0,
    body:
      left >= 0
        ? hedged
          ? `${COOLING_OFF_DAYS}-day cooling-off on distance purchases — you can cancel for any reason until at least ${fmtDate(ends)} (${days(left)} left), then ${RETURN_AFTER_CANCEL_DAYS} more days to send it back. ${AFTER_ARRIVAL}${sealed}`
          : `${COOLING_OFF_DAYS}-day cooling-off on distance purchases — you can cancel for any reason until ${fmtDate(ends)} (${days(left)} left), counting from the day it arrived, then ${RETURN_AFTER_CANCEL_DAYS} more days to send it back.${sealed}`
        : hedged
          ? `Counting from your order, the ${COOLING_OFF_DAYS}-day cooling-off has run out — ${CHECK_ARRIVAL}.${shopStillOpen || ' You keep the rights above for anything that turns out to be faulty.'} ${UNTOLD_EXTENSION}`
          : `The ${COOLING_OFF_DAYS}-day cooling-off has passed, counting from the day it arrived.${shopStillOpen || ' You keep the rights above for anything that turns out to be faulty.'} ${UNTOLD_EXTENSION}`,
  };
}

/**
 * Every statutory right this purchase carries, most powerful first.
 *
 * Returns one entry for something bought over a counter and two for a distance
 * purchase — never a choice between them. The order is deliberate: cancelling
 * for any reason is the stronger right while it lasts, so it leads when it is
 * live and follows the always-applicable one once it has run out.
 */
export function legalRights(r: Receipt, today: Date, storeWindowOpen: boolean): LegalRight[] {
  // The day the goods came into the buyer's hands, which is where both clocks
  // legally start. A counter purchase is handed over when it is paid for; a
  // delivered one is only known once someone says so, and until then the
  // dates are the earliest they could be and say so.
  const known = !r.distance || r.arrivedOn !== undefined;
  const from = fromISODate(r.arrivedOn ?? r.purchasedOn);

  const reject = shortTermRejectRight(from, today, !known);
  if (!r.distance) return [reject];

  const coolingOff = coolingOffRight(from, today, storeWindowOpen, !known, r.cat === 'beauty');
  return coolingOff.live ? [coolingOff, reject] : [reject, coolingOff];
}

/**
 * Which of a purchase's live clocks closes first — the shop's own window, the
 * right to reject faulty goods, or (bought at a distance) the right to cancel.
 *
 * The onboarding, the listing, the rights page and the README all said kept
 * "tells you which closes first", and no screen did: the receipt showed the
 * shop's date in a ring and the legal ones in a panel below, and left the
 * comparison to the reader. For IKEA's 365 days, B&Q's or John Lewis's, the
 * first to go is the 30-day right to reject — the one that means a full
 * refund for a fault rather than a repair — and nothing said so.
 *
 * `hedged` when the arrival date is unknown and the earliest clock is a legal
 * one: those run from arrival, so the date is a floor and "first" is a
 * likelihood, and the screen says so. Ties go to the shop, whose window is the
 * any-reason return and the one a person is usually asking about.
 */
export interface FirstClock {
  which: 'shop' | 'reject' | 'cancel';
  on: Date;
  hedged: boolean;
}

export function firstToClose(r: Receipt, today: Date, shopDeadline: Date): FirstClock | null {
  const known = !r.distance || r.arrivedOn !== undefined;
  const from = fromISODate(r.arrivedOn ?? r.purchasedOn);
  const clocks: { which: FirstClock['which']; on: Date }[] = [
    { which: 'shop', on: shopDeadline },
    ...(r.distance ? [{ which: 'cancel' as const, on: addDays(from, COOLING_OFF_DAYS) }] : []),
    { which: 'reject', on: addDays(from, REJECT_DAYS) },
  ];
  const live = clocks.filter((c) => daysBetween(today, c.on) >= 0);
  if (live.length === 0) return null;
  const first = live.reduce((a, b) => (daysBetween(b.on, a.on) > 0 ? b : a));
  return { ...first, hedged: first.which !== 'shop' && !known };
}

/** The sentence for it, from the same constants as every other one here. */
export function firstToCloseLine(c: FirstClock): string {
  const lead = c.hedged ? 'Likely to close first' : 'Closes first';
  const when = `${c.hedged ? 'no earlier than ' : ''}${fmtDate(c.on)}`;
  switch (c.which) {
    case 'shop':
      return `${lead}: the shop’s own window, ${when}.`;
    case 'reject':
      return `${lead}: your ${REJECT_DAYS}-day right to reject faulty goods for a full refund, ${when}.`;
    case 'cancel':
      return `${lead}: your ${COOLING_OFF_DAYS}-day right to cancel for any reason, ${when}.`;
  }
}

export const LEGAL_DISCLAIMER = 'Guidance, not legal advice.';
