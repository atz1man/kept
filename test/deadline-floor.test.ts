import { describe, expect, it } from 'vitest';
import { dueAlerts } from '../src/lib/alerts';
import { claimPack, claimPackText } from '../src/lib/claim-pack';
import { comingUp } from '../src/lib/coming-up';
import { addDays, toISODate } from '../src/lib/dates';
import { firstToClose, firstToCloseLine } from '../src/lib/legal';
import { toPence } from '../src/lib/money';
import { bucket, deadlineIsFloor, derive, floorClock, stillReturnablePence } from '../src/lib/receipts';
import { planAlerts } from '../src/lib/schedule';
import { findStore } from '../src/lib/stores';
import { heroCount, urgency } from '../src/lib/urgency';
import { reducer, type AppState } from '../src/app/state';
import { winCardLine } from '../src/app/win-card';
import { DEFAULT_SETTINGS } from '../src/lib/storage';
import type { Receipt } from '../src/lib/types';

/*
 * A floor announced as the deadline.
 *
 * For an online order from a shop that counts from delivery or dispatch, with
 * no arrival entered, `derive` counts from the order: the EARLIEST the window
 * could end. Only the Detail screen said so. The cases below are the ones an
 * audit measured, on the day it measured them (4 October 2026).
 */
const TODAY = new Date(2026, 9, 4);
const iso = (n: number) => toISODate(addDays(TODAY, n));
const apple = findStore('Apple')!;

/** Ordered from Apple online on 19 September; the parcel's arrival never entered. */
const appleOrder = (over: Partial<Receipt> = {}): Receipt => ({
  id: 'apple', store: 'Apple', item: 'AirPods Pro', cat: 'audio', amount: toPence(229),
  purchasedOn: '2026-09-19', windowDays: 14, policy: apple.policy, distance: true, status: 'active',
  ...over,
});
/** Bought over the counter long ago: a window that really has closed. */
const shut = (over: Partial<Receipt> = {}): Receipt => ({
  id: 'currys', store: 'Currys', item: 'Kettle', cat: 'kitchen', amount: toPence(40),
  purchasedOn: iso(-40), windowDays: 14, policy: 'p', distance: false, status: 'active',
  ...over,
});

describe('which deadlines are floors', () => {
  it('is an online order from a shop that counts from delivery or dispatch, its start unknown', () => {
    expect(floorClock(appleOrder())).toBe('delivery');
    expect(floorClock(appleOrder({ store: 'Zara' }))).toBe('dispatch');
    // Uniqlo counts from the till in store and from delivery online.
    expect(floorClock(appleOrder({ store: 'Uniqlo' }))).toBe('delivery');
  });

  it('is not one whose start is known, one bought over a counter, or a shop that counts from the order', () => {
    expect(deadlineIsFloor(appleOrder({ arrivedOn: '2026-09-22', windowStartsOn: '2026-09-22' }))).toBe(false);
    // Apple's own row counts from delivery; over its counter that is the till.
    expect(deadlineIsFloor(appleOrder({ distance: false }))).toBe(false);
    expect(deadlineIsFloor(appleOrder({ store: 'Uniqlo', distance: false }))).toBe(false);
    expect(deadlineIsFloor(appleOrder({ store: 'Tesco' }))).toBe(false);
    // Not in the table: already worded as a guess, nothing more to say.
    expect(deadlineIsFloor(appleOrder({ store: 'Corner Shop' }))).toBe(false);
  });
});

describe('the reminders, on the web', () => {
  it('do not tell the Apple order its window has closed', () => {
    // 15 days after the order: past the floor, two days inside a window
    // whose parcel took three.
    const [a] = dueAlerts([appleOrder()], TODAY, 7, new Set());
    expect(a.rung).toBe('closed');
    expect(a.title).not.toBe('That window has closed');
    expect(a.title).toMatch(/may have (closed|passed)/);
    expect(a.body).not.toMatch(/the shop’s window has passed/);
    expect(a.body).toMatch(/Apple counts from delivery, so it may still be open — add the day it arrived to know\./);
  });

  it('say "has closed" once the arrival is known and the window really is past', () => {
    const arrived = appleOrder({ arrivedOn: '2026-09-19', windowStartsOn: '2026-09-19' });
    expect(dueAlerts([arrived], TODAY, 7, new Set())[0].title).toMatch(/^(That window has closed|The saved window has passed)$/);
  });
});

describe('the reminders lodged with iOS', () => {
  it('hedge the last day and the morning after for a floor', () => {
    const next = new Date(new Date().getFullYear() + 1, 5, 1);
    const r = appleOrder({ purchasedOn: toISODate(next) });
    const plan = planAlerts([r], next, 7, new Set());
    const today = plan.find((p) => p.rung === 'today')!;
    const closed = plan.find((p) => p.rung === 'closed')!;
    expect(today.title).not.toBe('Today is the last day');
    expect(today.title).toMatch(/may (close|end) today/);
    expect(closed.title).not.toBe('That window has closed');
    expect(closed.body).toMatch(/may still be open — add the day it arrived to know/);
    for (const p of plan) expect(p.title).not.toMatch(/has closed|has passed/);
  });
});

describe('the claim pack', () => {
  // Ordered 1 September, arrived the 4th (never entered), sent back the 17th:
  // thirteen days after it came, inside Apple's fourteen.
  const sentBack = appleOrder({ purchasedOn: '2026-09-01', status: 'sent', sentOn: '2026-09-17' });

  it('does not tell the shop a return made in time was late', () => {
    const text = claimPackText(claimPack(sentBack, TODAY));
    expect(text).not.toContain('after the shop’s own window had closed');
    expect(text).toContain('Sent back on 17 September 2026.');
  });

  it('hedges the shop’s own date as it hedges the statutory ones', () => {
    const text = claimPackText(claimPack(sentBack, TODAY));
    expect(text).toContain('at least 15 September 2026 — The shop’s own return window closes (check the arrival date)');
    expect(text).not.toMatch(/return window closes \(passed\)/);
  });

  it('still says late when the window was a date and it went back after it', () => {
    const late = shut({ distance: true, store: 'Tesco', status: 'sent', sentOn: iso(-1) });
    expect(claimPackText(claimPack(late, TODAY))).toContain('after the shop’s own window had closed');
  });
});

describe('Home', () => {
  it('does not file a floor gone by under "Window closed"', () => {
    const b = bucket([appleOrder(), shut()], TODAY, 7);
    expect(b.closed.map((r) => r.id)).toEqual(['currys']);
    expect(b.unsure.map((r) => r.id)).toEqual(['apple']);
  });

  it('files it as a window again once the arrival says so', () => {
    const arrived = appleOrder({ arrivedOn: '2026-09-19', windowStartsOn: '2026-09-19' });
    expect(bucket([arrived], TODAY, 7).closed.map((r) => r.id)).toEqual(['apple']);
    // And a floor still ahead is an ordinary deadline, counted down.
    expect(bucket([appleOrder({ purchasedOn: iso(-10) })], TODAY, 7).urgent.map((r) => r.id)).toEqual(['apple']);
  });

  it('does not count it as still returnable: that is the unknown', () => {
    const b = bucket([appleOrder()], TODAY, 7);
    expect(stillReturnablePence(b)).toBe(0);
  });

  it('labels the row and the hero with the question, not "window closed" or "Gone"', () => {
    const left = derive(appleOrder(), TODAY).daysLeft;
    expect(urgency(left, 7, deadlineIsFloor(appleOrder())).label).toBe('arrived when?');
    expect(urgency(left, 7, false).label).toBe('window closed');
    expect(heroCount(left, true).count).not.toBe('Gone');
  });

  const state = (receipts: Receipt[]): AppState => ({
    version: 1, receipts, updates: [], onboardingSeen: true,
    settings: { ...DEFAULT_SETTINGS }, alertsLate: {}, reviewAsked: null, alertsSent: [],
    screen: 'home', selId: null, obStep: 0, celebrating: null, shared: 'no', upgrading: false, store: { shelf: { kind: 'asking' }, busy: null, note: null },
    sharedText: null, embedded: false, justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null, justUnswapped: null, restored: null,
  });

  it('will not keep a floor with the closed ones, even if asked', () => {
    const next = reducer(state([appleOrder(), shut()]), { type: 'keep-closed', ids: ['apple', 'currys'] }, TODAY);
    expect(next.receipts.find((r) => r.id === 'apple')!.status).toBe('active');
    expect(next.receipts.find((r) => r.id === 'currys')!.status).toBe('kept');
  });

  it('does not celebrate a floor refund as late, or as on time', () => {
    const next = reducer(state([appleOrder({ status: 'sent', sentOn: '2026-10-04' })]), { type: 'return', id: 'apple' }, TODAY);
    expect(next.celebrating?.inTime).toBeNull();
    expect(winCardLine('Apple', null)).toBe('Recovered from Apple.');
    // Sent back by the floor is in time, whatever day it came.
    const early = reducer(state([appleOrder({ status: 'sent', sentOn: '2026-10-01' })]), { type: 'return', id: 'apple' }, TODAY);
    expect(early.celebrating?.inTime).toBe(true);
  });
});

describe('the receipt’s own screen and Coming up', () => {
  it('say the shop’s date is the earliest, when it closes first', () => {
    const r = appleOrder({ purchasedOn: '2026-09-25' });
    const line = firstToCloseLine(firstToClose(r, TODAY, derive(r, TODAY).deadline)!);
    expect(line).toBe('Likely to close first: the shop’s own window, no earlier than 9 Oct.');
    const counter = appleOrder({ purchasedOn: '2026-09-25', distance: false });
    expect(firstToCloseLine(firstToClose(counter, TODAY, derive(counter, TODAY).deadline)!)).toBe('Closes first: the shop’s own window, 9 Oct.');
  });

  it('list its last day as "or later"', () => {
    const r = appleOrder({ purchasedOn: '2026-09-25' });
    expect(comingUp([r], TODAY).find((c) => c.kind === 'return')!.what).toBe('Last day to return it (or later)');
    expect(comingUp([{ ...r, distance: false }], TODAY).find((c) => c.kind === 'return')!.what).toBe('Last day to return it');
  });
});
