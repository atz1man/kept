/**
 * Every browser sweep runs on the UK clock, because the app does.
 *
 * The app's "today" is the day in London (`ukDay` in src/lib/dates.ts): a
 * deadline is a UK shop's, counted in UK days, whatever zone the phone or the
 * test machine is set to. The sweeps worked their dates out from the machine's
 * own clock instead — `new Date()`, `d.getDate() - 10` — in Node and inside the
 * page alike. On a laptop in Britain the two agree. On a CI runner, which is
 * on UTC, they disagree for one hour every night of British Summer Time, from
 * midnight in London to midnight UTC: the app has moved on to tomorrow and the
 * sweep has not. Measured on 5 October at 23:04 UTC, `smoke` failed on main
 * and on a pull request alike — a receipt meant to close "today" read as
 * closed, a date meant to be "tomorrow" was today and was accepted — and that
 * is a red build for an hour a day that no change caused.
 *
 * Setting TZ here, in the process, puts Node's local clock in London; the
 * Chromium each sweep launches inherits the variable, so every
 * `new Date()` evaluated in a page agrees too. It is imported FIRST by every
 * sweep (`test/uk-clock.test.ts` holds them to it) so nothing reads the clock
 * before it is set, and `smoke` checks the browser actually reports the zone.
 *
 * This does not hide a zone bug in the app: the app never reads the device's
 * zone for "today", and the unit suite runs under a non-UK zone on purpose to
 * catch anything that does.
 */
process.env.TZ = 'Europe/London';

export const UK_TIME_ZONE = 'Europe/London';
