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
    schedule: async () => void calls.push('schedule'),
    addListener: async () => ({ remove: () => {} }),
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
    expect(calls.indexOf('cancel')).toBeLessThan(calls.indexOf('schedule'));
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
