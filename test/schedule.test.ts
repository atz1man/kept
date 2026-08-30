import { describe, expect, it } from 'vitest';
import { addDays, toISODate } from '../src/lib/dates';
import { toPence } from '../src/lib/money';
import { FIRE_HOUR, MAX_PENDING, planAlerts } from '../src/lib/schedule';
import type { Receipt } from '../src/lib/types';

/*
 * Anchored well ahead of the real clock. `planAlerts` refuses anything already
 * past, measured against `new Date()` — which is right, and which would make a
 * fixture dated near today quietly shed rungs as the suite aged.
 */
const TODAY = new Date(new Date().getFullYear() + 1, 5, 1);
const iso = (d: Date) => toISODate(d);

function receipt(over: Partial<Receipt> = {}): Receipt {
  return {
    id: 'r1', store: 'Currys', item: 'Headphones', cat: 'audio',
    amount: toPence(89), purchasedOn: iso(TODAY), windowDays: 30,
    policy: 'p', distance: false, status: 'active',
    ...over,
  };
}

const keys = (list: { key: string }[]) => list.map((p) => p.key);
const plan = (receipts: Receipt[], urgentDays = 7, sent: string[] = []) =>
  planAlerts(receipts, TODAY, urgentDays, new Set(sent));

describe('what gets lodged with the system', () => {
  it('raises each rung once, at nine in the morning', () => {
    const out = plan([receipt()]);
    expect(keys(out)).toEqual(['r1:week', 'r1:soon', 'r1:today', 'r1:closed']);
    for (const p of out) expect(p.at.getHours()).toBe(FIRE_HOUR);
  });

  it('orders them soonest first', () => {
    const out = plan([receipt()]);
    const times = out.map((p) => p.at.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('says "closed" the morning AFTER the deadline, never on the day', () => {
    // The one rule this app cannot break: a live right reported as expired.
    const out = plan([receipt()]);
    const deadline = addDays(TODAY, 30);
    const closed = out.find((p) => p.rung === 'closed')!;
    expect(toISODate(closed.at)).toBe(toISODate(addDays(deadline, 1)));
  });

  it('never schedules anything already past', () => {
    const old = receipt({ purchasedOn: iso(addDays(TODAY, -400)), windowDays: 14 });
    expect(plan([old])).toEqual([]);
  });

  it('says nothing about a receipt already returned', () => {
    expect(plan([receipt({ status: 'returned' })])).toEqual([]);
  });

  it('says nothing about the demo set', () => {
    /*
     * The same rule dueAlerts states, enforced again because this is a SECOND,
     * independent path to a lock screen. A rule enforced in one of two paths
     * is not a rule — and this path is the worse one to get wrong, because it
     * fires when the app is closed and nothing on screen explains it.
     */
    expect(plan([receipt({ demo: true })])).toEqual([]);
  });

  it('stays silent about a rung already delivered on screen', () => {
    const out = plan([receipt()], 7, ['r1:week', 'r1:soon']);
    expect(keys(out)).toEqual(['r1:today', 'r1:closed']);
  });

  it('uses the same words as the alert the app shows itself', () => {
    // Not a parameter, not a copy: one exported function feeds both paths.
    const today = plan([receipt()]).find((p) => p.rung === 'today')!;
    expect(today.title).toBe('Today is the last day');
    expect(today.body).toContain('£89.00');
  });
});

describe('the two boundaries iOS and the settings slider impose', () => {
  /*
   * The slider offers 2 to 21 days. The `soon` rung is fixed at 3.
   *
   * At 3 they land on the same morning: two notifications, one instant, one
   * receipt. At 2 the gentle one lands AFTER the urgent one — "5 days left"
   * arriving the morning after "go now or lose it". Both settings are inside
   * the range the screen offers, so neither is hypothetical.
   */
  it.each([[2], [3]])('drops the soft rung when urgentDays is %i, where it would collide or invert', (days) => {
    const out = plan([receipt()], days);
    expect(keys(out)).toEqual(['r1:soon', 'r1:today', 'r1:closed']);
  });

  it('keeps it at 4, the first value where it is genuinely earlier', () => {
    const out = plan([receipt()], 4);
    expect(keys(out)).toContain('r1:week');
    const week = out.find((p) => p.rung === 'week')!;
    const soon = out.find((p) => p.rung === 'soon')!;
    expect(week.at.getTime()).toBeLessThan(soon.at.getTime());
  });

  it('never hands iOS more than it will keep', () => {
    // 30 receipts x 4 rungs = 120, against a limit of 64. Over the limit iOS
    // drops the excess itself, without saying which.
    const many = Array.from({ length: 30 }, (_, i) => receipt({ id: `r${i}`, windowDays: 30 + i }));
    const out = plan(many);
    expect(out.length).toBe(MAX_PENDING);
  });

  it('keeps the SOONEST when it has to cut, not whichever came first', () => {
    /*
     * The cut has to follow the sort. Cutting an unsorted list would drop
     * alerts at random, and the one dropped would as likely as not be
     * tomorrow's — the single alert the whole feature exists for.
     */
    const many = Array.from({ length: 30 }, (_, i) => receipt({ id: `r${i}`, windowDays: 400 - i * 10 }));
    const out = plan(many);
    const times = out.map((p) => p.at.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    // r29 has the shortest window, so its rungs are the earliest of all.
    expect(keys(out).some((k) => k.startsWith('r29:'))).toBe(true);
  });
});
