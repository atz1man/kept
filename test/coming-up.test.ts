import { describe, expect, it } from 'vitest';
import { REFUND_CHASE_DAYS } from '../src/lib/alerts';
import { COMING_UP_DAYS, comingUp } from '../src/lib/coming-up';
import { addDays, addMonths, toISODate } from '../src/lib/dates';
import { REPLY_DAYS } from '../src/lib/fault-letter';
import { toPence } from '../src/lib/money';
import type { Receipt } from '../src/lib/types';

const TODAY = new Date(2026, 7, 28);
const iso = (n: number) => toISODate(addDays(TODAY, n));

/** Bought `ago` days before TODAY with a 30-day window. */
const r = (id: string, ago: number, over: Partial<Receipt> = {}): Receipt => ({
  id, store: 'Argos', item: 'Kettle', cat: 'kitchen', amount: toPence(29),
  purchasedOn: iso(-ago), windowDays: 30, policy: 'p', distance: false, status: 'active',
  ...over,
});
const days = (list: ReturnType<typeof comingUp>) => list.map((c) => [c.receiptId, c.kind, toISODate(c.date)]);

describe('what is coming up', () => {
  it('lists a return window’s last day from today through the edge of the window, and not past it', () => {
    expect(days(comingUp([r('a', 30)], TODAY))).toEqual([['a', 'return', iso(0)]]);
    expect(days(comingUp([r('b', 31)], TODAY))).toEqual([]);
    expect(days(comingUp([r('c', 30 - COMING_UP_DAYS, { purchasedOn: iso(COMING_UP_DAYS - 30) })], TODAY))).toEqual([['c', 'return', iso(COMING_UP_DAYS)]]);
    expect(days(comingUp([r('d', 0, { purchasedOn: iso(COMING_UP_DAYS - 29) })], TODAY))).toEqual([]);
  });

  it('lists the day a refund is worth chasing, a fault letter’s reply, and credit running out', () => {
    const list = comingUp([
      r('sent', 40, { status: 'sent', sentOn: iso(-3) }),
      r('fault', 100, { status: 'kept', faultClaim: { sentOn: iso(-2) } }),
      r('credit', 100, { status: 'returned', returnedOn: iso(-50), credit: { expires: iso(20) } }),
    ], TODAY);
    expect(days(list)).toEqual([
      ['sent', 'refund', iso(REFUND_CHASE_DAYS - 3)],
      ['fault', 'fault', iso(REPLY_DAYS - 2)],
      ['credit', 'credit', iso(20)],
    ]);
  });

  it('lists a guarantee ending, on a receipt with one, and not one years away', () => {
    const ending = r('g', 0, { status: 'kept', purchasedOn: toISODate(addMonths(TODAY, -12)), warranty: { months: 12 } });
    expect(comingUp([ending], TODAY).map((c) => c.kind)).toEqual(['warranty']);
    // Its right to reject is listed; a guarantee two years off is not.
    expect(comingUp([r('far', 0, { status: 'kept', warranty: { months: 24 } })], TODAY).map((c) => c.kind)).toEqual(['reject']);
  });

  it('puts the soonest first, and the one with money on a clock first on the same day', () => {
    const list = comingUp([
      r('in15', 15),
      r('credit5', 100, { status: 'returned', returnedOn: iso(-50), credit: { expires: iso(5) } }),
      r('in10', 20),
    ], TODAY);
    expect(days(list)).toEqual([
      ['credit5', 'credit', iso(5)],
      ['in10', 'return', iso(10)],
      ['in15', 'return', iso(15)],
    ]);
    const sameDay = comingUp([
      r('w', 0, { status: 'kept', purchasedOn: toISODate(addMonths(addDays(TODAY, 10), -12)), warranty: { months: 12 } }),
      r('ret', 20),
    ], TODAY);
    expect(days(sameDay)).toEqual([['ret', 'return', iso(10)], ['w', 'warranty', iso(10)]]);
  });

  it('lists only the right to reject for a kept receipt, nothing for a returned one, and marks a sample as one', () => {
    expect(days(comingUp([r('kept', 5, { status: 'kept' }), r('back', 5, { status: 'returned', returnedOn: iso(-1) })], TODAY))).toEqual([['kept', 'reject', iso(25)]]);
    expect(comingUp([r('s', 5, { demo: true })], TODAY)[0].demo).toBe(true);
  });
});
