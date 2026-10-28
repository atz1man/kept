import type { Receipt } from '../lib/types';
import { derive, floorClock } from '../lib/receipts';
import { firstToClose, legalRights, type FirstClock, type LegalRight } from '../lib/legal';
import { clockFor, findStore, policyFor, shopCheckedOn, windowFor, type StorePolicy } from '../lib/stores';
import { windowStartFrom } from '../lib/draft';
import { daysBetween, fromISODate, toISODate } from '../lib/dates';

/*
 * The landing page's "can I still return it?" checker.
 *
 * A marketing page that computes a deadline is making the product's central
 * claim live, in front of someone deciding whether to trust it, so it must
 * give the answer the app would give and not a second opinion. It builds the
 * receipt the Add screen would save and asks the app's own functions:
 * `windowFor` and `clockFor` for the shop's window and clock,
 * `windowStartFrom` for where it starts, `derive` for the deadline, and
 * `legalRights` and `firstToClose` for the law beside it. Nothing here
 * re-derives a date. test/landing-checker.test.ts holds every figure to those
 * functions called directly.
 */

export interface CheckInput {
  /** A shop in the table, by its own name. */
  store: string;
  /** ISO day it was bought or ordered. */
  purchasedOn: string;
  /** Bought online, by phone or otherwise at a distance. */
  online: boolean;
  /** ISO day the shop's clock started, where it is not the purchase: arrival or dispatch. Optional. */
  startedOn?: string;
}

export interface CheckResult {
  shop: StorePolicy;
  windowDays: number;
  /** What the shop's clock counts from, for this way of buying. */
  clock: StorePolicy['clockStart'];
  /** The day it must be back by, inclusive. */
  deadline: Date;
  daysLeft: number;
  expired: boolean;
  /** Days of the window gone, for the ring. */
  daysUsed: number;
  /**
   * True when the shop counts from delivery or dispatch and that day was not
   * given: the deadline is then the EARLIEST it can be, never the latest, and
   * the page says so as the app does (`floorClock`).
   */
  floor: boolean;
  rights: LegalRight[];
  first: FirstClock | null;
  /** When the shop's own window was last read off its returns page, or null. */
  checkedOn: Date | null;
}

/** What is wrong with the input, or nothing — the reasons a person can act on. */
export function checkProblem(input: CheckInput, today: Date): string | null {
  if (!findStore(input.store)) return 'Pick a shop from the list';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.purchasedOn) || toISODate(fromISODate(input.purchasedOn)) !== input.purchasedOn) {
    return 'Pick the day you bought it';
  }
  if (daysBetween(today, fromISODate(input.purchasedOn)) > 0) return 'That day has not happened yet';
  if (input.startedOn) {
    if (toISODate(fromISODate(input.startedOn)) !== input.startedOn) return 'Pick a real day, or leave it blank';
    if (daysBetween(today, fromISODate(input.startedOn)) > 0) return 'That day has not happened yet';
    if (daysBetween(fromISODate(input.purchasedOn), fromISODate(input.startedOn)) < 0) return 'It cannot have come before you bought it';
  }
  return null;
}

/** The receipt the app would hold for this purchase. */
export function receiptFor(input: CheckInput): Receipt {
  const shop = findStore(input.store)!;
  const clock = clockFor(shop, input.online);
  const started = input.startedOn || undefined;
  const windowDays = windowFor(shop, input.online);
  return {
    id: 'landing-check',
    store: shop.name,
    item: 'Your purchase',
    cat: shop.cat ?? 'other',
    amount: 0,
    purchasedOn: input.purchasedOn,
    windowStartsOn: windowStartFrom(shop, {
      distance: input.online,
      arrivedOn: clock === 'delivery' ? started : undefined,
      dispatchedOn: clock === 'dispatch' ? started : undefined,
    }),
    windowDays,
    // The statutory clocks run from arrival. Only a delivery date is one; a
    // dispatch date is not, so it is not passed off as one here.
    arrivedOn: input.online && clock === 'delivery' ? started : undefined,
    policy: policyFor(shop.name, windowDays, undefined, input.online),
    distance: input.online,
    status: 'active',
  };
}

export function checkReturn(input: CheckInput, today: Date): CheckResult {
  const shop = findStore(input.store)!;
  const r = receiptFor(input);
  const d = derive(r, today);
  return {
    shop,
    windowDays: r.windowDays,
    clock: clockFor(shop, input.online),
    deadline: d.deadline,
    daysLeft: d.daysLeft,
    expired: d.expired,
    daysUsed: d.daysUsed,
    floor: floorClock(r) !== null,
    rights: legalRights(r, today, !d.expired),
    first: firstToClose(r, today, d.deadline),
    checkedOn: shopCheckedOn(shop.name, today),
  };
}
