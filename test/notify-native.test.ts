import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Which permission system the app asks, and what the row says about it.
 *
 * The iOS app can do the thing a web app cannot — wake itself at 9am — and
 * every question in `notify.ts` was answering for the browser, so the switch
 * that turns it on rendered disabled and labelled "Not available here", above
 * a sentence promising the deadlines are lodged with iOS in advance. Measured
 * before the fix, on a bridge with no `Notification` global: `notifyState()`
 * returned 'unsupported', `requestNotifyPermission()` returned 'unsupported'
 * too, so `deadlineAlerts` could never become true and `syncScheduled` never
 * received a non-empty plan.
 *
 * These drive the plugin rather than a phone, so what is proved is which
 * authority is consulted and what is done with the four answers — the part
 * that was wrong. Whether iOS itself honours a granted permission is not
 * something any test here can claim.
 */

const calls: string[] = [];
let display = 'prompt';
let afterRequest = 'granted';

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: async () => {
      calls.push('check');
      return { display };
    },
    requestPermissions: async () => {
      calls.push('request');
      return { display: afterRequest };
    },
  },
}));

/** The iOS app: the bridge is there, and WKWebView exposes no Notification. */
function native() {
  (globalThis as Record<string, unknown>).window = { Capacitor: { isNativePlatform: () => true } };
  delete (globalThis as Record<string, unknown>).Notification;
}

/** A browser: no bridge, and a Notification constructor that answers. */
function web(permission: string) {
  const win: Record<string, unknown> = {};
  win.self = win;
  win.top = win;
  (globalThis as Record<string, unknown>).window = win;
  (globalThis as Record<string, unknown>).Notification = { permission, requestPermission: async () => permission };
}

beforeEach(() => {
  calls.length = 0;
  display = 'prompt';
  afterRequest = 'granted';
  vi.resetModules();
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
  delete (globalThis as Record<string, unknown>).Notification;
});

describe('which permission system is the authority', () => {
  it('asks the plugin on native, where there is no Notification to ask', async () => {
    native();
    display = 'granted';
    const { currentNotifyState } = await import('../src/app/notify');
    expect(await currentNotifyState()).toBe('granted');
    expect(calls).toEqual(['check']);
  });

  it('lets the switch be turned on in the iOS app', async () => {
    native();
    display = 'prompt';
    afterRequest = 'granted';
    const { requestNotifyPermission } = await import('../src/app/notify');
    // This is the whole defect in one line: the value Settings feeds into
    // `deadlineAlerts`, which gates every call to `syncScheduled`.
    expect(await requestNotifyPermission()).toBe('granted');
    expect(calls).toEqual(['check', 'request']);
  });

  it('does not raise the one-shot dialog again after a refusal', async () => {
    native();
    display = 'denied';
    const { requestNotifyPermission } = await import('../src/app/notify');
    expect(await requestNotifyPermission()).toBe('denied');
    expect(calls).toEqual(['check']);
  });

  it('reads prompt-with-rationale as nobody having been asked', async () => {
    native();
    display = 'prompt-with-rationale';
    const { currentNotifyState } = await import('../src/app/notify');
    expect(await currentNotifyState()).toBe('default');
  });

  it('leaves the browser answering for itself, and never loads the plugin', async () => {
    web('granted');
    const { currentNotifyState, requestNotifyPermission } = await import('../src/app/notify');
    expect(await currentNotifyState()).toBe('granted');
    expect(await requestNotifyPermission()).toBe('granted');
    expect(calls).toEqual([]);
  });
});

describe('delivering while the app is open', () => {
  it('shows nothing itself on native, so a lodged alert is not cancelled', async () => {
    /*
     * Not merely a duplicate banner. What `deliver` returns is recorded in
     * `alertsSent`, and `planAlerts` drops anything already said — so one web
     * notification shown with the app open would silently withdraw the lodged
     * one that was meant to arrive with it closed.
     */
    (globalThis as Record<string, unknown>).window = {
      Capacitor: { isNativePlatform: () => true },
      self: 1,
      top: 1,
    };
    let constructed = 0;
    (globalThis as Record<string, unknown>).Notification = class {
      static permission = 'granted';
      constructor() {
        constructed += 1;
      }
    };
    const { deliver } = await import('../src/app/notify');
    const alert = {
      key: 'r1:today',
      receiptId: 'r1',
      rung: 'today' as const,
      title: 'Today is the last day',
      body: 'Currys · Headphones',
    };
    expect(await deliver([alert])).toEqual([]);
    expect(constructed).toBe(0);
  });
});

describe('what the row says', () => {
  it('offers the switch on native before anyone has been asked', async () => {
    const { alertsRow } = await import('../src/app/notify');
    const row = alertsRow({ permission: 'default', preference: false, native: true });
    expect(row.disabled).toBe(false);
    expect(row.detail).toBe('Off');
    expect(row.note).toContain('even if kept is closed');
  });

  it('does not promise a closed-app alert in a browser', async () => {
    const { alertsRow } = await import('../src/app/notify');
    const row = alertsRow({ permission: 'granted', preference: true, native: false });
    expect(row.on).toBe(true);
    expect(row.note).toContain('cannot wake itself');
  });

  it('sends someone to the right settings screen when blocked', async () => {
    const { alertsRow } = await import('../src/app/notify');
    expect(alertsRow({ permission: 'denied', preference: true, native: true }).note).toContain('iOS');
    expect(alertsRow({ permission: 'denied', preference: true, native: false }).note).toContain('browser');
  });

  it('greys the switch out only where a tap cannot change the answer', async () => {
    const { alertsRow } = await import('../src/app/notify');
    const disabled = (permission: 'unsupported' | 'default' | 'granted' | 'denied') =>
      alertsRow({ permission, preference: true, native: true }).disabled;
    expect(disabled('denied')).toBe(true);
    expect(disabled('unsupported')).toBe(true);
    expect(disabled('default')).toBe(false);
    expect(disabled('granted')).toBe(false);
  });

  it('never reads On beside a switch sitting off', async () => {
    const { alertsRow } = await import('../src/app/notify');
    // The preference can outlive the permission: granted, switched on, then
    // revoked in the OS. The label follows the switch, not the stored boolean.
    const row = alertsRow({ permission: 'denied', preference: true, native: true });
    expect(row.on).toBe(false);
    expect(row.detail).not.toBe('On');
  });
});
