import { isNative } from '../lib/mirror';
import type { PlannedAlert } from '../lib/schedule';

/**
 * Handing the plan to iOS.
 *
 * The counterpart of `notify.ts`, which shows an alert while the app is open.
 * This one lodges alerts the system will raise when it is not — the thing a
 * browser cannot do, and the reason the landing page's "you get pinged before
 * either clock runs out" has been a claim rather than a promise.
 *
 * Everything here is a no-op on the web. `schedule.ts` decides WHAT and WHEN
 * and is pure; this file only carries it across, so the part worth testing is
 * testable without a phone — which matters, because nothing in this file can
 * be exercised in this environment at all.
 */

/**
 * The whole plan is re-lodged each time, rather than diffed.
 *
 * Cancel-all-then-schedule is not laziness: the plan changes whenever a
 * receipt is added, edited, returned or deleted, or the urgency slider moves,
 * and a diff would have to be right about every one of those to avoid either a
 * stale alert firing about a receipt that has gone back, or a real one silently
 * missing. Re-lodging is cheap — at most `MAX_PENDING` entries — and cannot
 * drift. It also makes the ids free: they are positions in the current plan,
 * not identities that have to survive between runs, so nothing has to hash a
 * key into a number and hope.
 */
export async function syncScheduled(plan: readonly PlannedAlert[]): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    /*
     * Cancelling comes first, and needs no permission.
     *
     * This runs when the switch is turned OFF, with an empty plan, and that
     * path must clear what is already lodged whatever the permission state
     * says — otherwise alerts granted last week keep arriving for weeks after
     * the person asked them to stop.
     */
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }

    /*
     * Nothing to lodge means nothing to ask for, and the order matters more
     * than it looks.
     *
     * A fresh install holds five DEMO receipts and nothing else, and
     * `planAlerts` refuses to raise anything about those — a notification is
     * not a demonstration. So the plan is empty on first launch, and asking
     * first meant the system permission dialog appeared the moment the app
     * opened, before a single real receipt existed, about nothing.
     *
     * iOS gives an app ONE chance at that dialog. Someone who declines it
     * because it arrived out of nowhere has switched off deadline alerts
     * permanently, and the only way back is the Settings app. The prompt now
     * waits until there is a deadline to warn about, which is the moment it
     * can explain itself. `notify.ts` already refuses to ask from inside the
     * marketing page's demo frame, for the same reason.
     */
    if (plan.length === 0) return true;

    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      const asked = await LocalNotifications.requestPermissions();
      // Refused is an answer, not an error. The app keeps working; the
      // Settings screen is where the consequence belongs, not a thrown promise.
      if (asked.display !== 'granted') return false;
    }

    await LocalNotifications.schedule({
      notifications: plan.map((p, i) => ({
        id: i + 1,
        title: p.title,
        body: p.body,
        schedule: { at: p.at, allowWhileIdle: true },
        // The key rides along so a tapped notification can be traced back to
        // the receipt it is about, rather than only to a position in a list.
        extra: { key: p.key, receiptId: p.receiptId },
      })),
    });
    return true;
  } catch {
    // A scheduling failure must not take the app down: the receipts and their
    // deadlines are all still on screen, which is the part that matters.
    return false;
  }
}

/**
 * Open the receipt a tapped notification is about.
 *
 * The `extra` the scheduler attaches is the only link back: iOS hands the
 * notification to the app, not a receipt. Resolving it is the reducer's job,
 * because whether that receipt is still held is a question about state — the
 * alert may have been lodged weeks before it was tapped.
 *
 * Returns its own unsubscribe, so a re-render cannot stack listeners.
 */
export async function onNotificationTap(
  open: (receiptId: string, key: string) => void,
): Promise<() => void> {
  if (!isNative()) return () => {};
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const handle = await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const extra = action.notification.extra as { receiptId?: unknown; key?: unknown } | undefined;
      const id = extra?.receiptId;
      const key = extra?.key;
      if (typeof id === 'string' && id && typeof key === 'string' && key) open(id, key);
    });
    return () => void handle.remove();
  } catch {
    return () => {};
  }
}
