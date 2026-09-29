import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../src/lib/parse';
import { ORDER_EMAILS } from './fixtures/order-emails';

/**
 * Whole emails, in the layouts shops send them, read end to end. The unit
 * tests in parse.test.ts pin each rule; this asks whether the rules together
 * survive the email a person actually pastes — which is where three misreads
 * were found in one review (the Subtotal, the four-figure price, the time).
 */
const TODAY = new Date(2026, 8, 28);

describe('a corpus of order emails', () => {
  it('is not empty', () => {
    expect(ORDER_EMAILS.length).toBeGreaterThanOrEqual(10);
  });

  it.each(ORDER_EMAILS.map((e) => [e.name, e] as const))('%s', (_name, e) => {
    const out = parseReceiptText(e.text, TODAY);
    if (!out.ok) throw new Error(`did not parse: ${out.reason}`);
    const v = out.value;
    expect({ store: v.store, pence: v.amount, purchasedOn: v.purchasedOn, item: v.item }).toEqual({
      store: e.expect.store, pence: e.expect.pence, purchasedOn: e.expect.purchasedOn, item: e.expect.item,
    });
    if (e.expect.arrivedOn !== undefined) expect(v.arrivedOn).toBe(e.expect.arrivedOn);
    if (e.expect.dispatchedOn !== undefined) expect(v.dispatchedOn).toBe(e.expect.dispatchedOn);
  });
});
