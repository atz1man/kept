import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHECKED_ON, STORE_POLICIES } from '../src/lib/stores';
// @ts-expect-error - a small JS helper, run as `npm run record:shop`
import { checkedNames, manualRecord, readTable, withCheckedOn } from '../scripts/retailer-check-lib.mjs';
import sources from '../store/retailer-sources.json';

/**
 * `npm run record:shop` — the eight shops a person has to read.
 *
 * What can go wrong is that it writes something the evidence test then
 * refuses, so a person does the reading and the shop still says "not yet
 * checked"; or worse, that it accepts what the evidence test would refuse
 * and the two rules drift. So the section it writes is read back here the way
 * `test/verified.test.ts` reads a report, and every refusal names its reason.
 */
const STORES = readFileSync(join(__dirname, '..', 'src/lib/stores.ts'), 'utf8');
const table = readTable(STORES) as { name: string; windowDays: number; clockStart: string; onlineWindowDays?: number }[];
const own = (sources as { sources: Record<string, string[]> }).sources;
const row = (name: string) => table.find((r) => r.name === name)!;

/** As `test/verified.test.ts` reads a report: a heading, a page, its quotes. */
function quotesFor(name: string, text: string) {
  const out: { url: string; quote: string }[] = [];
  for (const section of `\n${text}`.split('\n## ').slice(1)) {
    const heading = section.split('\n')[0];
    if (heading !== name && !heading.startsWith(`${name} — `)) continue;
    let url = '';
    for (const line of section.split('\n')) {
      const page = /^- (https?:\/\/\S+)/.exec(line);
      if (page) url = page[1];
      else if (line.startsWith('  - > ') && url) out.push({ url, quote: line.slice(6) });
    }
  }
  return out;
}

const AMAZON = 'https://www.amazon.co.uk/gp/help/customer/display.html?nodeId=GKM69DUUYKQWKWX7';

describe('recording a shop read by hand', () => {
  it('writes a section the evidence test reads back, quote and page intact', () => {
    const r = manualRecord({ row: row('Amazon'), url: AMAZON, quotes: ['  Most items can be returned within 30 days\n of delivery. '], own: own.Amazon });
    expect(r.ok).toBe(true);
    expect(quotesFor('Amazon', r.section)).toEqual([{ url: AMAZON, quote: 'Most items can be returned within 30 days of delivery.' }]);
  });

  it('refuses a page that is not the shop’s own', () => {
    const r = manualRecord({ row: row('Amazon'), url: 'https://www.which.co.uk/consumer-rights/amazon-returns', quotes: ['Amazon gives you 30 days to return.'], own: own.Amazon });
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toMatch(/not on Amazon’s own site \(amazon\.co\.uk\)/);
  });

  it('refuses a sentence naming a different window, and changes nothing about it', () => {
    const r = manualRecord({ row: row('Amazon'), url: AMAZON, quotes: ['You can return items within 14 days of delivery.'], own: own.Amazon });
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toMatch(/table says 30 days and the quote says 14 — .*change stores\.ts by hand/);
  });

  it('refuses no sentence, a sentence with no number, and an address that is not one', () => {
    expect(manualRecord({ row: row('Amazon'), url: AMAZON, quotes: ['   '], own: own.Amazon }).problems.join(' ')).toMatch(/no quote/);
    expect(manualRecord({ row: row('Amazon'), url: AMAZON, quotes: ['Returns are easy.'], own: own.Amazon }).problems.join(' ')).toMatch(/no quote names 30 days/);
    expect(manualRecord({ row: row('Amazon'), url: 'amazon returns page', quotes: ['30 days'], own: own.Amazon }).problems.join(' ')).toMatch(/not a web address/);
  });

  it('holds a shop with a separate online window to both numbers', () => {
    // New Look: 28 days in store, 14 online. A quote for one is half the claim.
    const nl = row('New Look');
    expect(nl.onlineWindowDays).toBe(14);
    const url = own['New Look'][0];
    expect(manualRecord({ row: nl, url, quotes: ['Return in store within 28 days.'], own: own['New Look'] }).problems.join(' ')).toMatch(/table says 14 days/);
    expect(manualRecord({ row: nl, url, quotes: ['Return in store within 28 days.', 'Online orders: 14 days from delivery.'], own: own['New Look'] }).ok).toBe(true);
  });

  it('accepts exactly what the evidence test accepts for the window', () => {
    // "one year" is how IKEA writes 365, and the evidence test asks for the
    // number; the recorder must not accept what the test would then refuse.
    expect(manualRecord({ row: { ...row('Amazon'), windowDays: 365 }, url: AMAZON, quotes: ['Return within one year.'], own: own.Amazon }).ok).toBe(false);
    expect(manualRecord({ row: row('Amazon'), url: AMAZON, quotes: ['Within 30 calendar days of delivery.'], own: own.Amazon }).ok).toBe(true);
  });
});

describe('dating a shop in CHECKED_ON', () => {
  it('reads the same names stores.ts actually exports', () => {
    expect([...checkedNames(STORES)].sort()).toEqual(Object.keys(CHECKED_ON).sort());
  });

  it('lists exactly the shops nobody has read yet', () => {
    const left = table.filter((r) => !checkedNames(STORES).includes(r.name)).map((r) => r.name);
    expect(left.sort()).toEqual(STORE_POLICIES.map((s) => s.name).filter((n) => !CHECKED_ON[n]).sort());
    expect(left.length).toBeGreaterThan(0);
  });

  it('adds a shop once, and moves the date of one already there', () => {
    const added = withCheckedOn(STORES, 'H&M', '2026-10-05');
    expect(checkedNames(added)).toContain('H&M');
    expect(checkedNames(added)).toHaveLength(checkedNames(STORES).length + 1);
    const moved = withCheckedOn(added, 'H&M', '2026-11-01');
    expect(checkedNames(moved)).toHaveLength(checkedNames(added).length);
    expect(moved).toContain("  'H&M': '2026-11-01',");
    expect(moved).not.toContain("'H&M': '2026-10-05'");
  });

  it('keeps a name with an apostrophe in the quotes the table already uses', () => {
    const moved = withCheckedOn(STORES, "Levi's", '2026-11-01');
    expect(moved).toContain(`  "Levi's": '2026-11-01',`);
    expect(checkedNames(moved)).toHaveLength(checkedNames(STORES).length);
  });

  it('changes nothing outside CHECKED_ON', () => {
    const added = withCheckedOn(STORES, 'Zara', '2026-10-05');
    expect(added.replace("\n  'Zara': '2026-10-05',", '')).toBe(STORES);
  });
});
