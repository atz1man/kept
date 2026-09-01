import { describe, expect, it } from 'vitest';
import { toISODate } from '../src/lib/dates';
import { derive } from '../src/lib/receipts';
import { seedReceipts } from '../src/lib/seed';
import { SEARCH_APPEARS_ABOVE, shouldOfferSearch } from '../src/lib/search';
import { DEFAULT_URGENT_DAYS } from '../src/lib/urgency';
import { legalRights } from '../src/lib/legal';

/**
 * The demo library, held to what it is FOR rather than to its dates.
 *
 * Twenty-four of seed.ts's twenty-nine mutants survived the suite, and that is
 * the right result for most of them: the exact number of days ago a demo
 * receipt was bought is arbitrary, and a test asserting it would pin a decision
 * nobody made. What is NOT arbitrary is that a fresh install opens on a screen
 * that demonstrates the product — one deadline close enough to be alarming, one
 * comfortably far off, the dispatch gotcha, a warranty, and a purchase carrying
 * both statutory rights. Drift any of those dates far enough and the first
 * screen anybody ever sees stops showing what it was built to show, silently.
 *
 * So the properties are asserted and the numbers are not.
 */
const TODAY = new Date(2026, 7, 28);
const seeded = () => seedReceipts(TODAY);
const days = (id: string) => derive(seeded().find((r) => r.id === id)!, TODAY).daysLeft;

describe('the library a fresh install opens on', () => {
  it('is every one of them a demo, so nothing here counts against the free tier', () => {
    expect(seeded().every((r) => r.demo === true)).toBe(true);
    expect(seeded().length).toBeGreaterThan(0);
  });

  it('shows no search box, because a list this short does not need one', () => {
    // Ties the seed's size to the threshold in search.ts. Neither number is
    // pinned; the relationship between them is what matters, and it is the
    // reason a first launch is not cluttered with furniture.
    expect(seeded().length).toBeLessThanOrEqual(SEARCH_APPEARS_ABOVE);
    expect(shouldOfferSearch(seeded())).toBe(false);
  });

  it('opens with nothing already lost', () => {
    // A demo set whose first row reads "window closed" teaches the app is for
    // regret rather than for acting in time.
    expect(seeded().every((r) => derive(r, TODAY).daysLeft >= 0)).toBe(true);
  });

  it('has one close enough to be urgent and one comfortably far off', () => {
    const left = seeded().map((r) => derive(r, TODAY).daysLeft);
    expect(left.some((d) => d >= 0 && d <= DEFAULT_URGENT_DAYS)).toBe(true);
    expect(left.some((d) => d > DEFAULT_URGENT_DAYS * 2)).toBe(true);
  });

  it('carries the dispatch gotcha as data, not as prose', () => {
    /*
     * Zara counts from dispatch, and the seeded order was placed before the
     * parcel left — which is what makes the detail screen's warning TRUE rather
     * than decorative. Move that date onto the purchase date and the warning
     * stays on screen describing nothing.
     */
    const zara = seeded().find((r) => r.id === 'seed_zara')!;
    expect(zara.windowStartsOn).toBeTruthy();
    expect(zara.windowStartsOn).not.toBe(zara.purchasedOn);
    // And the engine counts from the later date, which is the whole point.
    expect(toISODate(derive(zara, TODAY).windowStart)).toBe(zara.windowStartsOn);
  });

  it('includes a purchase that carries BOTH statutory rights', () => {
    // Only a distance purchase does, and only one seeded receipt is one — which
    // is what makes the two-right case reachable from a fresh install.
    const distance = seeded().filter((r) => r.distance);
    expect(distance).toHaveLength(1);
    expect(legalRights(distance[0], TODAY, true).map((r) => r.chip))
      .toEqual(expect.arrayContaining(['Consumer Rights Act', 'Consumer Contracts Regs']));
  });

  it('includes a warranty, so that clock is visible too', () => {
    expect(seeded().some((r) => (r.warranty?.months ?? 0) > 0)).toBe(true);
  });

  it('keeps the urgent one urgent and the far one far, at the dates it ships with', () => {
    // Two anchors rather than five: enough that a wholesale shuffle of the
    // dates is caught, few enough that adjusting one demo receipt is not a
    // test failure for its own sake.
    expect(days('seed_currys')).toBeLessThanOrEqual(DEFAULT_URGENT_DAYS);
    expect(days('seed_ikea')).toBeGreaterThan(100);
  });
});
