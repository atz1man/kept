import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeadlineAlert } from '../src/lib/alerts';
import type { PlannedAlert } from '../src/lib/schedule';

/*
 * The landing page's demo, asked to touch each thing the device keeps.
 *
 * The demo is this build at this origin, opened as `/app/?embed=1`, and its
 * receipts lived in memory. That held for everything that went through the
 * reducer and nothing that did not. Measured on the built app, from the demo:
 * Erase everything wrote an empty library over the visitor's real one
 * ([Sofa, Kettle, Coat] became []); Settings showed the real set-aside copy
 * and "Save them as a file" threw it away; opening the demo over an unreadable
 * store set a copy of it aside; and the demo opened on its own raised the
 * origin's notification prompt and delivered a notification.
 *
 * Every store now asks `embedded()` at its own door. Each door is asked here
 * from the demo, and then from the real app, so a refusal cannot pass by
 * being a door that is simply shut to everybody.
 */

/** Every call either plugin was asked to make, by name. */
const bridge: string[] = [];

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Documents: 'DOCUMENTS' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: Object.fromEntries(
    ['readFile', 'writeFile', 'rename', 'deleteFile', 'mkdir', 'rmdir', 'readdir'].map((method) => [
      method,
      async () => {
        bridge.push(`Filesystem.${method}`);
        if (method === 'readdir') return { files: [{ name: 'seed_currys.jpg' }] };
        if (method === 'readFile') return { data: '{"version":1,"receipts":[]}' };
        return {};
      },
    ]),
  ),
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: async () => {
      bridge.push('LocalNotifications.checkPermissions');
      return { display: 'prompt' };
    },
    requestPermissions: async () => {
      bridge.push('LocalNotifications.requestPermissions');
      return { display: 'granted' };
    },
    getPending: async () => {
      bridge.push('LocalNotifications.getPending');
      return { notifications: [{ id: 1 }] };
    },
    cancel: async () => void bridge.push('LocalNotifications.cancel'),
    schedule: async () => void bridge.push('LocalNotifications.schedule'),
    addListener: async () => {
      bridge.push('LocalNotifications.addListener');
      return { remove: () => {} };
    },
  },
}));

const DEMO = '?embed=1';
const APP = '';

const LIBRARY = JSON.stringify({
  version: 1,
  onboardingSeen: true,
  receipts: [
    {
      id: 'r_1', store: 'John Lewis', item: 'Sofa', cat: 'other', amount: 89900, purchasedOn: '2026-09-28',
      windowDays: 35, policy: 'John Lewis · 35 days', distance: false, status: 'active',
    },
  ],
});
const SET_ASIDE = '{"version":1,"receipts":[{"id":"lost","store":"Currys"';

/** A page opened at this address, with a store that records everything done to it. */
function page(search: string, { native = false, cells = {} as Record<string, string> } = {}) {
  const store = new Map(Object.entries(cells));
  const touched: string[] = [];
  const listening: string[] = [];
  const win: Record<string, unknown> = {
    location: { search },
    localStorage: {
      getItem: (k: string) => {
        touched.push(`read ${k}`);
        return store.get(k) ?? null;
      },
      setItem: (k: string, v: string) => {
        touched.push(`write ${k}`);
        store.set(k, v);
      },
      removeItem: (k: string) => {
        touched.push(`remove ${k}`);
        store.delete(k);
      },
    },
    addEventListener: (type: string) => void listening.push(type),
    removeEventListener: () => {},
  };
  win.self = win;
  win.top = win;
  if (native) win.Capacitor = { isNativePlatform: () => true };
  (globalThis as Record<string, unknown>).window = win;
  return { store, touched, listening };
}

/** A browser's notifications: what it has been asked, and what it has shown. */
function browserNotifications(permission: 'default' | 'granted') {
  const seen = { asked: 0, shown: 0 };
  (globalThis as Record<string, unknown>).Notification = class {
    static permission = permission;
    static requestPermission = async () => {
      seen.asked += 1;
      return 'granted';
    };
    constructor() {
      seen.shown += 1;
    }
  };
  return seen;
}

const TODAY = new Date(2026, 9, 4);
const alert: DeadlineAlert = { key: 'r_1:today', receiptId: 'r_1', rung: 'today', title: 'Today is the last day', body: 'John Lewis · Sofa' };
const planned: PlannedAlert = { ...alert, at: new Date(Date.now() + 86_400_000) };

const settle = async () => {
  for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
};

beforeEach(() => {
  bridge.length = 0;
  vi.resetModules();
});

afterEach(() => {
  for (const key of ['window', 'Notification']) delete (globalThis as Record<string, unknown>)[key];
});

describe('which page is the demo', () => {
  it('is the page opened with ?embed, whatever its value, and no other', async () => {
    const cases: [string, boolean][] = [
      ['?embed=1', true], ['?embed', true], ['?x=1&embed=', true],
      ['', false], ['?text=embed', false], ['?embedded=1', false],
    ];
    for (const [search, demo] of cases) {
      vi.resetModules();
      page(search);
      const { embedded } = await import('../src/lib/embed');
      expect(embedded(), search || '(no query)').toBe(demo);
    }
  });

  it('decides once, so a demo cannot turn into the real app halfway through', async () => {
    page(DEMO);
    const { embedded } = await import('../src/lib/embed');
    expect(embedded()).toBe(true);
    // Whatever later happens to the address, the stores keep refusing.
    (globalThis as { window: { location: unknown } }).window.location = { search: '' };
    expect(embedded()).toBe(true);
  });

  it('is not the demo where there is no address to read', async () => {
    (globalThis as Record<string, unknown>).window = { localStorage: {} };
    const { embedded } = await import('../src/lib/embed');
    expect(embedded()).toBe(false);
  });
});

describe('the library, and the copy a bad launch set aside', () => {
  it('Erase everything in the demo leaves both exactly where they were', async () => {
    const tab = page(DEMO, { cells: { 'kept.v1': LIBRARY, 'kept.v1.unreadable': SET_ASIDE } });
    const { wipe } = await import('../src/lib/storage');
    wipe();
    expect(tab.store.get('kept.v1')).toBe(LIBRARY);
    expect(tab.store.get('kept.v1.unreadable')).toBe(SET_ASIDE);
    expect(tab.touched).toEqual([]);
  });

  it('and in the app it still erases both', async () => {
    const tab = page(APP, { cells: { 'kept.v1': LIBRARY, 'kept.v1.unreadable': SET_ASIDE } });
    const { wipe } = await import('../src/lib/storage');
    wipe();
    expect(JSON.parse(tab.store.get('kept.v1')!).receipts).toEqual([]);
    expect(tab.store.has('kept.v1.unreadable')).toBe(false);
  });

  it('the demo reads nothing at launch, so it sets nothing aside', async () => {
    const tab = page(DEMO, { cells: { 'kept.v1': SET_ASIDE } });
    const { load } = await import('../src/lib/storage');
    // The designed state, not the visitor's library: the five samples.
    expect(load(TODAY).receipts.every((r) => r.demo)).toBe(true);
    expect(tab.touched).toEqual([]);
    expect(tab.store.has('kept.v1.unreadable')).toBe(false);
  });

  it('while the app, launched over the same store, sets it aside', async () => {
    const tab = page(APP, { cells: { 'kept.v1': SET_ASIDE } });
    const { load } = await import('../src/lib/storage');
    load(TODAY);
    expect(tab.store.get('kept.v1.unreadable')).toBe(SET_ASIDE);
  });

  it('the demo is neither shown the set-aside copy nor able to discard it', async () => {
    const tab = page(DEMO, { cells: { 'kept.v1.unreadable': SET_ASIDE } });
    const { discardSetAside, setAsideData } = await import('../src/lib/storage');
    expect(setAsideData()).toBeNull();
    discardSetAside();
    expect(tab.store.get('kept.v1.unreadable')).toBe(SET_ASIDE);
    expect(tab.touched).toEqual([]);
  });

  it('while the app is shown it, and can let it go once it is saved', async () => {
    const tab = page(APP, { cells: { 'kept.v1.unreadable': SET_ASIDE } });
    const { discardSetAside, setAsideData } = await import('../src/lib/storage');
    expect(setAsideData()).toBe(SET_ASIDE);
    discardSetAside();
    expect(tab.store.has('kept.v1.unreadable')).toBe(false);
  });

  it('a rescue from the demo hands over nothing, where the app hands over the library', async () => {
    const demoTab = page(DEMO, { cells: { 'kept.v1': LIBRARY } });
    const fromDemo = (await import('../src/lib/storage')).rescueBackup();
    expect(fromDemo).toBeNull();
    expect(demoTab.touched).toEqual([]);

    vi.resetModules();
    page(APP, { cells: { 'kept.v1': LIBRARY } });
    const fromApp = (await import('../src/lib/storage')).rescueBackup();
    expect(fromApp?.text).toContain('Sofa');
  });

  it('the demo saves nothing, where the app saves', async () => {
    const parsed = JSON.parse(LIBRARY);
    const state = { ...parsed, updates: [], settings: { urgentDays: 7, plan: 'free', deadlineAlerts: true, policyWatch: true, remindersExplained: false }, alertsSent: [] };
    const demoTab = page(DEMO);
    (await import('../src/lib/storage')).save(state);
    expect(demoTab.touched).toEqual([]);

    vi.resetModules();
    const appTab = page(APP);
    (await import('../src/lib/storage')).save(state);
    expect(appTab.store.get('kept.v1')).toContain('Sofa');
  });

  it('the demo does not listen for the real app writing, where the app does', async () => {
    const demoTab = page(DEMO);
    (await import('../src/lib/storage')).onExternalChange(() => {}, TODAY)();
    expect(demoTab.listening).toEqual([]);

    vi.resetModules();
    const appTab = page(APP);
    (await import('../src/lib/storage')).onExternalChange(() => {}, TODAY)();
    expect(appTab.listening).toEqual(['storage']);
  });
});

describe('an iPhone’s files: the mirror, the photographs, a saved backup', () => {
  it('none of them is reached from the demo', async () => {
    page(DEMO, { native: true, cells: { 'kept.v1': LIBRARY } });
    const storage = await import('../src/lib/storage');
    const photos = await import('../src/lib/photos');
    const mirror = await import('../src/lib/mirror');
    const files = await import('../src/lib/save-file');
    storage.wipe();
    // The demo's samples carry the same ids as the real app's samples, so a
    // photo kept from the demo would have landed on the real one's file.
    expect(await photos.savePhoto('seed_currys', 'AAAA')).toBe(false);
    expect(await photos.readPhoto('seed_currys')).toBeNull();
    await photos.deletePhoto('seed_currys');
    await photos.erasePhotos();
    expect(await photos.cleanupPhotos([])).toBe(0);
    expect(await mirror.writeMirror('{"version":1,"receipts":[]}')).toBe(false);
    expect((await mirror.readMirrorWithin(500)).raw).toBeNull();
    expect(await storage.restoreFromMirror(500)).toBe(false);
    expect((await files.saveJsonFile('kept-backup-2026-10-04.json', '{}')).to).toBe('nowhere');
    await settle();
    await mirror.mirrorSettled();
    expect(bridge).toEqual([]);
  });

  it('while the app reaches them as it always has', async () => {
    page(APP, { native: true, cells: { 'kept.v1': LIBRARY } });
    const storage = await import('../src/lib/storage');
    const photos = await import('../src/lib/photos');
    const mirror = await import('../src/lib/mirror');
    expect(await photos.savePhoto('seed_currys', 'AAAA')).toBe(true);
    storage.wipe();
    await settle();
    await mirror.mirrorSettled();
    expect(bridge).toEqual(expect.arrayContaining(['Filesystem.writeFile', 'Filesystem.rename', 'Filesystem.rmdir']));
  });
});

describe('notifications', () => {
  it('nothing is lodged, cancelled, listened for or asked from the demo on an iPhone', async () => {
    page(DEMO, { native: true });
    const { onNotificationTap, syncScheduled } = await import('../src/app/schedule-native');
    const { currentNotifyState, requestNotifyPermission } = await import('../src/app/notify');
    expect(await syncScheduled([planned])).toBe(false);
    expect(await syncScheduled([])).toBe(false);
    (await onNotificationTap(() => {}))();
    await requestNotifyPermission();
    await currentNotifyState();
    expect(bridge).toEqual([]);
  });

  it('while the app lodges its plan, replacing what was there', async () => {
    page(APP, { native: true });
    const { syncScheduled } = await import('../src/app/schedule-native');
    expect(await syncScheduled([planned])).toBe(true);
    expect(bridge).toEqual(expect.arrayContaining(['LocalNotifications.cancel', 'LocalNotifications.schedule']));
  });

  it('the demo asks the browser nothing, outside a frame as well as in one', async () => {
    page(DEMO);
    const seen = browserNotifications('default');
    const { requestNotifyPermission } = await import('../src/app/notify');
    expect(await requestNotifyPermission()).toBe('default');
    expect(seen.asked).toBe(0);
  });

  it('while the app asks, when the switch is turned on', async () => {
    page(APP);
    const seen = browserNotifications('default');
    const { requestNotifyPermission } = await import('../src/app/notify');
    expect(await requestNotifyPermission()).toBe('granted');
    expect(seen.asked).toBe(1);
  });

  it('the demo shows nothing, outside a frame as well as in one', async () => {
    page(DEMO);
    const seen = browserNotifications('granted');
    const { deliver } = await import('../src/app/notify');
    expect(await deliver([alert])).toEqual([]);
    expect(seen.shown).toBe(0);
  });

  it('while the app shows what is due', async () => {
    page(APP);
    const seen = browserNotifications('granted');
    const { deliver } = await import('../src/app/notify');
    expect(await deliver([alert])).toHaveLength(1);
    expect(seen.shown).toBe(1);
  });
});
