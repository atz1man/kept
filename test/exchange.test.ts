import { describe, expect, it } from 'vitest';
import { reducer, type AppState } from '../src/app/state';
import { dueAlerts, supersededKeys } from '../src/lib/alerts';
import { readReceipt } from '../src/lib/backup';
import { addDays, toISODate } from '../src/lib/dates';
import { toPence } from '../src/lib/money';
import { recoveredPence, refundOf } from '../src/lib/receipts';
import { DEFAULT_SETTINGS } from '../src/lib/storage';
import type { Receipt } from '../src/lib/types';

/*
 * A swap — a different size, a replacement over the counter — had no way to
 * be said, so it was recorded as kept, or as a refund: both false, and the
 * second counted money that never came.
 */

const TODAY = new Date(2026, 7, 28);
const receipt = (id: string, over: Partial<Receipt> = {}): Receipt => ({
  id, store: 'Next', item: 'Jeans, 32 waist', cat: 'clothing', amount: toPence(40),
  purchasedOn: '2026-08-20', windowDays: 28, policy: 'p', distance: false, status: 'active', orderRef: 'N-1',
  ...over,
});
const state = (receipts: Receipt[]): AppState => ({
  version: 1, receipts, updates: [], onboardingSeen: true,
  settings: { ...DEFAULT_SETTINGS }, alertsSent: [],
  screen: 'detail', selId: receipts[0]?.id ?? null, obStep: 0, celebrating: null, shared: 'no', upgrading: false,
  sharedText: null, embedded: false, justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null,
});
const swap = (s: AppState, id = 'a') => reducer(s, { type: 'exchange', id, newId: 'swapin' }, TODAY);
const find = (s: AppState, id: string) => s.receipts.find((r) => r.id === id)!;

describe('swapping it for another', () => {
  it('settles the one that went back with nothing recovered', () => {
    const s = swap(state([receipt('a'), receipt('b')]));
    expect(find(s, 'a')).toMatchObject({ status: 'returned', returnedOn: toISODate(TODAY), exchanged: true });
    expect(refundOf(find(s, 'a'))).toBe(0);
    expect(recoveredPence(s.receipts)).toBe(0);
    expect(find(s, 'b')).toEqual(receipt('b'));
  });

  it('opens the one that came home: a receipt of its own, with the original’s dates and shop', () => {
    const s = swap(state([receipt('a', { warranty: { months: 12 } })]));
    expect(s).toMatchObject({ screen: 'detail', selId: 'swapin' });
    const swapIn = find(s, 'swapin');
    expect(swapIn).toEqual({ ...receipt('a', { warranty: { months: 12 } }), id: 'swapin', swappedFrom: 'a' });
  });

  it('carries nothing that belonged to the first one’s ending', () => {
    const s = swap(state([receipt('a', { faultClaim: { sentOn: '2026-08-25' } })]));
    expect(find(s, 'swapin').faultClaim).toBeUndefined();
  });

  it('is only for something still in hand, and never over another receipt', () => {
    const kept = state([receipt('a', { status: 'kept', keptOn: '2026-08-21' })]);
    expect(swap(kept)).toBe(kept);
    const clash = state([receipt('a'), receipt('swapin')]);
    expect(swap(clash)).toBe(clash);
  });

  it('can be taken back: the original in hand again, and the swapped-in receipt gone', () => {
    const s = swap(state([receipt('a'), receipt('b')]));
    const back = reducer(s, { type: 'unexchange', id: 'a' }, TODAY);
    expect(back.receipts).toEqual([receipt('a'), receipt('b')]);
  });

  it('leaves no swap flag behind when the return itself is taken back', () => {
    const s = swap(state([receipt('a')]));
    expect(find(reducer(s, { type: 'unreturn', id: 'a' }, TODAY), 'a').exchanged).toBeUndefined();
  });

  it('is carried in a backup, and a swap flag on a receipt that did not go back is dropped', () => {
    const s = swap(state([receipt('a')]));
    expect(readReceipt(JSON.parse(JSON.stringify(find(s, 'a'))))?.exchanged).toBe(true);
    expect(readReceipt(JSON.parse(JSON.stringify(find(s, 'swapin'))))?.swappedFrom).toBe('a');
    expect(readReceipt({ ...receipt('x'), exchanged: true })?.exchanged).toBeUndefined();
  });

  it('does not tell the one that came home what was already said about the one that went back', () => {
    // A TV whose 14 days had passed: "closed" was shown and recorded, as the
    // app records it. Swapped for another on day 20, the replacement keeps
    // the same dates, and said it all again.
    const tv = receipt('a', { store: 'Currys', item: 'TV', purchasedOn: toISODate(addDays(TODAY, -20)), windowDays: 14 });
    const shown = dueAlerts([tv], TODAY, 7, new Set());
    expect(shown.map((a) => a.rung)).toEqual(['closed']);
    const told = reducer(state([tv]), { type: 'alerted', keys: shown.flatMap((a) => [a.key, ...supersededKeys(a)]) }, TODAY);
    const s = swap(told);
    expect(dueAlerts(s.receipts, TODAY, 7, new Set(s.alertsSent))).toEqual([]);
  });

  it('carries what was said about the original’s clocks, and not about its fault letter', () => {
    const said = ['a:week', 'a:soon', 'a:today', 'a:closed', 'a:warranty', 'a:reject', 'a:fault'];
    const original = receipt('a', { warranty: { months: 12 }, faultClaim: { sentOn: '2026-08-25' } });
    const s = swap({ ...state([original]), alertsSent: said });
    expect(s.alertsSent.filter((k) => k.startsWith('swapin:')).sort()).toEqual(
      ['swapin:closed', 'swapin:reject', 'swapin:soon', 'swapin:today', 'swapin:warranty', 'swapin:week'],
    );
    // A new receipt from the shop: dated again, and its reminders are owed.
    const redated = reducer(s, { type: 'update', receipt: { ...find(s, 'swapin'), purchasedOn: toISODate(TODAY) } }, TODAY);
    expect(redated.alertsSent.filter((k) => k.startsWith('swapin:'))).toEqual([]);
  });
});
