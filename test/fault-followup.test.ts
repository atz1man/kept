import { describe, expect, it } from 'vitest';
import { reducer, type AppState } from '../src/app/state';
import { alertKey, dueAlerts, supersededKeys } from '../src/lib/alerts';
import { readReceipt } from '../src/lib/backup';
import { addDays, toISODate } from '../src/lib/dates';
import { REPLY_DAYS } from '../src/lib/fault-letter';
import { toPence } from '../src/lib/money';
import { FIRE_HOUR, planAlerts } from '../src/lib/schedule';
import { DEFAULT_SETTINGS } from '../src/lib/storage';
import type { Receipt } from '../src/lib/types';

const TODAY = new Date(2026, 7, 28);
const iso = (n: number, from = TODAY) => toISODate(addDays(from, n));

/** A kept dishwasher whose fault letter went `ago` days before TODAY. */
const written = (ago: number | null, over: Partial<Receipt> = {}): Receipt => ({
  id: 'a', store: 'Currys', item: 'Bosch dishwasher', cat: 'kitchen', amount: toPence(429),
  purchasedOn: iso(-120), windowDays: 30, policy: 'p', distance: false, status: 'kept', keptOn: iso(-100),
  ...(ago === null ? {} : { faultClaim: { sentOn: iso(-ago), what: 'It leaks' } }),
  ...over,
});

const state = (r: Receipt, alertsSent: string[] = []): AppState => ({
  version: 1, receipts: [r], updates: [], onboardingSeen: true,
  settings: { ...DEFAULT_SETTINGS }, alertsLate: {}, reviewAsked: null, alertsSent,
  screen: 'detail', selId: r.id, obStep: 0, celebrating: null, shared: 'no', upgrading: false, store: { shelf: { kind: 'asking' }, busy: null, note: null },
  sharedText: null, embedded: false, justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null, justUnswapped: null, restored: null,
});

describe('asking whether the shop replied to the fault letter', () => {
  const due = (r: Receipt, sent: string[] = []) => dueAlerts([r], TODAY, 7, new Set(sent)).filter((a) => a.rung === 'fault');

  it('is due on the day the letter asked for a reply by, and not the day before', () => {
    expect(due(written(REPLY_DAYS - 1))).toHaveLength(0);
    expect(due(written(REPLY_DAYS))).toHaveLength(1);
  });

  it('says when it was written, what was asked, and where to go next — calling the fortnight the letter’s', () => {
    const [a] = due(written(REPLY_DAYS));
    expect(a.title).toBe('Has Currys replied?');
    expect(a.body).toContain(`asked for a reply within ${REPLY_DAYS} days`);
    expect(a.body).toContain('Citizens Advice');
  });

  it('is not asked without a letter, on a sample, once asked, or once the thing has gone back', () => {
    expect(due(written(null))).toHaveLength(0);
    expect(due(written(20, { demo: true }))).toHaveLength(0);
    expect(due(written(20), [alertKey('a', 'fault')])).toHaveLength(0);
    expect(due(written(20, { status: 'returned', returnedOn: iso(-1) }))).toHaveLength(0);
    expect(due(written(20, { status: 'active' }))).toHaveLength(1);
  });

  it('stands alone: nothing below it counts as skipped', () => {
    expect(supersededKeys(due(written(20))[0])).toEqual([]);
  });

  it('is lodged with the phone for 9am on that day', () => {
    const AHEAD = new Date(new Date().getFullYear() + 1, 5, 1);
    const r = written(null, { purchasedOn: iso(-30, AHEAD), faultClaim: { sentOn: iso(0, AHEAD) } });
    const p = planAlerts([r], AHEAD, 7, new Set()).find((x) => x.rung === 'fault')!;
    expect(toISODate(p.at)).toBe(iso(REPLY_DAYS, AHEAD));
    expect(p.at.getHours()).toBe(FIRE_HOUR);
  });
});

describe('recording that the letter went', () => {
  const a = (s: AppState) => s.receipts[0];

  it('records today and the words, tidied, and forgets a reply asked about an earlier letter', () => {
    const s = reducer(state(written(30), [alertKey('a', 'fault')]), { type: 'fault-sent', id: 'a', what: '  It  leaks ' }, TODAY);
    expect(a(s).faultClaim).toEqual({ sentOn: toISODate(TODAY), what: 'It leaks' });
    expect(s.alertsSent).toEqual([]);
    expect(a(reducer(state(written(null)), { type: 'fault-sent', id: 'a', what: ' ' }, TODAY)).faultClaim).toEqual({ sentOn: toISODate(TODAY) });
  });

  it('only on a receipt still with its owner', () => {
    const back = state(written(null, { status: 'returned', returnedOn: iso(-1) }));
    expect(a(reducer(back, { type: 'fault-sent', id: 'a', what: 'x' }, TODAY)).faultClaim).toBeUndefined();
  });

  it('is taken back, with its question', () => {
    const s = reducer(state(written(20), [alertKey('a', 'fault')]), { type: 'fault-unsent', id: 'a' }, TODAY);
    expect(a(s).faultClaim).toBeUndefined();
    expect(s.alertsSent).toEqual([]);
  });
});

describe('a sent fault letter, in a backup', () => {
  it('is carried with its words', () => {
    expect(readReceipt({ ...written(3) })?.faultClaim).toEqual({ sentOn: iso(-3), what: 'It leaks' });
  });
  it('is dropped when its day is not a real one, and the receipt kept', () => {
    const r = readReceipt({ ...written(null), faultClaim: { sentOn: 'last week' } });
    expect(r).not.toBeNull();
    expect(r?.faultClaim).toBeUndefined();
  });
});
