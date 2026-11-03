import { fmtDateLong, fromISODate } from './dates';
import { findStore } from './stores';
import type { Receipt } from './types';

/**
 * Christmas returns: the later date a shop gives for things bought in the
 * run-up to Christmas, so a present can still go back in January.
 *
 * Without it the app was wrong in the one season most returns happen. A
 * jumper bought from Dunelm on 1 December has 28 days, so the app said
 * "return by 29 December" — and reminded, and coloured the row red, and put
 * it in the claim pack as late after that — when Dunelm's own page says it
 * can go back until 31 January. The person most likely to trust the date is
 * the one who was given the thing and never saw the receipt.
 *
 * Each row is what the shop's own returns page says, quoted in the report
 * named by `checkedOn` (store/retailer-check/), read twice; test/christmas
 * holds every row to its quote. Nothing here comes from a search result or a
 * news story: an extension the shop has not published is not an extension.
 *
 * An extension only ever moves a deadline LATER. Every shop that states it
 * either says "whichever is later" or gives a date past any ordinary window
 * for the purchases it covers, and none takes days away — so the date is the
 * later of the two, never the extension's alone.
 *
 * One with a CONDITION the app cannot see on a receipt (full-price items only,
 * unworn) does not move the deadline. Telling a person whose sale jumper does
 * not qualify that it can go back in January is the one mistake here that
 * costs them the refund. It is SAID instead, beside the date, with the
 * condition, and they decide.
 */
export interface ChristmasExtension {
  /** The shop's name exactly as in the table. */
  store: string;
  /** First purchase day it covers, inclusive. */
  boughtFrom: string;
  /** Last purchase day it covers, inclusive; absent where the shop gives no end. */
  boughtTo?: string;
  /** The last day it can go back, inclusive. */
  returnBy: string;
  /** Which purchases: 'online' orders only, 'store' purchases only, or both. */
  appliesTo: 'all' | 'online' | 'store';
  /** What an item must be to qualify, in the shop's terms — the app cannot tell. */
  condition?: string;
  /**
   * What the shop leaves out that is not most things — Next's Christmas
   * decorations, a jeweller's monthly warranty — as a sentence. Said beside
   * the date; it does not hold the deadline back, because nearly everything
   * bought qualifies.
   */
  excludes?: string;
  /** The report in store/retailer-check/ the quote is in. */
  checkedOn: string;
}

/*
 * Christmas 2026, read on 3 November 2026 (store/retailer-check/2026-11-03-christmas.md).
 * Shops that sell only online are 'all': a receipt from one may not be marked
 * online, and there is no other way to have bought it.
 */
const ON = '2026-11-03';
export const CHRISTMAS: readonly ChristmasExtension[] = [
  { store: 'Dunelm', boughtFrom: '2026-10-12', boughtTo: '2026-12-24', returnBy: '2027-01-31', appliesTo: 'all', excludes: 'Dunelm says exclusions apply.', checkedOn: ON },
  // From the 20th the page puts purchases back on 28 days, which reaches the 17th anyway.
  { store: 'Seasalt', boughtFrom: '2026-10-01', boughtTo: '2026-12-19', returnBy: '2027-01-17', appliesTo: 'all', checkedOn: ON },
  { store: 'Jigsaw', boughtFrom: '2026-10-15', boughtTo: '2026-12-26', returnBy: '2027-01-17', appliesTo: 'all', condition: 'full-price items', checkedOn: ON },
  { store: 'Next', boughtFrom: '2026-10-23', boughtTo: '2026-12-25', returnBy: '2027-01-05', appliesTo: 'all', excludes: 'Not for Outlet or Clearance stores, or Christmas decorations.', checkedOn: ON },
  { store: 'Boohoo', boughtFrom: '2026-10-29', returnBy: '2027-01-05', appliesTo: 'all', checkedOn: ON },
  { store: 'PrettyLittleThing', boughtFrom: '2026-10-29', returnBy: '2027-01-05', appliesTo: 'all', checkedOn: ON },
  { store: 'New Look', boughtFrom: '2026-10-26', boughtTo: '2026-12-06', returnBy: '2027-01-03', appliesTo: 'all', condition: 'unwanted gifts, not sale items,', checkedOn: ON },
  { store: 'Gymshark', boughtFrom: '2026-11-01', boughtTo: '2027-01-01', returnBy: '2027-01-31', appliesTo: 'all', checkedOn: ON },
  { store: 'Crew Clothing', boughtFrom: '2026-10-12', returnBy: '2027-01-23', appliesTo: 'all', condition: 'unworn full-price items with a receipt', checkedOn: ON },
  { store: 'Joe Browns', boughtFrom: '2026-10-22', returnBy: '2027-01-11', appliesTo: 'all', checkedOn: ON },
  { store: 'M&S', boughtFrom: '2026-10-22', returnBy: '2027-01-17', appliesTo: 'all', condition: 'full-price items', checkedOn: ON },
  { store: 'Oliver Bonas', boughtFrom: '2026-11-01', boughtTo: '2026-12-11', returnBy: '2027-01-10', appliesTo: 'all', excludes: 'It says “most items”.', checkedOn: ON },
  { store: 'Toast', boughtFrom: '2026-10-23', boughtTo: '2026-12-24', returnBy: '2027-01-16', appliesTo: 'all', condition: 'full-price items', checkedOn: ON },
  { store: 'Ernest Jones', boughtFrom: '2026-10-01', boughtTo: '2026-12-24', returnBy: '2027-01-23', appliesTo: 'all', excludes: 'Not for warranty bought on a monthly plan.', checkedOn: ON },
  { store: 'H.Samuel', boughtFrom: '2026-10-01', boughtTo: '2026-12-24', returnBy: '2027-01-23', appliesTo: 'all', excludes: 'Not for warranty bought on a monthly plan.', checkedOn: ON },
  { store: 'Dell', boughtFrom: '2026-11-01', boughtTo: '2026-12-29', returnBy: '2027-01-15', appliesTo: 'all', excludes: 'For consumers buying at Dell.com.', checkedOn: ON },
];

/** The extension that covers this purchase, conditional or not, or null. */
export function christmasCover(
  r: Pick<Receipt, 'store' | 'purchasedOn' | 'distance'>,
  table: readonly ChristmasExtension[] = CHRISTMAS,
): ChristmasExtension | null {
  const shop = findStore(r.store);
  if (!shop) return null;
  const bought = r.purchasedOn;
  for (const x of table) {
    if (x.store !== shop.name) continue;
    if (x.appliesTo === 'online' && !r.distance) continue;
    if (x.appliesTo === 'store' && r.distance) continue;
    // ISO dates compare as strings, and the purchase day is a calendar day:
    // no time zone can move it across a bound.
    if (bought < x.boughtFrom) continue;
    if (x.boughtTo && bought > x.boughtTo) continue;
    return x;
  }
  return null;
}

/**
 * The extension that moves this receipt's deadline — covered, no condition,
 * and later than the ordinary deadline — or null.
 */
export function christmasDeadline(
  r: Pick<Receipt, 'store' | 'purchasedOn' | 'distance'>,
  ordinary: Date,
  table: readonly ChristmasExtension[] = CHRISTMAS,
): Date | null {
  const x = christmasCover(r, table);
  if (!x || x.condition) return null;
  const by = fromISODate(x.returnBy);
  return by.getTime() > ordinary.getTime() ? by : null;
}

/** "1 December 2026": the year always, since these straddle two. */
const day = (iso: string) => fmtDateLong(fromISODate(iso));

/**
 * The sentence the receipt's screen shows under the shop's policy, or null.
 *
 * Where the extension moved the deadline it says whose date it is and what
 * the ordinary window would have been, so a date a month later than the
 * receipt's "28 days" is not a mystery. Where it carries a condition the app
 * cannot see, it says the condition and the date, and leaves the deadline
 * alone — see the note at the top of this file.
 */
export function christmasLine(
  r: Pick<Receipt, 'store' | 'purchasedOn' | 'distance' | 'windowDays'>,
  d: { christmas: boolean; deadline: Date },
  table: readonly ChristmasExtension[] = CHRISTMAS,
): string | null {
  const x = christmasCover(r, table);
  if (!x) return null;
  const moved = d.christmas;
  // A Christmas date no later than the one shown offers nothing: M&S's 17
  // January is no help to something bought on 1 January with 28 days.
  if (x.condition && fromISODate(x.returnBy).getTime() <= d.deadline.getTime()) return null;
  const shop = findStore(r.store)!.name;
  const when = x.boughtTo ? `bought ${day(x.boughtFrom)} to ${day(x.boughtTo)}` : `bought from ${day(x.boughtFrom)}`;
  if (x.condition) return `Christmas returns: ${shop} takes ${x.condition} ${when} back until ${day(x.returnBy)}. If this qualifies, you have until then; the date above is the ordinary ${r.windowDays}-day window.`;
  if (!moved) return null;
  return `Christmas returns: ${shop} takes things ${when} back until ${day(x.returnBy)}, later than its usual ${r.windowDays} days.${x.excludes ? ` ${x.excludes}` : ''}`;
}
