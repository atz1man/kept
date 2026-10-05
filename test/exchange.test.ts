import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Detail } from '../src/app/screens/Detail';
import { reducer, type AppState } from '../src/app/state';
import { dueAlerts, supersededKeys } from '../src/lib/alerts';
import { readReceipt } from '../src/lib/backup';
import { addDays, toISODate } from '../src/lib/dates';
import { toPence } from '../src/lib/money';
import { recoveredPence, refundOf, swapInFate, swapInFateText } from '../src/lib/receipts';
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
  settings: { ...DEFAULT_SETTINGS }, alertsLate: {}, alertsSent: [],
  screen: 'detail', selId: receipts[0]?.id ?? null, obStep: 0, celebrating: null, shared: 'no', upgrading: false, store: { shelf: { kind: 'asking' }, busy: null, note: null },
  sharedText: null, embedded: false, justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null, justUnswapped: null, restored: null,
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

describe('taking a swap back', () => {
  /*
   * "Not swapped after all" removed every receipt carrying the original's id,
   * whatever had happened to it. Measured with the audit's repro: swap size 8
   * for size 9, refund the 9s (£80), and one tap on the 8s left the 8s alone
   * and active — money back £80 to £0, no undo. A chain 8 → 9 → 10 left two
   * active receipts for one £80 purchase.
   */
  const shoes = receipt('a', { item: 'Shoes', amount: toPence(80) });
  const nines = () => reducer(swap(state([shoes])), { type: 'go', screen: 'home' }, TODAY);

  it('is refused once the one that came home has gone back, and the refund stays', () => {
    const refunded = reducer(reducer(nines(), { type: 'return', id: 'swapin' }, TODAY), { type: 'go', screen: 'home' }, TODAY);
    expect(recoveredPence(refunded.receipts)).toBe(toPence(80));
    const tapped = reducer(refunded, { type: 'unexchange', id: 'a' }, TODAY);
    expect(tapped.receipts).toEqual(refunded.receipts);
    expect(find(tapped, 'swapin')).toMatchObject({ status: 'returned', returnedOn: toISODate(TODAY) });
    expect(recoveredPence(tapped.receipts)).toBe(toPence(80));
    // And the screen says why, from the same function the reducer refused with.
    const fate = swapInFate(tapped.receipts, 'a');
    expect(fate).toMatchObject({ fate: 'returned', swapIn: { id: 'swapin' } });
    expect(swapInFateText(fate!.fate)).toBe(
      'The one you swapped it for has gone back since. To take this swap back, undo that on its own receipt first.',
    );
  });

  it('is refused for a swap of a swap, so one purchase never becomes two in hand', () => {
    const chain = reducer(nines(), { type: 'exchange', id: 'swapin', newId: 'tens' }, TODAY);
    const tapped = reducer(chain, { type: 'unexchange', id: 'a' }, TODAY);
    expect(tapped.receipts).toEqual(chain.receipts);
    expect(tapped.receipts.filter((r) => r.status === 'active').map((r) => r.id)).toEqual(['tens']);
    expect(swapInFate(tapped.receipts, 'a')?.fate).toBe('swapped');
    // Unwound one at a time, from the newest, it comes back to the 8s alone.
    const unwound = reducer(reducer(chain, { type: 'unexchange', id: 'swapin' }, TODAY), { type: 'unexchange', id: 'a' }, TODAY);
    expect(unwound.receipts).toEqual([shoes]);
  });

  it('is refused while the one that came home is posted, kept, split or written about', () => {
    const posted = reducer(nines(), { type: 'send', id: 'swapin' }, TODAY);
    expect(reducer(posted, { type: 'unexchange', id: 'a' }, TODAY)).toBe(posted);
    const kept = reducer(nines(), { type: 'keep', id: 'swapin' }, TODAY);
    expect(reducer(kept, { type: 'unexchange', id: 'a' }, TODAY)).toBe(kept);
    const split = reducer(nines(), { type: 'split', id: 'swapin', item: 'Laces', pence: toPence(5), newId: 'laces' }, TODAY);
    expect(reducer(split, { type: 'unexchange', id: 'a' }, TODAY)).toBe(split);
    const letter = reducer(nines(), { type: 'fault-sent', id: 'swapin', what: 'sole came away' }, TODAY);
    expect(reducer(letter, { type: 'unexchange', id: 'a' }, TODAY)).toBe(letter);
    // An online order's notice of cancellation, sent about the second pair.
    const online = reducer(reducer(state([{ ...shoes, distance: true }]), { type: 'exchange', id: 'a', newId: 'swapin' }, TODAY), { type: 'go', screen: 'home' }, TODAY);
    const cancelled = reducer(online, { type: 'cancel-sent', id: 'swapin' }, TODAY);
    expect(find(cancelled, 'swapin').cancelledOn).toBe(toISODate(TODAY));
    expect(reducer(cancelled, { type: 'unexchange', id: 'a' }, TODAY)).toBe(cancelled);
  });

  it('is offered back from the bar when it does go through, and the undo puts both back as they were', () => {
    const before = nines();
    const edited = reducer(before, { type: 'update', receipt: { ...find(before, 'swapin'), item: 'Shoes, size 9' } }, TODAY);
    const back = reducer(edited, { type: 'unexchange', id: 'a' }, TODAY);
    expect(back.receipts.map((r) => r.id)).toEqual(['a']);
    expect(back.justUnswapped).toMatchObject({ id: 'a', returnedOn: toISODate(TODAY) });
    const undone = reducer(back, { type: 'undo-unswap' }, TODAY);
    expect(undone.receipts).toEqual(edited.receipts);
    expect(undone.justUnswapped).toBeNull();
  });

  it('does not add the one that came home twice, if another tab already put it back', () => {
    const before = nines();
    const back = reducer(before, { type: 'unexchange', id: 'a' }, TODAY);
    const synced = { ...back, receipts: [...back.receipts, find(before, 'swapin')] };
    const undone = reducer(synced, { type: 'undo-unswap' }, TODAY);
    expect(undone.receipts.filter((r) => r.id === 'swapin')).toHaveLength(1);
  });

  it('is not undone over something done to the original since', () => {
    const back = reducer(nines(), { type: 'unexchange', id: 'a' }, TODAY);
    const kept = reducer(back, { type: 'keep', id: 'a' }, TODAY);
    const undone = reducer(kept, { type: 'undo-unswap' }, TODAY);
    expect(undone.receipts).toEqual(kept.receipts);
    expect(undone.justUnswapped).toBeNull();
  });

  it('holds one undo at a time, like every other bar', () => {
    const back = reducer(nines(), { type: 'unexchange', id: 'a' }, TODAY);
    expect(reducer(back, { type: 'dismiss-undo' }, TODAY).justUnswapped).toBeNull();
    expect(reducer(back, { type: 'go', screen: 'home' }, TODAY).justUnswapped).toBeNull();
    expect(reducer(back, { type: 'delete', id: 'a' }, TODAY).justUnswapped).toBeNull();
  });
});

describe('the original’s screen, when the swap cannot be taken back', () => {
  // Rendered, not read: the button is replaced by the reason, so it is never
  // offered for a tap the reducer would refuse.
  const noop = () => {};
  const screen = (swapBlocked: { text: string; onOpen: () => void } | null) =>
    renderToStaticMarkup(createElement(Detail, {
      receipt: receipt('a', { status: 'returned', returnedOn: toISODate(TODAY), exchanged: true }),
      today: TODAY, urgentDays: 7, onBack: noop, onEdit: noop, onPack: noop, onReturn: noop, onUnreturn: noop,
      onExchange: noop, onUnexchange: noop, swapBlocked, onKeep: noop, onUnkeep: noop, onSend: noop, onUnsend: noop, onSetRefund: noop,
      onSetReturnRef: noop, onSetCredit: noop, onCreditSpent: noop, onFaultSent: noop, onFaultUnsent: noop, onCancelSent: noop,
      onCancelUnsent: noop, onArrived: noop, onDelete: noop, onSplit: noop, onUnsplit: null, splitFromReceipt: null,
    })).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  it('says why, with the way to the other receipt, and offers no button', () => {
    const said = screen({ text: swapInFateText('returned'), onOpen: noop });
    expect(said).toContain('The one you swapped it for has gone back since.');
    expect(said).toContain('Open that receipt');
    expect(said).not.toContain('Not swapped after all');
  });

  it('offers the button when it can be taken back', () => {
    expect(screen(null)).toContain('Not swapped after all');
  });
});
