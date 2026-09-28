import { describe, expect, it } from 'vitest';
import { tickerLines } from '../src/landing/ticker';
import { STORE_POLICIES, findStore } from '../src/lib/stores';
import { REJECT_DAYS } from '../src/lib/legal';

/**
 * The scrolling bar on the landing page restates the table and the feed, and
 * it used to do it from memory: five literals in `placeholder-content.ts`,
 * exempted from that module's "nothing here is measured" warning on the
 * grounds that they were real. Nothing held them to what they were quoting,
 * and the README's own pre-ship task is to change every window in the table.
 */
describe('the landing ticker', () => {
  const lines = tickerLines();

  it('says as many things as the bar has room for', () => {
    expect(lines.length).toBe(5);
    expect(lines.every((l) => l.trim().length > 0)).toBe(true);
  });

  it('quotes a window, and where it starts, from the table', () => {
    const asos = findStore('ASOS')!;
    const line = lines.find((l) => l.startsWith('ASOS:'));
    expect(line).toBeDefined();
    expect(line).toContain(`${asos.windowDays} days`);
    expect(line).toContain(asos.clockStart === 'purchase' ? 'the day you buy' : asos.clockStart);
  });

  it('quotes the statute from legal.ts', () => {
    expect(lines.some((l) => l.includes(`${REJECT_DAYS} days to reject`))).toBe(true);
  });

  it('reports no policy change', () => {
    /*
     * Two lines were sample changes stated as news: "ZARA changed its returns
     * policy 2 days ago — kept already updated", two days old on whatever day
     * the page was opened, and "APPLE: 14-day window confirmed for iPhone 18".
     * Nobody had checked either against the retailer (APN-84). The bar says
     * what the table and the law say, and nothing that happened.
     */
    for (const line of lines) {
      expect(line, line).not.toMatch(/\bchanged\b|\bconfirmed\b|\bago\b|already updated|iPhone/i);
    }
  });

  it('claims nothing beats a window only of the longest one there is', () => {
    // "IKEA: 365 days, still unbeaten" singled IKEA out while Decathlon
    // matches it at 365 in kept's own list.
    const max = Math.max(...STORE_POLICIES.map((s) => s.windowDays));
    const line = lines.find((l) => /beats it/.test(l));
    expect(line).toBeDefined();
    expect(line).toContain(String(max));
    const named = STORE_POLICIES.find((s) => line!.startsWith(`${s.name.toUpperCase()}:`));
    expect(named?.windowDays).toBe(max);
  });

  it('names only shops that are actually in the table', () => {
    /*
     * The three the module quotes by literal, which is the coupling that rots:
     * whoever does the README's pre-ship pass over all twenty windows could
     * rename or drop one of these, and the bar would fall back to a silent
     * default — "ASOS: 0 days from delivery" on the page whose
     * entire claim is that kept knows the real numbers.
     */
    for (const name of ['ASOS', 'Zara', 'Uniqlo']) {
      expect(findStore(name), name).toBeDefined();
    }
  });

  it('never prints a fallback where a window should be', () => {
    expect(lines.some((l) => /\b0[- ]days?\b/.test(l))).toBe(false);
  });

  it('puts an actual gotcha after UNIQLO, not just the label', () => {
    // `gotchaOf` falls back to an empty string, and "every line is non-empty"
    // is satisfied by the word UNIQLO alone.
    for (const shop of ['UNIQLO', 'ZARA']) {
      const line = lines.find((l) => l.startsWith(`${shop}:`))!;
      expect(line.replace(`${shop}:`, '').trim().length, shop).toBeGreaterThan(10);
    }
  });

  it('does not name a shop twice in one line', () => {
    // The Uniqlo line is built from a gotcha that opens with "Uniqlo", after
    // a bar that has already said UNIQLO.
    for (const line of lines) {
      for (const s of STORE_POLICIES) {
        const hits = line.toLowerCase().split(s.name.toLowerCase()).length - 1;
        expect(hits, `${s.name} in "${line}"`).toBeLessThan(2);
      }
    }
  });
});
