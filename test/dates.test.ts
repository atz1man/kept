import { describe, expect, it } from 'vitest';
import { addDays, addMonths, currentDay, daysBetween, fmtDate, fmtDateNear, fmtDatesTogether, fromISODate, relativeAgo, startOfDay, toISODate } from '../src/lib/dates';

/**
 * This suite runs under TZ=America/New_York on purpose (see package.json).
 * In UTC or London, a date parsed as UTC midnight still lands on the right
 * calendar day, so the bug these tests exist to catch would pass unnoticed.
 */
describe('day arithmetic', () => {
  it('counts calendar boundaries, not elapsed hours', () => {
    const late = new Date(2026, 7, 1, 23, 50);
    const early = new Date(2026, 7, 2, 0, 5);
    expect(daysBetween(late, early)).toBe(1);
  });

  it('survives a spring DST transition', () => {
    // 29 March 2026 is the UK spring-forward; the US one is 8 March. Either
    // way one of these "days" is 23 hours long, and a truncating divide loses it.
    const before = new Date(2026, 2, 1);
    const after = new Date(2026, 3, 1);
    expect(daysBetween(before, after)).toBe(31);
  });

  it('survives an autumn DST transition', () => {
    const before = new Date(2026, 9, 1);
    const after = new Date(2026, 10, 1);
    expect(daysBetween(before, after)).toBe(31);
  });

  it('is negative for a date already past', () => {
    expect(daysBetween(new Date(2026, 7, 10), new Date(2026, 7, 3))).toBe(-7);
  });

  it('parses a stored ISO date as local midnight, not UTC', () => {
    // The whole point: west of Greenwich, Date('2026-08-28') is 27 August.
    const d = fromISODate('2026-08-28');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(28);
  });

  it('round-trips a date through ISO', () => {
    const d = new Date(2026, 0, 5);
    expect(fromISODate(toISODate(d)).getTime()).toBe(startOfDay(d).getTime());
  });

  it('adds days across a month boundary', () => {
    expect(toISODate(addDays(new Date(2026, 0, 30), 3))).toBe('2026-02-02');
  });

  it('formats day-first, as en-GB writes it', () => {
    // Asserting the ORDER, not the exact abbreviation: en-GB renders
    // September as "Sept" and CLDR has changed such spellings before. The
    // regression that would actually mislead a UK user is US ordering.
    expect(fmtDate(new Date(2026, 7, 5))).toBe('5 Aug');
    expect(fmtDate(new Date(2026, 8, 5))).toMatch(/^5 Sep/);
  });
});

describe('fromISODate on a string that is not a full date', () => {
  /*
   * `isISODate` in backup.ts enforces the shape and the round trip, so nothing
   * stored ever reaches here short. The fallbacks exist so the function is
   * TOTAL — every other date helper composes on top of it, and an Invalid Date
   * escaping into `daysBetween` becomes a NaN days-left that renders as
   * "NaN days" rather than failing anywhere anyone would notice.
   *
   * A missing part means the start of the period it names, which is the only
   * reading of "2026" that is not a guess.
   */
  it('reads a bare year as the first of January', () => {
    expect(toISODate(fromISODate('2026'))).toBe('2026-01-01');
  });

  it('reads a year and month as the first of that month', () => {
    expect(toISODate(fromISODate('2026-08'))).toBe('2026-08-01');
  });

  it('never hands back an Invalid Date', () => {
    // The property the fallbacks are actually for.
    for (const iso of ['2026', '2026-08', '2026-08-28']) {
      expect(Number.isNaN(fromISODate(iso).getTime())).toBe(false);
    }
  });
});

describe('relativeAgo — the chip on the policy feed', () => {
  /*
   * Coarse on purpose: the exact hour a retailer edited its terms is noise.
   * But the bucket EDGES are what a reader sees, and they were untested — the
   * weeks bucket rounded down with nothing saying it must.
   */
  const day = (n: number) => new Date(2026, 7, 28 - n);
  const today = new Date(2026, 7, 28);
  const ago = (n: number) => relativeAgo(day(n), today);

  it('rounds weeks DOWN, so it never overstates how long ago it was', () => {
    // ceil would call eight days "2w ago", which is a fortnight it has not been.
    expect(ago(7)).toBe('1w ago');
    expect(ago(8)).toBe('1w ago');
    expect(ago(13)).toBe('1w ago');
    expect(ago(14)).toBe('2w ago');
  });

  it('changes unit where it says it does', () => {
    expect(ago(6)).toBe('6d ago');
    expect(ago(29)).toBe('4w ago');
    expect(ago(30)).toBe('1mo ago');
    expect(ago(364)).toBe('12mo ago');
    expect(ago(365)).toBe('1y ago');
  });

  it('says today and yesterday rather than counting them', () => {
    expect(ago(0)).toBe('today');
    expect(relativeAgo(new Date(2026, 7, 29), today)).toBe('today');
    expect(ago(1)).toBe('yesterday');
  });
});

describe('addMonths — the unit warranties are quoted in', () => {
  it('adds a plain month', () => {
    expect(toISODate(addMonths(new Date(2026, 0, 15), 1))).toBe('2026-02-15');
  });

  it('clamps to the end of a shorter month rather than overflowing', () => {
    // The naive setMonth(m + 1) turns 31 January into 3 March, handing someone
    // two days of cover they do not have.
    expect(toISODate(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-28');
  });

  it('lands on 29 February in a leap year', () => {
    expect(toISODate(addMonths(new Date(2028, 0, 31), 1))).toBe('2028-02-29');
  });

  it('crosses years', () => {
    expect(toISODate(addMonths(new Date(2026, 7, 16), 24))).toBe('2028-08-16');
    expect(toISODate(addMonths(new Date(2026, 7, 16), 120))).toBe('2036-08-16');
  });

  it('goes backwards too', () => {
    expect(toISODate(addMonths(new Date(2026, 0, 15), -2))).toBe('2025-11-15');
  });
});

describe('relativeAgo', () => {
  const today = new Date(2026, 7, 28);
  it.each([
    [0, 'today'],
    [1, 'yesterday'],
    [2, '2d ago'],
    [6, '6d ago'],
    [7, '1w ago'],
    [21, '3w ago'],
    [30, '1mo ago'],
    [200, '6mo ago'],
    [400, '1y ago'],
  ])('renders %i days back as "%s"', (back, expected) => {
    expect(relativeAgo(addDays(today, -back), today)).toBe(expected);
  });
});

describe('fmtDateNear — the year, only when it earns its space', () => {
  const today = new Date(2026, 7, 28);

  it('leaves the year off for a date this year', () => {
    expect(fmtDateNear(new Date(2026, 1, 14), today)).toBe('14 Feb');
  });

  it('adds the year for one that is not', () => {
    // IKEA's 365-day window: "bought 14 Feb · return by 14 Feb" reads as the
    // same day when it is twelve months apart.
    expect(fmtDateNear(new Date(2027, 1, 14), today)).toBe('14 Feb 2027');
  });

  it('adds the year for a date in the past too', () => {
    expect(fmtDateNear(new Date(2025, 11, 3), today)).toBe('3 Dec 2025');
  });
});

describe('fmtDatesTogether — a pair that cannot be read as the same year', () => {
  const today = new Date(2026, 7, 28);

  it('leaves the year off when every date is this year', () => {
    const out = fmtDatesTogether([new Date(2026, 1, 14), new Date(2026, 8, 5)], today);
    expect(out).toEqual(['14 Feb', expect.stringMatching(/^5 Sep/)]);
  });

  it('carries the year on BOTH when one of them is not this year', () => {
    // The IKEA case: a 365-day window puts the deadline on the same day and
    // month as the purchase. Deciding per date gives "15 Feb 2027" beside
    // "15 Feb" — a year on one and not the other is exactly what invites
    // reading them as the same day.
    expect(fmtDatesTogether([new Date(2027, 1, 15), new Date(2026, 1, 15)], today)).toEqual([
      '15 Feb 2027',
      '15 Feb 2026',
    ]);
  });

  it('carries the year when the odd one out is in the past', () => {
    expect(fmtDatesTogether([new Date(2026, 0, 8), new Date(2025, 11, 25)], today)).toEqual([
      '8 Jan 2026',
      '25 Dec 2025',
    ]);
  });

  it('keeps the order it was given, so a caller can destructure it', () => {
    const a = new Date(2026, 2, 1);
    const b = new Date(2026, 4, 9);
    expect(fmtDatesTogether([a, b], today)).toEqual([fmtDate(a), fmtDate(b)]);
  });
});

describe('the day the app thinks it is', () => {
  /*
   * `currentDay` is called on a sixty-second interval and on every return to
   * the foreground, and what it returns is held in state and fed to the
   * reducer, every screen's day-counts, the alert plan and the scheduler. So
   * both halves matter: it has to turn over, and it has to not.
   *
   * The effect it came out of asserted this in prose — "sets state only when
   * the date actually turns over" — where nothing could contradict it.
   */
  it('hands back the very same object while the day has not turned', () => {
    const current = startOfDay(new Date(2026, 5, 30, 9, 0));
    const later = new Date(2026, 5, 30, 23, 59, 59);
    // Identity, not equality: a fresh Date each minute would re-run the
    // reducer, every derivation and the scheduler for the life of the session.
    expect(currentDay(current, later)).toBe(current);
  });

  it('turns over at midnight, not at the twenty-four hour mark', () => {
    const current = startOfDay(new Date(2026, 5, 30, 23, 0));
    const justAfter = new Date(2026, 6, 1, 0, 0, 1);
    const next = currentDay(current, justAfter);
    expect(next).not.toBe(current);
    expect(toISODate(next)).toBe('2026-07-01');
  });

  it('turns over exactly once across a 23-hour spring-forward day', () => {
    /*
     * The suite runs in America/New_York for this: on 8 March 2026 the day is
     * 23 hours long, so anything comparing elapsed milliseconds against
     * 86_400_000 turns the date over early or late. Two calls, one either side
     * of the short night.
     */
    const before = startOfDay(new Date(2026, 2, 8, 12, 0));
    expect(currentDay(before, new Date(2026, 2, 8, 23, 30))).toBe(before);
    const after = currentDay(before, new Date(2026, 2, 9, 0, 30));
    expect(toISODate(after)).toBe('2026-03-09');
  });

  it('goes backwards if the clock does', () => {
    // A phone whose time is corrected backwards is not a case to be clever
    // about: the app should report the day it now is, not the latest it saw.
    const current = startOfDay(new Date(2026, 5, 30));
    expect(toISODate(currentDay(current, new Date(2026, 5, 28, 8, 0)))).toBe('2026-06-28');
  });
});
