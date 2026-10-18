import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error - a small JS helper shared by the evidence scripts
import { ukIsoDay } from '../scripts/uk-day.mjs';

/**
 * The scripts that write a date into the repository as evidence date it in
 * London's day, the day the app counts in.
 *
 * `record:shop`, `check:retailers` and `feed:add` stamp the day a retailer's
 * page was read — into CHECKED_ON, the report's file name and a feed entry's
 * `checkedOn`. Two took it through `toISOString()` (UTC) and one from the
 * machine's zone, so a quote read at 00:30 on a summer night in London was
 * filed under yesterday, and `feed:add --checked <today>` was refused as a
 * future date. The sweeps are held to London by `uk-clock.test.ts`; these run
 * without it, so they are held here.
 */
const SCRIPTS = join(__dirname, '..', 'scripts');
const source = (file: string) => readFileSync(join(SCRIPTS, file), 'utf8');

/** Lines of a script that turn the machine's clock into a day by itself. */
export function machineDays(text: string): number[] {
  return text
    .split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => !/^\s*(\*|\/\/)/.test(line))
    .filter(({ line }) => (/toISOString\(\)\.slice\(0,\s*10\)/.test(line) && !/T12:00/.test(line)) || /\.getFullYear\(\)/.test(line))
    .map(({ n }) => n);
}

describe('the evidence scripts date things in London', () => {
  it('is the next day in London once London has passed midnight, though UTC has not', () => {
    expect(ukIsoDay(new Date('2026-07-01T23:30:00Z'))).toBe('2026-07-02');
    expect(ukIsoDay(new Date('2026-07-01T22:59:00Z'))).toBe('2026-07-01');
    // In winter London is on UTC, so the day turns with it.
    expect(ukIsoDay(new Date('2026-12-01T23:30:00Z'))).toBe('2026-12-01');
    expect(ukIsoDay(new Date('2026-12-02T00:00:00Z'))).toBe('2026-12-02');
  });

  it('each of the three takes today from ukIsoDay', () => {
    for (const file of ['record-shop.mjs', 'check-retailers.mjs', 'feed-add.mjs']) {
      expect(source(file), file).toMatch(/import \{ ukIsoDay \} from '\.\/uk-day\.mjs'/);
      expect(source(file), file).toMatch(/ukIsoDay\(\)/);
    }
  });

  it('and no script off the UK clock makes a day from the machine’s', () => {
    const off = readdirSync(SCRIPTS)
      .filter((f) => f.endsWith('.mjs') && !/'\.\/uk-clock\.mjs'/.test(source(f)))
      .flatMap((f) => machineDays(source(f)).map((n) => `${f}:${n}`));
    expect(off).toEqual([]);
  });

  it('would name a script that did', () => {
    expect(machineDays("const today = new Date().toISOString().slice(0, 10);")).toEqual([1]);
    expect(machineDays('const now = new Date();\nconst y = now.getFullYear();')).toEqual([2]);
    expect(machineDays("const d = new Date(`${iso}T12:00:00`).toISOString().slice(0, 10);")).toEqual([]);
    expect(machineDays(' * read through toISOString().slice(0, 10) is UTC')).toEqual([]);
  });
});
