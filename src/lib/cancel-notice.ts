import { addDays, daysBetween, fmtDateLong, fromISODate } from './dates';
import { COOLING_OFF_DAYS, REFUND_CHASE_DAYS, RETURN_AFTER_CANCEL_DAYS } from './legal';
import { money } from './money';
import type { Receipt } from './types';

/**
 * Cancelling an online order, in writing, and what follows from the day.
 *
 * The Consumer Contracts Regulations 2013 give fourteen days from delivery to
 * cancel a distance purchase for any reason (reg. 29–30). Cancelling is
 * TELLING the shop — the model form in Schedule 3, or any clear statement
 * (reg. 32) — and the goods then have fourteen more days to go back (reg.
 * 35). kept stated both clocks and recorded only the posting, so it never
 * knew the day that decides the rest: a parcel posted on day 20 after a
 * notice on day 10 was treated as outside the period, and the refund letter
 * left out the regulation that covered it.
 *
 * So: the notice, in the model form's terms, while the period runs; the day
 * it went, once someone says it has; and from that day, when it must be back.
 */

/**
 * The cancellation period, while it runs, on an order that has not been
 * cancelled — null otherwise. Counted from the day it came, or the order day
 * while nobody has said, which can only make the period look shorter: the
 * notice is offered for certain inside it, and `hedged` says the real end is
 * no earlier.
 */
export function cancelOffered(r: Receipt, today: Date): { ends: Date; hedged: boolean } | null {
  if (!r.distance || r.status !== 'active' || r.cancelledOn) return null;
  const ends = addDays(fromISODate(r.arrivedOn ?? r.purchasedOn), COOLING_OFF_DAYS);
  if (daysBetween(today, ends) < 0) return null;
  return { ends, hedged: r.arrivedOn === undefined };
}

/** The day the goods must be on their way back by, once the order is cancelled (reg. 35). */
export function sendBackBy(r: Receipt): Date | null {
  return r.cancelledOn ? addDays(fromISODate(r.cancelledOn), RETURN_AFTER_CANCEL_DAYS) : null;
}

/**
 * Whether the notice was given inside the cancellation period, counted from
 * delivery where known and from the order where not — again only ever
 * shorter, so "inside" is certain.
 */
export function cancelledInTime(r: Receipt): boolean {
  if (!r.distance || !r.cancelledOn) return false;
  return daysBetween(fromISODate(r.arrivedOn ?? r.purchasedOn), fromISODate(r.cancelledOn)) <= COOLING_OFF_DAYS;
}

/**
 * The notice. The model form's parts — the goods, the order and delivery
 * dates — in a letter's words, then what follows from it, so the shop reads
 * the refund rule in the same place. No name or address: the person sends it
 * from their own account, as the fault letter is.
 */
export function cancelLetter(r: Receipt): string {
  const ordered = fmtDateLong(fromISODate(r.purchasedOn));
  const received = r.arrivedOn ? `, received on ${fmtDateLong(fromISODate(r.arrivedOn))}` : '';
  return [
    `Dear ${r.store},`,
    '',
    `Cancellation of order: ${r.item}`,
    ...(r.orderRef ? [`Order number: ${r.orderRef}`] : []),
    '',
    `I am cancelling my contract for the following goods: “${r.item}”, ${money(r.amount)}, ordered on ${ordered}${received}.`,
    '',
    `I am giving this notice within the ${COOLING_OFF_DAYS}-day cancellation period under the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013. Please tell me how you would like the goods returned. Under regulation 34, the refund is due within ${REFUND_CHASE_DAYS} days of your receiving them back, or of my supplying evidence of having sent them, if that is earlier, and includes the standard delivery charge if I paid one.`,
    '',
    'Yours faithfully,',
  ].join('\n');
}
