import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reducer, type AppState } from '../src/app/state';
import { addDays, toISODate } from '../src/lib/dates';
import { toPence } from '../src/lib/money';
import { planAlerts, recordLate, type LateRecord, type PlannedAlert } from '../src/lib/schedule';
import { DEFAULT_SETTINGS, hydrate } from '../src/lib/storage';
import type { Receipt } from '../src/lib/types';

/*
 * A single-shot alert lodged late is lodged ONCE.
 *
 * On iOS a reminder is recorded as said only when it is tapped, and a late
 * one is lodged for "the next 9am" — a different morning every day. So one
 * that fired and was swiped away came back on the next launch for the morning
 * after, and the one after that: measured, a credit note recorded with twenty
 * days to run and the app opened every evening raised twenty notifications.
 * The record of what was lodged late, and for when, is what stops that.
 */

const DAY = new Date(2027, 5, 15); // Tue 15 June 2027
const iso = (d: Date) => toISODate(d);
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m, d, h, min, 0, 0);
const nine = (d: Date) => at(d.getFullYear(), d.getMonth(), d.getDate(), 9);
const evening = (n: number) => at(2027, 5, 15 + n, 18);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterEach(() => {
  vi.useRealTimers();
});

function receipt(over: Partial<Receipt> = {}): Receipt {
  return {
    id: 'r1', store: 'John Lewis', item: 'Kettle', cat: 'kitchen',
    amount: toPence(45), purchasedOn: iso(addDays(DAY, -40)), windowDays: 35,
    policy: 'p', distance: false, status: 'active',
    ...over,
  };
}
const credit = (expires: Date) => receipt({ status: 'returned', returnedOn: iso(DAY), credit: { expires: iso(expires) } });

/** One launch, as `useApp` does it: plan with the record, hand it to iOS, remember what it took. */
function launch(receipts: Receipt[], now: Date, late: LateRecord, sent: string[] = []): { plan: PlannedAlert[]; late: LateRecord } {
  vi.setSystemTime(now);
  const plan = planAlerts(receipts, new Date(now.getFullYear(), now.getMonth(), now.getDate()), 7, new Set(sent), late);
  return { plan, late: recordLate(late, plan, receipts, new Set(sent)) };
}

describe('lodged once, however often the app is opened', () => {
  it('a credit note recorded with 20 days left, the app opened every evening: one notification in all', () => {
    const r = credit(addDays(DAY, 20));
    let late: LateRecord = {};
    const lodged = new Set<string>();
    for (let n = 0; n <= 21; n += 1) {
      const out = launch([r], evening(n), late);
      late = out.late;
      // Each plan replaces the last, so what can fire is what each one holds
      // before the next evening's launch replaces it.
      for (const p of out.plan) if (p.at.getTime() < evening(n + 1).getTime()) lodged.add(`${p.key}@${p.at.toISOString()}`);
    }
    expect([...lodged]).toEqual([`r1:credit@${nine(addDays(DAY, 1)).toISOString()}`]);
  });

  it('and the same through the reducer, as the app runs it', () => {
    const r = credit(addDays(DAY, 20));
    let state = appState([r]);
    const lodged = new Set<string>();
    for (let n = 0; n <= 21; n += 1) {
      vi.setSystemTime(evening(n));
      const today = addDays(DAY, n);
      const plan = planAlerts(state.receipts, today, 7, new Set(state.alertsSent), state.alertsLate);
      state = reducer(state, { type: 'lodged', plan }, today);
      for (const p of plan) if (p.at.getTime() < evening(n + 1).getTime()) lodged.add(`${p.key}@${p.at.toISOString()}`);
    }
    expect(lodged.size).toBe(1);
  });

  it('an on-time one is not recorded: its morning was already fixed', () => {
    vi.setSystemTime(evening(0));
    const r = credit(addDays(DAY, 40));
    const { plan, late } = launch([r], evening(0), {});
    expect(plan.map((p) => p.key)).toEqual(['r1:credit']);
    expect(plan[0].late).toBeUndefined();
    expect(late).toEqual({});
  });
});

describe('the morning it was lodged for does not move', () => {
  it('a re-plan the same day keeps the same moment and the same record', () => {
    const r = credit(addDays(DAY, 20));
    const first = launch([r], at(2027, 5, 15, 10), {});
    const second = launch([r], at(2027, 5, 15, 23), first.late);
    expect(second.plan[0].at).toEqual(first.plan[0].at);
    expect(second.late).toBe(first.late);
  });

  it('is lodged for the recorded moment while it is ahead, not for a fresh "next 9am"', () => {
    // Recorded for Wednesday; re-planned at 08:00 on Tuesday, when a fresh
    // plan would say Tuesday 9am.
    const r = credit(addDays(DAY, 20));
    const recorded: LateRecord = { 'r1:credit': { at: nine(addDays(DAY, 1)).toISOString(), from: iso(addDays(DAY, -10)), until: iso(addDays(DAY, 20)) } };
    const { plan } = launch([r], at(2027, 5, 15, 8), recorded);
    expect(plan[0].at).toEqual(nine(addDays(DAY, 1)));
    expect(plan[0].body).toContain('19 days from now');
  });

  it('once that moment has passed it is said, and no later morning is lodged', () => {
    const r = credit(addDays(DAY, 20));
    const first = launch([r], at(2027, 5, 15, 10), {});
    expect(launch([r], at(2027, 5, 16, 9, 1), first.late).plan).toEqual([]);
  });
});

describe('a clock that moves is owed again', () => {
  it('a new expiry on the credit note', () => {
    const first = launch([credit(addDays(DAY, 20))], at(2027, 5, 15, 10), {});
    const moved = credit(addDays(DAY, 25));
    const after = launch([moved], at(2027, 5, 16, 18), first.late);
    expect(after.plan.map((p) => [p.key, p.at])).toEqual([['r1:credit', nine(addDays(DAY, 2))]]);
    expect(after.plan[0].body).toContain('23 days from now');
    expect(after.late['r1:credit']).toEqual({ at: nine(addDays(DAY, 2)).toISOString(), from: iso(addDays(DAY, -5)), until: iso(addDays(DAY, 25)) });
  });

  it('a longer guarantee', () => {
    const covered = (months: number) =>
      receipt({ status: 'kept', keptOn: iso(addDays(DAY, -300)), purchasedOn: iso(addDays(addMonthsBack(DAY, 12), 18)), warranty: { months } });
    const first = launch([covered(12)], at(2027, 5, 15, 10), {});
    expect(first.plan.map((p) => p.rung)).toEqual(['warranty']);
    // Cover now ends a month later, so its notice morning is ahead again.
    const after = launch([covered(13)], at(2027, 5, 16, 18), first.late);
    expect(after.plan.map((p) => p.rung)).toEqual(['warranty']);
    expect(after.plan[0].late).toBeUndefined();
  });

  it('the day a parcel went back, for the refund that never lapses', () => {
    const sent = (ago: number) => receipt({ status: 'sent', sentOn: iso(addDays(DAY, -ago)) });
    const first = launch([sent(30)], at(2027, 5, 15, 10), {});
    expect(launch([sent(30)], at(2027, 5, 16, 18), first.late).plan).toEqual([]);
    expect(launch([sent(25)], at(2027, 5, 16, 18), first.late).plan.map((p) => p.rung)).toEqual(['refund']);
  });
});

describe('only ever about the single-shot rungs', () => {
  it('a record under a deadline rung silences nothing', () => {
    const r = receipt({ purchasedOn: iso(addDays(DAY, -20)), windowDays: 30 });
    vi.setSystemTime(at(2027, 5, 15, 10));
    const without = planAlerts([r], DAY, 7, new Set());
    const clock = { at: at(2027, 5, 15, 9).toISOString(), from: iso(DAY), until: iso(addDays(DAY, 10)) };
    const record: LateRecord = Object.fromEntries(['week', 'soon', 'today', 'closed'].map((rung) => [`r1:${rung}`, clock]));
    expect(planAlerts([r], DAY, 7, new Set(), record)).toEqual(without);
    expect(without.map((p) => p.rung)).toEqual(['week', 'soon', 'today', 'closed']);
  });

  it('and a deadline rung is never recorded', () => {
    const r = receipt({ purchasedOn: iso(addDays(DAY, -27)), windowDays: 30 });
    const { plan, late } = launch([r], at(2027, 5, 15, 10), {});
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.every((p) => p.late === undefined)).toBe(true);
    expect(late).toEqual({});
  });
});

describe('what the record keeps', () => {
  const entry = { at: at(2027, 5, 16, 9).toISOString(), from: iso(DAY), until: null };

  it('drops a receipt that has gone, and a key that has since been said', () => {
    const r = credit(addDays(DAY, 20));
    const before: LateRecord = { 'gone:credit': entry, 'r1:fault': entry };
    vi.setSystemTime(at(2027, 5, 15, 10));
    expect(recordLate(before, [], [r], new Set(['r1:fault']))).toEqual({});
    // Not lodged for a receipt deleted, or a key tapped, while the plan was in flight.
    const plan = planAlerts([r], DAY, 7, new Set());
    expect(recordLate({}, plan, [], new Set())).toEqual({});
    expect(recordLate({}, plan, [r], new Set(['r1:credit']))).toEqual({});
  });

  it('a tap still wins: the key in sent stops it whatever the record says', () => {
    const r = credit(addDays(DAY, 20));
    const first = launch([r], at(2027, 5, 15, 10), {});
    expect(launch([r], at(2027, 5, 15, 11), first.late, ['r1:credit']).plan).toEqual([]);
  });

  it('the reducer hands back the same state when nothing changed, so the sync does not loop', () => {
    const s = appState([credit(addDays(DAY, 20))]);
    vi.setSystemTime(at(2027, 5, 15, 10));
    const plan = planAlerts(s.receipts, DAY, 7, new Set(), s.alertsLate);
    const once = reducer(s, { type: 'lodged', plan }, DAY);
    expect(once.alertsLate['r1:credit']?.at).toBe(at(2027, 5, 16, 9).toISOString());
    expect(reducer(once, { type: 'lodged', plan }, DAY)).toBe(once);
  });

  it('Erase everything forgets it', () => {
    const s = appState([credit(addDays(DAY, 20))], { 'r1:credit': entry });
    expect(reducer(s, { type: 'wipe' }, DAY).alertsLate).toEqual({});
  });
});

describe('read back from the store', () => {
  const held = credit(addDays(DAY, 20));
  const stored = (alertsLate: unknown) => ({ version: 1, receipts: [held], updates: [], onboardingSeen: true, settings: DEFAULT_SETTINGS, alertsSent: [], alertsLate });
  const good = { at: '2027-06-16T13:00:00.000Z', from: '2027-06-05', until: '2027-07-05' };

  it('round-trips', () => {
    expect(hydrate(JSON.parse(JSON.stringify(stored({ 'r1:credit': good, 'r1:refund': { ...good, until: null } }))), DAY).alertsLate)
      .toEqual({ 'r1:credit': good, 'r1:refund': { ...good, until: null } });
  });

  it('an old store without it loads, with nothing recorded', () => {
    const { alertsLate: _gone, ...old } = stored({});
    expect(hydrate(old, DAY).alertsLate).toEqual({});
  });

  it('drops what it cannot read rather than trusting it', () => {
    // Through JSON, as the store hands it over: there `__proto__` is an
    // ordinary key, where in a literal it would set the prototype instead.
    const out = hydrate(JSON.parse(JSON.stringify(stored({
      'r1:credit': good,
      'r1:warranty': { ...good, at: 'soon' },
      'r1:reject': { ...good, from: '5 June' },
      'r1:fault': { ...good, until: 7 },
      'r1:refund': { at: good.at, until: null },
      'other:credit': good,
      'r1:today': good,
      'r1:closed': good,
      nocolon: good,
      ':credit': good,
      'r1:x:credit': [good],
    })).replace('"nocolon"', '"__proto__":' + JSON.stringify(good) + ',"nocolon"')), DAY).alertsLate;
    expect(out).toEqual({ 'r1:credit': good });
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
  });

  it.each([[null], [[good]], ['r1:credit'], [42]])('a record that is not one at all (%j) is nothing', (raw) => {
    expect(hydrate(stored(raw), DAY).alertsLate).toEqual({});
  });

  it('takes only the three fields it knows', () => {
    expect(hydrate(stored({ 'r1:credit': { ...good, extra: 'x' } }), DAY).alertsLate).toEqual({ 'r1:credit': good });
  });
});

function addMonthsBack(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() - months, d.getDate());
}

function appState(receipts: Receipt[], alertsLate: LateRecord = {}): AppState {
  return {
    version: 1, receipts, updates: [], onboardingSeen: true,
    settings: { ...DEFAULT_SETTINGS }, alertsSent: [], alertsLate: { ...alertsLate },
    screen: 'home', selId: null, obStep: 0, celebrating: null, shared: 'no', upgrading: false, store: { shelf: { kind: 'asking' }, busy: null, note: null },
    sharedText: null, embedded: false, justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null, justUnswapped: null, restored: null,
  };
}
