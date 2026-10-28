import { describe, expect, it } from 'vitest';
import { checkProblem, checkReturn, receiptFor } from '../src/landing/checker';
import { derive } from '../src/lib/receipts';
import { firstToClose, legalRights, REJECT_DAYS } from '../src/lib/legal';
import { STORE_POLICIES, clockFor, findStore, windowFor } from '../src/lib/stores';
import { addDays, fromISODate, toISODate } from '../src/lib/dates';

/**
 * The landing page's checker gives the app's answer, not its own.
 *
 * A deadline computed on the page someone is deciding whether to trust is
 * the product's claim made live; a page that disagreed with the app by a day
 * would be the one place that disagreement is guaranteed to be seen. So every
 * figure it shows is held to the app's own functions, called directly on the
 * receipt the Add screen would save, over every shop in the table and both
 * ways of buying.
 */
const TODAY = fromISODate('2026-10-28');
const ago = (n: number) => toISODate(addDays(TODAY, -n));

describe('the checker, over every shop', () => {
  it('finds what it is meant to be checking', () => {
    // A sweep over an empty table passes silently.
    expect(STORE_POLICIES.length).toBeGreaterThan(50);
  });

  it('gives the deadline, the law and the first clock the app gives', () => {
    for (const shop of STORE_POLICIES) {
      for (const online of [false, true]) {
        for (const startedOn of [undefined, ago(3)]) {
          const input = { store: shop.name, purchasedOn: ago(9), online, startedOn };
          const r = receiptFor(input);
          const d = derive(r, TODAY);
          const got = checkReturn(input, TODAY);
          const where = `${shop.name} ${online ? 'online' : 'in store'} ${startedOn ?? ''}`;
          expect(got.windowDays, where).toBe(windowFor(shop, online));
          expect(got.clock, where).toBe(clockFor(shop, online));
          expect(toISODate(got.deadline), where).toBe(toISODate(d.deadline));
          expect(got.daysLeft, where).toBe(d.daysLeft);
          expect(got.rights, where).toEqual(legalRights(r, TODAY, !d.expired));
          expect(got.first, where).toEqual(firstToClose(r, TODAY, d.deadline));
        }
      }
    }
  });
});

describe('the cases a person would check it against', () => {
  it('counts a till purchase from the day it was bought', () => {
    const next = findStore('Next')!;
    const got = checkReturn({ store: 'Next', purchasedOn: ago(10), online: false }, TODAY);
    expect(got.daysLeft).toBe(next.windowDays - 10);
    expect(got.floor).toBe(false);
    // One statutory right over a counter, never the cooling-off.
    expect(got.rights).toHaveLength(1);
  });

  it('counts a delivery-clocked order from the day it arrived, once that is given', () => {
    const asos = findStore('ASOS')!;
    expect(clockFor(asos, true)).toBe('delivery');
    const without = checkReturn({ store: 'ASOS', purchasedOn: ago(10), online: true }, TODAY);
    const withArrival = checkReturn({ store: 'ASOS', purchasedOn: ago(10), online: true, startedOn: ago(4) }, TODAY);
    // Without the arrival the date is the earliest it can be, and says so.
    expect(without.floor).toBe(true);
    expect(withArrival.floor).toBe(false);
    expect(withArrival.daysLeft - without.daysLeft).toBe(6);
  });

  it('counts Zara from dispatch, and does not pass a dispatch day off as an arrival', () => {
    expect(clockFor(findStore('Zara')!, true)).toBe('dispatch');
    const r = receiptFor({ store: 'Zara', purchasedOn: ago(10), online: true, startedOn: ago(8) });
    expect(r.windowStartsOn).toBe(ago(8));
    // The law runs from arrival, which a dispatch day is not.
    expect(r.arrivedOn).toBeUndefined();
  });

  it('says a long window is not the first to close', () => {
    // IKEA's 365 days: the first clock to run out is the right to reject.
    const got = checkReturn({ store: 'IKEA', purchasedOn: ago(2), online: false }, TODAY);
    expect(got.first?.which).toBe('reject');
    expect(toISODate(got.first!.on)).toBe(toISODate(addDays(fromISODate(ago(2)), REJECT_DAYS)));
  });

  it('reports a window that has closed as closed', () => {
    const got = checkReturn({ store: 'Apple', purchasedOn: ago(200), online: false }, TODAY);
    expect(got.expired).toBe(true);
    expect(got.first).toBeNull();
  });
});

describe('what it refuses', () => {
  it('turns down what the app would not save, saying why', () => {
    expect(checkProblem({ store: 'Not A Shop', purchasedOn: ago(1), online: false }, TODAY)).toMatch(/shop/i);
    expect(checkProblem({ store: 'Next', purchasedOn: '2026-02-30', online: false }, TODAY)).toMatch(/day you bought/i);
    expect(checkProblem({ store: 'Next', purchasedOn: ago(-1), online: false }, TODAY)).toMatch(/not happened/i);
    expect(checkProblem({ store: 'ASOS', purchasedOn: ago(3), online: true, startedOn: ago(5) }, TODAY)).toMatch(/before you bought/i);
    expect(checkProblem({ store: 'ASOS', purchasedOn: ago(5), online: true, startedOn: ago(3) }, TODAY)).toBeNull();
  });
});
