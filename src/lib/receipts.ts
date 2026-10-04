import { addDays, addMonths, daysBetween, fmtDateNear, fromISODate, startOfDay } from './dates';
import { sumPence } from './money';
import { clockFor, findStore } from './stores';
import type { Receipt } from './types';

/**
 * Every derived fact about a receipt, computed from stored dates against a
 * caller-supplied `today`. The date is a parameter rather than a `new Date()`
 * inside, because a deadline calculator that cannot be run at an arbitrary
 * date is a deadline calculator that cannot be tested.
 */
export interface DerivedWarranty {
  /** The quoted length. Zero means a note with no clock behind it. */
  months: number;
  /** Last day of cover, inclusive. */
  ends: Date;
  daysLeft: number;
  expired: boolean;
  /** Remaining cover, said the way a person would: "2 years", "5 months", "9 days". */
  label: string;
}

/**
 * Warranties are long, so days are the wrong unit for most of one and the
 * right unit for the end of it. "638 days" tells you nothing; "1y 9m" tells
 * you not to worry, and "9 days" tells you to hurry.
 */
function humaniseRemaining(today: Date, ends: Date): string {
  const days = daysBetween(today, ends);
  if (days < 0) return '';
  if (days < 45) return `${days} ${days === 1 ? 'day' : 'days'}`;
  // Starting at 1 gives the same answer everywhere this line is reached — 45
  // days is always at least one whole month — so no test can tell 0 from 1
  // here. Recorded rather than left for the next person to try.
  let months = 0;
  while (addMonths(today, months + 1).getTime() <= ends.getTime()) months += 1;
  // Singular, like the days and years branches either side of it. This read
  // "1 months" for every warranty between 45 and 59 days from its end, on the
  // detail screen, for six weeks of every cover period.
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (rest === 0) return `${years} ${years === 1 ? 'year' : 'years'}`;
  return `${years}y ${rest}m`;
}

export interface DerivedReceipt {
  /** The date the retailer's clock actually started (dispatch, where that differs). */
  windowStart: Date;
  /** The last day the item can go back — inclusive. */
  deadline: Date;
  /** Whole days from today to the deadline. 0 = today is the last day. */
  daysLeft: number;
  /** Days of the window already spent. */
  daysUsed: number;
  expired: boolean;
  /** Present only when the receipt carries a warranty. */
  warranty?: DerivedWarranty;
}

/**
 * The warranty clock runs from PURCHASE, not from the dispatch date a shop may
 * use for returns: a manufacturer's cover starts when the thing was bought,
 * whatever the retailer counts its own window from.
 */
function deriveWarranty(r: Receipt, today: Date): DerivedWarranty | undefined {
  if (!r.warranty) return undefined;
  const ends = addMonths(fromISODate(r.purchasedOn), r.warranty.months);
  const daysLeft = daysBetween(today, ends);
  return {
    months: r.warranty.months,
    ends,
    daysLeft,
    expired: daysLeft < 0,
    label: humaniseRemaining(today, ends),
  };
}

/**
 * The guarantee, in the few words a list row has room for — or null where
 * there is no clock to state.
 *
 * The KEEPING IT list showed the shop, the item and the price, and nothing of
 * the one thing that makes a kept receipt worth holding. "Is the dishwasher
 * still covered?" was a tap into every row to answer.
 */
export function coverLine(r: Receipt, today: Date): string | null {
  const w = deriveWarranty(r, today);
  if (!w || w.months <= 0) return null;
  return w.expired ? `cover ended ${fmtDateNear(w.ends, today)}` : `covered until ${fmtDateNear(w.ends, today)}`;
}

/**
 * Whether the receipt's screen should ask for a guarantee it does not have.
 *
 * The guarantee is the clock that outlives the shop's, and kept only warns
 * before one ends if it knows the length — which nothing asked for. Add has no
 * field (a longer form costs every receipt, most of which never need it), so
 * the receipt's own screen asks instead, where the question is about one
 * thing. Only for what usually carries one: electricals, kitchen things,
 * furniture and the rest, not clothes or cosmetics. Never once it has gone
 * back, and never over a guarantee already noted, clock or not.
 */
export function asksForGuarantee(r: Receipt): boolean {
  return (r.status === 'active' || r.status === 'kept') && !r.warranty && r.cat !== 'clothing' && r.cat !== 'beauty';
}

/**
 * Whether the shop's deadline `derive` gives is a FLOOR rather than the date,
 * and if so which event the shop really counts from. Null when the date is
 * the date.
 *
 * `derive` counts the shop's window from `windowStartsOn`, and without one
 * from the order. For an online order from a shop that counts from delivery
 * or dispatch — 66 of the 101 in the table, 63 of them checked — the order is
 * the EARLIEST the clock could have started, so the deadline is the earliest
 * the window could end and never the latest. Only the Detail screen said so.
 * The reminders, Home's "Window closed" and its "I'm keeping all", the iOS
 * schedule and the claim pack all stated that floor as the deadline, in the
 * confident wording a checked shop earns. Measured: an Apple order placed 19
 * September with no arrival entered was told on 4 October "That window has
 * closed — the shop's window has passed"; a parcel that took three days had
 * until the 6th. And an Apple order sent back thirteen days after it arrived
 * went into the claim pack as "after the shop's own window had closed" — a
 * return made in time, described as late, to the shop.
 *
 * One condition, read by every surface, so none of them can say a floor
 * closed while another says it might not have:
 *  - an online order (`distance`): over a counter the thing is handed over
 *    when it is paid for, so delivery and dispatch ARE the purchase — Apple's
 *    in-store receipt counts from the till, whatever its table row says;
 *  - from a shop whose online clock is delivery or dispatch (`clockFor`, the
 *    rule Add, Edit and `windowStartFor` save by);
 *  - with no `windowStartsOn`, the one field the shop's clock is counted from.
 *    `arrivedOn` sets it for a delivery shop (`windowStartFor`) and does
 *    nothing for a dispatch shop, which counts from earlier — so it is not
 *    read here. A receipt carrying an arrival but no start (a shop whose
 *    clock the table learned after the receipt was saved) is still counted
 *    from the order by `derive`, so its date is still a floor, and Edit's
 *    save puts the start back.
 *
 * A shop not in the table is counted from the order and worded as a guess
 * already (`windowChecked`); nothing here can say more about it.
 */
export function floorClock(r: Pick<Receipt, 'store' | 'distance' | 'windowStartsOn'>): 'delivery' | 'dispatch' | null {
  if (!r.distance || r.windowStartsOn) return null;
  const shop = findStore(r.store);
  const clock = shop ? clockFor(shop, true) : 'purchase';
  return clock === 'purchase' ? null : clock;
}

/** The same condition, as a yes or no. */
export function deadlineIsFloor(r: Pick<Receipt, 'store' | 'distance' | 'windowStartsOn'>): boolean {
  return floorClock(r) !== null;
}

/**
 * The words for why a floor is a floor, and the one thing that turns it into
 * a date — for every surface that has to say it, so they say it alike.
 */
export function floorWords(clock: 'delivery' | 'dispatch'): { countsFrom: string; addIt: string } {
  return clock === 'dispatch'
    ? { countsFrom: 'dispatch', addIt: 'add the day it was dispatched' }
    : { countsFrom: 'delivery', addIt: 'add the day it arrived' };
}

export function derive(r: Receipt, today: Date): DerivedReceipt {
  const windowStart = fromISODate(r.windowStartsOn ?? r.purchasedOn);
  const deadline = addDays(windowStart, r.windowDays);
  const daysLeft = daysBetween(today, deadline);
  const elapsed = daysBetween(windowStart, today);
  return {
    windowStart,
    deadline,
    daysLeft,
    // Clamped: a receipt back-dated by a typo must not report "-4 of 30 days
    // used", and one long past its deadline shows the window as fully spent
    // rather than overflowing the progress ring.
    daysUsed: Math.max(0, Math.min(r.windowDays, elapsed)),
    expired: daysLeft < 0,
    warranty: deriveWarranty(r, today),
  };
}

/**
 * Soonest deadline first — the order every list in the app uses.
 *
 * Pair each receipt with its derived form ONCE, then sort on the number. Used
 * as a bare comparator this derives twice per comparison, which on a few
 * hundred receipts is thousands of redundant date parses to establish an
 * order that was already knowable.
 */
function sortByDeadline(receipts: readonly Receipt[], today: Date): DerivedPair[] {
  return receipts
    .map((r) => ({ receipt: r, derived: derive(r, today) }))
    .sort((a, b) => a.derived.daysLeft - b.derived.daysLeft);
}

export interface DerivedPair {
  receipt: Receipt;
  derived: DerivedReceipt;
}

export interface Buckets {
  /**
   * Past the earliest day its window could close, and nobody has said when
   * it arrived (`deadlineIsFloor`): it may still be open. Not `closed`.
   */
  unsure: Receipt[];
  /** The shop's window has already shut. Still the top of the list. */
  closed: Receipt[];
  urgent: Receipt[];
  later: Receipt[];
  returned: Receipt[];
  /** Decided on and kept: no more return reminders, still has its rights. */
  kept: Receipt[];
  /** Gone back to the shop, the refund still to come. */
  sent: Receipt[];
}

/**
 * The four home-screen sections.
 *
 * An expired-but-unreturned receipt stays at the top — the money may still be
 * recoverable under the statutory rights, and demoting it would hide the row
 * a person most needs to see. It used to sit inside `urgent`, under the
 * heading "GO NOW OR LOSE IT", which is the one thing that cannot be done
 * about something already lost. On a library with a backlog that heading led
 * a screen of rows all reading "window closed".
 *
 * Its own section instead: same position, and a name that says what the row
 * actually is and what is left to try.
 */
export function bucket(receipts: readonly Receipt[], today: Date, urgentDays: number): Buckets {
  const active = sortByDeadline(receipts.filter((r) => r.status === 'active'), today);
  const past = active.filter((x) => x.derived.daysLeft < 0);
  return {
    /*
     * A floor past its day is not a closed window, and was filed as one: red
     * under WINDOW CLOSED · CHECK YOUR RIGHTS, and swept into "I'm keeping
     * all" — one tap that settled as kept an Apple order whose window, for a
     * parcel that took three days, had two days left. Its own section
     * instead, asking for the one date that settles it. It stays there until
     * somebody says, however old the order: "may still be open" about a long
     * shut window costs a row that asks a question, and "closed" about an
     * open one costs the money.
     */
    unsure: past.filter((x) => deadlineIsFloor(x.receipt)).map((x) => x.receipt),
    closed: past.filter((x) => !deadlineIsFloor(x.receipt)).map((x) => x.receipt),
    urgent: active.filter((x) => x.derived.daysLeft >= 0 && x.derived.daysLeft <= urgentDays).map((x) => x.receipt),
    later: active.filter((x) => x.derived.daysLeft > urgentDays).map((x) => x.receipt),
    returned: latestFirst(receipts.filter((r) => r.status === 'returned'), (r) => r.returnedOn),
    kept: latestFirst(receipts.filter((r) => r.status === 'kept'), (r) => r.keptOn),
    sent: latestFirst(receipts.filter((r) => r.status === 'sent'), (r) => r.sentOn),
  };
}

/**
 * Settled lists, most recently settled first. They were in the order the
 * receipts were added, which on a year of use put last week's refund below
 * forty older ones — and kept receipts, which do not count against the free
 * tier, are the list with no reason to stay short. ISO dates sort as text; a
 * receipt with no date (an old backup) goes last, in its original order.
 */
function latestFirst(receipts: Receipt[], on: (r: Receipt) => string | undefined): Receipt[] {
  return receipts
    .map((r, i) => ({ r, i, d: on(r) ?? '' }))
    .sort((a, b) => (a.d === b.d ? a.i - b.i : a.d < b.d ? 1 : -1))
    .map((x) => x.r);
}

/**
 * The money a shop will still take back.
 *
 * NOT every active receipt, and that distinction is the whole of it. `bucket`
 * deliberately keeps an expired one at the top of the list — the money may
 * still be recoverable under the statutory rights, and demoting it would hide
 * the row a person most needs to see — so summing every active receipt put
 * those amounts under the words "still returnable", in the footer of the same
 * card whose label reads WINDOW ALREADY CLOSED and whose line above it says
 * the shop's window shut.
 *
 * That card had already been corrected twice for exactly this contradiction:
 * the label above the headline, then the sentence below it. The footer was the
 * third statement on it and was still counting money the shop will not give
 * back. A closed window is not returnable in the ordinary sense this total
 * means; what is left to try is said per receipt in the section below, in the
 * language of rights rather than of refunds.
 */
export function stillReturnablePence(b: Buckets, everything?: readonly Receipt[]): number {
  // Not `unsure` either: whether the shop still takes it back is the thing
  // nobody knows yet, and this total is a claim that it will.
  const counts = countsAsMoney(everything ?? [...b.unsure, ...b.closed, ...b.urgent, ...b.later, ...b.returned]);
  return sumPence([...b.urgent, ...b.later].filter(counts).map((r) => r.amount));
}

/** What came back for one returned receipt: the refund recorded, or the whole price. */
export function refundOf(r: Receipt): number {
  // A swap brought back an item, not money: nothing recovered.
  if (r.exchanged) return 0;
  return r.refunded ?? r.amount;
}

/** The money a person has actually had back — the same rule as the total above. */
export function recoveredPence(receipts: readonly Receipt[]): number {
  const counts = countsAsMoney(receipts);
  return sumPence(receipts.filter((r) => r.status === 'returned' && counts(r)).map(refundOf));
}

/**
 * Whether a receipt's money belongs in a total.
 *
 * The five sample receipts are not anybody's money, and the rest of the app
 * already knew it — alerts skip them, the quota does not charge for them —
 * while the totals added them in: someone with £50 of real receipts who had
 * not deleted the samples read "£462.96 still returnable", £412.96 of it
 * purchases nobody made.
 *
 * Until the person has added anything, though, the samples ARE the whole
 * point: a fresh install's totals are part of the demonstration, and "£0.00"
 * beside five receipts would read as broken. So the samples count only while
 * they are all there is. The first real receipt takes them out of every total.
 */
export function countsAsMoney(all: readonly Receipt[]): (r: Receipt) => boolean {
  const anyReal = all.some((r) => !r.demo);
  return (r) => !anyReal || !r.demo;
}

/** Receipts whose deadline lands inside the 30-day timeline strip. */
export function timelineDots(receipts: readonly Receipt[], today: Date) {
  return receipts
    .filter((r) => r.status === 'active')
    .map((r) => ({ receipt: r, derived: derive(r, today) }))
    .filter(({ derived }) => derived.daysLeft >= 0 && derived.daysLeft <= 30)
    .map(({ receipt, derived }) => ({
      store: receipt.store,
      daysLeft: derived.daysLeft,
      // Clamped away from the rail's ends so a dot is never half off the strip.
      left: Math.max(2, Math.min(98, Math.round((derived.daysLeft / 30) * 100))),
    }));
}

export function makeReceiptId(now: Date = new Date()): string {
  // The slice bounds are arbitrary: any six-ish base-36 characters do, and
  // pinning the exact length in a test would assert a decision nobody made.
  // What matters is asserted next door — uniqueness, and surviving photoName.
  const rand = Math.random().toString(36).slice(2, 8);
  return `r_${startOfDay(now).getTime().toString(36)}_${rand}`;
}

/**
 * Whether every return in a library actually made it back before its deadline.
 *
 * The "All squared away" card says "Every return made it back in time" above
 * the total recovered, and that sentence used to be unconditional — a claim
 * about timing that nothing checked, on a screen where a return CAN be made
 * after the shop's window shuts, by goodwill or the faulty-goods route. It was
 * made conditional and then lived as an inline `.every` in a component nothing
 * here can render, which is the same claim with a thinner guard.
 *
 * Two rules worth stating rather than reading out of the expression:
 *
 * A return with no date recorded counts AGAINST it. The record cannot support
 * the claim either way, and the boast is the half that has to be earned.
 *
 * An empty library answers FALSE, where `.every` answers true. "Every return
 * made it back in time" about no returns at all is not a claim worth making,
 * and leaving it vacuously true made the sentence depend on a separate
 * emptiness check sitting somewhere else on the screen.
 */
export function everyReturnInTime(returned: readonly Receipt[], today: Date): boolean {
  if (returned.length === 0) return false;
  return returned.every(
    (r) =>
      // The day it went BACK, where that was recorded, not the day the refund
      // landed: posted on day 27 and refunded on day 35 is a return in time.
      (r.sentOn ?? r.returnedOn) !== undefined &&
      daysBetween(fromISODate((r.sentOn ?? r.returnedOn)!), derive(r, today).deadline) >= 0,
  );
}

/**
 * How many rows a settled section shows before "Show all". Money back and
 * Keeping it only ever grow — a year of use is forty rows below the deadlines
 * that still need something — and the latest few are the ones anybody looks
 * for; both lists are sorted latest first.
 */
export const SETTLED_SHOWN = 3;

/**
 * The rows a settled section shows, and how many it is holding back.
 *
 * Everything while searching: a search that found a refund and then hid it
 * behind "Show all" would be answering the question and keeping the answer.
 * And never just one held back: "Show all 4" to reveal a single row costs
 * more than the row.
 */
export function settledRows<T>(rows: readonly T[], expanded: boolean, searching: boolean): { rows: readonly T[]; hidden: number } {
  if (expanded || searching || rows.length <= SETTLED_SHOWN + 1) return { rows, hidden: 0 };
  return { rows: rows.slice(0, SETTLED_SHOWN), hidden: rows.length - SETTLED_SHOWN };
}

/**
 * How long after an online order the app goes on asking whether it has come.
 * Our number, not a shop's: long enough for ordinary delivery and a slow
 * courier, short enough that an order from last spring with no arrival date
 * is not still called "on its way". Past it, the detail screen's floor hedge
 * and Edit remain.
 */
export const ARRIVAL_ASK_DAYS = 30;

/**
 * Ordered online, not yet known to have arrived. The moment most people add a
 * receipt is the order email, which comes before the parcel — and every clock
 * that matters for an online order starts at the doormat: the two statutory
 * rights always, and the shop's own window for the shops that count from
 * delivery. Until the arrival is known each of them is counted from the order,
 * which is early, so the one tap that fixes it is worth offering.
 */
export function awaitingArrival(r: Receipt, today: Date): boolean {
  if (r.status !== 'active' || !r.distance || r.arrivedOn) return false;
  const since = daysBetween(fromISODate(r.purchasedOn), today);
  return since >= 0 && since <= ARRIVAL_ASK_DAYS;
}
