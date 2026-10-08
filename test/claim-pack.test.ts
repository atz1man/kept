import { describe, expect, it } from 'vitest';
import { REFUND_CHASE_DAYS } from '../src/lib/alerts';
import { claimPack, claimPackFilename, claimPackHtml, claimPackText, deadlineState, escapeHtml } from '../src/lib/claim-pack';
import { addDays, fmtDateLong, toISODate } from '../src/lib/dates';
import { COOLING_OFF_DAYS, LEGAL_DISCLAIMER, REJECT_DAYS } from '../src/lib/legal';
import { toPence } from '../src/lib/money';
import type { Receipt } from '../src/lib/types';

const TODAY = new Date(2026, 9, 4);
const iso = (n: number) => toISODate(addDays(TODAY, n));

const counter = (over: Partial<Receipt> = {}): Receipt => ({
  id: 'r', store: 'John Lewis', item: 'Kettle', cat: 'kitchen', amount: toPence(49),
  purchasedOn: iso(-5), windowDays: 35, policy: '35 days with receipt.', distance: false, status: 'active',
  ...over,
});
const online = (over: Partial<Receipt> = {}): Receipt =>
  counter({ store: 'ASOS', item: 'Wool coat', cat: 'clothing', amount: toPence(120), windowDays: 28, distance: true, ...over });

const labels = (r: Receipt, today = TODAY) => claimPack(r, today).timeline.map((e) => e.label);
const find = (r: Receipt, label: string, today = TODAY) => claimPack(r, today).timeline.find((e) => e.label === label);

describe('what the timeline says happened', () => {
  it('is only what the receipt recorded — nothing inferred from a deadline', () => {
    const happened = claimPack(counter(), TODAY).timeline.filter((e) => e.kind === 'happened');
    expect(happened.map((e) => e.label)).toEqual(['Bought']);
  });

  it('carries every recorded step, each on its own day', () => {
    const r = online({
      purchasedOn: iso(-30), arrivedOn: iso(-27), cancelledOn: iso(-25), sentOn: iso(-24), returnRef: 'RM123GB',
      status: 'returned', returnedOn: iso(-10),
    });
    const happened = claimPack(r, TODAY).timeline.filter((e) => e.kind === 'happened');
    expect(happened.map((e) => [e.label, toISODate(e.on)])).toEqual([
      ['Ordered', iso(-30)], ['Arrived', iso(-27)], ['Cancellation notice sent', iso(-25)], ['Sent back', iso(-24)], ['Refund received', iso(-10)],
    ]);
    expect(happened.find((e) => e.label === 'Sent back')?.detail).toBe('Tracking RM123GB');
  });

  it('says a swap was a swap and store credit was credit, not a refund', () => {
    expect(labels(counter({ status: 'returned', returnedOn: iso(-1), exchanged: true }))).toContain('Swapped for another');
    expect(labels(counter({ status: 'returned', returnedOn: iso(-1), credit: {} }))).toContain('Refunded as store credit');
  });
});

describe('deadlines', () => {
  it('are open on their last day and passed the day after', () => {
    // The shop's window: bought 35 days before the deadline.
    expect(find(counter({ purchasedOn: iso(-35) }), 'The shop’s own return window closes')?.passed).toBe(false);
    expect(find(counter({ purchasedOn: iso(-36) }), 'The shop’s own return window closes')?.passed).toBe(true);
  });

  it('run the statutory clocks from arrival, and say so when arrival is unknown', () => {
    const known = online({ purchasedOn: iso(-10), arrivedOn: iso(-6) });
    const reject = find(known, 'Last day to reject a fault for a full refund')!;
    expect(toISODate(reject.on)).toBe(iso(-6 + REJECT_DAYS));
    expect(reject.hedged).toBe(false);
    expect(toISODate(find(known, 'Last day to cancel for any reason')!.on)).toBe(iso(-6 + COOLING_OFF_DAYS));

    const unknown = online({ purchasedOn: iso(-10) });
    expect(find(unknown, 'Last day to reject a fault for a full refund')!.hedged).toBe(true);
    expect(find(unknown, 'Last day to cancel for any reason')!.hedged).toBe(true);
    // The shop's own date is a floor as well, for ASOS: it counts its 28
    // days from delivery, so from the order they are the earliest. This
    // line used to say "the shop's own date is the shop's, not a floor",
    // which was true only of a shop that counts from the till.
    expect(find(unknown, 'The shop’s own return window closes')!.hedged).toBe(true);
    // Arrived, and the shop's clock started on that day: a date.
    expect(find(online({ purchasedOn: iso(-10), arrivedOn: iso(-6), windowStartsOn: iso(-6) }), 'The shop’s own return window closes')!.hedged).toBe(false);
    // Online from a shop that counts from the order: the order IS its date.
    expect(find(counter({ distance: true, purchasedOn: iso(-10) }), 'The shop’s own return window closes')!.hedged).toBe(false);
  });

  it('never call a floor that has gone by "passed" — the parcel may have come later', () => {
    // Ordered 20 days ago, arrival never recorded: counted from the order the
    // 14 days have run, but a parcel that came on day 10 still has them.
    const r = online({ purchasedOn: iso(-20) });
    const cancel = find(r, 'Last day to cancel for any reason')!;
    expect(cancel.passed).toBe(true);
    expect(deadlineState(cancel)).toBe('unsure');
    const text = claimPackText(claimPack(r, TODAY));
    expect(text).toMatch(/Last day to cancel for any reason \(check the arrival date\)/);
    expect(text).not.toMatch(/Last day to cancel for any reason \(passed\)/);
    expect(claimPackHtml(claimPack(r, TODAY), null)).toMatch(/class="unsure"><time>at least [^<]+<\/time><b>Last day to cancel/);
    // Once the arrival is known, a date that has gone has gone.
    expect(deadlineState(find(online({ purchasedOn: iso(-20), arrivedOn: iso(-19) }), 'Last day to cancel for any reason')!)).toBe('passed');
  });

  it('date the presumption of a fault to its last day, as section 19(14) counts it', () => {
    // "The period of six months beginning with the day on which the goods were
    // delivered": handed over on 15 January, the last presumed day is 14 July.
    // The pack dated it 15 July, and on the 15th still called it open.
    const r = counter({ purchasedOn: '2026-01-15', status: 'kept', keptOn: '2026-01-20' });
    const presumption = (today: Date) => claimPack(r, today).timeline.find((e) => /s\.19\(14\)/.test(e.detail ?? ''))!;
    expect(toISODate(presumption(new Date(2026, 6, 14)).on)).toBe('2026-07-14');
    expect(presumption(new Date(2026, 6, 14)).passed).toBe(false);
    expect(presumption(new Date(2026, 6, 15)).passed).toBe(true);
    // Named as the last day it holds, like the timeline's other deadlines.
    expect(presumption(new Date(2026, 6, 15)).label).toBe('Last day a fault is presumed there from the start');
  });

  it('offer no right to cancel on something bought over a counter', () => {
    expect(labels(counter())).not.toContain('Last day to cancel for any reason');
  });

  it('name a refund as due by law only where the regulations make it so', () => {
    const inside = online({ purchasedOn: iso(-20), arrivedOn: iso(-18), status: 'sent', sentOn: iso(-10) });
    const due = find(inside, 'Refund due')!;
    expect(toISODate(due.on)).toBe(iso(-10 + REFUND_CHASE_DAYS));
    // Sent back after the cancellation period: the app's reminder, not the law's date.
    const outside = online({ purchasedOn: iso(-40), arrivedOn: iso(-38), status: 'sent', sentOn: iso(-20) });
    expect(find(outside, 'Refund due')).toBeUndefined();
  });

  it('come in date order, and on one day what happened comes first', () => {
    const t = claimPack(online({ purchasedOn: iso(-20), arrivedOn: iso(-14), cancelledOn: iso(0) }), TODAY).timeline;
    const times = t.map((e) => e.on.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    // Cancelled today, and the last day to cancel is also today.
    const today = t.filter((e) => toISODate(e.on) === iso(0));
    expect(today.map((e) => e.kind)).toEqual(['happened', 'deadline']);
  });
});

describe('the letters', () => {
  it('are the letter as drafted on the day it went, not as today would write it', () => {
    // Reported on day 5, inside the 30 days: the letter rejected for a refund.
    // Today is day 90, when a new letter would ask for a repair instead.
    const r = counter({ purchasedOn: iso(-90), status: 'kept', keptOn: iso(-80), faultClaim: { sentOn: iso(-85), what: 'It leaks' } });
    const [letter] = claimPack(r, TODAY).letters;
    expect(letter.title).toBe('Fault letter');
    expect(letter.text).toMatch(/I am rejecting the goods/);
    expect(letter.text).not.toMatch(/repair or replace/);
    expect(letter.text).toMatch(/The problem: It leaks\./);
  });

  it('include the cancellation notice, dated, and nothing that was never recorded as sent', () => {
    expect(claimPack(online(), TODAY).letters).toEqual([]);
    const [notice] = claimPack(online({ cancelledOn: iso(-1) }), TODAY).letters;
    expect(notice.title).toBe('Cancellation notice');
    expect(toISODate(notice.sentOn)).toBe(iso(-1));
  });
});

describe('where it stands', () => {
  it('says whether it went back inside the shop’s window, up to and including the last day', () => {
    const onTheDay = counter({ purchasedOn: iso(-40), status: 'sent', sentOn: iso(-5) });
    expect(claimPack(onTheDay, TODAY).standing[0]).toMatch(/inside the shop’s own 35-day window/);
    const late = counter({ purchasedOn: iso(-41), status: 'sent', sentOn: iso(-5) });
    expect(claimPack(late, TODAY).standing[0]).toMatch(/after the shop’s own window had closed/);
  });

  it('says a refund is late once it is', () => {
    const r = online({ purchasedOn: iso(-40), status: 'sent', sentOn: iso(-REFUND_CHASE_DAYS) });
    expect(claimPack(r, TODAY).standing.join(' ')).toMatch(/The refund is late/);
    expect(claimPack({ ...r, sentOn: iso(-REFUND_CHASE_DAYS + 1) }, TODAY).standing.join(' ')).not.toMatch(/late/);
  });
});

describe('the page it makes', () => {
  const hostile = counter({
    store: '<script>alert(1)</script>', item: '"><img src=x onerror=alert(1)>', policy: '&amp; <b>bold</b>',
    faultClaim: { sentOn: iso(-1), what: '</pre><script>steal()</script>' },
  });

  it('escapes everything a person typed or pasted', () => {
    const html = claimPackHtml(claimPack(hostile, TODAY), null);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img src=x/);
    expect(html).not.toMatch(/<b>bold/);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&amp;amp;');
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  it('cannot be broken out of through the photo', () => {
    const html = claimPackHtml(claimPack(counter(), TODAY), 'QUJD" onerror="alert(1)');
    expect(html).toContain('src="data:image/jpeg;base64,QUJDonerror=alert1"');
  });

  it('loads nothing from anywhere — no scripts, no remote addresses', () => {
    const html = claimPackHtml(claimPack(online({ cancelledOn: iso(-1), faultClaim: { sentOn: iso(-1) } }), TODAY), 'QUJD');
    expect(html).not.toMatch(/<script|<link|@import|https?:\/\//i);
  });

  it('carries the receipt photo only when there is one', () => {
    expect(claimPackHtml(claimPack(counter(), TODAY), null)).not.toContain('Proof of purchase');
    expect(claimPackHtml(claimPack(counter(), TODAY), 'QUJD')).toContain('Proof of purchase');
  });

  it('says what it is not, in the page and in the text', () => {
    const p = claimPack(counter(), TODAY);
    expect(claimPackHtml(p, null)).toContain(LEGAL_DISCLAIMER);
    expect(claimPackText(p)).toContain(LEGAL_DISCLAIMER);
    expect(claimPackText(p)).toContain(`Made with Quids In on ${fmtDateLong(TODAY)}`);
  });

  it('marks a floor as a floor in the text too', () => {
    const text = claimPackText(claimPack(online({ purchasedOn: iso(-3) }), TODAY));
    expect(text).toContain(`at least ${fmtDateLong(addDays(TODAY, -3 + REJECT_DAYS))} — Last day to reject a fault for a full refund (still open)`);
  });

  it('is named for the shop and the day', () => {
    expect(claimPackFilename(counter({ store: 'Marks & Spencer' }), TODAY)).toBe('quids-in-claim-marks-spencer-2026-10-04.html');
    expect(claimPackFilename(counter({ store: '!!!' }), TODAY)).toBe('quids-in-claim-receipt-2026-10-04.html');
  });
});
