/**
 * Whole-day arithmetic, in calendar days.
 *
 * Which day it IS comes from the UK's calendar (`ukDay`), because every window
 * counted here is a UK retailer's; the arithmetic below then runs on those
 * days as local-midnight Dates.
 *
 * A return deadline is a CALENDAR fact, not a 24-hour countdown: a receipt
 * bought at 23:50 on the 1st with a 14-day window is returnable all of the
 * 15th, and "1 day left" must not flip to "0" because the phone clock passed
 * an arbitrary hour. So every function here collapses to local midnight first
 * and counts date boundaries crossed — and rounds, because a DST transition
 * makes one of those "days" 23 or 25 hours long and a truncating divide would
 * silently lose a day each spring.
 */

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const UK_CALENDAR = (() => {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: 'numeric', day: 'numeric' });
  } catch {
    return null;
  }
})();

/**
 * The calendar day it is in the UK at `now`, as this module's local-midnight Date.
 *
 * Every shop in this app is a UK retailer and every window it counts closes at
 * the end of a UK day, so "today" is the UK's today wherever the phone is. It
 * was the phone's own: measured, a Next jacket bought on 6 September with 28
 * days had its last day on Sunday 4 October, and at 04:00 on Monday 5 October
 * in London a phone set to New York (still 23:00 on the Sunday) said "Today is
 * the last day" — about a window that had already shut. A person on holiday
 * west of the UK is told they have hours they do not have; east of it, the
 * same mistake runs the other way in the morning. At home the two answers are
 * the same day, so nothing changes for anyone in the UK.
 *
 * Read through `Intl`, the platform's own zone tables, so the clocks going
 * forward and back are the zone database's business rather than an offset
 * written here. Where a platform cannot name the zone, the phone's own day is
 * the answer, as it always was.
 */
export function ukDay(now: Date): Date {
  if (!UK_CALENDAR) return startOfDay(now);
  let year = NaN;
  let month = NaN;
  let day = NaN;
  for (const part of UK_CALENDAR.formatToParts(now)) {
    if (part.type === 'year') year = Number(part.value);
    else if (part.type === 'month') month = Number(part.value);
    else if (part.type === 'day') day = Number(part.value);
  }
  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day) ? new Date(year, month - 1, day) : startOfDay(now);
}

/**
 * The day it is now, given the day the app currently thinks it is.
 *
 * Returns the SAME OBJECT when the calendar day has not turned over, and that
 * identity is the point rather than a detail: `useApp` holds `today` in state
 * and feeds it to the reducer, every screen's day-counts, the alert plan and
 * the scheduler. Called on a sixty-second interval and on every return to the
 * foreground, a fresh Date each time would re-run all of that once a minute
 * for the life of the session.
 *
 * Lifted out of the effect because it is the judgement, and an effect is the
 * one place here nothing can exercise. What the effect had was a comment
 * saying it "sets state only when the date actually turns over" — a claim
 * about behaviour, in prose, with nothing able to contradict it.
 */
export function currentDay(current: Date, now: Date): Date {
  const today = ukDay(now);
  return today.getTime() === current.getTime() ? current : today;
}

/*
 * Equivalent under mutation, and recorded rather than left to be rediscovered:
 * bumping this by a millisecond changes no answer this app can produce.
 * `daysBetween` rounds, so the error only reaches half a day after about
 * forty-three million of them.
 */
const MS_PER_DAY = 86_400_000;

/** Whole days from `a` to `b`; negative when `b` is earlier. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_PER_DAY);
}

export function addDays(d: Date, n: number): Date {
  const out = startOfDay(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** ISO calendar date (YYYY-MM-DD) — how a receipt's dates are stored. */
export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Parse a stored ISO date as LOCAL midnight. `new Date('2026-08-28')` parses
 * as UTC midnight, which is the previous day everywhere west of Greenwich —
 * that alone would show a UK user the wrong number of days left.
 */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/*
 * One formatter each, made once. `toLocaleDateString` builds a new
 * Intl.DateTimeFormat on every call, and a list row can carry a date: on a
 * library of 3,000 receipts a search that matched the Keeping list called it
 * once a row per keystroke. Measured in Node, 69 µs a call against under 1 µs
 * for a formatter already made — 207 ms for 3,000 dates, on the main thread.
 *
 * Held in UTC and handed the date's own LOCAL day, month and year, so the
 * answer is the one `toLocaleDateString` gave and cannot drift: a formatter
 * made once also fixes its timezone once, and a phone that crosses a zone with
 * the app open would otherwise print a local midnight as the day before.
 */
const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const LONG = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** The same calendar day as `d` reads locally, as an instant in UTC. */
function sameDayInUTC(d: Date): Date {
  const u = new Date(0);
  // setUTCFullYear rather than Date.UTC, which reads years 0–99 as 1900–1999.
  u.setUTCFullYear(d.getFullYear(), d.getMonth(), d.getDate());
  return u;
}

/** en-GB short form, as the design shows it: "5 Sep". */
export function fmtDate(d: Date): string {
  // An invalid date throws from `format`; toLocaleDateString says so instead.
  if (Number.isNaN(d.getTime())) return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return SHORT.format(sameDayInUTC(d));
}

/**
 * A group of dates shown together, rendered so they cannot be read as the same
 * year.
 *
 * `fmtDateNear` decides per date — carry the year only when it is not this one
 * — which is right for a date on its own and wrong for a pair. A 365-day
 * window puts the deadline on the same day and month as the purchase, so the
 * detail screen read "RETURN BY 15 Feb 2027" six lines above "bought 15 Feb":
 * the same string twice, a year apart, on the screen whose entire job is
 * dates. Not a coincidence of the seed either — it is true of every receipt
 * from a shop with a year-long window.
 *
 * All or none, because a year on one and not the other is exactly what invites
 * reading them as the same.
 */
export function fmtDatesTogether(dates: readonly Date[], today: Date): string[] {
  const withYear = dates.some((d) => d.getFullYear() !== today.getFullYear());
  return dates.map((d) => (withYear ? `${fmtDate(d)} ${d.getFullYear()}` : fmtDate(d)));
}

/** en-GB long form for legal copy: "5 September 2026". */
export function fmtDateLong(d: Date): string {
  if (Number.isNaN(d.getTime())) return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return LONG.format(sameDayInUTC(d));
}

/**
 * "2d ago" / "1w ago" / "3mo ago" — the compact form the policy feed uses.
 * Deliberately coarse: the exact hour a retailer edited its terms is noise,
 * and a chip that reads "47h ago" invites the reader to do arithmetic the
 * label exists to save them.
 */
export function relativeAgo(then: Date, today: Date): string {
  const days = daysBetween(then, today);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/**
 * Add whole months, clamping to the end of the target month.
 *
 * Warranties are quoted in months and years, never days, and the naive
 * `setMonth(m + n)` overflows: 31 January plus one month becomes 3 March,
 * which would hand someone two days of cover they do not have. The last day
 * of a short month is the honest answer.
 */
export function addMonths(d: Date, months: number): Date {
  const start = startOfDay(d);
  const day = start.getDate();
  // The 1 is arbitrary and cannot be otherwise: setDate below overwrites it.
  // Any day-of-month here gives the same answer, which is why no test can
  // distinguish them — recorded rather than left for the next person to try.
  const out = new Date(start.getFullYear(), start.getMonth() + months, 1);
  const lastDayOfTarget = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate();
  out.setDate(Math.min(day, lastDayOfTarget));
  return out;
}

/**
 * The last day of a period of `months` calendar months BEGINNING WITH
 * `first`: that day counts as the first of the period, as a statute means
 * when it says "beginning with".
 *
 * The day before the same date `months` on, so six months beginning with 15
 * January end on 14 July, and beginning with 1 March on 31 August. Where the
 * month reached has no such date, as six months on from 31 August reach a
 * February with no 31st, the period runs to the end of that month: there is no
 * day "before" a date that does not exist, and the later reading is the one
 * that never ends a right early.
 *
 * Not `addMonths(addDays(first, -1), months)`, which reads the same and agrees
 * on most days: from 1 March it steps back to 28 February and lands on 28
 * August, three days short of six months.
 */
export function lastDayOfMonthsBeginning(first: Date, months: number): Date {
  const same = addMonths(first, months);
  return same.getDate() === first.getDate() ? addDays(same, -1) : same;
}

/**
 * Short form, with the year only when it is not this year.
 *
 * IKEA's 365-day window puts the deadline a year out, and "bought 14 Feb ·
 * return by 14 Feb" reads as the same day when it is twelve months apart. The
 * year earns its space exactly when it disambiguates, and not otherwise.
 */
export function fmtDateNear(d: Date, today: Date): string {
  return d.getFullYear() === today.getFullYear() ? fmtDate(d) : `${fmtDate(d)} ${d.getFullYear()}`;
}
