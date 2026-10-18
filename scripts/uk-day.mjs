/**
 * Today's date in London, as YYYY-MM-DD, whatever clock the machine keeps.
 *
 * For the scripts that write a date into the repository as EVIDENCE — the
 * day a retailer's page was read (`record:shop`, `check:retailers`) and the
 * day a change reached the feed (`feed:add`). Those dates are what
 * `test/verified.test.ts` and the app's "checked on" lines rest on, and they
 * were taken from the machine: two through `toISOString()`, which is UTC, so
 * a page read between midnight and 1am in London all summer was dated the day
 * BEFORE it was read; and `feed:add` refused `--checked` with the true date
 * as "a future one" for that hour. The third read the machine's own zone, so
 * the same quote recorded by someone abroad, or on a UTC laptop, landed on
 * another day. The app counts in London's days (`ukDay` in src/lib/dates.ts);
 * so does its evidence.
 *
 * Not `uk-clock.mjs`: that sets TZ for a whole sweep and its browser, and a
 * date written into a commit should not depend on which import ran first.
 */
const LONDON = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });

export function ukIsoDay(now = new Date()) {
  const part = (type) => LONDON.formatToParts(now).find((p) => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
