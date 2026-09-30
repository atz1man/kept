import { daysBetween, fmtDate, fromISODate } from './dates';
import { money } from './money';
import { derive, refundOf } from './receipts';
import type { Receipt } from './types';

/**
 * Which deadlines deserve to interrupt someone today.
 *
 * "Pings you before either clock runs out" was the promise on the landing
 * page, and a switch in Settings that did nothing. This is the part that
 * decides — pure, so it can be tested at any date, and separate from the
 * delivery mechanism, which differs by platform and will change.
 *
 * The hard requirement is restraint. An app that says the same thing every
 * morning gets its notifications switched off within a week, and then it
 * cannot tell you the one thing that mattered. So a receipt raises each rung
 * of the ladder at most once, ever, and a phone left in a drawer through
 * several rungs still yields one alert: the most urgent.
 */

/** The shop's return window, closing. */
export type ReturnRung = 'week' | 'soon' | 'today' | 'closed';
/**
 * The guarantee, about to end. Not a rung of the return ladder: it belongs to
 * a different clock, usually a year or more later, and it is the one reason
 * to keep a receipt long after the window has shut.
 */
export type AlertRung = ReturnRung | 'warranty' | 'refund' | 'credit';

/**
 * How long after something went back it is worth asking whether the money
 * came. Fourteen days is the Consumer Contracts Regulations' limit for
 * refunding a cancelled online order once the goods are back (reg. 34), and a
 * common shop promise besides; after it, a missing refund is worth chasing.
 */
export const REFUND_CHASE_DAYS = 14;

/**
 * Whether an alert already sent was a reminder BEFORE the shop's window shut.
 *
 * The share line says "kept. reminded me before the window shut", and it was
 * decided by "any alert at all for this receipt". Since the guarantee alert
 * and the refund chase exist, that counted reminders about other clocks, and
 * "window closed" never was one. Only the rungs that come before the window
 * shuts make the sentence true.
 */
export function remindedBeforeWindow(sent: readonly string[], receiptId: string): boolean {
  return (['week', 'soon', 'today'] as const).some((rung) => sent.includes(alertKey(receiptId, rung)));
}

/**
 * How long before a guarantee ends it is worth saying so. A month: long
 * enough to notice a fault you have been living with, book a repair and get
 * the thing looked at while it is still covered.
 */
export const WARRANTY_NOTICE_DAYS = 30;

/**
 * How far ahead of its expiry store credit is worth a reminder. Our number, as
 * the guarantee's is: a month is time to find something worth buying, which a
 * reminder on the last day is not.
 */
export const CREDIT_NOTICE_DAYS = 30;

/** Store credit with a known expiry, on a real receipt: the one kind watched. */
export function creditWatched(r: Receipt): boolean {
  return r.status === 'returned' && !r.demo && !!r.credit?.expires;
}

/**
 * Whether a receipt's guarantee is worth a word from this app at all.
 *
 * Active or kept: a returned item has gone back, and its guarantee went with
 * it. Never a sample. And only a guarantee with a clock — one restored from an
 * old backup as free text (`months: 0`) has no end date to warn about.
 */
export function warrantyWatched(r: Receipt): boolean {
  return (r.status === 'active' || r.status === 'kept') && !r.demo && !!r.warranty && r.warranty.months > 0;
}

export interface DeadlineAlert {
  receiptId: string;
  rung: AlertRung;
  /** Stable dedup key — one per receipt per rung, for the life of the receipt. */
  key: string;
  title: string;
  body: string;
}

export const alertKey = (receiptId: string, rung: AlertRung) => `${receiptId}:${rung}`;

const LADDER: ReturnRung[] = ['week', 'soon', 'today', 'closed'];

/** The most urgent rung this receipt has reached, or null if it is not close yet. */
function rungFor(daysLeft: number, urgentDays: number): ReturnRung | null {
  if (daysLeft < 0) return 'closed';
  if (daysLeft === 0) return 'today';
  if (daysLeft <= 3) return 'soon';
  if (daysLeft <= urgentDays) return 'week';
  return null;
}

/**
 * The words, in one place.
 *
 * Exported because there are now TWO paths to a lock screen — this module,
 * when the app is open, and `schedule.ts`, which lodges the same alerts with
 * iOS ahead of time. Handing the wording to the scheduler as a parameter would
 * let the two say different things about the same receipt, which is the exact
 * shape of defect this codebase keeps finding: one fact, two surfaces, quietly
 * disagreeing. There is one set of words and both read it.
 */
export function copyFor(rung: AlertRung, r: Receipt, daysLeft: number, deadline: Date): { title: string; body: string } {
  const what = `${r.store} · ${r.item}`;
  switch (rung) {
    case 'week':
      return {
        title: `${money(r.amount)} still returnable`,
        body: `${what} — ${daysLeft} days left, until ${fmtDate(deadline)}.`,
      };
    case 'soon':
      return {
        title: 'Go now or lose it',
        body: `${what} — ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left. ${money(r.amount)} back if it goes back.`,
      };
    case 'today':
      return {
        title: 'Today is the last day',
        body: `${what} — ${money(r.amount)} back, but only if it goes back today.`,
      };
    case 'closed':
      return {
        title: 'That window has closed',
        body: `${what} — the shop’s window has passed. If it turns out to be faulty, you still have rights.`,
      };
    case 'refund':
      // `deadline` is the day it went back; `daysLeft` is unused. The legal
      // limit is stated only where it applies — a cancelled distance order —
      // and never as a promise about any other shop's terms.
      return {
        title: 'Has the refund come through?',
        body: `${what} — it went back on ${fmtDate(deadline)}.${
          r.distance ? ` For an online order, the shop has ${REFUND_CHASE_DAYS} days from getting it back to refund you.` : ''
        } If the money has not arrived, chase it.`,
      };
    case 'credit':
      // `daysLeft` and `deadline` are the CREDIT's here: the day the note
      // says it runs out, which is still spendable.
      return {
        title: 'Your store credit is running out',
        body: `${money(refundOf(r))} of ${r.store} credit, from ${r.item} — it runs out on ${fmtDate(deadline)}${
          daysLeft > 0 ? `, ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} from now` : ', which is today'
        }. Spend it before then.`,
      };
    case 'warranty':
      // `daysLeft` and `deadline` are the GUARANTEE's here. Cover runs to the
      // end of `deadline`, the day `derive` still calls it live.
      return {
        title: 'Your guarantee is running out',
        body: `${what} — covered until ${fmtDate(deadline)}${
          daysLeft > 0 ? `, ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} from now` : ', which is today'
        }. If anything is wrong with it, claim before then.`,
      };
  }
}

/**
 * @param sent Dedup keys already delivered. Everything in here stays silent.
 */
export function dueAlerts(
  receipts: readonly Receipt[],
  today: Date,
  urgentDays: number,
  sent: ReadonlySet<string>,
): DeadlineAlert[] {
  const out: DeadlineAlert[] = [];
  for (const r of receipts) {
    // Gone back, money not yet seen: asked once, a fortnight on.
    if (r.status === 'sent' && !r.demo && r.sentOn) {
      const went = fromISODate(r.sentOn);
      const key = alertKey(r.id, 'refund');
      if (daysBetween(went, today) >= REFUND_CHASE_DAYS && !sent.has(key)) {
        out.push({ receiptId: r.id, rung: 'refund', key, ...copyFor('refund', r, 0, went) });
      }
    }
    // The guarantee first, and apart: it is on its own clock, and a kept
    // receipt — which has left the return ladder for good — still has one.
    if (warrantyWatched(r)) {
      const w = derive(r, today).warranty;
      const key = alertKey(r.id, 'warranty');
      // Inside the notice period and not yet over. An ended guarantee is not
      // announced after the fact: there is nothing left to do about it.
      if (w && w.daysLeft >= 0 && w.daysLeft <= WARRANTY_NOTICE_DAYS && !sent.has(key)) {
        out.push({ receiptId: r.id, rung: 'warranty', key, ...copyFor('warranty', r, w.daysLeft, w.ends) });
      }
    }
    // Credit, a month before the note says it lapses, through its last day.
    if (creditWatched(r)) {
      const ends = fromISODate(r.credit!.expires!);
      const left = daysBetween(today, ends);
      const key = alertKey(r.id, 'credit');
      if (left >= 0 && left <= CREDIT_NOTICE_DAYS && !sent.has(key)) {
        out.push({ receiptId: r.id, rung: 'credit', key, ...copyFor('credit', r, left, ends) });
      }
    }
    if (r.status !== 'active') continue;
    /*
     * Never about the demo set.
     *
     * A notification is not a demonstration. The five receipts a fresh install
     * arrives with are labelled "sample" on the list and cost nothing against
     * the free tier, and this was the one place they still behaved as real:
     * grant permission and the phone says "Go now or lose it — Currys · JBL
     * Tune 770NC headphones — 2 days left. £89.00 back if it goes back", on a
     * lock screen, indistinguishable from a real one, about £89 nobody spent.
     *
     * The urgency is already demonstrated where it can be seen for what it is:
     * the home screen leads with that same receipt and its two days. An
     * interruption carrying a money figure is a different thing from a card.
     */
    if (r.demo) continue;
    const { daysLeft, deadline } = derive(r, today);
    const rung = rungFor(daysLeft, urgentDays);
    if (!rung) continue;
    const key = alertKey(r.id, rung);
    if (sent.has(key)) continue;
    out.push({ receiptId: r.id, rung, key, ...copyFor(rung, r, daysLeft, deadline) });
  }
  // Soonest first: when several fire at once, the one that matters most is the
  // one that gets read.
  // Only the ORDER of these numbers means anything — 'week' could be any value
  // above 'closed' and no test could tell, which is why none tries.
  const order: Record<AlertRung, number> = { today: 0, soon: 1, closed: 2, week: 3, refund: 4, credit: 5, warranty: 6 };
  return out.sort((a, b) => order[a.rung] - order[b.rung]);
}

/**
 * Keys for rungs this receipt has already passed through.
 *
 * Marked delivered without ever being shown, so a phone left in a drawer for a
 * fortnight does not open into four notifications about the same coat. The
 * receipt is at its most urgent rung; the gentler ones it skipped are history,
 * and history is not worth an interruption.
 */
export function supersededKeys(alert: DeadlineAlert): string[] {
  // Its own clock, a single rung: nothing below it to have skipped.
  if (alert.rung === 'warranty' || alert.rung === 'refund' || alert.rung === 'credit') return [];
  return LADDER.slice(0, LADDER.indexOf(alert.rung)).map((rung) => alertKey(alert.receiptId, rung));
}

/**
 * Drops keys belonging to receipts that no longer exist, so the sent-list does
 * not grow without bound on a device that adds and returns receipts for years.
 */
export function pruneSent(sent: readonly string[], receipts: readonly Receipt[]): string[] {
  const live = new Set(receipts.map((r) => r.id));
  return sent.filter((k) => live.has(k.slice(0, k.lastIndexOf(':'))));
}
