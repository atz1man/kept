import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Detail } from '../src/app/screens/Detail';
import { addDays, toISODate } from '../src/lib/dates';
import { toPence } from '../src/lib/money';
import type { Receipt } from '../src/lib/types';

/**
 * A receipt sent back or kept stops counting down, and its window is named in
 * the tense the calendar is in. It read "The window ran to 8 Nov" three
 * weeks before 8 November — found by marking a fresh receipt sent back.
 */
const TODAY = new Date(2026, 9, 18);
const iso = (n: number) => toISODate(addDays(TODAY, n));
const noop = () => {};
const screen = (r: Receipt) =>
  renderToStaticMarkup(createElement(Detail, {
    receipt: r, today: TODAY, urgentDays: 7, onBack: noop, onEdit: noop, onPack: noop, onReturn: noop, onUnreturn: noop,
    onExchange: noop, onUnexchange: noop, swapBlocked: null, onKeep: noop, onUnkeep: noop, onSend: noop, onUnsend: noop, onSetRefund: noop,
    onSetReturnRef: noop, onSetCredit: noop, onCreditSpent: noop, onFaultSent: noop, onFaultUnsent: noop, onFinalRejectSent: noop, onFinalRejectUnsent: noop, onCancelSent: noop,
    onCancelUnsent: noop, onArrived: noop, onDelete: noop, onSplit: noop, onUnsplit: null, splitFromReceipt: null,
  })).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const sent = (boughtAgo: number): Receipt => ({
  id: 'r', store: 'Zara', item: 'Jumper', cat: 'clothing', amount: toPence(30),
  purchasedOn: iso(-boughtAgo), windowDays: 30, policy: 'p', distance: false, status: 'sent', sentOn: iso(0),
});

describe('a settled receipt’s window, in the right tense', () => {
  it('runs to a day still ahead', () => {
    const page = screen(sent(9));
    expect(page).toContain('The window runs to');
    expect(page).not.toContain('The window ran to');
  });

  it('ran to a day already gone', () => {
    const page = screen(sent(40));
    expect(page).toContain('The window ran to');
    expect(page).not.toContain('The window runs to');
  });
});
