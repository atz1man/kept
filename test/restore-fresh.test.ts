import { describe, expect, it } from 'vitest';
import { reducer, type Action, type AppState } from '../src/app/state';
import { parseBackup } from '../src/lib/backup';
import { toPence } from '../src/lib/money';
import { FREE_TIER_LIMIT, meterWords } from '../src/lib/quota';
import { DEFAULT_SETTINGS, exportBackup } from '../src/lib/storage';
import type { Receipt } from '../src/lib/types';

/*
 * Restoring a backup onto a new phone, the moment a backup exists for.
 * Walked as a person would: a 40-receipt backup from an unlocked library,
 * restored into a fresh install. Settings read "Free plan · 39 of 10 open
 * receipts", and the five samples stayed mixed in with the real forty.
 */
const TODAY = new Date(2026, 9, 18);
const r = (id: string, over: Partial<Receipt> = {}): Receipt => ({
  id, store: 'Argos', item: `Thing ${id}`, cat: 'other', amount: toPence(10), purchasedOn: '2026-10-10', windowDays: 30,
  policy: 'Argos · 30-day return window', distance: false, status: 'active', ...over,
});
const start = (receipts: Receipt[]): AppState => ({
  version: 1, receipts, updates: [], onboardingSeen: true, settings: { ...DEFAULT_SETTINGS }, alertsLate: {}, reviewAsked: null, alertsSent: [],
  screen: 'settings', selId: null, obStep: 0, celebrating: null, shared: 'no', upgrading: false,
  store: { shelf: { kind: 'asking' }, busy: null, note: null },
  sharedText: null, embedded: false, justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null,
  justUnswapped: null, restored: null,
});
const restore = (onto: AppState, from: Receipt[]): AppState => {
  const out = parseBackup(exportBackup(start(from)));
  if (!out.ok) throw new Error(out.reason);
  return reducer(onto, { type: 'restore', backup: out.summary } as Action, TODAY);
};
const samples = [r('s1', { demo: true }), r('s2', { demo: true })];

describe('restoring onto a fresh phone', () => {
  it('replaces the samples with the person’s own receipts', () => {
    const after = restore(start(samples), [r('a'), r('b')]);
    expect(after.receipts.map((x) => x.id).sort()).toEqual(['a', 'b']);
    expect(after.restored).toMatchObject({ added: 2 });
  });

  it('leaves the samples alone when the backup holds nothing real', () => {
    const after = restore(start(samples), [r('s9', { demo: true })]);
    expect(after.receipts.some((x) => x.id === 's1')).toBe(true);
  });

  it('keeps every real receipt already on the phone', () => {
    const after = restore(start([...samples, r('mine')]), [r('a')]);
    expect(after.receipts.map((x) => x.id).sort()).toEqual(['a', 'mine']);
  });
});

describe('the free plan’s meter, past its limit', () => {
  it('never reads "39 of 10"', () => {
    expect(meterWords(3)).toBe(`3 of ${FREE_TIER_LIMIT} open receipts`);
    expect(meterWords(FREE_TIER_LIMIT)).toBe(`${FREE_TIER_LIMIT} of ${FREE_TIER_LIMIT} open receipts`);
    expect(meterWords(39)).toBe(`39 open receipts — the free plan holds ${FREE_TIER_LIMIT}`);
  });
});
