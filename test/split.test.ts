import { describe, expect, it } from 'vitest';
import { reducer, type AppState } from '../src/app/state';
import { readReceipt } from '../src/lib/backup';
import { toPence } from '../src/lib/money';
import { canSplit, readSplit, splitReceipt, validSplit } from '../src/lib/split';
import { DEFAULT_SETTINGS } from '../src/lib/storage';
import type { Receipt } from '../src/lib/types';

/*
 * A receipt holds one item and one amount, and a till receipt is often a
 * basket: returning one thing from three settled the whole receipt, and the
 * guarantee and fault letter of the two that stayed went with it.
 */

const TODAY = new Date(2026, 7, 28);
const basket = (over: Partial<Receipt> = {}): Receipt => ({
  id: 'a', store: 'Boots', item: 'Shopping', cat: 'beauty', amount: toPence(60),
  purchasedOn: '2026-08-20', windowDays: 35, policy: 'p', distance: false, status: 'active',
  orderRef: 'B-7', warranty: { months: 24 },
  ...over,
});
const state = (receipts: Receipt[]): AppState => ({
  version: 1, receipts, updates: [], onboardingSeen: true,
  settings: { ...DEFAULT_SETTINGS }, alertsSent: [],
  screen: 'detail', selId: receipts[0]?.id ?? null, obStep: 0, celebrating: null, shared: 'no', upgrading: false, store: { shelf: { kind: 'asking' }, busy: null, note: null },
  sharedText: null, embedded: false, justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null,
});
const find = (s: AppState, id: string) => s.receipts.find((r) => r.id === id)!;

describe('reading a split as typed', () => {
  it('wants a name, and a price below the whole', () => {
    expect(readSplit(basket(), '  Hairdryer  ', '£25')).toEqual({ ok: true, item: 'Hairdryer', pence: 2500 });
    expect(readSplit(basket(), ' ', '25')).toEqual({ ok: false, error: 'Say what the part is' });
    expect(readSplit(basket(), 'Hairdryer', '60')).toEqual({ ok: false, error: 'It has to be less than the whole receipt' });
    expect(readSplit(basket(), 'Hairdryer', '59.99')).toMatchObject({ ok: true, pence: 5999 });
    expect(readSplit(basket(), 'x'.repeat(201), '5').ok).toBe(false);
  });

  it('is only for a receipt still with its owner', () => {
    expect(canSplit(basket())).toBe(true);
    expect(canSplit(basket({ status: 'kept', keptOn: '2026-08-21' }))).toBe(true);
    expect(canSplit(basket({ status: 'returned', returnedOn: '2026-08-22' }))).toBe(false);
    expect(canSplit(basket({ status: 'sent', sentOn: '2026-08-22' }))).toBe(false);
    expect(validSplit(basket(), 'x', 0)).toBe(false);
    expect(validSplit(basket(), 'x', 1.5)).toBe(false);
  });
});

describe('splitting a part out', () => {
  it('makes it a receipt of its own on the same clocks, and leaves the rest of the money', () => {
    const { rest, part } = splitReceipt(basket({ faultClaim: { sentOn: '2026-08-25' }, returnRef: 'X' }), 'Hairdryer', 2500, 'b');
    expect(rest.amount).toBe(3500);
    expect(rest.faultClaim).toEqual({ sentOn: '2026-08-25' });
    expect(part).toEqual({ ...basket(), id: 'b', item: 'Hairdryer', amount: 2500, splitFrom: 'a' });
  });

  it('opens the part, and refuses what it cannot split', () => {
    const s = reducer(state([basket()]), { type: 'split', id: 'a', item: 'Hairdryer', pence: 2500, newId: 'b' }, TODAY);
    expect(s).toMatchObject({ screen: 'detail', selId: 'b' });
    expect(find(s, 'a').amount).toBe(3500);
    const whole = state([basket()]);
    expect(reducer(whole, { type: 'split', id: 'a', item: 'All of it', pence: 6000, newId: 'b' }, TODAY)).toBe(whole);
    const clash = state([basket(), basket({ id: 'b' })]);
    expect(reducer(clash, { type: 'split', id: 'a', item: 'x', pence: 100, newId: 'b' }, TODAY)).toBe(clash);
  });

  it('can be put back: the part gone and its money home again', () => {
    const s = reducer(state([basket()]), { type: 'split', id: 'a', item: 'Hairdryer', pence: 2500, newId: 'b' }, TODAY);
    const back = reducer(s, { type: 'unsplit', id: 'b' }, TODAY);
    expect(back.receipts).toEqual([basket()]);
    expect(back).toMatchObject({ selId: 'a' });
    // Not once the receipt it came from has gone: the money would have nowhere to go.
    const orphan = { ...s, receipts: s.receipts.filter((r) => r.id !== 'a') };
    expect(reducer(orphan, { type: 'unsplit', id: 'b' }, TODAY)).toBe(orphan);
    // Nor once either has gone back: that would rewrite a refund.
    const partBack = reducer(s, { type: 'return', id: 'b' }, TODAY);
    expect(reducer(partBack, { type: 'unsplit', id: 'b' }, TODAY).receipts).toEqual(partBack.receipts);
    const restBack = reducer(s, { type: 'return', id: 'a' }, TODAY);
    expect(reducer(restBack, { type: 'unsplit', id: 'b' }, TODAY).receipts).toEqual(restBack.receipts);
  });

  it('is carried in a backup', () => {
    const { part } = splitReceipt(basket(), 'Hairdryer', 2500, 'b');
    expect(readReceipt(JSON.parse(JSON.stringify(part)))?.splitFrom).toBe('a');
  });
});
