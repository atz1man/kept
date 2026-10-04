import { addDays, daysBetween, fmtDate, fromISODate, toISODate } from './dates';
import { REPLY_DAYS } from './fault-letter';
import { REFUND_CHASE_DAYS, REJECT_DAYS } from './legal';
import { money } from './money';
import { derive, floorClock, floorWords, refundOf } from './receipts';
import { refundIsStatutory } from './refund-chase';
import { windowChecked } from './stores';
import type { Receipt } from './types';
import { possessive } from './words';

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
export type AlertRung = ReturnRung | 'reject' | 'warranty' | 'refund' | 'credit' | 'fault';

/**
 * When a refund is asked about: reg. 34's fortnight, defined in legal.ts with
 * the statute's other periods and exported here too, where the scheduler, the
 * Coming up list and the screens have always imported it from.
 */
export { REFUND_CHASE_DAYS };

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

/** Store credit with a known expiry, on a real receipt, not yet spent: the one kind watched. */
export function creditWatched(r: Receipt): boolean {
  return r.status === 'returned' && !r.demo && !!r.credit?.expires && !r.credit.spentOn;
}

/**
 * A fault letter sent about something still with its owner, on a real
 * receipt: asked about once, on the day the letter asked the shop to reply by.
 */
export function faultWatched(r: Receipt): boolean {
  return (r.status === 'active' || r.status === 'kept') && !r.demo && !!r.faultClaim;
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

/**
 * How long before the short-term right to reject ends it is worth a word.
 * Our number, the same three days the shop's ladder calls "soon": time to try
 * the thing properly and to tell the shop if it is not right.
 */
export const REJECT_NOTICE_DAYS = 3;

/**
 * How far from the shop's own deadline, before it or after it, the right to
 * reject has to end before it earns an alert of its own. Our number. Inside a
 * week of the shop's deadline the ladder is already talking about this
 * receipt, and a second alert about the same days is the kind that gets
 * notifications switched off.
 *
 * Either side, because the ladder's days sit on both sides of the deadline:
 * "week" before it, "closed" the morning after. At a week's gap, with the
 * default seven-day warning, the morning this reminder is lodged for is at
 * least three days from every rung's, whichever way round the two clocks are.
 */
export const REJECT_GAP_DAYS = 7;

/**
 * The last day of the 30-day right to reject, as its reminder counts it.
 *
 * From the day it came, as the Act counts it; for an online order nobody has
 * said arrived, the order date, which can only be earlier — so the alert comes
 * early rather than late, and says "no earlier than". One count for the alert
 * and for the reducer, which forgets the reminder when this day moves.
 */
export function rejectEnds(r: Receipt): Date {
  return addDays(fromISODate(r.arrivedOn ?? r.purchasedOn), REJECT_DAYS);
}

/**
 * The day the 30-day right to reject ends, when that day deserves its own
 * alert, else null.
 *
 * kept told people it "counts both clocks down" and, natively, that it
 * "lodges each deadline with iOS" — and only the shop's was ever lodged. The
 * statutory clock that matters on its own is this one: a shop that gives 35
 * or 365 days for a change of mind lets the 30 days to reject a FAULT, for a
 * full refund and without accepting a repair first, run out unannounced.
 *
 * Kept receipts are watched whatever the shop's window: they have left the
 * return ladder, and "is it working?" is the one question left worth asking
 * before the right lapses. Active ones only when the right ends at least a
 * week away from the shop's deadline, on either side of it. Never a sample,
 * and never once a fault letter has gone: that has its own clock and its own
 * follow-up. The 14-day right to cancel gets none — where the shop's window
 * is longer it already covers a change of mind, and where it is shorter the
 * ladder is already speaking.
 *
 * Either side, not only before. The gap was measured one way, as if every
 * shop gave longer than thirty days, so a SHORTER window silenced the right
 * as well: Currys', Apple's, Samsung's and Selfridges' fourteen days, and
 * Debenhams', Boohoo's and PrettyLittleThing's twenty-one. Their ladder says
 * its last the morning after the shop's day — "If it turns out to be faulty,
 * you still have rights" — and the first of those rights to lapse then went a
 * week or two later with nothing said. Measured: bought 27 days ago and still
 * on the list, a Currys, Apple or Debenhams receipt raised nothing on the web
 * and had nothing lodged with iOS, while an IKEA one was told it had three
 * days left.
 */
export function rejectWatched(r: Receipt, today: Date): { ends: Date; hedged: boolean } | null {
  if (r.demo || r.faultClaim) return null;
  if (r.status !== 'active' && r.status !== 'kept') return null;
  const ends = rejectEnds(r);
  if (r.status === 'active' && Math.abs(daysBetween(ends, derive(r, today).deadline)) < REJECT_GAP_DAYS) return null;
  return { ends, hedged: r.distance && r.arrivedOn === undefined };
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
  /*
   * The shop's window, said as what it is. For a shop Kept has checked it is
   * the shop's; for any other it is the number saved on the receipt — a guess
   * or a figure typed in — and a reminder must not state it as the shop's.
   * "That window has closed" about a guess is the one sentence this app must
   * never say wrongly: the shop may well give longer.
   */
  const checked = windowChecked(r);
  const unchecked = `Kept hasn’t checked ${possessive(r.store)} returns policy, so check the receipt.`;
  /*
   * And for a floor (`floorClock`), the date is not the date at all: counted
   * from the order because nobody said when the parcel came, it is the
   * EARLIEST the window can end. "That window has closed" about one was the
   * same sentence about a day the shop would still take it back — measured on
   * an Apple order, two days before its real last day — and the checked
   * shops said it most confidently, because their windows ARE checked. So
   * the last two rungs hedge, the way the statutory lines already do ("no
   * earlier than"), and say the one thing that settles it. The earlier rungs
   * need nothing: "3 days left" when there may be more is a reminder that
   * comes early, the direction `rejectEnds` errs in on purpose.
   */
  const floor = floorClock(r);
  const counts = floor ? `${r.store} counts from ${floorWords(floor).countsFrom}` : '';
  const addIt = floor ? `${floorWords(floor).addIt} to know` : '';
  switch (rung) {
    case 'week':
      return {
        title: `${money(r.amount)} still returnable`,
        body: `${what} — ${daysLeft} days left, until ${fmtDate(deadline)}.${checked ? '' : ` ${unchecked}`}`,
      };
    case 'soon':
      return {
        title: 'Due soon',
        body: `${what} — ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left. ${money(r.amount)} back if it goes back.${checked ? '' : ` ${unchecked}`}`,
      };
    case 'today':
      if (floor) {
        return checked
          ? { title: 'The window may close today', body: `${what} — ${money(r.amount)} back if it goes back today, the earliest its window can close. ${counts}, so it may give longer — ${addIt}.` }
          : { title: 'The saved window may end today', body: `${what} — the ${r.windowDays} days saved for it end today at the earliest. ${counts}, so it may give longer — ${addIt}. ${unchecked}` };
      }
      return checked
        ? { title: 'Today is the last day', body: `${what} — ${money(r.amount)} back, but only if it goes back today.` }
        : { title: 'The saved window ends today', body: `${what} — the ${r.windowDays} days saved for it end today. ${unchecked}` };
    case 'closed':
      if (floor) {
        return {
          title: checked ? 'That window may have closed' : 'The saved window may have passed',
          body: `${what} — counted from your order its ${r.windowDays} days are up, but ${counts}, so it may still be open — ${addIt}.${checked ? '' : ` ${unchecked}`} If it turns out to be faulty, you still have rights.`,
        };
      }
      return checked
        ? {
            title: 'That window has closed',
            body: `${what} — the shop’s window has passed. If it turns out to be faulty, you still have rights.`,
          }
        : {
            title: 'The saved window has passed',
            body: `${what} — the ${r.windowDays} days saved for it are up. Kept hasn’t checked ${possessive(r.store)} returns policy, so check the receipt: the shop may give longer. If it turns out to be faulty, you still have rights.`,
          };
    case 'reject': {
      // `daysLeft` and `deadline` are the RIGHT's here. After it, the shop
      // may repair or replace first (s.23) — which is what is being lost,
      // and so what is said, rather than "your rights end".
      const hedged = r.distance && r.arrivedOn === undefined;
      return {
        title: daysLeft > 0 ? `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left to reject it if it’s faulty` : 'Last day to reject it if it’s faulty',
        body: `${what} — your ${REJECT_DAYS}-day right to reject faulty goods for a full refund ends ${hedged ? 'no earlier than' : 'on'} ${fmtDate(deadline)}. If anything is wrong with it, tell the shop before then: after it, they can offer a repair or replacement first.`,
      };
    }
    case 'refund':
      // `deadline` is the day it went back; `daysLeft` is unused. The legal
      // limit is stated only where it applies — a cancelled distance order,
      // by the one test the late panel, the letter and the claim pack use —
      // and never as a promise about any other shop's terms. It tested
      // `r.distance`, which is every online order however late it went back.
      return {
        title: 'Has the refund come through?',
        body: `${what} — it went back on ${fmtDate(deadline)}.${
          refundIsStatutory(r) ? ` For an online order, the shop has ${REFUND_CHASE_DAYS} days from getting it back to refund you.` : ''
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
    case 'fault':
      // `deadline` is the day the letter went; `daysLeft` is unused. The
      // fortnight is the letter's own ask, not the law's, and is called that.
      return {
        title: `Has ${r.store} replied?`,
        body: `${what} — you wrote about the fault on ${fmtDate(deadline)} and asked for a reply within ${REPLY_DAYS} days. If nothing has come, Citizens Advice’s consumer service can tell you what to do next.`,
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
    // The right to reject a fault, in its last days, where nothing else is
    // saying so. On a kept receipt as well as an active one.
    const reject = rejectWatched(r, today);
    if (reject) {
      const left = daysBetween(today, reject.ends);
      const key = alertKey(r.id, 'reject');
      if (left >= 0 && left <= REJECT_NOTICE_DAYS && !sent.has(key)) {
        out.push({ receiptId: r.id, rung: 'reject', key, ...copyFor('reject', r, left, reject.ends) });
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
    // The fault letter, once, on the day its fortnight for a reply is up.
    if (faultWatched(r)) {
      const sentOn = fromISODate(r.faultClaim!.sentOn);
      const key = alertKey(r.id, 'fault');
      if (daysBetween(sentOn, today) >= REPLY_DAYS && !sent.has(key)) {
        out.push({ receiptId: r.id, rung: 'fault', key, ...copyFor('fault', r, 0, sentOn) });
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
  const order: Record<AlertRung, number> = { today: 0, soon: 1, closed: 2, week: 3, reject: 4, refund: 5, credit: 6, fault: 7, warranty: 8 };
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
  if (alert.rung === 'warranty' || alert.rung === 'refund' || alert.rung === 'credit' || alert.rung === 'fault' || alert.rung === 'reject') return [];
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

/**
 * The clocks a receipt carries in its own dates, each with the reminders that
 * are about it and the day it ends: the shop's window, the guarantee and the
 * right to reject. Not the refund, the credit or the fault letter: each of
 * those clocks starts with something done to one receipt (posting it back,
 * being given credit, writing the letter) and has its own reducer case.
 */
const DATED_CLOCKS: readonly { rungs: readonly AlertRung[]; ends: (r: Receipt, today: Date) => string }[] = [
  { rungs: LADDER, ends: (r, today) => toISODate(derive(r, today).deadline) },
  { rungs: ['warranty'], ends: (r, today) => { const w = derive(r, today).warranty; return w ? toISODate(w.ends) : ''; } },
  { rungs: ['reject'], ends: (r) => toISODate(rejectEnds(r)) },
];

/**
 * The reminders whose clock ends on a different day on `after` than on
 * `before`, so what was said about them is about a day that has gone: what an
 * edit makes stale. Every dated clock's, where there is no `before`.
 */
export function movedRungs(before: Receipt | undefined, after: Receipt, today: Date): AlertRung[] {
  return DATED_CLOCKS.filter((c) => !before || c.ends(before, today) !== c.ends(after, today)).flatMap((c) => c.rungs);
}

/**
 * What was already said about `from`, said under `to`'s id: for a receipt
 * made out of another, a part split off a basket or the one that came home
 * from a swap.
 *
 * Both are made with the original's dates, so the reminders about those
 * clocks were already given, about the same days. The new receipt had none
 * of the keys, and said them all again: a basket's "Today is the last day",
 * shown that morning, came back the moment a shirt was split out of it, and a
 * swapped TV's "The saved window has passed" came back for the replacement.
 * Only the clocks the two share, decided by the comparison `update` forgets
 * by, so the two rules cannot come apart: a clock that ends on another day
 * is owed its reminders, and the refund, credit and fault ones are never
 * carried.
 */
export function inheritedKeys(sent: readonly string[], from: Receipt, to: Receipt, today: Date): string[] {
  const moved = new Set(movedRungs(from, to, today));
  return DATED_CLOCKS.flatMap((c) => c.rungs)
    .filter((rung) => !moved.has(rung) && sent.includes(alertKey(from.id, rung)))
    .map((rung) => alertKey(to.id, rung));
}
