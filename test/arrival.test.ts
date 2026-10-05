import { describe, expect, it } from 'vitest';
import { reducer, type AppState } from '../src/app/state';
import { alertKey, dueAlerts, REJECT_NOTICE_DAYS } from '../src/lib/alerts';
import { addDays, toISODate } from '../src/lib/dates';
import { REJECT_DAYS } from '../src/lib/legal';
import { toPence } from '../src/lib/money';
import { ARRIVAL_ASK_DAYS, awaitingArrival, derive } from '../src/lib/receipts';
import { DEFAULT_SETTINGS } from '../src/lib/storage';
import type { Receipt } from '../src/lib/types';

const TODAY = new Date(2026, 7, 28);
const iso = (n: number) => toISODate(addDays(TODAY, n));

/** Ordered online `ago` days before TODAY. */
const ordered = (ago: number, over: Partial<Receipt> = {}): Receipt => ({
  id: 'a', store: 'ASOS', item: 'Trainers', cat: 'clothing', amount: toPence(60),
  purchasedOn: iso(-ago), windowDays: 28, policy: 'p', distance: true, status: 'active',
  ...over,
});

const state = (r: Receipt, alertsSent: string[] = []): AppState => ({
  version: 1, receipts: [r], updates: [], onboardingSeen: true,
  settings: { ...DEFAULT_SETTINGS }, alertsSent,
  screen: 'detail', selId: r.id, obStep: 0, celebrating: null, shared: 'no', upgrading: false, store: { shelf: { kind: 'asking' }, busy: null, note: null },
  sharedText: null, embedded: false, justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null, justUnswapped: null, restored: null,
});

describe('whether an order is still on its way', () => {
  it('is, for an online order with no arrival date, up to and including the last day it is asked about', () => {
    expect(awaitingArrival(ordered(0), TODAY)).toBe(true);
    expect(awaitingArrival(ordered(ARRIVAL_ASK_DAYS), TODAY)).toBe(true);
    expect(awaitingArrival(ordered(ARRIVAL_ASK_DAYS + 1), TODAY)).toBe(false);
  });

  it('is not, once it has arrived, if it was bought over a counter, or once it is settled', () => {
    expect(awaitingArrival(ordered(3, { arrivedOn: iso(-1) }), TODAY)).toBe(false);
    expect(awaitingArrival(ordered(3, { distance: false }), TODAY)).toBe(false);
    for (const status of ['sent', 'returned', 'kept'] as const) {
      expect(awaitingArrival(ordered(3, { status }), TODAY)).toBe(false);
    }
  });

  it('is not, for an order dated in the future by a typo', () => {
    expect(awaitingArrival(ordered(-2), TODAY)).toBe(false);
  });
});

describe('"It arrived today"', () => {
  const a = (s: AppState) => s.receipts[0];

  it('records today, and a shop that counts from delivery starts its window today', () => {
    const r = ordered(6);
    const after = a(reducer(state(r), { type: 'arrived', id: 'a' }, TODAY));
    expect(after.arrivedOn).toBe(toISODate(TODAY));
    expect(after.windowStartsOn).toBe(toISODate(TODAY));
    expect(toISODate(derive(after, TODAY).deadline)).toBe(iso(28));
  });

  it('leaves a shop that counts from dispatch counting from dispatch', () => {
    const r = ordered(6, { store: 'Zara', windowDays: 30, windowStartsOn: iso(-5) });
    const after = a(reducer(state(r), { type: 'arrived', id: 'a' }, TODAY));
    expect(after.arrivedOn).toBe(toISODate(TODAY));
    expect(after.windowStartsOn).toBe(iso(-5));
  });

  it('leaves a shop that counts from the order counting from the order', () => {
    const r = ordered(6, { store: 'Argos', windowDays: 30 });
    const after = a(reducer(state(r), { type: 'arrived', id: 'a' }, TODAY));
    expect(after.arrivedOn).toBe(toISODate(TODAY));
    expect(after.windowStartsOn).toBeUndefined();
  });

  it('forgets the reminders said about the old deadline, so they can be said about the real one', () => {
    const r = ordered(26);
    const s = reducer(state(r, [alertKey('a', 'soon'), alertKey('a', 'today')]), { type: 'arrived', id: 'a' }, TODAY);
    expect(s.alertsSent).toEqual([]);
  });

  it('forgets the reminder about the right to reject too, which now runs from today', () => {
    // An IKEA sofa ordered 27 days ago: told the right to reject ended "no
    // earlier than" three days from now. It comes today, so the right runs
    // thirty days from today, and the shop's year-long window does not move.
    const sofa = ordered(27, { store: 'IKEA', item: 'Sofa', windowDays: 365 });
    const s = reducer(state(sofa, [alertKey('a', 'reject')]), { type: 'arrived', id: 'a' }, TODAY);
    expect(s.alertsSent).toEqual([]);
    // Said again three days before the real end, and not before.
    const due = (n: number) => dueAlerts(s.receipts, addDays(TODAY, n), 7, new Set(s.alertsSent)).map((a) => a.rung);
    expect(due(REJECT_DAYS - REJECT_NOTICE_DAYS - 1)).toEqual([]);
    expect(due(REJECT_DAYS - REJECT_NOTICE_DAYS)).toEqual(['reject']);
  });

  it('does nothing to a receipt that has arrived, or was bought over a counter', () => {
    for (const r of [ordered(6, { arrivedOn: iso(-2) }), ordered(6, { distance: false })]) {
      const s = state(r);
      expect(reducer(s, { type: 'arrived', id: 'a' }, TODAY)).toBe(s);
    }
  });
});
