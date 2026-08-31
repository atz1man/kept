import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlannedAlert } from '../src/lib/schedule';

/*
 * When the app is allowed to ask for permission, and what it cancels.
 *
 * iOS gives an app ONE chance at the notification dialog. Someone who declines
 * it because it appeared out of nowhere has turned deadline alerts off
 * permanently — the only way back is the Settings app — so WHEN it is raised
 * is a product decision, not plumbing.
 */

const calls: string[] = [];
let permission = 'prompt';
let pending: { id: number }[] = [];
let tapHandler: ((a: unknown) => void) | null = null;
let scheduleThrows = false;

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: async () => {
      calls.push('check');
      return { display: permission };
    },
    requestPermissions: async () => {
      calls.push('request');
      return { display: permission };
    },
    getPending: async () => {
      calls.push('getPending');
      return { notifications: pending };
    },
    cancel: async () => void calls.push('cancel'),
    schedule: async () => {
      calls.push('schedule');
      if (scheduleThrows) throw new Error('the bridge said no');
    },
    addListener: async (_event: string, handler: (a: unknown) => void) => {
      tapHandler = handler;
      calls.push('addListener');
      return {
        remove: () => {
          calls.push('remove');
        },
      };
    },
  },
}));

const alert = (key: string): PlannedAlert => ({
  key,
  receiptId: 'r1',
  rung: 'today',
  at: new Date(Date.now() + 86_400_000),
  title: 'Today is the last day',
  body: 'Currys · Headphones',
});

beforeEach(() => {
  calls.length = 0;
  permission = 'prompt';
  pending = [];
  tapHandler = null;
  scheduleThrows = false;
  vi.resetModules();
  (globalThis as Record<string, unknown>).window = { Capacitor: { isNativePlatform: () => true } };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe('asking for permission', () => {
  it('does NOT ask when there is nothing to schedule', async () => {
    /*
     * The first launch. A fresh install holds five demo receipts and nothing
     * else, and `planAlerts` raises nothing about those — a notification is not
     * a demonstration — so the plan is empty. Asking here meant the system
     * dialog appeared the instant the app opened, about nothing, and spent the
     * single chance iOS allows.
     */
    const { syncScheduled } = await import('../src/app/schedule-native');
    await syncScheduled([]);
    expect(calls).not.toContain('request');
    expect(calls).not.toContain('check');
  });

  it('asks once there is a deadline to warn about', async () => {
    permission = 'granted';
    const { syncScheduled } = await import('../src/app/schedule-native');
    await syncScheduled([alert('r1:today')]);
    expect(calls).toContain('check');
    expect(calls).toContain('schedule');
  });

  it('does not schedule anything when permission is refused', async () => {
    permission = 'denied';
    const { syncScheduled } = await import('../src/app/schedule-native');
    expect(await syncScheduled([alert('r1:today')])).toBe(false);
    expect(calls).not.toContain('schedule');
  });
});

describe('cancelling', () => {
  it('clears what is lodged even with an empty plan and no permission', async () => {
    /*
     * This is the switch being turned off. It has to work regardless of the
     * permission state, or alerts granted last week keep arriving for weeks
     * after the person asked them to stop — which would make the control a
     * stored boolean nothing acts on, the defect `policyWatch` already was.
     */
    permission = 'denied';
    pending = [{ id: 1 }, { id: 2 }];
    const { syncScheduled } = await import('../src/app/schedule-native');
    expect(await syncScheduled([])).toBe(true);
    expect(calls).toContain('cancel');
    expect(calls).not.toContain('request');
  });

  it('cancels before it schedules, so the plan replaces rather than piles up', async () => {
    permission = 'granted';
    pending = [{ id: 1 }];
    const { syncScheduled } = await import('../src/app/schedule-native');
    await syncScheduled([alert('r1:today')]);
    // Both assertions, because the ordering one alone could not fail in the
    // direction it guards: a cancel that never happens gives indexOf -1, which
    // is duly less than the index of the schedule.
    expect(calls).toContain('cancel');
    expect(calls.indexOf('cancel')).toBeLessThan(calls.indexOf('schedule'));
  });

  it('clears a lodged alert even when there is only one of them', async () => {
    /*
     * `pending.notifications.length > 0` — and every test above happened to
     * use two. Off-by-one and the person who switched alerts off still gets
     * the one that was already waiting, which is the failure this whole cancel
     * path exists to prevent.
     */
    pending = [{ id: 1 }];
    const { syncScheduled } = await import('../src/app/schedule-native');
    await syncScheduled([]);
    expect(calls).toContain('cancel');
  });

  it('reports that the plan was lodged', async () => {
    permission = 'granted';
    const { syncScheduled } = await import('../src/app/schedule-native');
    expect(await syncScheduled([alert('r1:today')])).toBe(true);
  });

  it('says so rather than throwing when the bridge refuses', async () => {
    /*
     * A scheduling failure must not take the app down: the receipts and their
     * deadlines are all still on screen, which is the part that matters. The
     * catch was there and nothing had ever entered it.
     */
    permission = 'granted';
    scheduleThrows = true;
    const { syncScheduled } = await import('../src/app/schedule-native');
    await expect(syncScheduled([alert('r1:today')])).resolves.toBe(false);
  });

  it('does not call cancel when nothing is lodged', async () => {
    // The other side of the same comparison: a fresh install has nothing to
    // clear, and a bridge call that can only be a no-op is one worth not making.
    pending = [];
    const { syncScheduled } = await import('../src/app/schedule-native');
    await syncScheduled([]);
    expect(calls).not.toContain('cancel');
  });
});

describe('a tapped notification', () => {
  /*
   * The `extra` the scheduler attaches is the only link from a notification
   * back to the receipt it is about — iOS hands the app the notification, not
   * the receipt. Nothing here had a test, and every guard in it survived
   * mutation.
   */
  const tap = (extra: unknown) => tapHandler?.({ notification: { extra } });

  it('opens the receipt the notification was about', async () => {
    const { onNotificationTap } = await import('../src/app/schedule-native');
    const opened: [string, string][] = [];
    await onNotificationTap((id, key) => opened.push([id, key]));
    tap({ receiptId: 'r1', key: 'r1:today' });
    expect(opened).toEqual([['r1', 'r1:today']]);
  });

  it('opens nothing when the payload is not what it should be', async () => {
    /*
     * A notification lodged weeks ago by an older build, or one whose extra
     * did not survive the round trip. Opening on a blank or non-string id
     * would navigate the app to a receipt that is not there.
     */
    const { onNotificationTap } = await import('../src/app/schedule-native');
    const opened: unknown[] = [];
    await onNotificationTap((id, key) => opened.push([id, key]));
    for (const extra of [
      undefined,
      {},
      { receiptId: 'r1' },
      { key: 'r1:today' },
      { receiptId: '', key: 'r1:today' },
      { receiptId: 'r1', key: '' },
      { receiptId: 7, key: 'r1:today' },
      { receiptId: 'r1', key: 7 },
    ]) {
      tap(extra);
    }
    expect(opened).toEqual([]);
  });

  it('hands back an unsubscribe that actually removes the listener', async () => {
    // Returned so a re-render cannot stack listeners — every one of which
    // would open the same receipt again on a single tap.
    const { onNotificationTap } = await import('../src/app/schedule-native');
    const off = await onNotificationTap(() => {});
    expect(calls).toContain('addListener');
    off();
    expect(calls).toContain('remove');
  });

  it('listens to nothing at all on the web', async () => {
    delete (globalThis as Record<string, unknown>).window;
    const { onNotificationTap } = await import('../src/app/schedule-native');
    const off = await onNotificationTap(() => {});
    expect(calls).toEqual([]);
    // And the unsubscribe it hands back is still callable, so a caller does
    // not have to know which platform it is on.
    expect(() => off()).not.toThrow();
  });
});

describe('on the web', () => {
  it('touches the plugin at all only on native', async () => {
    delete (globalThis as Record<string, unknown>).window;
    const { syncScheduled } = await import('../src/app/schedule-native');
    expect(await syncScheduled([alert('r1:today')])).toBe(false);
    expect(calls).toEqual([]);
  });
});
