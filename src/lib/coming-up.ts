import { creditWatched, faultWatched, REFUND_CHASE_DAYS, rejectWatched, warrantyWatched } from './alerts';
import { addDays, daysBetween, fromISODate } from './dates';
import { REPLY_DAYS } from './fault-letter';
import { derive } from './receipts';
import type { Receipt } from './types';

/**
 * Everything dated in the weeks ahead, across every receipt, in one list.
 *
 * The app already knew each of these dates and said each one on its own
 * receipt's screen: the last day of a return window, the day a refund is
 * worth chasing, the day a fault letter asked for a reply by, the day store
 * credit lapses, the day a guarantee ends. Nothing put them side by side, so
 * "what do I have to do this month?" meant opening every receipt in turn.
 *
 * Every date here comes from the same rule the receipt's own screen and its
 * reminder use — `derive`, the alert constants, the `…Watched` predicates —
 * so the list cannot disagree with either.
 */

/** How far ahead the list looks. Our number: a month and a bit either side of payday. */
export const COMING_UP_DAYS = 60;

export type ComingKind = 'return' | 'reject' | 'refund' | 'fault' | 'credit' | 'warranty';

export interface ComingUp {
  receiptId: string;
  date: Date;
  kind: ComingKind;
  /** What happens on the day, in the list's own words. */
  what: string;
  demo: boolean;
}

/** Same-day order: the one with money on a clock first. */
const ORDER: Record<ComingKind, number> = { return: 0, reject: 1, refund: 2, credit: 3, fault: 4, warranty: 5 };

export function comingUp(receipts: readonly Receipt[], today: Date, days: number = COMING_UP_DAYS): ComingUp[] {
  const out: ComingUp[] = [];
  const within = (d: Date) => {
    const n = daysBetween(today, d);
    return n >= 0 && n <= days;
  };
  const push = (r: Receipt, date: Date, kind: ComingKind, what: string) => {
    if (within(date)) out.push({ receiptId: r.id, date, kind, what, demo: !!r.demo });
  };
  for (const r of receipts) {
    if (r.status === 'active') push(r, derive(r, today).deadline, 'return', 'Last day to return it');
    if (r.status === 'sent' && r.sentOn) {
      push(r, addDays(fromISODate(r.sentOn), REFUND_CHASE_DAYS), 'refund', 'Refund due — chase it if it has not come');
    }
    const reject = rejectWatched(r, today);
    if (reject) push(r, reject.ends, 'reject', `Last day to reject it if it’s faulty${reject.hedged ? ' (or later)' : ''}`);
    if (faultWatched(r)) push(r, addDays(fromISODate(r.faultClaim!.sentOn), REPLY_DAYS), 'fault', 'The reply your fault letter asked for is due');
    if (creditWatched(r)) push(r, fromISODate(r.credit!.expires!), 'credit', 'Store credit runs out');
    if (warrantyWatched(r)) {
      const w = derive(r, today).warranty;
      if (w) push(r, w.ends, 'warranty', 'Guarantee ends');
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime() || ORDER[a.kind] - ORDER[b.kind]);
}
