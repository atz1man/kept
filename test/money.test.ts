import { describe, expect, it } from 'vitest';
import { fromPence, money, sumPence, toPence } from '../src/lib/money';

describe('money', () => {
  it('always shows two decimals', () => {
    expect(money(8900)).toBe('£89.00');
    expect(money(6499)).toBe('£64.99');
    expect(money(0)).toBe('£0.00');
    expect(money(5)).toBe('£0.05');
  });

  it('groups thousands', () => {
    expect(money(140000)).toBe('£1,400.00');
  });

  it('renders a negative amount with the sign outside the symbol', () => {
    expect(money(-1250)).toBe('-£12.50');
  });

  it('converts pounds to pence without float drift', () => {
    /*
     * The amounts here are chosen because they DRIFT. 24.98 * 100 is exactly
     * 2498 in floating point and so were the other three this test used to
     * carry — which meant it passed with the rounding replaced by truncation,
     * the one defect the file's header exists to describe.
     *
     * These do not: 0.29 * 100 is 28.999999999999996, 19.99 is
     * 1998.9999999999998, 129.95 is 12994.999999999998. Truncating any of them
     * loses a penny off a price of the shape most receipts actually carry.
     */
    expect(toPence(0.29)).toBe(29);
    expect(toPence(1.15)).toBe(115);
    expect(toPence(19.99)).toBe(1999);
    expect(toPence(129.95)).toBe(12995);
    expect(toPence(24.98)).toBe(2498);
    expect(toPence(0.1) + toPence(0.2)).toBe(30);
    expect(fromPence(2498)).toBe(24.98);
  });

  it('loses nothing over a list of prices that each drift', () => {
    // A penny per receipt is invisible on one row and is the whole claim on a
    // total: "still returnable" is a number this app asks people to trust.
    const prices = [0.29, 1.15, 19.99, 129.95, 4.99, 12.45];
    expect(money(sumPence(prices.map(toPence)))).toBe('£168.82');
  });

  it('sums a list exactly — the reason amounts are integers at all', () => {
    const items = Array.from({ length: 100 }, () => toPence(0.1));
    expect(money(sumPence(items))).toBe('£10.00');
  });
});
