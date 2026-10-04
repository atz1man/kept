import { describe, expect, it } from 'vitest';
import { alertKey, dueAlerts, REJECT_GAP_DAYS, REJECT_NOTICE_DAYS, rejectWatched, supersededKeys } from '../src/lib/alerts';
import { comingUp } from '../src/lib/coming-up';
import { addDays, fmtDate, toISODate } from '../src/lib/dates';
import { REJECT_DAYS } from '../src/lib/legal';
import { toPence } from '../src/lib/money';
import { FIRE_HOUR, planAlerts } from '../src/lib/schedule';
import type { Receipt } from '../src/lib/types';

/*
 * The 30-day right to reject a fault, announced in its last days.
 *
 * kept said it counts both clocks and, on iOS, lodges each deadline — and
 * only the shop's was ever lodged. On a 35-day or 365-day shop window the
 * right to a full refund for a fault, without taking a repair first, lapsed
 * with nothing said.
 */

const TODAY = new Date(2026, 7, 28);
const iso = (n: number) => toISODate(addDays(TODAY, n));
const none = new Set<string>();

/** Bought `ago` days before TODAY, with a `window`-day shop window. */
const r = (ago: number, window: number, over: Partial<Receipt> = {}): Receipt => ({
  id: 'a', store: 'John Lewis', item: 'Toaster', cat: 'kitchen', amount: toPence(45),
  purchasedOn: iso(-ago), windowDays: window, policy: 'p', distance: false, status: 'active',
  ...over,
});
const rungs = (receipts: Receipt[], sent = none) => dueAlerts(receipts, TODAY, 7, sent).map((a) => a.rung);

describe('the right to reject, in its last days', () => {
  it('pins the numbers it is built on', () => {
    expect(REJECT_DAYS).toBe(30);
    expect(REJECT_NOTICE_DAYS).toBe(3);
    expect(REJECT_GAP_DAYS).toBe(7);
  });

  it('is raised on a long shop window, three days out, and says what is lost after it', () => {
    const [alert] = dueAlerts([r(REJECT_DAYS - 2, 365)], TODAY, 7, none);
    expect(alert.rung).toBe('reject');
    expect(alert.key).toBe(alertKey('a', 'reject'));
    expect(alert.title).toBe('2 days left to reject it if it’s faulty');
    expect(alert.body).toBe(
      `John Lewis · Toaster — your 30-day right to reject faulty goods for a full refund ends on ${fmtDate(addDays(TODAY, 2))}. If anything is wrong with it, tell the shop before then: after it, they can offer a repair or replacement first.`,
    );
    expect(dueAlerts([r(REJECT_DAYS, 365)], TODAY, 7, none)[0].title).toBe('Last day to reject it if it’s faulty');
  });

  it('opens three days out, runs through the last day, and not a day either side', () => {
    expect(rungs([r(REJECT_DAYS - REJECT_NOTICE_DAYS - 1, 365)])).toEqual([]);
    expect(rungs([r(REJECT_DAYS - REJECT_NOTICE_DAYS, 365)])).toEqual(['reject']);
    expect(rungs([r(REJECT_DAYS, 365)])).toEqual(['reject']);
    expect(rungs([r(REJECT_DAYS + 1, 365)])).toEqual([]);
  });

  it('is left to the shop’s ladder when the shop’s window ends within a week of it', () => {
    // Window of 30 + gap: watched. One day less: the ladder is already talking.
    expect(rejectWatched(r(0, REJECT_DAYS + REJECT_GAP_DAYS), TODAY)).not.toBeNull();
    expect(rejectWatched(r(0, REJECT_DAYS + REJECT_GAP_DAYS - 1), TODAY)).toBeNull();
    expect(rejectWatched(r(0, 28), TODAY)).toBeNull();
  });

  it('is raised on a short shop window too, whose ladder said its last weeks before', () => {
    // Currys gives fourteen days. Bought 27 days ago, its window shut on day
    // 14 and every rung of the ladder has been said; the right to reject a
    // fault ends in three days. The gap was measured one way only, and this
    // receipt got nothing on day 27 while IKEA's got its alert.
    const ladder = new Set((['week', 'soon', 'today', 'closed'] as const).map((rung) => alertKey('a', rung)));
    const currys = r(REJECT_DAYS - REJECT_NOTICE_DAYS, 14, { store: 'Currys' });
    expect(rungs([currys], ladder)).toEqual(['reject']);
    expect(dueAlerts([currys], TODAY, 7, ladder)[0].title).toBe('3 days left to reject it if it’s faulty');
  });

  it('is left to the ladder a week either side of the shop’s deadline, and no nearer', () => {
    // 30 − gap: the shop's window shut a week before the right ends, so it is
    // watched. One day more and "closed" lands in the same days: left to it.
    expect(rejectWatched(r(0, REJECT_DAYS - REJECT_GAP_DAYS), TODAY)).not.toBeNull();
    expect(rejectWatched(r(0, REJECT_DAYS - REJECT_GAP_DAYS + 1), TODAY)).toBeNull();
  });

  it('is raised for a kept receipt whatever its shop window, which has left the ladder', () => {
    expect(rungs([r(REJECT_DAYS - 1, 28, { status: 'kept', keptOn: iso(-10) })])).toEqual(['reject']);
  });

  it('is never raised for a sample, a receipt that has gone back, or one whose fault letter has gone', () => {
    expect(rungs([r(REJECT_DAYS - 1, 365, { demo: true })])).toEqual([]);
    expect(rejectWatched(r(REJECT_DAYS - 1, 365, { status: 'sent', sentOn: iso(-1) }), TODAY)).toBeNull();
    expect(rejectWatched(r(REJECT_DAYS - 1, 365, { status: 'returned', returnedOn: iso(-1) }), TODAY)).toBeNull();
    expect(rungs([r(REJECT_DAYS - 1, 365, { faultClaim: { sentOn: iso(-1) } })])).not.toContain('reject');
  });

  it('is raised once, and passes over no gentler rung', () => {
    expect(rungs([r(REJECT_DAYS - 1, 365)], new Set([alertKey('a', 'reject')]))).toEqual([]);
    const [alert] = dueAlerts([r(REJECT_DAYS - 1, 365)], TODAY, 7, none);
    expect(supersededKeys(alert)).toEqual([]);
  });

  it('counts an online order from the day it came, and says "no earlier than" while nobody has said', () => {
    const online = r(REJECT_DAYS - 1, 365, { distance: true });
    expect(rejectWatched(online, TODAY)).toEqual({ ends: addDays(TODAY, 1), hedged: true });
    expect(dueAlerts([online], TODAY, 7, none)[0].body).toContain(`ends no earlier than ${fmtDate(addDays(TODAY, 1))}`);
    // Arrived five days after it was ordered: the right runs five days longer.
    const came = { ...online, arrivedOn: iso(-(REJECT_DAYS - 1) + 5) };
    expect(rejectWatched(came, TODAY)).toEqual({ ends: addDays(TODAY, 6), hedged: false });
  });

  it('comes after the shop’s rungs when both fire, and before the refund chase', () => {
    const closing = r(28, 30, { id: 'shop' });
    const refund = r(40, 365, { id: 'back', status: 'sent', sentOn: iso(-20) });
    const reject = r(REJECT_DAYS - 1, 365, { id: 'rej' });
    expect(dueAlerts([refund, reject, closing], TODAY, 7, none).map((a) => a.rung)).toEqual(['soon', 'reject', 'refund']);
  });

  it('is listed in what is coming up, on the day the right ends', () => {
    const list = comingUp([r(10, 365)], TODAY).filter((c) => c.kind === 'reject');
    expect(list.map((c) => toISODate(c.date))).toEqual([iso(REJECT_DAYS - 10)]);
    expect(list[0].what).toBe('Last day to reject it if it’s faulty');
    expect(comingUp([r(10, 365, { distance: true })], TODAY).find((c) => c.kind === 'reject')?.what).toBe('Last day to reject it if it’s faulty (or later)');
  });

  it('is listed after a short shop window’s own last day, not instead of it', () => {
    const list = comingUp([r(10, 14, { store: 'Currys' })], TODAY);
    expect(list.map((c) => [c.kind, toISODate(c.date)])).toEqual([['return', iso(4)], ['reject', iso(REJECT_DAYS - 10)]]);
  });
});

describe('the right to reject, lodged with iOS', () => {
  // `planAlerts` measures "past" against the real clock, so the fixture lives a year ahead.
  const FUTURE = new Date(new Date().getFullYear() + 1, 5, 1);
  const bought = (over: Partial<Receipt> = {}): Receipt => ({ ...r(0, 365), purchasedOn: toISODate(FUTURE), ...over });

  it('is lodged for 9am three days before the right ends', () => {
    const [p] = planAlerts([bought({ status: 'kept', keptOn: toISODate(FUTURE) })], FUTURE, 7, new Set());
    const at = addDays(FUTURE, REJECT_DAYS - REJECT_NOTICE_DAYS);
    at.setHours(FIRE_HOUR, 0, 0, 0);
    expect(p.rung).toBe('reject');
    expect(p.at.getTime()).toBe(at.getTime());
    expect(p.title).toBe('3 days left to reject it if it’s faulty');
  });

  it('is not lodged again once shown, nor where the shop’s ladder covers those days', () => {
    expect(planAlerts([bought()], FUTURE, 7, new Set([alertKey('a', 'reject')])).map((p) => p.rung)).not.toContain('reject');
    expect(planAlerts([bought({ windowDays: 30 })], FUTURE, 7, new Set()).map((p) => p.rung)).not.toContain('reject');
  });

  it('is lodged on a short shop window too, after the last of the ladder', () => {
    // Currys' fourteen days: the ladder is lodged for days 7 to 15, and the
    // right to reject, which nothing else mentions, for 9am on day 27.
    const plan = planAlerts([bought({ store: 'Currys', windowDays: 14 })], FUTURE, 7, new Set());
    expect(plan.map((p) => p.rung)).toEqual(['week', 'soon', 'today', 'closed', 'reject']);
    const at = addDays(FUTURE, REJECT_DAYS - REJECT_NOTICE_DAYS);
    at.setHours(FIRE_HOUR, 0, 0, 0);
    expect(plan[4].at.getTime()).toBe(at.getTime());
    expect(plan[4].title).toBe('3 days left to reject it if it’s faulty');
  });
});
