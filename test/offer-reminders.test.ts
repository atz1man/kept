import { describe, expect, it } from 'vitest';
import { offerReminders } from '../src/app/notify';
import { toPence } from '../src/lib/money';
import type { Receipt } from '../src/lib/types';

/*
 * The card that explains reminders before iOS asks — which it does once and
 * never again. It used to arrive unannounced the moment the first real
 * receipt was saved.
 */
const mine: Receipt = {
  id: 'r', store: 'Argos', item: 'Mixer', cat: 'kitchen', amount: toPence(249.99),
  purchasedOn: '2026-09-27', windowDays: 30, policy: 'p', distance: true, status: 'active',
};
const base = { native: true, alertsOn: true, explained: false, permission: 'default' as const, receipts: [mine] };

describe('offering to explain reminders', () => {
  it('offers once a real receipt with a deadline exists, before iOS has been asked', () => {
    expect(offerReminders(base)).toBe(true);
  });

  it('waits for something real to remind about', () => {
    expect(offerReminders({ ...base, receipts: [{ ...mine, demo: true }] })).toBe(false);
    expect(offerReminders({ ...base, receipts: [{ ...mine, status: 'returned' }] })).toBe(false);
    expect(offerReminders({ ...base, receipts: [] })).toBe(false);
  });

  it('is not offered on the web, with alerts off, once answered, or once iOS has answered', () => {
    expect(offerReminders({ ...base, native: false })).toBe(false);
    expect(offerReminders({ ...base, alertsOn: false })).toBe(false);
    expect(offerReminders({ ...base, explained: true })).toBe(false);
    expect(offerReminders({ ...base, permission: 'granted' })).toBe(false);
    expect(offerReminders({ ...base, permission: 'denied' })).toBe(false);
    // Not yet read from the bridge: say nothing rather than guess.
    expect(offerReminders({ ...base, permission: null })).toBe(false);
  });
});
