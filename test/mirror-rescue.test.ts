import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The rescue itself, not just the decision behind it.
 *
 * `mirror.test.ts` covers `chooseSource`, which is pure and is where the
 * judgement lives. This covers the WIRING — that a save really does reach the
 * second copy, that a launch with the live store gone really does put it back,
 * and that the web build does none of it. That wiring is the most consequential
 * code on this branch: it is what stands between a WKWebView the system has
 * reclaimed and somebody losing every receipt they own.
 *
 * It cannot be run on a device from here, and a stub is not a phone. What it
 * does establish is that the logic and the plumbing are right, which is the
 * half that was previously asserted rather than shown.
 */

const files = new Map<string, string>();

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Documents: 'DOCUMENTS' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    readFile: async ({ path }: { path: string }) => {
      if (!files.has(path)) throw new Error('ENOENT');
      return { data: files.get(path) };
    },
    writeFile: async ({ path, data }: { path: string; data: string }) => {
      files.set(path, data);
    },
  },
}));

const KEY = 'kept.v1';

function fakeLocalStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _map: map,
  };
}

let store: ReturnType<typeof fakeLocalStorage>;

function boot(native: boolean) {
  store = fakeLocalStorage();
  (globalThis as Record<string, unknown>).window = {
    localStorage: store,
    ...(native ? { Capacitor: { isNativePlatform: () => true } } : {}),
  };
}

/** The mirror write is deliberately not awaited by `save`, so poll for it. */
async function settle() {
  for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
}

const library = (ids: string[]) =>
  JSON.stringify({
    version: 1,
    receipts: ids.map((id) => ({ id })),
    updates: [],
    onboardingSeen: true,
    settings: {},
    alertsSent: [],
  });

beforeEach(() => {
  files.clear();
  vi.resetModules();
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe('on iOS', () => {
  it('a save reaches the second copy', async () => {
    boot(true);
    const { save } = await import('../src/lib/storage');
    save(JSON.parse(library(['a', 'b'])));
    await settle();
    expect(files.get('kept-receipts.json')).toBeTruthy();
    expect(JSON.parse(files.get('kept-receipts.json')!).receipts).toHaveLength(2);
  });

  it('puts the library back when the web view has lost it', async () => {
    boot(true);
    const { save, restoreFromMirror } = await import('../src/lib/storage');
    save(JSON.parse(library(['a', 'b'])));
    await settle();

    // The system reclaimed WKWebView's storage: the file survives, the store
    // does not. This is the failure the whole mirror exists for.
    store._map.clear();
    expect(store.getItem(KEY)).toBeNull();

    expect(await restoreFromMirror()).toBe(true);
    expect(JSON.parse(store.getItem(KEY)!).receipts).toHaveLength(2);
  });

  it('leaves a healthy store alone', async () => {
    boot(true);
    const { save, restoreFromMirror } = await import('../src/lib/storage');
    save(JSON.parse(library(['a', 'b'])));
    await settle();
    // A newer library than the mirror holds, as if a save had not yet mirrored.
    store.setItem(KEY, library(['a', 'b', 'c']));

    expect(await restoreFromMirror()).toBe(false);
    expect(JSON.parse(store.getItem(KEY)!).receipts).toHaveLength(3);
  });

  it('mirrors the erase rather than preserving what was erased', async () => {
    boot(true);
    const { save, restoreFromMirror } = await import('../src/lib/storage');
    save(JSON.parse(library(['a', 'b'])));
    await settle();

    save(JSON.parse(library([])));
    await settle();

    expect(await restoreFromMirror()).toBe(false);
    expect(JSON.parse(files.get('kept-receipts.json')!).receipts).toEqual([]);
  });

  it('does NOT undo an erase, even when the mirror still holds the old library', async () => {
    /*
     * The state that actually matters, and the one the obvious version of this
     * test could not reach.
     *
     * Written the obvious way — erase, then ask — BOTH copies end up empty,
     * because the erase is mirrored like any other save. The choice is then
     * never made, and the test passed with `looksLikeState` mutated to reject
     * empty libraries: it was agreeing with itself, not checking anything.
     * Found by mutation, which is the only reason it is written this way.
     *
     * So the divergence is constructed directly: the erase committed locally,
     * the mirror write did not land. A crash between the two does this, and so
     * does a file system that refused the write. If an empty library did not
     * count as an answer, THIS is the launch where someone who erased their
     * receipts finds every one of them back.
     */
    boot(true);
    const { save, restoreFromMirror } = await import('../src/lib/storage');
    save(JSON.parse(library(['a', 'b'])));
    await settle();

    // The erase, local only — the mirror is left holding a and b.
    store.setItem(KEY, library([]));
    expect(JSON.parse(files.get('kept-receipts.json')!).receipts).toHaveLength(2);

    expect(await restoreFromMirror()).toBe(false);
    expect(JSON.parse(store.getItem(KEY)!).receipts).toEqual([]);
  });
});

describe('on the web', () => {
  it('writes no second copy and rescues nothing', async () => {
    // The web build must behave exactly as it did before any of this existed.
    boot(false);
    const { save, restoreFromMirror } = await import('../src/lib/storage');
    save(JSON.parse(library(['a'])));
    await settle();

    expect(files.size).toBe(0);
    expect(await restoreFromMirror()).toBe(false);
  });
});
