import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * A rescue that never answers must not take the app with it.
 *
 * `restoreFromMirror` runs BEFORE the first render, so a filesystem call that
 * hangs is a blank screen — nothing threw, nothing rendered, and `Recovery`
 * never hears about it because there is no error to catch. This is the one
 * failure mode of the mirror that costs more than the mirror is worth.
 *
 * Real timers and a short budget, NOT fake timers. Three attempts to fake the
 * clock here were flaky at about one run in three in the full suite and clean
 * every time in isolation, which is the signature of a race that needs load to
 * lose. The cause: `readMirror` dynamically imports the plugin before it reads,
 * and `advanceTimersByTimeAsync` advances fake time while module resolution
 * needs real async work — so the budget expired on the IMPORT, `readFile` was
 * never reached, and the test measured a hung import while claiming to measure
 * a hung read. Two of the three versions could also pass vacuously that way.
 *
 * Passing the budget in is the same seam `derive(r, today)` uses, for the same
 * reason.
 */

let resolveRead: ((value: unknown) => void) | null = null;
/** Reads of the file that hangs. */
let readCalls = 0;
/** Every file read was asked for, hanging or not. */
const reads: string[] = [];
/** What reached the mirror file, in order. */
const writes: string[] = [];
/** The disk, for every file but the one that hangs. */
const disk = new Map<string, string>();
/**
 * The file whose read never answers. The mirror itself unless a test says
 * otherwise: a write that reaches it goes through a pending file first (see
 * `write` in mirror.ts), and that read sits inside the same budget.
 */
let hangs = 'kept-receipts.json';

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Documents: 'DOCUMENTS' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    // Never settles: a plugin call waiting on a bridge that will not answer.
    readFile: async ({ path }: { path: string }) => {
      reads.push(path);
      if (path !== hangs) {
        if (!disk.has(path)) throw new Error('ENOENT');
        return { data: disk.get(path) };
      }
      readCalls += 1;
      return new Promise((res) => {
        resolveRead = res;
      });
    },
    writeFile: async ({ path, data }: { path: string; data: string }) => {
      if (path === 'kept-receipts.json') writes.push(data);
      disk.set(path, data);
    },
    // Capacitor 6 on iOS: remove the destination, then move (Filesystem.swift:132-149).
    rename: async ({ from, to }: { from: string; to: string }) => {
      disk.delete(to);
      if (!disk.has(from)) throw new Error('ENOENT');
      const data = disk.get(from)!;
      disk.delete(from);
      disk.set(to, data);
      if (to === 'kept-receipts.json') writes.push(data);
    },
  },
}));

const BUDGET = 25;

beforeEach(() => {
  readCalls = 0;
  resolveRead = null;
  writes.length = 0;
  reads.length = 0;
  disk.clear();
  hangs = 'kept-receipts.json';
  (globalThis as Record<string, unknown>).window = {
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    Capacitor: { isNativePlatform: () => true },
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe('a rescue that never answers', () => {
  it('gives up inside its budget instead of holding the app forever', async () => {
    const { readMirror } = await import('../src/lib/mirror');
    const started = Date.now();
    await expect(readMirror(BUDGET)).resolves.toBeNull();
    // It really did reach the read and really did give up on it, rather than
    // falling out somewhere earlier and looking the same from outside.
    expect(readCalls).toBe(1);
    expect(resolveRead).not.toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('a late answer reaches nobody', async () => {
    /*
     * Why the budget is on the READ and not on the restore that calls it. A
     * timeout one level up would abandon the wait and let this resolution
     * arrive after the app had mounted on an empty store — and the save effect
     * would commit that empty library, which the mirror copies, making a
     * recoverable loss permanent. Here the race has already settled, so the
     * answer has nowhere to go.
     */
    const { readMirror } = await import('../src/lib/mirror');
    const first = await readMirror(BUDGET);
    expect(first).toBeNull();
    expect(resolveRead).not.toBeNull();

    resolveRead!({ data: JSON.stringify({ receipts: [{ id: 'ghost' }] }) });
    await new Promise((r) => setTimeout(r, 10));
    // The call already answered null and cannot answer twice.
    await expect(Promise.resolve(first)).resolves.toBeNull();
  });

  it('leaves the live store untouched, and never even asks, when it is healthy', async () => {
    /*
     * The cheapest defence against a hanging bridge is not to call it. An
     * ordinary launch has a readable store and returns before the filesystem
     * is touched at all — which is why `readCalls` is 0 here, and why the
     * early return in restoreFromMirror is not the mere optimisation I first
     * recorded it as.
     */
    const held = JSON.stringify({ receipts: [{ id: 'a' }] });
    (globalThis as Record<string, unknown>).window = {
      localStorage: {
        getItem: () => held,
        setItem: () => {
          throw new Error('a healthy store must not be written over');
        },
        removeItem: () => {},
      },
      Capacitor: { isNativePlatform: () => true },
    };
    const { restoreFromMirror } = await import('../src/lib/storage');
    await expect(restoreFromMirror()).resolves.toBe(false);
    expect(readCalls).toBe(0);
    expect(reads).toEqual([]);
  });

  it('holds the pending file to the same budget as the mirror', async () => {
    /*
     * The read now asks two files, the pending one first, and a budget that
     * covered only the second would let the first hang the app all over
     * again. A late answer from it is still an answer: a complete pending
     * file is the newest library there is.
     */
    hangs = 'kept-receipts.json.next';
    const { readMirrorWithin } = await import('../src/lib/mirror');
    const started = Date.now();
    const { raw, late } = await readMirrorWithin(BUDGET);
    expect(raw).toBeNull();
    expect(readCalls).toBe(1);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(late).not.toBeNull();
    const pending = JSON.stringify({ receipts: [{ id: 'pending' }] });
    resolveRead!({ data: pending });
    await expect(late).resolves.toBe(pending);
  });
});

describe('a rescue that answers late', () => {
  /*
   * The budget kept the app from hanging, and it was also the way to lose
   * everything. The web view hands back an empty store, which is the case the
   * mirror exists for. The mirror read takes longer than the budget, so the
   * app gives up and mounts on a fresh library. Its first save then committed
   * that fresh library to the mirror, whose one rule is to hold whatever was
   * committed, and the receipts that were a moment from arriving were
   * overwritten. That is the exact loss main.tsx says the ordering prevents,
   * arriving by the timeout instead.
   */
  const library = JSON.stringify({ receipts: [{ id: 'mine' }], updates: [], onboardingSeen: true });

  function nativeWindow() {
    const store = new Map<string, string>();
    const reload = vi.fn();
    (globalThis as Record<string, unknown>).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
      location: { reload },
      Capacitor: { isNativePlatform: () => true },
    };
    return { store, reload };
  }

  it('does not let the fresh boot overwrite the mirror, and brings the library back when it arrives', async () => {
    const { store, reload } = nativeWindow();
    const { restoreFromMirror, save, load } = await import('../src/lib/storage');
    const { mirrorSettled } = await import('../src/lib/mirror');

    // Gives up in time, so the app can mount.
    await expect(restoreFromMirror(BUDGET)).resolves.toBe(false);
    expect(readCalls).toBe(1);

    // The app mounts on a fresh library and saves it. Neither copy takes it.
    expect(save(load(new Date(2026, 8, 29)))).toBe(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(writes).toEqual([]);
    expect(store.get('kept.v1')).toBeUndefined();

    // The read answers after all, with the library.
    resolveRead!({ data: library });
    await new Promise((r) => setTimeout(r, 10));
    await mirrorSettled();

    expect(writes).toEqual([]);
    expect(store.get('kept.v1')).toBe(library);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('lets the held save through when the late answer is that there was nothing', async () => {
    const { store, reload } = nativeWindow();
    const { restoreFromMirror, save, load } = await import('../src/lib/storage');
    const { mirrorSettled } = await import('../src/lib/mirror');

    await restoreFromMirror(BUDGET);
    save(load(new Date(2026, 8, 29)));
    resolveRead!({ data: 'not a library' });
    await new Promise((r) => setTimeout(r, 10));
    await mirrorSettled();

    // The fresh library is now the only one there is, so both copies get it.
    expect(writes.length).toBe(1);
    expect(JSON.parse(writes[0]).receipts.length).toBeGreaterThan(0);
    expect(store.get('kept.v1')).toBe(writes[0]);
    expect(reload).not.toHaveBeenCalled();
  });

  it('an erase in those seconds erases what was on screen, not the library still on its way', async () => {
    /*
     * The person can only have seen the fresh library, so that is what they
     * asked to erase. The mirror holds a library nobody has shown them, and
     * erasing it on their behalf is the one loss here nobody chose. It comes
     * back, and they can erase it knowingly.
     */
    const { store, reload } = nativeWindow();
    const { restoreFromMirror, wipe } = await import('../src/lib/storage');
    const { mirrorSettled } = await import('../src/lib/mirror');
    await restoreFromMirror(BUDGET);
    wipe();
    await new Promise((r) => setTimeout(r, 10));
    expect(writes).toEqual([]);

    resolveRead!({ data: library });
    await new Promise((r) => setTimeout(r, 10));
    await mirrorSettled();
    expect(writes).toEqual([]);
    expect(store.get('kept.v1')).toBe(library);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('a read that never answers leaves the next launch able to try again', async () => {
    /*
     * The read hangs for the whole session. Had the fresh library's save
     * reached localStorage, the next launch would find a readable store,
     * never consult the mirror, and its first save would overwrite it.
     */
    const { store } = nativeWindow();
    const { restoreFromMirror, save, load } = await import('../src/lib/storage');
    await restoreFromMirror(BUDGET);
    save(load(new Date(2026, 8, 29)));
    await new Promise((r) => setTimeout(r, 10));
    expect(store.has('kept.v1')).toBe(false);
    expect(writes).toEqual([]);
  });
});
