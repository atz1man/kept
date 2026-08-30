import { describe, expect, it } from 'vitest';
import { addDays, toISODate } from '../src/lib/dates';
import { photoName } from '../src/lib/photos';
import { toPence } from '../src/lib/money';
import { bucket, derive, makeReceiptId, stillReturnablePence, timelineDots } from '../src/lib/receipts';
import type { Receipt } from '../src/lib/types';

const TODAY = new Date(2026, 7, 28);
const ago = (n: number) => toISODate(addDays(TODAY, -n));

function receipt(over: Partial<Receipt> = {}): Receipt {
  return {
    id: 'r1', store: 'Currys', item: 'Headphones', cat: 'audio',
    amount: toPence(89), purchasedOn: ago(12), windowDays: 14,
    policy: 'p', distance: false, status: 'active',
    ...over,
  };
}

describe('derive', () => {
  it('counts days left from the stored purchase date', () => {
    expect(derive(receipt(), TODAY).daysLeft).toBe(2);
  });

  it('reports the deadline as an inclusive calendar date', () => {
    expect(toISODate(derive(receipt(), TODAY).deadline)).toBe('2026-08-30');
  });

  it('counts from dispatch when the retailer does', () => {
    // Ordered 15 days ago, dispatched 13. The window hangs off the dispatch
    // date, not the order — which is what makes the deadline shown on the
    // detail screen the shop's own answer rather than a guess from the order
    // confirmation.
    const zara = receipt({ purchasedOn: ago(15), windowStartsOn: ago(13), windowDays: 30 });
    expect(derive(zara, TODAY).daysLeft).toBe(17);
    expect(toISODate(derive(zara, TODAY).windowStart)).toBe(ago(13));
    expect(derive({ ...zara, windowStartsOn: undefined }, TODAY).daysLeft).toBe(15);
  });

  it('marks a passed deadline expired rather than negative-and-fine', () => {
    const d = derive(receipt({ purchasedOn: ago(20), windowDays: 14 }), TODAY);
    expect(d.daysLeft).toBe(-6);
    expect(d.expired).toBe(true);
  });

  it('never reports more days used than the window holds', () => {
    const d = derive(receipt({ purchasedOn: ago(400), windowDays: 30 }), TODAY);
    expect(d.daysUsed).toBe(30);
  });

  it('never reports negative days used for a future-dated purchase', () => {
    const d = derive(receipt({ purchasedOn: toISODate(addDays(TODAY, 3)) }), TODAY);
    expect(d.daysUsed).toBe(0);
  });

  it('is NOT expired on the last day of the window', () => {
    /*
     * The one thing this app must never do. `expired` is `daysLeft < 0`, and
     * the whole suite tested it at minus six — where `<` and `<=` agree. On the
     * last day they do not, and `<=` tells somebody they have missed a deadline
     * they could still meet today, by walking into the shop.
     *
     * The deadline is INCLUSIVE, which is why zero days left is a live right
     * rather than a spent one.
     */
    const d = derive(receipt({ purchasedOn: ago(14), windowDays: 14 }), TODAY);
    expect(d.daysLeft).toBe(0);
    expect(d.expired).toBe(false);
  });

  it('is expired the day after, and not before', () => {
    const d = derive(receipt({ purchasedOn: ago(15), windowDays: 14 }), TODAY);
    expect(d.daysLeft).toBe(-1);
    expect(d.expired).toBe(true);
  });
});

describe('bucketing', () => {
  const set: Receipt[] = [
    receipt({ id: 'urgent', purchasedOn: ago(12), windowDays: 14 }),   // 2 left
    receipt({ id: 'later', purchasedOn: ago(21), windowDays: 30 }),    // 9 left
    receipt({ id: 'expired', purchasedOn: ago(40), windowDays: 14 }),  // -26
    receipt({ id: 'done', status: 'returned' }),
  ];

  it('splits on the urgent threshold', () => {
    const b = bucket(set, TODAY, 7);
    expect(b.urgent.map((r) => r.id)).toContain('urgent');
    expect(b.later.map((r) => r.id)).toEqual(['later']);
    expect(b.returned.map((r) => r.id)).toEqual(['done']);
  });

  it('keeps an expired receipt in view instead of hiding it', () => {
    // The money may still be recoverable under the statutory rights; silently
    // demoting the row would hide the one the user most needs to act on.
    expect(bucket(set, TODAY, 7).closed.map((r) => r.id)).toEqual(['expired']);
  });

  it('does not file an expired receipt under "go now or lose it"', () => {
    // It used to sit inside `urgent`, under a heading that names the one
    // thing that cannot be done about something already lost — and on a
    // library with a backlog that heading led a screen of rows all reading
    // "window closed".
    expect(bucket(set, TODAY, 7).urgent.map((r) => r.id)).not.toContain('expired');
  });

  it('sorts soonest deadline first', () => {
    /*
     * This asserted a bucket holding ONE receipt, which is an order no
     * comparator can get wrong — the name promised sorting and the assertion
     * could not see it. Flipping the comparator's subtraction to an addition
     * left it green.
     *
     * Four in one bucket, handed over in the wrong order, is the smallest case
     * that actually asks the question.
     */
    const many: Receipt[] = [
      receipt({ id: 'in-9', purchasedOn: ago(21), windowDays: 30 }),
      receipt({ id: 'in-2', purchasedOn: ago(12), windowDays: 14 }),
      receipt({ id: 'in-20', purchasedOn: ago(10), windowDays: 30 }),
      receipt({ id: 'in-5', purchasedOn: ago(9), windowDays: 14 }),
    ];
    expect(bucket(many, TODAY, 30).urgent.map((r) => r.id)).toEqual(['in-2', 'in-5', 'in-9', 'in-20']);
  });

  it('orders the closed ones by how recently they closed', () => {
    // Negative days left sort the same way, and a sum comparator reverses them.
    const shut: Receipt[] = [
      receipt({ id: 'long-gone', purchasedOn: ago(60), windowDays: 14 }),
      receipt({ id: 'just-shut', purchasedOn: ago(16), windowDays: 14 }),
    ];
    expect(bucket(shut, TODAY, 7).closed.map((r) => r.id)).toEqual(['long-gone', 'just-shut']);
  });

  it('counts the threshold day itself as urgent, not as later', () => {
    // `<= urgentDays`. Nothing in the fixture above sat ON the boundary, so
    // narrowing it to `<` changed no test — and the receipt with exactly the
    // urgent number of days left is the one the setting is named for.
    const onIt = receipt({ id: 'exactly-7', purchasedOn: ago(7), windowDays: 14 });
    expect(bucket([onIt], TODAY, 7).urgent.map((r) => r.id)).toEqual(['exactly-7']);
    expect(bucket([onIt], TODAY, 7).later).toHaveLength(0);
    expect(bucket([onIt], TODAY, 6).later.map((r) => r.id)).toEqual(['exactly-7']);
  });

  it('files the last day as urgent rather than closed', () => {
    // `daysLeft >= 0`. Zero is a live right — see derive above.
    const lastDay = receipt({ id: 'today', purchasedOn: ago(14), windowDays: 14 });
    expect(bucket([lastDay], TODAY, 7).urgent.map((r) => r.id)).toEqual(['today']);
    expect(bucket([lastDay], TODAY, 7).closed).toHaveLength(0);
  });

  it('puts the closed ones above everything still running', () => {
    // Same position as before, different name: the sections render in this
    // order and the row a person most needs to see is still the first one.
    const b = bucket(set, TODAY, 7);
    expect([...b.closed, ...b.urgent, ...b.later].map((r) => r.id)).toEqual(['expired', 'urgent', 'later']);
  });

  it('moves the threshold when the user widens it', () => {
    expect(bucket(set, TODAY, 14).later).toHaveLength(0);
  });
});

describe('timeline', () => {
  it('shows only deadlines inside the next 30 days', () => {
    const set = [
      receipt({ id: 'in', purchasedOn: ago(12), windowDays: 14 }),
      receipt({ id: 'far', purchasedOn: ago(10), windowDays: 365 }),
      receipt({ id: 'gone', purchasedOn: ago(40), windowDays: 14 }),
    ];
    expect(timelineDots(set, TODAY).map((d) => d.daysLeft)).toEqual([2]);
  });

  it('keeps every dot on the rail', () => {
    const set = [receipt({ purchasedOn: ago(14), windowDays: 14 })]; // 0 days left
    const [dot] = timelineDots(set, TODAY);
    expect(dot.left).toBeGreaterThanOrEqual(2);
    expect(dot.left).toBeLessThanOrEqual(98);
  });

  it('includes the thirtieth day and excludes the thirty-first', () => {
    // `<= 30`. Nothing sat on the edge, so narrowing it to `<` changed nothing
    // — and the strip is named for the next thirty days.
    const on = receipt({ id: 'day-30', purchasedOn: ago(0), windowDays: 30 });
    const past = receipt({ id: 'day-31', purchasedOn: ago(0), windowDays: 31 });
    expect(timelineDots([on, past], TODAY).map((d) => d.daysLeft)).toEqual([30]);
  });

  it('puts the far end of the rail at the far end, and the near end near', () => {
    /*
     * The clamp is `max(2, min(98, round(daysLeft / 30 * 100)))`, and the old
     * pair of assertions only asked that a single dot fell somewhere between 2
     * and 98 — which every value does. `min` swapped for `max` left it green,
     * putting every dot at 98.
     */
    const dots = timelineDots([
      receipt({ id: 'today', purchasedOn: ago(14), windowDays: 14 }),   // 0 left
      receipt({ id: 'mid', purchasedOn: ago(0), windowDays: 15 }),      // 15 left
      receipt({ id: 'end', purchasedOn: ago(0), windowDays: 30 }),      // 30 left
    ], TODAY);
    expect(dots.map((d) => d.left)).toEqual([2, 50, 98]);
  });

  it('rounds a dot to the nearest percent rather than truncating it', () => {
    // Eight of thirty is 26.67: rounding puts it at 27, truncation at 26. The
    // three values above all divide evenly, so neither could tell them apart.
    const dots = timelineDots([receipt({ purchasedOn: ago(0), windowDays: 8 })], TODAY);
    expect(dots.map((d) => d.left)).toEqual([27]);
  });
});

describe('the id every receipt is minted with', () => {
  /*
   * Untested until now, and it is not merely an identifier: on iOS it becomes
   * a FILENAME, through `photoName`, which is why that function reduces it to
   * characters that cannot mean anything to a path. An id generator that drifts
   * into producing something `photoName` rejects would leave receipts silently
   * unable to hold a photograph.
   */
  it('is unique across a burst minted in the same millisecond', () => {
    const ids = new Set(Array.from({ length: 500 }, () => makeReceiptId(TODAY)));
    expect(ids.size).toBe(500);
  });

  it('survives the filename reduction unchanged', () => {
    for (let i = 0; i < 50; i += 1) {
      const id = makeReceiptId(TODAY);
      expect(photoName(id)).toBe(`${id}.jpg`);
    }
  });

  it('carries the day it was minted, so ids sort roughly by age', () => {
    const older = makeReceiptId(new Date(2026, 0, 1));
    const newer = makeReceiptId(TODAY);
    expect(older < newer).toBe(true);
  });
});

describe('the warranty clock', () => {
  const withWarranty = (months: number, boughtDaysAgo: number) =>
    derive(receipt({ purchasedOn: ago(boughtDaysAgo), warranty: { months } }), TODAY);

  it('is absent when the receipt carries no warranty', () => {
    expect(derive(receipt(), TODAY).warranty).toBeUndefined();
  });

  it('runs from the purchase date, not the retailer’s dispatch clock', () => {
    // Zara counts returns from dispatch; a manufacturer's cover starts when the
    // thing was bought, whatever the shop counts its own window from — so the
    // two-day gap must not shift the warranty's end date.
    const shared = { purchasedOn: ago(30), warranty: { months: 24 } } as const;
    const plain = derive(receipt(shared), TODAY);
    const dispatched = derive(receipt({ ...shared, windowStartsOn: ago(28) }), TODAY);
    expect(toISODate(dispatched.warranty!.ends)).toBe(toISODate(plain.warranty!.ends));
    // ...while the RETURN deadline does move with dispatch.
    expect(dispatched.daysLeft).not.toBe(plain.daysLeft);
  });

  it('expires on the right day two years out', () => {
    const d = withWarranty(24, 12); // bought 16 Aug 2026
    expect(toISODate(d.warranty!.ends)).toBe('2028-08-16');
    expect(d.warranty!.expired).toBe(false);
  });

  it('knows when cover has run out', () => {
    const d = withWarranty(12, 400);
    expect(d.warranty!.expired).toBe(true);
    expect(d.warranty!.daysLeft).toBeLessThan(0);
  });

  it('is still live on its last day', () => {
    const d = withWarranty(12, 365);
    expect(d.warranty!.daysLeft).toBe(0);
    expect(d.warranty!.expired).toBe(false);
  });

  it('says years when there are years left', () => {
    expect(withWarranty(120, 0).warranty!.label).toBe('10 years');
  });

  it('says years and months when the remainder matters', () => {
    expect(withWarranty(24, 90).warranty!.label).toBe('1y 9m');
  });

  it('drops to months in the last year', () => {
    expect(withWarranty(12, 200).warranty!.label).toBe('5 months');
  });

  it('drops to days at the end, when the unit starts to matter', () => {
    expect(withWarranty(12, 356).warranty!.label).toBe('9 days');
  });

  it('uses the singular on the last day', () => {
    expect(withWarranty(12, 364).warranty!.label).toBe('1 day');
  });

  it('says "1 month", not "1 months"', () => {
    /*
     * Found by mutating the branches around it and noticing none of them was
     * pinned. The days branch says "1 day" and the years branch says "1 year";
     * this one said "1 months" for every warranty between 45 and 59 days from
     * its end — six weeks of every cover period, on the detail screen.
     */
    expect(withWarranty(12, 320).warranty!.label).toBe('1 month');
    expect(withWarranty(3, 0).warranty!.label).toBe('3 months');
  });

  it('switches from days to months at 45, and not before', () => {
    // `days < 45`. Either side of the edge, so widening it to `<=` fails.
    expect(withWarranty(12, 321).warranty!.label).toBe('44 days');
    expect(withWarranty(12, 320).warranty!.label).toBe('1 month');
  });

  it('switches from months to years at twelve, and not before', () => {
    // `months < 12`. Eleven months is still months; twelve is a year.
    expect(withWarranty(12, 1).warranty!.label).toBe('11 months');
    expect(withWarranty(12, 0).warranty!.label).toBe('1 year');
  });

  it('still says something on the last day of cover, rather than nothing', () => {
    /*
     * `days < 0` returns the empty label, and zero is not less than zero — the
     * cover is live all of its last day, the same rule the return window
     * follows. Widening it to `<=` blanks the label on exactly the day somebody
     * checking their warranty most needs to see it, and an empty label renders
     * as no warranty at all rather than as an expired one.
     *
     * "0 days" is terse, and it is honest.
     */
    const d = withWarranty(12, 365);
    expect(d.warranty!.daysLeft).toBe(0);
    expect(d.warranty!.expired).toBe(false);
    expect(d.warranty!.label).toBe('0 days');
  });

  it('says nothing at all once cover has run out', () => {
    /*
     * Found by deleting the `days < 0` guard and watching nothing fail. The
     * detail screen reads `expired` first and prints the word "expired", so
     * `label` is computed for every expired warranty and rendered by nobody —
     * which is exactly how it stays wrong until the day something renders it.
     * Without the guard the field reads "-638 days", under a heading that
     * calls it remaining cover.
     */
    expect(withWarranty(12, 400).warranty!.expired).toBe(true);
    expect(withWarranty(12, 400).warranty!.label).toBe('');
  });

  it('carries a note with no clock, for a warranty imported as prose', () => {
    const d = derive(receipt({ warranty: { months: 0, note: '2-year manufacturer warranty' } }), TODAY);
    expect(d.warranty!.months).toBe(0);
  });
});

describe('what "still returnable" counts', () => {
  /*
   * The hero footer summed every ACTIVE receipt, and `bucket` keeps an expired
   * one active on purpose. So the card that says WINDOW ALREADY CLOSED was
   * counting that receipt's money as still returnable, three lines below.
   */
  const today = new Date(2026, 7, 29);
  const at = (daysAgo: number, amount: number, id: string): Receipt => ({
    id,
    store: 'Currys',
    item: 'Thing',
    cat: 'other',
    amount,
    purchasedOn: toISODate(addDays(today, -daysAgo)),
    windowDays: 30,
    policy: 'Currys · 30 days',
    distance: false,
    status: 'active',
  });

  it('leaves out the money the shop will no longer take back', () => {
    const rs = [at(40, 19325, 'gone'), at(2, 5000, 'open')];
    expect(stillReturnablePence(bucket(rs, today, 7))).toBe(5000);
  });

  it('counts both an urgent one and a relaxed one', () => {
    const rs = [at(28, 1000, 'urgent'), at(1, 2000, 'later')];
    expect(stillReturnablePence(bucket(rs, today, 7))).toBe(3000);
  });

  it('counts the last day of a window, which is still a day', () => {
    // daysLeft === 0 is inside the window, not past it — the receipt that most
    // needs its money counted is the one you can still act on today.
    const rs = [at(30, 4200, 'lastday')];
    expect(bucket(rs, today, 7).urgent).toHaveLength(1);
    expect(stillReturnablePence(bucket(rs, today, 7))).toBe(4200);
  });

  it('does not count a receipt already returned', () => {
    const rs = [{ ...at(2, 5000, 'back'), status: 'returned' as const }, at(2, 1000, 'open')];
    expect(stillReturnablePence(bucket(rs, today, 7))).toBe(1000);
  });
});
