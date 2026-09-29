import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlannedAlert } from '../src/lib/schedule';

/*
 * Two syncs at once must leave the NEWER plan lodged with iOS.
 *
 * `syncScheduled` is fired, not awaited, on every state change, and each call
 * reads what is pending, cancels it and schedules its plan across several
 * bridge calls. Two in flight interleave: both read, both cancel, and whichever
 * finishes LAST wins — which can be the older one. Returning a receipt, or
 * switching Deadline alerts off, could leave the plan from before it lodged,
 * and alerts kept arriving about something already handled, or after the
 * person had asked them to stop.
 *
 * A fake with state, so what is lodged at the end is the thing asserted.
 */
let lodged: number[] = [];
let failOnce = false;
/** The first read of what is pending takes a moment, as a bridge call can — which is what lets a second sync overtake the first. */
let slowFirstRead = false;

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: async () => ({ display: 'granted' }),
    requestPermissions: async () => ({ display: 'granted' }),
    getPending: async () => {
      if (slowFirstRead) {
        slowFirstRead = false;
        await new Promise((r) => setTimeout(r, 20));
      }
      return { notifications: lodged.map((id) => ({ id })) };
    },
    cancel: async ({ notifications }: { notifications: { id: number }[] }) => {
      const gone = new Set(notifications.map((n) => n.id));
      lodged = lodged.filter((id) => !gone.has(id));
    },
    schedule: async ({ notifications }: { notifications: { id: number }[] }) => {
      if (failOnce) {
        failOnce = false;
        throw new Error('the bridge said no');
      }
      lodged = [...lodged, ...notifications.map((n) => n.id)];
    },
    addListener: async () => ({ remove: () => {} }),
  },
}));

const plan = (n: number): PlannedAlert[] =>
  Array.from({ length: n }, (_, i) => ({
    key: `r${i}:today`, receiptId: `r${i}`, rung: 'today' as const,
    at: new Date(Date.now() + 86_400_000), title: 't', body: 'b',
  }));

beforeEach(() => {
  lodged = [];
  failOnce = false;
  slowFirstRead = true;
  vi.resetModules();
  (globalThis as Record<string, unknown>).window = { Capacitor: { isNativePlatform: () => true } };
});
afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe('two syncs in flight', () => {
  it('leave the newer plan lodged when the newer one is shorter', async () => {
    const { syncScheduled } = await import('../src/app/schedule-native');
    const older = syncScheduled(plan(10));
    const newer = syncScheduled(plan(6));
    await Promise.all([older, newer]);
    expect(lodged.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('leave nothing lodged when the newer one is the switch going off', async () => {
    const { syncScheduled } = await import('../src/app/schedule-native');
    const older = syncScheduled(plan(3));
    const off = syncScheduled([]);
    await Promise.all([older, off]);
    expect(lodged).toEqual([]);
  });

  it('and one failing does not stop the next from running', async () => {
    const { syncScheduled } = await import('../src/app/schedule-native');
    failOnce = true;
    const first = syncScheduled(plan(2));
    const second = syncScheduled(plan(1));
    await Promise.all([first, second]);
    expect(lodged).toEqual([1]);
  });
});
