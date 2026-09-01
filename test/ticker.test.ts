import { describe, expect, it } from 'vitest';
import { tickerLines } from '../src/landing/ticker';
import { STORE_POLICIES, findStore } from '../src/lib/stores';
import { seedUpdates } from '../src/lib/seed';
import { fromISODate, relativeAgo } from '../src/lib/dates';

/**
 * The scrolling bar on the landing page restates the table and the feed, and
 * it used to do it from memory: five literals in `placeholder-content.ts`,
 * exempted from that module's "nothing here is measured" warning on the
 * grounds that they were real. Nothing held them to what they were quoting,
 * and the README's own pre-ship task is to change every window in the table.
 */
const TODAY = new Date(2026, 7, 28);

describe('the landing ticker', () => {
  const lines = tickerLines(TODAY);

  it('says as many things as the bar has room for', () => {
    expect(lines.length).toBe(5);
    expect(lines.every((l) => l.trim().length > 0)).toBe(true);
  });

  it('quotes each window from the table, not from memory', () => {
    for (const name of ['ASOS', 'Apple']) {
      const line = lines.find((l) => l.startsWith(`${name.toUpperCase()}:`));
      expect(line).toBeDefined();
      expect(line).toContain(String(findStore(name)!.windowDays));
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

  it('dates the newest change off the feed’s own date', () => {
    // The literal said "2 days ago" and would have gone on saying it. The
    // phrase is computed from the entry, in the app's own compact form.
    const newest = seedUpdates(TODAY)[0];
    expect(lines[0]).toContain(newest.store.toUpperCase());
    expect(lines[0]).toContain(relativeAgo(fromISODate(newest.changedOn), TODAY));
    expect(lines[0]).not.toContain('2 days ago');
  });

  it('reports whichever entry the feed puts newest', () => {
    // Not "Zara" because Zara was typed here once: the store named is
    // whatever the feed's first entry is, and every other entry names a
    // different shop, so aiming at the wrong one would show.
    const feed = seedUpdates(TODAY);
    expect(new Set(feed.map((u) => u.store)).size).toBe(feed.length);
    expect(lines[0].startsWith(feed[0].store.toUpperCase())).toBe(true);
  });

  it('names only shops that are actually in the table', () => {
    /*
     * The three the module quotes by literal, which is the coupling that rots:
     * whoever does the README's pre-ship pass over all twenty windows could
     * rename or drop one of these, and the bar would fall back to a silent
     * default — "ASOS: 0-day window for frequent returners" on the page whose
     * entire claim is that kept knows the real numbers.
     */
    for (const name of ['ASOS', 'Apple', 'Uniqlo']) {
      expect(findStore(name), name).toBeDefined();
    }
  });

  it('never prints a fallback where a window should be', () => {
    expect(lines.some((l) => /\b0[- ]day\b/.test(l))).toBe(false);
  });

  it('puts an actual gotcha after UNIQLO, not just the label', () => {
    // `gotchaOf` falls back to an empty string, and "every line is non-empty"
    // is satisfied by the word UNIQLO alone.
    const line = lines.find((l) => l.startsWith('UNIQLO:'))!;
    expect(line.replace('UNIQLO:', '').trim().length).toBeGreaterThan(10);
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
