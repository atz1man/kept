import { describe, expect, it } from 'vitest';
import { reducer, type AppState } from '../src/app/state';
import { alertKey, CREDIT_NOTICE_DAYS, dueAlerts, supersededKeys } from '../src/lib/alerts';
import { readReceipt } from '../src/lib/backup';
import { addDays, toISODate } from '../src/lib/dates';
import { toPence } from '../src/lib/money';
import { FIRE_HOUR, planAlerts } from '../src/lib/schedule';
import { DEFAULT_SETTINGS } from '../src/lib/storage';
import type { Receipt } from '../src/lib/types';

const TODAY = new Date(2026, 7, 28);
const iso = (n: number, from = TODAY) => toISODate(addDays(from, n));

/** Returned a week ago, as store credit running out `left` days from TODAY. */
const credited = (left: number | null, over: Partial<Receipt> = {}): Receipt => ({
  id: 'a', store: 'Zara', item: 'Wool coat', cat: 'clothing', amount: toPence(34.99),
  purchasedOn: iso(-30), windowDays: 30, policy: 'p', distance: true,
  status: 'returned', returnedOn: iso(-7), credit: left === null ? {} : { expires: iso(left) },
  ...over,
});

const state = (r: Receipt, alertsSent: string[] = []): AppState => ({
  version: 1, receipts: [r], updates: [], onboardingSeen: true,
  settings: { ...DEFAULT_SETTINGS }, alertsSent,
  screen: 'detail', selId: r.id, obStep: 0, celebrating: null, shared: 'no', upgrading: false, store: { shelf: { kind: 'asking' }, busy: null, note: null },
  sharedText: null, embedded: false, justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null,
});

describe('the reminder before store credit lapses', () => {
  const due = (r: Receipt, sent: string[] = []) => dueAlerts([r], TODAY, 7, new Set(sent)).filter((a) => a.rung === 'credit');

  it('is due from a month before through the last day, and not before or after', () => {
    expect(due(credited(CREDIT_NOTICE_DAYS + 1))).toHaveLength(0);
    expect(due(credited(CREDIT_NOTICE_DAYS))).toHaveLength(1);
    expect(due(credited(0))).toHaveLength(1);
    expect(due(credited(-1))).toHaveLength(0);
  });

  it('says how much, where, and by when, in its own words', () => {
    const [a] = due(credited(10));
    expect(a.title).toBe('Your store credit is running out');
    expect(a.body).toContain('£34.99 of Zara credit, from Wool coat');
    expect(a.body).toContain('10 days from now');
    expect(due(credited(0))[0].body).toContain('which is today');
  });

  it('follows a partial refund: the credit is what came back', () => {
    expect(due(credited(10, { refunded: 2000 }))[0].body).toContain('£20.00 of Zara credit');
  });

  it('is never raised without a date, on a sample, on money, or once given', () => {
    expect(due(credited(null))).toHaveLength(0);
    expect(due(credited(10, { demo: true }))).toHaveLength(0);
    expect(due(credited(10, { credit: undefined }))).toHaveLength(0);
    expect(due(credited(10), [alertKey('a', 'credit')])).toHaveLength(0);
  });

  it('stands alone: nothing below it counts as skipped', () => {
    expect(supersededKeys(due(credited(10))[0])).toEqual([]);
  });
});

describe('the credit reminder, lodged with the phone', () => {
  // Anchored ahead of the real clock, as the schedule tests are.
  const AHEAD = new Date(new Date().getFullYear() + 1, 5, 1);
  it('fires at nine, a month before the credit runs out', () => {
    const r = credited(null, { returnedOn: iso(0, AHEAD), credit: { expires: iso(90, AHEAD) } });
    const p = planAlerts([r], AHEAD, 7, new Set()).find((x) => x.rung === 'credit')!;
    expect(toISODate(p.at)).toBe(iso(90 - CREDIT_NOTICE_DAYS, AHEAD));
    expect(p.at.getHours()).toBe(FIRE_HOUR);
  });
});

describe('recording store credit', () => {
  const a = (s: AppState) => s.receipts[0];
  const money = credited(null, { credit: undefined });

  it('marks a refund as credit, with and without the day it runs out, and back to money', () => {
    const c = reducer(state(money), { type: 'set-credit', id: 'a', credit: {} }, TODAY);
    expect(a(c).credit).toEqual({});
    const dated = reducer(c, { type: 'set-credit', id: 'a', credit: { expires: iso(100) } }, TODAY);
    expect(a(dated).credit).toEqual({ expires: iso(100) });
    expect(a(reducer(dated, { type: 'set-credit', id: 'a', credit: null }, TODAY)).credit).toBeUndefined();
  });

  it('refuses a receipt that has not been refunded, a date that is not one, or one before it was given', () => {
    const live = state(credited(null, { status: 'active', returnedOn: undefined, credit: undefined }));
    expect(reducer(live, { type: 'set-credit', id: 'a', credit: {} }, TODAY)).toBe(live);
    const s = state(money);
    expect(reducer(s, { type: 'set-credit', id: 'a', credit: { expires: '2026-02-30' } }, TODAY)).toBe(s);
    expect(reducer(s, { type: 'set-credit', id: 'a', credit: { expires: iso(-8) } }, TODAY)).toBe(s);
  });

  it('forgets a reminder given about a different expiry, and keeps one about the same', () => {
    const sent = [alertKey('a', 'credit')];
    expect(reducer(state(credited(10), sent), { type: 'set-credit', id: 'a', credit: { expires: iso(60) } }, TODAY).alertsSent).toEqual([]);
    expect(reducer(state(credited(10), sent), { type: 'set-credit', id: 'a', credit: { expires: iso(10) } }, TODAY).alertsSent).toEqual(sent);
  });

  it('keeps the credit when the amount is corrected, and drops it when the refund is taken back', () => {
    expect(a(reducer(state(credited(10)), { type: 'set-refund', id: 'a', pence: null }, TODAY)).credit).toEqual({ expires: iso(10) });
    expect(a(reducer(state(credited(10)), { type: 'unreturn', id: 'a' }, TODAY)).credit).toBeUndefined();
  });
});

describe('store credit, in a backup', () => {
  const good = credited(10);
  it('is carried on a refund, with its date', () => {
    expect(readReceipt({ ...good })?.credit).toEqual({ expires: iso(10) });
  });
  it('keeps the credit and drops a date that is not one', () => {
    expect(readReceipt({ ...good, credit: { expires: 'soon' } })?.credit).toEqual({});
  });
  it('is not carried on a receipt that was not refunded', () => {
    expect(readReceipt({ ...good, status: 'active', returnedOn: undefined })?.credit).toBeUndefined();
  });
});

describe('store credit, spent', () => {
  /*
   * Credit was the one thing kept could be told about and never told it had
   * gone: "spend it before then" still fired a month before the note's date
   * on credit used the week it was given, and the only ways to stop it made
   * the record false.
   */
  const a = (s: AppState) => s.receipts[0];
  const spent = () => reducer(state(credited(10)), { type: 'credit-spent', id: 'a' }, TODAY);

  it('is recorded on the day, keeping what the credit was and when it would have run out', () => {
    expect(a(spent()).credit).toEqual({ expires: iso(10), spentOn: toISODate(TODAY) });
    expect(a(spent()).status).toBe('returned');
  });

  it('stops the reminder, on screen and lodged with the phone', () => {
    expect(dueAlerts([a(spent())], TODAY, 7, new Set()).filter((x) => x.rung === 'credit')).toEqual([]);
    const FUTURE = new Date(new Date().getFullYear() + 1, 5, 1);
    const later = { ...credited(40), returnedOn: toISODate(FUTURE), credit: { expires: iso(60, FUTURE), spentOn: toISODate(FUTURE) } };
    expect(planAlerts([later], FUTURE, 7, new Set()).map((p) => p.rung)).not.toContain('credit');
    expect(planAlerts([{ ...later, credit: { expires: iso(60, FUTURE) } }], FUTURE, 7, new Set()).map((p) => p.rung)).toContain('credit');
  });

  it('can be taken back, and the reminder is due again', () => {
    const back = reducer(spent(), { type: 'credit-unspent', id: 'a' }, TODAY);
    expect(a(back).credit).toEqual({ expires: iso(10) });
    expect(dueAlerts([a(back)], TODAY, 7, new Set()).map((x) => x.rung)).toContain('credit');
  });

  it('is only recorded on credit, once, and survives a corrected expiry', () => {
    const money = { ...credited(10), credit: undefined };
    expect(reducer(state(money), { type: 'credit-spent', id: 'a' }, TODAY)).toEqual(state(money));
    const again = reducer(spent(), { type: 'credit-spent', id: 'a' }, addDays(TODAY, 3));
    expect(a(again).credit?.spentOn).toBe(toISODate(TODAY));
    const moved = reducer(spent(), { type: 'set-credit', id: 'a', credit: { expires: iso(20) } }, TODAY);
    expect(a(moved).credit).toEqual({ expires: iso(20), spentOn: toISODate(TODAY) });
    expect(a(reducer(spent(), { type: 'set-credit', id: 'a', credit: null }, TODAY)).credit).toBeUndefined();
  });

  it('is carried in a backup and through a reload, and a day that is not one is dropped', () => {
    const r = a(spent());
    expect(readReceipt(JSON.parse(JSON.stringify(r)))?.credit).toEqual({ expires: iso(10), spentOn: toISODate(TODAY) });
    expect(readReceipt({ ...r, credit: { expires: iso(10), spentOn: '2026-02-31' } })?.credit).toEqual({ expires: iso(10) });
  });
});
