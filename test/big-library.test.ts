import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addDays, addMonths, daysBetween, fmtDate, fmtDateLong, toISODate } from '../src/lib/dates';
import { coverLine, derive } from '../src/lib/receipts';
import type { Receipt } from '../src/lib/types';
import { ActiveRow, KeepingRow, MoneyBackRow, SentRow } from '../src/app/screens/Home';

/**
 * A library of years, not weeks.
 *
 * Somebody who files every online order has 500 to 3,000 receipts after a few
 * years, most of them settled, a third carrying a guarantee. Measured on main
 * with 3,000 such receipts and the CPU slowed four times (a mid-range phone):
 * the first letter typed into the search box took 1.4 s to appear, a later
 * one up to 490 ms, and typing "kettle" at a key every 200 ms took 3.3 s to
 * show the answer. Three things were doing work nobody saw:
 *
 *  - every date on a row was formatted by `toLocaleDateString`, which builds
 *    a new formatter per call — 69 µs each, so the Keeping list's "covered
 *    until" lines cost more than the rest of the row;
 *  - a guarantee's "2y 3m" was found by counting up a month at a time from
 *    nought, so `derive` cost seventy-two steps for a six-year guarantee, on
 *    every pass over the library;
 *  - Home rendered every row again on every keystroke, and showed the letter
 *    only once the list under it had been redrawn.
 *
 * What is held here is what can be held without a browser. The browser half
 * was measured by hand and is in the commit that added this file.
 */

const TODAY = new Date(2026, 7, 28);

function receipt(over: Partial<Receipt> = {}): Receipt {
  return {
    id: 'r1', store: 'Currys', item: 'Dishwasher', cat: 'kitchen',
    amount: 34_900, purchasedOn: toISODate(TODAY), windowDays: 30,
    policy: 'p', distance: false, status: 'kept',
    ...over,
  };
}

/** How the label was found before: a month at a time from nought. */
function labelByCountingUp(today: Date, ends: Date): string {
  const days = daysBetween(today, ends);
  if (days < 0) return '';
  if (days < 45) return `${days} ${days === 1 ? 'day' : 'days'}`;
  let months = 0;
  while (addMonths(today, months + 1).getTime() <= ends.getTime()) months += 1;
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (rest === 0) return `${years} ${years === 1 ? 'year' : 'years'}`;
  return `${years}y ${rest}m`;
}

/** Every `new Date` made while `run` runs. */
function datesMade(run: () => void): number {
  const Real = Date;
  let made = 0;
  globalThis.Date = class extends Real {
    constructor(...args: []) {
      super(...args);
      made += 1;
    }
  } as DateConstructor;
  try {
    run();
  } finally {
    globalThis.Date = Real;
  }
  return made;
}

describe('a guarantee’s remaining cover', () => {
  it('reads the same as counting a month at a time, on every day of four years', () => {
    // Month ends, a leap day and a mid-month day, because those are where a
    // month's arithmetic differs from a calendar's; lengths either side of a
    // year, and the longest a shop quotes.
    const bought = ['2026-01-31', '2026-03-30', '2026-06-15', '2024-02-29'];
    const lengths = [2, 13, 24, 72];
    let compared = 0;
    for (let day = 0; day < 4 * 366; day += 1) {
      // Late in the evening on odd days: `today` is not always a midnight.
      const today = addDays(new Date(2024, 1, 1), day);
      if (day % 2) today.setHours(23, 30);
      for (const purchasedOn of bought) {
        for (const months of lengths) {
          const w = derive(receipt({ purchasedOn, warranty: { months } }), today).warranty!;
          expect(w.label, `${purchasedOn} + ${months}m, on ${toISODate(today)}`).toBe(labelByCountingUp(today, w.ends));
          if (w.label) compared += 1;
        }
      }
    }
    // Most of these are still running: a sweep of expired guarantees would
    // compare empty strings and pass.
    expect(compared).toBeGreaterThan(10_000);
  });

  it('costs no more for six years than for one', () => {
    /*
     * Counted, not timed, so it says the same on any machine. On main a
     * six-year guarantee bought today made 233 Dates in `derive` and a
     * one-year one 53 — three for every month counted. Now both make 20,
     * however long the cover.
     */
    const made = (months: number) => datesMade(() => derive(receipt({ warranty: { months } }), TODAY));
    expect(made(12)).toBeGreaterThan(0);
    expect(made(72)).toBeLessThanOrEqual(made(12) + 3);
    expect(made(72)).toBeLessThan(30);
  });
});

describe('dates on a row', () => {
  it('print exactly what toLocaleDateString printed', () => {
    const start = new Date(2024, 0, 1);
    for (let i = 0; i < 3 * 366; i += 1) {
      const d = addDays(start, i);
      // And at a time of day, not only at midnight.
      if (i % 3 === 0) d.setHours(23, 59);
      expect(fmtDate(d)).toBe(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
      expect(fmtDateLong(d)).toBe(d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
    }
    // A year the two-digit rule of Date.UTC would move to the 1900s.
    const early = new Date(2026, 1, 28);
    early.setFullYear(26);
    expect(fmtDateLong(early)).toBe(early.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
    // An invalid date says so, as it did, rather than throwing from inside a render.
    expect(fmtDate(new Date(Number.NaN))).toBe('Invalid Date');
    expect(fmtDateLong(new Date(Number.NaN))).toBe('Invalid Date');
  });

  it('format three thousand in a moment', () => {
    /*
     * Measured: 3,000 dates in each form took 190–260 ms apiece on main
     * (a new Intl.DateTimeFormat per call) and 3–10 ms with one formatter
     * made once. The bound is ten times the fixed figure and under half of
     * main's, so it fails on the slow version and not on a slow machine.
     */
    const days = Array.from({ length: 3_000 }, (_, i) => addDays(new Date(2024, 0, 1), i));
    const started = performance.now();
    for (const d of days) {
      fmtDate(d);
      fmtDateLong(d);
    }
    expect(performance.now() - started).toBeLessThan(100);
    // The Keeping list's line, which is where a search put three thousand of them.
    expect(coverLine(receipt({ warranty: { months: 24 } }), TODAY)).toBe(`covered until ${fmtDate(addMonths(TODAY, 24))} 2028`);
  });
});

describe('Home’s rows while somebody types', () => {
  const home = readFileSync(join(__dirname, '..', 'src', 'app', 'screens', 'Home.tsx'), 'utf8');

  it('are memoised, so a row whose receipt has not changed is not drawn again', () => {
    for (const row of [ActiveRow, SentRow, MoneyBackRow, KeepingRow]) {
      expect((row as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for('react.memo'));
    }
  });

  it('are handed Home’s own callbacks, not an arrow made per row per render', () => {
    // An arrow made in the map is a new prop every render, and memo compares
    // props: it would draw every row again and look as if it did not.
    const uses = [...home.matchAll(/<(ActiveRow|SentRow|MoneyBackRow|KeepingRow)\b([\s\S]*?)\/>/g)];
    expect(uses.map((u) => u[1]).sort()).toEqual(['ActiveRow', 'ActiveRow', 'ActiveRow', 'ActiveRow', 'KeepingRow', 'MoneyBackRow', 'SentRow']);
    for (const [, name, props] of uses) expect(props, name).not.toMatch(/=>/);
  });

  it('show the letter typed before the list under it is redrawn', () => {
    // The box reads what was typed; everything else reads the deferred copy.
    // `query` anywhere else would put the list back in the keystroke's way.
    // Comments out first: the prose about the box says "query" too.
    const code = home.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const reads = code.split('\n').filter((line) => /\bquery\b/.test(line)).map((line) => line.trim());
    expect(reads).toEqual([
      "const [query, setQuery] = useState('');",
      'const shown = useDeferredValue(query);',
      'value={query}',
    ]);
    // And the render that shows the letter does not search and sort the
    // library again for a list it is not about to change.
    expect(code).toMatch(/useMemo\(\(\) => \(searching \? search\(receipts, shown\) : receipts\), \[searching, receipts, shown\]\)/);
    expect(code).toMatch(/useMemo\(\(\) => bucket\(visible, today, urgentDays\), \[visible, today, urgentDays\]\)/);
  });
});
