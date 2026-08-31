import { describe, expect, it } from 'vitest';
import { FEATURED_TIER, TIERS } from '../src/lib/pricing';

/**
 * The tier every upsell points at.
 *
 * `TIERS.find((t) => t.featured) ?? TIERS[0]` — the fallback index was the only
 * mutation this file had and it survived, because the fallback is unreachable
 * while exactly one tier is featured. Which is the property worth asserting:
 * TWO featured tiers would make `find` pick whichever came first and the
 * fallback would still never run, so the mutation would stay invisible while
 * the page grew a second highlighted price.
 */
describe('the tier the app points at', () => {
  it('is exactly one of them, which is what makes the fallback unreachable', () => {
    expect(TIERS.filter((t) => t.featured)).toHaveLength(1);
  });

  it('is the one found, not the one at the front of the list', () => {
    // Only meaningful because the featured tier is NOT first: if it were, this
    // would pass whether `find` worked or not.
    expect(TIERS[0].featured).not.toBe(true);
    expect(FEATURED_TIER).toBe(TIERS.find((t) => t.featured));
  });

  it('offers a way to pay once, and says the price of each', () => {
    expect(TIERS.map((t) => t.period)).toContain('lifetime');
    expect(TIERS.every((t) => /^£\d/.test(t.price))).toBe(true);
  });
});
