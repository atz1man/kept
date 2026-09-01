import { describe, expect, it } from 'vitest';
import { daysBetween, fromISODate, toISODate } from '../src/lib/dates';

/**
 * The suite's timezone premise, held to what it is actually for.
 *
 * Half the date tests here only mean something in a zone that observes
 * daylight saving: in UTC every day is exactly 24 hours, so a truncating
 * divide — the defect `daysBetween` rounds to avoid, which would lose a day
 * each spring — passes every one of them.
 *
 * That is not hypothetical. The zone was set by the `npm test` script and
 * nothing else, so `npx vitest run` used the container's UTC. Measured:
 * `Math.round` mutated to `Math.floor` in `daysBetween` left the suite GREEN
 * under `npx vitest run` and RED under `npm test`. Every DST test was passing
 * for the wrong reason, and the one running the suite could not tell.
 *
 * It is set in `vite.config.ts` now, so it holds however the suite is started.
 * This file is what stops that going quiet again.
 *
 * NOT `expect(TZ).toBe('America/New_York')`. That asserts the setting against
 * itself and would pass in a build of Node with no timezone data at all, where
 * the zone name resolves and every day is still 24 hours. What matters is the
 * PROPERTY: somewhere in the year there is a day that is not 24 hours long,
 * and the short one is counted as a whole day anyway.
 */
const HOURS = 3_600_000;

/** Midnight-to-midnight spans across a year, in hours. */
const dayLengths = (year: number): { date: Date; hours: number }[] => {
  const out: { date: Date; hours: number }[] = [];
  for (let m = 0; m < 12; m += 1) {
    const days = new Date(year, m + 1, 0).getDate();
    for (let d = 1; d <= days; d += 1) {
      const start = new Date(year, m, d);
      const next = new Date(year, m, d + 1);
      out.push({ date: start, hours: (next.getTime() - start.getTime()) / HOURS });
    }
  }
  return out;
};

describe('the zone these tests run in', () => {
  const lengths = dayLengths(2026);

  it('finds the days it is meant to be measuring', () => {
    // A sweep over nothing passes silently. 365 days, and every one of them a
    // real span rather than a NaN from a Date that would not construct.
    expect(lengths).toHaveLength(365);
    expect(lengths.every((d) => Number.isFinite(d.hours))).toBe(true);
  });

  it('observes daylight saving, or every date test here is decoration', () => {
    const odd = lengths.filter((d) => d.hours !== 24);
    expect(
      odd.map((d) => `${d.date.toDateString()} ${d.hours}h`),
      'this environment has no clock change in 2026, so the DST tests cannot fail',
    ).toHaveLength(2);
  });

  it('has a SHORT day, which is the direction that loses one', () => {
    /*
     * The 23-hour day is the whole point. A long one divides to 1.04 and
     * truncates to 1, which is right by luck; the short one divides to 0.96 and
     * truncates to 0. Spring is where a day goes missing, so spring is what has
     * to exist here.
     */
    const short = lengths.find((d) => d.hours === 23);
    expect(short, 'no 23-hour day in this zone').toBeTruthy();

    // And the fact everything rests on: that day still counts as one day.
    const next = new Date(short!.date);
    next.setDate(next.getDate() + 1);
    expect(daysBetween(short!.date, next)).toBe(1);
  });

  it('sits WEST of Greenwich, or the other half of the premise is decoration too', () => {
    /*
     * The zone was chosen for two reasons and the DST check above covers one.
     * The other is that `new Date('2026-08-28')` parses as UTC midnight, which
     * is the PREVIOUS DAY everywhere west of Greenwich — the bug `fromISODate`
     * exists to prevent, and the reason it builds a local date by hand.
     *
     * London observes daylight saving, so it satisfies everything above and
     * still cannot catch this: UTC midnight in London is the same calendar day.
     * Both legs have to be asserted or half the premise is untested.
     */
    const iso = '2026-08-28';
    expect(toISODate(fromISODate(iso))).toBe(iso);
    expect(
      toISODate(new Date(iso)),
      'UTC midnight lands on the same calendar day here, so the ISO-parsing bug cannot be caught',
    ).not.toBe(iso);
  });
});
