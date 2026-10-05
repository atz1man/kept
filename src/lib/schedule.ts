import { addDays, startOfDay } from './dates';
import { derive } from './receipts';
import { alertKey, copyFor, singleShotDue, singleShots, type AlertRung, type ReturnRung } from './alerts';
import type { Receipt } from './types';

/**
 * The alerts to hand the operating system, ahead of time.
 *
 * This is the half a web app could never have. `alerts.ts` decides what is
 * worth saying WHEN THE APP IS OPEN, because that is the only moment a browser
 * gets — Notification Triggers never shipped, so the honest contract there was
 * "computed whenever kept is opened", and Settings says so. A native shell can
 * instead lodge a notification with the system now and have it arrive on a
 * Tuesday morning when the app has not been launched for a fortnight. That is
 * the difference between "you get pinged before either clock runs out" being a
 * promise and being a claim, and it is the reason this app has an iOS build.
 *
 * So the shape is different: not "what should I say today" but "what will be
 * worth saying, and when". Pure, and separate from the plugin that lodges
 * them, for the same reason `alerts.ts` is separate from `notify.ts`.
 */

/** Nine in the morning, local. Not midnight, which is when the date changes. */
export const FIRE_HOUR = 9;

/**
 * iOS keeps at most 64 pending local notifications per app and silently drops
 * the rest. This app can exceed that easily — a paid library is uncapped and
 * every receipt has up to four rungs, so seventeen receipts is enough.
 *
 * Which 64 survive is therefore a decision, not a detail, and the soonest are
 * kept: they are the ones that matter first, and every later one is re-planned
 * long before its turn comes round. Sorting before cutting is the whole point;
 * cutting an unsorted list would drop alerts at random, and the one it dropped
 * would be as likely as not to be tomorrow's.
 */
export const MAX_PENDING = 64;

export interface PlannedAlert {
  /** The same key `alerts.ts` dedups on, so the two halves cannot disagree. */
  key: string;
  receiptId: string;
  rung: AlertRung;
  /** When the system should raise it. Always in the future. */
  at: Date;
  title: string;
  body: string;
}

/**
 * How many days before the deadline each rung is worth raising.
 *
 * `week` is the only one the person controls; the others are fixed, because
 * "three days left", "today", and "it has closed" are facts about the window
 * rather than preferences about warning.
 */
function fireDayFor(rung: ReturnRung, deadline: Date, urgentDays: number): Date | null {
  switch (rung) {
    case 'week':
      /*
       * Only when it is actually earlier than the fixed three-day rung.
       *
       * The Settings slider goes down to two days. At three, `week` lands on
       * exactly the same morning as `soon` — two notifications, same instant,
       * same receipt. At two it lands AFTER it, so the gentle "5 days left"
       * warning would arrive the day after "go now or lose it". Neither is a
       * hypothetical: both are inside the range the screen offers.
       */
      return urgentDays > 3 ? addDays(deadline, -urgentDays) : null;
    case 'soon':
      return addDays(deadline, -3);
    case 'today':
      return deadline;
    case 'closed':
      // The morning after. Saying "that window has closed" at 9am on the last
      // day would be false, and this app's one unbreakable rule is never to
      // report a live right as expired.
      return addDays(deadline, 1);
  }
}

function at9am(day: Date): Date {
  const d = startOfDay(day);
  d.setHours(FIRE_HOUR, 0, 0, 0);
  return d;
}

/** The first 9am after `now`: today's while it is still ahead, else tomorrow's. */
function nextNine(now: Date): Date {
  const today = at9am(now);
  return today.getTime() > now.getTime() ? today : at9am(addDays(now, 1));
}

/**
 * Everything worth lodging with the system, soonest first, within the cap.
 *
 * @param sent Keys already delivered — the same list `dueAlerts` reads, so an
 *             alert the app already showed on screen is not then repeated by
 *             the operating system a week later.
 */
export function planAlerts(
  receipts: readonly Receipt[],
  today: Date,
  urgentDays: number,
  sent: ReadonlySet<string>,
): PlannedAlert[] {
  const now = new Date();
  const out: PlannedAlert[] = [];

  for (const r of receipts) {
    /*
     * The single-shot rungs — the refund, the guarantee, the right to reject,
     * the credit and the fault letter — at 9am on their first morning, read
     * off the same decision `dueAlerts` makes, so the two cannot disagree.
     *
     * Or at the NEXT 9am, where that first morning has already gone. Each of
     * these has one notice day and no ladder after it, so skipping a past
     * morning skipped the alert for good: a credit note recorded with twenty
     * days to run, a guarantee added in its last month, an item kept on day
     * 28 with two days of its right to reject left — every one raised on the
     * web the moment the app opened, and nothing lodged with iOS at all. It is
     * lodged only if it will still be true on that morning, by the same test
     * `dueAlerts` applies on the morning it opens, and its words count the
     * days left from that morning: a right that ends today is said at 9am if
     * 9am is still ahead, and not at all once it has gone.
     *
     * The guarantee is years out, usually, and so it is also the alert most
     * likely to sit behind the 64-slot cap: that is the right way round,
     * since it is re-planned on every launch long before its morning comes.
     */
    for (const s of singleShots(r, today)) {
      if (sent.has(s.key)) continue;
      const when = new Date(Math.max(at9am(s.from).getTime(), nextNine(now).getTime()));
      if (!singleShotDue(s, when)) continue;
      out.push({ key: s.key, receiptId: r.id, rung: s.rung, at: when, ...s.copy(when) });
    }
    if (r.status !== 'active') continue;
    // The same rule `dueAlerts` states at length: a notification is not a
    // demonstration, and the demo set must never raise one about money nobody
    // spent. Repeated here because this is a second, independent path to the
    // lock screen, and a rule enforced in only one of two paths is not a rule.
    if (r.demo) continue;

    const { deadline } = derive(r, today);
    for (const rung of ['week', 'soon', 'today', 'closed'] as const) {
      const key = alertKey(r.id, rung);
      if (sent.has(key)) continue;
      const day = fireDayFor(rung, deadline, urgentDays);
      if (!day) continue;
      const when = at9am(day);
      // Nothing in the past: the system would either fire it immediately or
      // refuse it, and both are wrong for a window that closed last month.
      // `<` would do: `when` is always 9am exactly and `now` is an arbitrary
      // instant, so equality needs the suite to run at 09:00:00.000 to the
      // millisecond. Practically equivalent, and recorded rather than chased.
      if (when.getTime() <= now.getTime()) continue;
      const daysLeft = Math.round((startOfDay(deadline).getTime() - startOfDay(when).getTime()) / 86_400_000);
      out.push({ key, receiptId: r.id, rung, at: when, ...copyFor(rung, r, daysLeft, deadline) });
    }
  }

  out.sort((a, b) => a.at.getTime() - b.at.getTime());
  return out.slice(0, MAX_PENDING);
}
