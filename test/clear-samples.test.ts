import { describe, expect, it } from 'vitest';
import { reducer, type AppState } from '../src/app/state';
import { toPence } from '../src/lib/money';
import { DEFAULT_SETTINGS } from '../src/lib/storage';
import type { Receipt } from '../src/lib/types';

/*
 * The samples had no way out but one at a time, or Erase everything — which
 * takes the real receipts with them. So they stayed on the list beside real
 * purchases for good.
 */

const TODAY = new Date(2026, 7, 28);
const receipt = (id: string, over: Partial<Receipt> = {}): Receipt => ({
  id, store: 'Argos', item: 'Mixer', cat: 'kitchen', amount: toPence(64.99),
  purchasedOn: '2026-08-07', windowDays: 30, policy: 'p', distance: false, status: 'active',
  ...over,
});
const sample = (id: string) => receipt(id, { demo: true });
const base = (over: Partial<AppState> = {}): AppState => ({
  version: 1, receipts: [sample('s1'), receipt('mine'), sample('s2')], updates: [], onboardingSeen: true,
  settings: { ...DEFAULT_SETTINGS }, alertsSent: ['s1:week', 'mine:week'],
  screen: 'home', selId: null, obStep: 0, celebrating: null, shared: 'no', upgrading: false, store: { shelf: { kind: 'asking' }, busy: null, note: null },
  sharedText: null, embedded: false, justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null,
  ...over,
});
const clear = (s: AppState) => reducer(s, { type: 'clear-samples' }, TODAY);

describe('removing the samples', () => {
  it('takes every sample and nothing else, leaving the real receipts exactly as they were', () => {
    const next = clear(base());
    expect(next.receipts).toEqual([receipt('mine')]);
  });

  it('forgets the alerts it had noted about them, and keeps the ones about real receipts', () => {
    expect(clear(base()).alertsSent).toEqual(['mine:week']);
  });

  it('withdraws an undo that would put a sample back, and leaves one about a real receipt', () => {
    expect(clear(base({ justDeleted: sample('s3') })).justDeleted).toBeNull();
    expect(clear(base({ justDeleted: receipt('gone') })).justDeleted).toEqual(receipt('gone'));
    expect(clear(base({ justReturned: { id: 's1', was: { status: 'active' } } })).justReturned).toBeNull();
    expect(clear(base({ justReturned: { id: 'mine', was: { status: 'active' } } })).justReturned).not.toBeNull();
    expect(clear(base({ justKept: ['s2'] })).justKept).toBeNull();
    expect(clear(base({ justAdded: 'mine' })).justAdded).toBe('mine');
    expect(clear(base({ justSent: 's2' })).justSent).toBeNull();
    expect(clear(base({ justSent: 'mine' })).justSent).toBe('mine');
  });

  it('leaves a sample’s own screen for the list, and a real one open', () => {
    expect(clear(base({ screen: 'detail', selId: 's1' }))).toMatchObject({ screen: 'home', selId: null });
    expect(clear(base({ screen: 'detail', selId: 'mine' }))).toMatchObject({ screen: 'detail', selId: 'mine' });
  });

  it('is nothing at all once there are no samples', () => {
    const none = base({ receipts: [receipt('mine')] });
    expect(clear(none)).toBe(none);
  });
});
