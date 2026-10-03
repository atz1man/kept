import { describe, expect, it } from 'vitest';
import { alertKey, dueAlerts, pruneSent, REFUND_CHASE_DAYS, supersededKeys, WARRANTY_NOTICE_DAYS } from '../src/lib/alerts';
import { addDays, addMonths, toISODate } from '../src/lib/dates';
import { toPence } from '../src/lib/money';
import { seedReceipts } from '../src/lib/seed';
import { derive } from '../src/lib/receipts';
import type { Receipt } from '../src/lib/types';

const TODAY = new Date(2026, 7, 28);
const URGENT = 7;

/** A receipt whose window closes in exactly `daysLeft` days. */
function closingIn(daysLeft: number, over: Partial<Receipt> = {}): Receipt {
  const windowDays = 30;
  return {
    id: 'r1', store: 'Zara', item: 'Wool coat', cat: 'clothing', amount: toPence(34.99),
    purchasedOn: toISODate(addDays(TODAY, -(windowDays - daysLeft))),
    windowDays, policy: 'p', distance: true, status: 'active',
    ...over,
  };
}

const none = new Set<string>();

describe('which deadlines are worth an interruption', () => {
  it('says nothing about a deadline that is still far off', () => {
    expect(dueAlerts([closingIn(20)], TODAY, URGENT, none)).toEqual([]);
  });

  it('raises the week rung as the deadline enters the urgent window', () => {
    expect(dueAlerts([closingIn(7)], TODAY, URGENT, none)[0]).toMatchObject({ rung: 'week' });
    expect(dueAlerts([closingIn(8)], TODAY, URGENT, none)).toEqual([]);
  });

  it.each([
    // Four is the case that was missing. Three was here, and at three the rung
    // is 'soon' whether the cut is `<= 3` or `<= 4` — only the day on the OTHER
    // side of the boundary can tell them apart, and that is the day the wording
    // changes from planning to hurrying.
    [4, 'week'],
    [3, 'soon'],
    [1, 'soon'],
    [0, 'today'],
    [-1, 'closed'],
  ])('puts a deadline %i days out on the %s rung', (days, rung) => {
    expect(dueAlerts([closingIn(days)], TODAY, URGENT, none)[0]).toMatchObject({ rung });
  });

  it('follows the user’s own urgent threshold', () => {
    expect(dueAlerts([closingIn(12)], TODAY, URGENT, none)).toEqual([]);
    expect(dueAlerts([closingIn(12)], TODAY, 14, none)[0]).toMatchObject({ rung: 'week' });
  });

  it('never interrupts about a receipt already returned', () => {
    expect(dueAlerts([closingIn(0, { status: 'returned' })], TODAY, URGENT, none)).toEqual([]);
  });

  it('counts from dispatch when the retailer does', () => {
    // The alert has to agree with the screen, or one of them is lying.
    const zara = closingIn(10, { windowStartsOn: toISODate(addDays(TODAY, -27)) });
    expect(dueAlerts([zara], TODAY, URGENT, none)[0]).toMatchObject({ rung: 'soon' });
  });
});

describe('restraint', () => {
  it('says a thing once, then never again', () => {
    const r = closingIn(2);
    const first = dueAlerts([r], TODAY, URGENT, none);
    expect(first).toHaveLength(1);
    expect(dueAlerts([r], TODAY, URGENT, new Set([first[0].key]))).toEqual([]);
  });

  it('still speaks up when the receipt reaches a more urgent rung', () => {
    const sent = new Set([alertKey('r1', 'week')]);
    expect(dueAlerts([closingIn(2)], TODAY, URGENT, sent)[0]).toMatchObject({ rung: 'soon' });
  });

  it('raises one alert, not four, for a phone left in a drawer', () => {
    // Opened after two weeks: the coat crossed week, soon and today on the way.
    const alerts = dueAlerts([closingIn(-1)], TODAY, URGENT, none);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].rung).toBe('closed');
    // The rungs it skipped are marked delivered so they cannot fire later.
    expect(supersededKeys(alerts[0]).sort()).toEqual([
      alertKey('r1', 'soon'), alertKey('r1', 'today'), alertKey('r1', 'week'),
    ].sort());
  });

  it('supersedes nothing at the gentlest rung', () => {
    expect(supersededKeys(dueAlerts([closingIn(7)], TODAY, URGENT, none)[0])).toEqual([]);
  });

  it('puts the most urgent first when several fire at once', () => {
    const set = [
      closingIn(6, { id: 'week-one' }),
      closingIn(-2, { id: 'closed-one' }),
      closingIn(0, { id: 'today-one' }),
      closingIn(2, { id: 'soon-one' }),
    ];
    expect(dueAlerts(set, TODAY, URGENT, none).map((a) => a.receiptId)).toEqual([
      'today-one', 'soon-one', 'closed-one', 'week-one',
    ]);
  });

  it('ranks them, rather than leaving the order it was handed', () => {
    /*
     * The case above fed `today` in before `soon`, and `Array.sort` is stable —
     * so it passed unchanged when `today` and `soon` were given the SAME rank,
     * because the input order already had them that way round. It was asserting
     * the fixture, not the ranking.
     *
     * Reversing the input is the whole test: now only a comparator that really
     * puts today above soon can produce this.
     */
    const set = [
      closingIn(2, { id: 'soon-one' }),
      closingIn(6, { id: 'week-one' }),
      closingIn(0, { id: 'today-one' }),
      closingIn(-2, { id: 'closed-one' }),
    ];
    expect(dueAlerts(set, TODAY, URGENT, none).map((a) => a.receiptId)).toEqual([
      'today-one', 'soon-one', 'closed-one', 'week-one',
    ]);
  });
});

describe('the copy people actually see', () => {
  it('names the shop, the item and the money', () => {
    const a = dueAlerts([closingIn(2)], TODAY, URGENT, none)[0];
    expect(a.title).toBe('Go now or lose it');
    expect(a.body).toContain('Zara · Wool coat');
    expect(a.body).toContain('£34.99');
    expect(a.body).toContain('2 days left');
  });

  it('uses the singular on the last-but-one day', () => {
    expect(dueAlerts([closingIn(1)], TODAY, URGENT, none)[0].body).toContain('1 day left');
  });

  it('gives the deadline date on the gentle rung, when there is still time to plan', () => {
    expect(dueAlerts([closingIn(7)], TODAY, URGENT, none)[0].body).toContain('4 Sep');
  });

  it('stays useful rather than scolding once the window has closed', () => {
    const a = dueAlerts([closingIn(-1)], TODAY, URGENT, none)[0];
    expect(a.body).toContain('still have rights');
  });
});

describe('a window Kept has not checked is not stated as the shop\'s', () => {
  // Most shops a person uses are not in the table; their windows are a guess
  // or a number typed in, and the reminders are where they are acted on.
  // `closingIn` dates the purchase for a 30-day window; these carry others.
  const closing = (daysLeft: number, windowDays: number, over: Partial<Receipt> = {}) =>
    closingIn(daysLeft, { windowDays, purchasedOn: toISODate(addDays(TODAY, -(windowDays - daysLeft))), ...over });
  const corner = (daysLeft: number) => closing(daysLeft, 28, { store: 'Corner Shop', policy: 'Corner Shop · 28-day return window — as entered, not verified. Check the receipt.' });

  it('never says a guessed window "has closed": the shop may give longer', () => {
    const a = dueAlerts([corner(-1)], TODAY, URGENT, none)[0];
    expect(a.title).toBe('The saved window has passed');
    expect(a.title).not.toMatch(/has closed/);
    expect(a.body).toMatch(/Kept hasn’t checked Corner Shop’s returns policy, so check the receipt: the shop may give longer/);
    expect(a.body).toContain('still have rights');
  });

  it('says whose last day it is', () => {
    const a = dueAlerts([corner(0)], TODAY, URGENT, none)[0];
    expect(a.title).toBe('The saved window ends today');
    expect(a.body).toMatch(/the 28 days saved for it end today\. Kept hasn’t checked Corner Shop’s returns policy/);
  });

  it('says so on the earlier rungs too', () => {
    for (const n of [2, 7]) expect(dueAlerts([corner(n)], TODAY, URGENT, none)[0].body).toMatch(/Kept hasn’t checked Corner Shop’s returns policy, so check the receipt\.$/);
  });

  it('treats a table shop with a different window typed in as unchecked too', () => {
    const typed = closing(-1, 45);
    expect(dueAlerts([typed], TODAY, URGENT, none)[0].title).toBe('The saved window has passed');
  });

  it('checks the window for the way it was bought, where the shop has two', () => {
    // Liberty: 14 days in store, 30 online. The 30 is a window Kept has read
    // off Liberty's page, but not for something bought at the counter.
    const liberty = (windowDays: number, distance: boolean) =>
      closing(-1, windowDays, { store: 'Liberty', distance, policy: 'Liberty · 14 days from purchase in store; 30 days from delivery for an online order.' });
    expect(dueAlerts([liberty(30, true)], TODAY, URGENT, none)[0].title).toBe('That window has closed');
    expect(dueAlerts([liberty(14, false)], TODAY, URGENT, none)[0].title).toBe('That window has closed');
    expect(dueAlerts([liberty(30, false)], TODAY, URGENT, none)[0].title).toBe('The saved window has passed');
  });

  it('keeps the shop\'s own words for a window it has checked, or a cited policy change', () => {
    // Tesco's 30 days were read off Tesco's own page. Zara's were not — its
    // pages refused every run — so its plain 30 days are worded as a guess,
    // while a cited policy change below is the shop's word again.
    const tesco = (n: number) => closingIn(n, { store: 'Tesco' });
    expect(dueAlerts([tesco(-1)], TODAY, URGENT, none)[0].title).toBe('That window has closed');
    expect(dueAlerts([tesco(2)], TODAY, URGENT, none)[0].body).not.toMatch(/hasn’t checked/);
    expect(dueAlerts([closingIn(-1)], TODAY, URGENT, none)[0].title).toBe('The saved window has passed');
    const changed = closing(0, 45, { policy: 'Zara · 45-day return window, from a policy change on 1 August 2026.' });
    expect(dueAlerts([changed], TODAY, URGENT, none)[0].title).toBe('Today is the last day');
  });
});

describe('the sent list does not grow forever', () => {
  it('forgets keys for receipts that no longer exist', () => {
    const kept = closingIn(2, { id: 'still-here' });
    const sent = [alertKey('still-here', 'week'), alertKey('deleted', 'week'), alertKey('deleted', 'soon')];
    expect(pruneSent(sent, [kept])).toEqual([alertKey('still-here', 'week')]);
  });

  it('does not trip over an id containing a colon', () => {
    const odd = closingIn(2, { id: 'r:1:2' });
    expect(pruneSent([alertKey('r:1:2', 'soon')], [odd])).toEqual(['r:1:2:soon']);
  });
});

describe('the demo set never interrupts', () => {
  it('raises no alert, however urgent it looks', () => {
    // A notification is not a demonstration. Grant permission on a fresh
    // install and the phone said "Go now or lose it — Currys · JBL Tune 770NC
    // headphones — 2 days left. £89.00 back if it goes back", on a lock
    // screen, about £89 nobody spent.
    const seeded = seedReceipts(TODAY);
    const due = seeded.filter((r) => {
      const { daysLeft } = derive(r, TODAY);
      return daysLeft >= 0 && daysLeft <= 7;
    });
    expect(due.length, 'the seed has nothing urgent to be silent about').toBeGreaterThan(0);
    expect(dueAlerts(seeded, TODAY, 7, new Set())).toEqual([]);
  });

  it('still alerts about the receipts beside them', () => {
    const seeded = seedReceipts(TODAY);
    const mine = { ...seeded[0], id: 'mine', demo: undefined };
    const alerts = dueAlerts([...seeded, mine], TODAY, 7, new Set());
    expect(alerts.map((a) => a.receiptId)).toEqual(['mine']);
  });
});

describe('a kept receipt', () => {
  it('raises no return reminder, however close its deadline — only the right to reject it if faulty', () => {
    // Bought 30 days ago: the shop's window and the 30-day right end today.
    expect(dueAlerts([closingIn(0, { status: 'kept', keptOn: toISODate(TODAY) })], TODAY, URGENT, none).map((a) => a.rung)).toEqual(['reject']);
    expect(dueAlerts([closingIn(0)], TODAY, URGENT, none).length).toBeGreaterThan(0);
  });
});

describe('a guarantee about to end', () => {
  /*
   * The one reason to keep a receipt long after its window, and the app went
   * quiet about it: the end date was on the receipt's screen and nothing ever
   * said so before it passed. A month's notice, once, for anything still on
   * this phone — kept or not yet returned.
   */
  /** Out of its return window, with a 12-month guarantee ending in `n` days. */
  const coverEndingIn = (n: number, over: Partial<Receipt> = {}): Receipt => ({
    ...closingIn(-200),
    purchasedOn: toISODate(addMonths(addDays(TODAY, n), -12)),
    warranty: { months: 12 },
    ...over,
  });
  const warrantyAlerts = (rs: Receipt[], sent = none) => dueAlerts(rs, TODAY, URGENT, sent).filter((a) => a.rung === 'warranty');

  it('says so inside the last month, and not before', () => {
    expect(derive(coverEndingIn(WARRANTY_NOTICE_DAYS), TODAY).warranty!.daysLeft).toBe(WARRANTY_NOTICE_DAYS);
    expect(warrantyAlerts([coverEndingIn(WARRANTY_NOTICE_DAYS)]).map((a) => a.key)).toEqual(['r1:warranty']);
    expect(warrantyAlerts([coverEndingIn(0)])).toHaveLength(1);
    expect(warrantyAlerts([coverEndingIn(WARRANTY_NOTICE_DAYS + 1)])).toEqual([]);
  });

  it('is said for a kept receipt, which is the point of keeping it', () => {
    expect(warrantyAlerts([coverEndingIn(10, { status: 'kept', keptOn: toISODate(TODAY) })])).toHaveLength(1);
  });

  it('is not said once the guarantee has ended, nor for one that went back, nor for a sample', () => {
    expect(warrantyAlerts([coverEndingIn(-1)])).toEqual([]);
    expect(warrantyAlerts([coverEndingIn(10, { status: 'returned', returnedOn: toISODate(TODAY) })])).toEqual([]);
    expect(warrantyAlerts([coverEndingIn(10, { demo: true })])).toEqual([]);
  });

  it('is not said about a guarantee with no clock', () => {
    // An old backup's free-text warranty comes back as months: 0.
    // Bought today, so a zero-month "clock" would read as ending today and
    // pass every other test here; only the months check keeps it quiet.
    expect(warrantyAlerts([coverEndingIn(10, { purchasedOn: toISODate(TODAY), warranty: { months: 0, note: 'lifetime' } })])).toEqual([]);
  });

  it('is said once', () => {
    const [a] = warrantyAlerts([coverEndingIn(10)]);
    expect(warrantyAlerts([coverEndingIn(10)], new Set([a.key]))).toEqual([]);
    expect(supersededKeys(a)).toEqual([]);
  });

  it('comes after anything about a return window', () => {
    const both = [coverEndingIn(10, { id: 'cover' }), closingIn(URGENT, { id: 'window' })];
    // The guarantee's receipt is long out of its window too, hence 'closed'.
    expect(dueAlerts(both, TODAY, URGENT, none).map((a) => a.rung)).toEqual(['closed', 'week', 'warranty']);
  });

  it('names the item and the last day of cover, and says what to do', () => {
    const [a] = warrantyAlerts([coverEndingIn(10)]);
    expect(a.title).toBe('Your guarantee is running out');
    expect(a.body).toMatch(/^Zara · Wool coat — covered until .+, 10 days from now\. If anything is wrong with it, claim before then\.$/);
    expect(warrantyAlerts([coverEndingIn(0)])[0].body).toMatch(/which is today\./);
    expect(warrantyAlerts([coverEndingIn(1)])[0].body).toMatch(/1 day from now/);
  });
});

describe('a refund still to come', () => {
  // Sent back, money not yet seen: asked about once, a fortnight on.
  const sentAgo = (n: number, over: Partial<Receipt> = {}) =>
    closingIn(5, { status: 'sent', sentOn: toISODate(addDays(TODAY, -n)), ...over });
  const refunds = (rs: Receipt[], sent = none) => dueAlerts(rs, TODAY, URGENT, sent).filter((a) => a.rung === 'refund');

  it('raises no return reminder while it is in the post, however close the window', () => {
    expect(dueAlerts([closingIn(0, { status: 'sent', sentOn: toISODate(TODAY) })], TODAY, URGENT, none)).toEqual([]);
  });

  it('asks a fortnight on, not before, and once', () => {
    expect(REFUND_CHASE_DAYS).toBe(14);
    expect(refunds([sentAgo(13)])).toEqual([]);
    const [a] = refunds([sentAgo(14)]);
    expect(a.key).toBe('r1:refund');
    expect(refunds([sentAgo(40)], new Set([a.key]))).toEqual([]);
    expect(supersededKeys(a)).toEqual([]);
  });

  it('states the legal fortnight only for an online order', () => {
    expect(refunds([sentAgo(14)])[0].body).toMatch(/For an online order, the shop has 14 days from getting it back/);
    expect(refunds([sentAgo(14, { distance: false })])[0].body).not.toMatch(/online order/);
    expect(refunds([sentAgo(14)])[0].body).toMatch(/^Zara · Wool coat — it went back on .+\. .*If the money has not arrived, chase it\.$/);
  });

  it('is never about a sample', () => {
    expect(refunds([sentAgo(20, { demo: true })])).toEqual([]);
  });
});
