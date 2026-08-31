import { isNative } from '../lib/mirror';
import type { DeadlineAlert } from '../lib/alerts';

/**
 * Delivering an alert on this platform, and being straight about the limits.
 *
 * A web app cannot wake itself at 9am to tell you about a coat. Notification
 * Triggers never shipped, and Periodic Background Sync is one engine's, only
 * for installed apps, and granted at the browser's discretion. So the honest
 * contract is: alerts are computed whenever kept is opened or brought back to
 * the foreground, and the Settings screen says exactly that rather than
 * implying a background service that does not exist. The engine in
 * lib/alerts.ts is where the decisions live and does not care how they are
 * delivered — when a native shell or a push path arrives, only this file
 * changes.
 *
 * The native shell has arrived, and this file did NOT change with it, which
 * was the defect. WKWebView exposes no `Notification` constructor, so every
 * question here answered "unsupported" on the one platform that can actually
 * wake itself — the Settings switch rendered disabled and labelled "Not
 * available here", directly above the sentence promising alerts are lodged
 * with iOS in advance. Measured: on a simulated bridge with no `Notification`
 * global, `notifyState()` returned 'unsupported' and `requestNotifyPermission()`
 * returned it too, so `deadlineAlerts` could never be set true and
 * `syncScheduled` never received a non-empty plan.
 *
 * The web permission would be the wrong authority even if it existed there: a
 * local notification is granted to the APP by iOS, and `LocalNotifications`
 * is what holds that answer. So every native branch below asks the plugin,
 * and none of them depends on whether `Notification` happens to be defined.
 */

export type NotifyState = 'unsupported' | 'default' | 'granted' | 'denied';

/**
 * At most this many at once — an app that stacks up notifications gets muted.
 *
 * Deliberately NOT pinned by a test, on this codebase's rule that a threshold
 * we chose is not a fact: three or four both serve the sentence above, and a
 * test asserting the literal would only restate it. What IS asserted, in
 * notify-delivery.test.ts, is the property — that a cap exists and bites, that
 * the overflow is left unrecorded so it comes up again rather than vanishing,
 * and that the batch is taken from the FRONT of a list that arrives most
 * urgent first. This is the one surviving mutant in the file, and it survives
 * on purpose.
 */
const MAX_PER_WAKE = 3;

/**
 * Imported only once the platform check has passed, so a browser never loads
 * it — the same rule `mirror.ts` follows for the filesystem plugin.
 */
async function local() {
  const mod = await import('@capacitor/local-notifications');
  return mod.LocalNotifications;
}

/**
 * Capacitor answers with four states and this file has three. 'prompt' and
 * 'prompt-with-rationale' both mean nobody has been asked yet, which is what
 * the web calls 'default'.
 */
function fromDisplay(display: string): NotifyState {
  if (display === 'granted') return 'granted';
  if (display === 'denied') return 'denied';
  return 'default';
}

/** The web answer. Synchronous, so a screen can seed its state with it. */
export function notifyState(): NotifyState {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as NotifyState;
}

/**
 * The answer for whichever platform this is. Asynchronous because the native
 * one has to cross the bridge, which is why `notifyState` still exists beside
 * it: a screen seeds synchronously and then corrects itself from this.
 */
export async function currentNotifyState(): Promise<NotifyState> {
  if (!isNative()) return notifyState();
  try {
    return fromDisplay((await (await local()).checkPermissions()).display);
  } catch {
    return 'unsupported';
  }
}

/** True when this is the landing page's embedded demo rather than the real app. */
function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // A cross-origin frame throws on the comparison, which is itself the answer.
    return true;
  }
}

export async function requestNotifyPermission(): Promise<NotifyState> {
  if (isNative()) {
    try {
      const LocalNotifications = await local();
      // Asked first because iOS raises its dialog once and never again: after
      // a refusal `requestPermissions` returns denied silently, and reading
      // the standing answer keeps that one-shot rule visible here rather than
      // only in `schedule-native.ts`.
      const standing = fromDisplay((await LocalNotifications.checkPermissions()).display);
      if (standing !== 'default') return standing;
      return fromDisplay((await LocalNotifications.requestPermissions()).display);
    } catch {
      return 'unsupported';
    }
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  // Permission prompts are blocked in frames, and the marketing page's demo
  // has no business asking for one.
  if (isEmbedded()) return notifyState();
  try {
    return (await Notification.requestPermission()) as NotifyState;
  } catch {
    return notifyState();
  }
}

/**
 * Shows the alerts and returns the ones actually delivered, so the caller
 * records exactly what was said. Anything beyond the cap is left unrecorded
 * and comes up again next time, rather than being silently swallowed.
 */
export async function deliver(alerts: readonly DeadlineAlert[]): Promise<DeadlineAlert[]> {
  /*
   * Never on native, and stated rather than left to fall out of WKWebView
   * having no `Notification`. The system raises these from the plan lodged by
   * `schedule-native.ts`, and a second copy here would not merely duplicate
   * the banner: what `deliver` returns is recorded in `alertsSent`, and
   * `planAlerts` drops anything already said — so a web notification shown
   * while the app is open would silently cancel the lodged one that was
   * supposed to arrive with the app closed.
   */
  if (isNative()) return [];
  if (notifyState() !== 'granted' || isEmbedded()) return [];
  const batch = alerts.slice(0, MAX_PER_WAKE);
  if (batch.length === 0) return [];

  // The service worker's notifications survive the tab closing and can be
  // clicked back into the app; the constructor is the fallback where no
  // worker is registered.
  let registration: ServiceWorkerRegistration | undefined;
  try {
    registration = await navigator.serviceWorker?.ready;
  } catch {
    registration = undefined;
  }

  const shown: DeadlineAlert[] = [];
  for (const a of batch) {
    const options: NotificationOptions = {
      body: a.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // Keyed per receipt+rung so a repeat can only ever replace its own
      // notification, never pile a second one on top.
      tag: a.key,
      data: { receiptId: a.receiptId },
    };
    try {
      if (registration) await registration.showNotification(a.title, options);
      else new Notification(a.title, options);
      shown.push(a);
    } catch {
      // A refused notification is not worth taking the app down for, and an
      // undelivered alert stays unrecorded so it can be tried again.
    }
  }
  return shown;
}

/**
 * What the Deadline alerts row shows, given the two things it depends on.
 *
 * Lifted out of `Settings.tsx` because it is where the defect was and the
 * component is the one thing here nothing can render. The row had derived its
 * disabled state from the WEB permission on every platform, so the iOS app
 * showed a dead switch labelled "Not available here" above a sentence saying
 * the deadlines are lodged with iOS in advance — the screen contradicting
 * itself in adjacent lines, and the native scheduler unreachable behind it.
 *
 * The asymmetry that matters is in `disabled`. On the web an unasked
 * permission ('default') is fine to offer, because clicking the switch is what
 * raises the browser prompt; on native it is fine for the same reason, and
 * `requestNotifyPermission` crosses the bridge. Only a settled 'denied', or a
 * platform with no notifications at all, is a switch worth greying out —
 * because those are the two states a tap cannot change.
 */
export interface AlertsRow {
  /** The switch position: the preference AND permission to act on it. */
  on: boolean;
  disabled: boolean;
  detail: string;
  note: string;
}

export function alertsRow(
  { permission, preference, native }: { permission: NotifyState; preference: boolean; native: boolean },
): AlertsRow {
  const on = preference && permission === 'granted';
  const detail =
    permission === 'unsupported'
      ? 'Not available here'
      : permission === 'denied'
        ? native
          ? 'Blocked in iOS Settings'
          : 'Blocked by your browser'
        : on
          ? 'On'
          : 'Off';
  /*
   * Two different truths, and the row has to tell the right one. On the web
   * the ceiling is genuine and stated where the switch is rather than implied
   * away: Notification Triggers never shipped and periodic background sync is
   * one engine's, at its discretion. In the iOS app the deadlines are lodged
   * with the system in advance, so they do arrive with kept closed — and
   * leaving the web sentence there would be the app understating what it does,
   * which is the same species of untruth as overstating it.
   */
  const note =
    permission === 'denied'
      ? native
        ? 'iOS is blocking notifications for kept. Turn them back on in Settings › Notifications › kept.'
        : 'Your browser is blocking notifications for kept. Turn them back on in site settings.'
      : native
        ? 'Lodged with iOS in advance, so they arrive at 9am on the day even if kept is closed. Turning this off cancels the ones already waiting.'
        : 'Checked each time you open kept. Nothing arrives while kept is closed — a web app cannot wake itself.';
  return { on, disabled: permission === 'unsupported' || permission === 'denied', detail, note };
}
