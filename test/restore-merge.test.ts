import { describe, expect, it } from 'vitest';
import { reducer, type Action, type AppState } from '../src/app/state';
import { mergeBackup, parseBackup, restoredNote } from '../src/lib/backup';
import { toPence } from '../src/lib/money';
import { bucket, recoveredPence, stillReturnablePence } from '../src/lib/receipts';
import { DEFAULT_SETTINGS, exportBackup } from '../src/lib/storage';
import type { Receipt } from '../src/lib/types';

/*
 * Restoring an older backup onto a phone that has moved on since.
 *
 * Measured before the fix, with the audit's repro and these same steps:
 * Monday export; Tuesday split a £20 lamp off a £60 basket, take £30 of a £60
 * coat back as store credit, swap some shoes; Wednesday restore Monday's file.
 * "Still returnable" went from £140 to £160 (the basket back to £60, beside
 * its £20 part), "money back" from £30 to £140 (the partial refund read as a
 * full one, the swap as an £80 refund), and the credit's expiry was gone —
 * under "0 restored · 3 updated. Nothing already here was lost."
 */

const TODAY = new Date(2026, 9, 4);
const r = (id: string, item: string, amount: number): Receipt => ({
  id, store: 'Argos', item, cat: 'other', amount, purchasedOn: '2026-09-20', windowDays: 30,
  policy: 'Argos · 30-day return window', distance: true, status: 'active',
});
const start = (receipts: Receipt[]): AppState => ({
  version: 1, receipts, updates: [], onboardingSeen: true, settings: { ...DEFAULT_SETTINGS }, alertsLate: {}, reviewAsked: null, alertsSent: [],
  screen: 'settings', selId: null, obStep: 0, celebrating: null, shared: 'no', upgrading: false,
  store: { shelf: { kind: 'asking' }, busy: null, note: null },
  sharedText: null, embedded: false, justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null,
  justUnswapped: null, restored: null,
});
const run = (s: AppState, ...actions: Action[]) => actions.reduce((x, a) => reducer(x, a, TODAY), s);
const totals = (rs: readonly Receipt[]) => ({
  returnable: stillReturnablePence(bucket(rs, TODAY, 7), rs),
  back: recoveredPence(rs),
});
const find = (rs: readonly Receipt[], id: string) => rs.find((x) => x.id === id);

const monday = start([r('basket', 'Basket', toPence(60)), r('coat', 'Coat', toPence(60)), r('shoes', 'Shoes', toPence(80))]);
const mondayFile = exportBackup(monday);
const tuesday = run(
  monday,
  { type: 'split', id: 'basket', item: 'Lamp', pence: toPence(20), newId: 'lamp' },
  { type: 'return', id: 'coat' },
  { type: 'set-refund', id: 'coat', pence: toPence(30) },
  { type: 'set-credit', id: 'coat', credit: { expires: '2027-01-31' } },
  { type: 'exchange', id: 'shoes', newId: 'shoes2' },
  { type: 'go', screen: 'settings' },
);
const parsed = (() => {
  const out = parseBackup(mondayFile);
  if (!out.ok) throw new Error(out.reason);
  return out.summary;
})();

describe('restoring an older backup', () => {
  it('is set up as measured: £140 still returnable and £30 back on Tuesday', () => {
    expect(totals(tuesday.receipts)).toEqual({ returnable: toPence(140), back: toPence(30) });
  });

  it('changes no money the device recorded since — not the totals, not the basket, not its part', () => {
    const { receipts } = mergeBackup(tuesday.receipts, parsed.receipts);
    expect(totals(receipts)).toEqual({ returnable: toPence(140), back: toPence(30) });
    expect(find(receipts, 'basket')?.amount).toBe(toPence(40));
    expect(find(receipts, 'lamp')?.amount).toBe(toPence(20));
    expect(find(receipts, 'coat')).toMatchObject({ refunded: toPence(30), credit: { expires: '2027-01-31' } });
    expect(find(receipts, 'shoes')?.exchanged).toBe(true);
    expect(receipts).toEqual(tuesday.receipts);
  });

  it('is merged by the reducer, against the receipts it lands on, and says what it did truthfully', () => {
    const after = run(tuesday, { type: 'restore', backup: parsed });
    expect(after.receipts).toEqual(tuesday.receipts);
    expect(totals(after.receipts)).toEqual({ returnable: toPence(140), back: toPence(30) });
    expect(after.restored).toEqual({ added: 0, alreadyHere: 3, skipped: 0 });
    expect(restoredNote(after.restored!)).toBe('0 restored · 3 already here. Nothing already here was changed.');
  });

  it('still brings back a receipt deleted since, whole, beside everything recorded since', () => {
    // The case a restore exists for, and the one this must not cost.
    const wednesday = run(tuesday, { type: 'delete', id: 'lamp' }, { type: 'go', screen: 'settings' }, { type: 'delete', id: 'basket' }, { type: 'go', screen: 'settings' });
    const after = run(wednesday, { type: 'restore', backup: parsed });
    // Monday's basket, as Monday had it: the device no longer holds one to contradict it.
    expect(find(after.receipts, 'basket')?.amount).toBe(toPence(60));
    expect(find(after.receipts, 'coat')).toMatchObject({ refunded: toPence(30), credit: { expires: '2027-01-31' } });
    expect(after.restored).toEqual({ added: 1, alreadyHere: 2, skipped: 0 });
  });

  it('keeps a change that landed while the file was being read', () => {
    // The screen used to merge the receipts it had rendered with, after an
    // await, and dispatch the result: a refund adopted from another tab in
    // that gap was overwritten by the list from before it.
    const meanwhile = run(tuesday, { type: 'return', id: 'lamp' }, { type: 'go', screen: 'settings' });
    const after = run(meanwhile, { type: 'restore', backup: parsed });
    expect(find(after.receipts, 'lamp')?.status).toBe('returned');
  });

  it('is said once, where it happened', () => {
    const after = run(tuesday, { type: 'restore', backup: parsed }, { type: 'go', screen: 'home' });
    expect(after.restored).toBeNull();
  });
});
