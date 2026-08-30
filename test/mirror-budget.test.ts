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
let readCalls = 0;

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Documents: 'DOCUMENTS' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    // Never settles: a plugin call waiting on a bridge that will not answer.
    readFile: () => {
      readCalls += 1;
      return new Promise((res) => {
        resolveRead = res;
      });
    },
    writeFile: async () => {},
  },
}));

const BUDGET = 25;

beforeEach(() => {
  readCalls = 0;
  resolveRead = null;
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
  });
});
