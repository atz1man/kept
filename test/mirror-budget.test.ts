import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * A rescue that never answers must not take the app with it.
 *
 * `restoreFromMirror` runs BEFORE the first render, so a filesystem call that
 * hangs is a blank screen — nothing threw, nothing rendered, and `Recovery`
 * never hears about it because there is no error to catch. This is the one
 * failure mode of the mirror that costs more than the mirror is worth.
 */

let resolveRead: ((value: unknown) => void) | null = null;
const readCalls: number[] = [];

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Documents: 'DOCUMENTS' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    // Never settles. This is a plugin call that has gone away — the app is
    // waiting on a bridge that will not answer.
    readFile: () => {
      readCalls.push(Date.now());
      return new Promise((res) => {
        resolveRead = res;
      });
    },
    writeFile: async () => {},
  },
}));

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

beforeEach(() => {
  readCalls.length = 0;
  resolveRead = null;
  vi.resetModules();
  vi.useFakeTimers();
  store = fakeLocalStorage();
  (globalThis as Record<string, unknown>).window = {
    localStorage: store,
    Capacitor: { isNativePlatform: () => true },
  };
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as Record<string, unknown>).window;
});

describe('a rescue that never answers', () => {
  it('gives up inside its budget instead of holding the app forever', async () => {
    const { readMirror, MIRROR_READ_BUDGET_MS } = await import('../src/lib/mirror');
    const pending = readMirror();

    // The read is genuinely outstanding: nothing has resolved it.
    await vi.advanceTimersByTimeAsync(MIRROR_READ_BUDGET_MS - 1);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(2);
    await expect(pending).resolves.toBeNull();
    expect(readCalls).toHaveLength(1);
  });

  it('leaves the live store untouched when it gives up', async () => {
    /*
     * The important half. Giving up must not be mistaken for "the mirror said
     * there is nothing", which would be a licence to write over what is there.
     */
    const { restoreFromMirror } = await import('../src/lib/storage');
    store.setItem('kept.v1', JSON.stringify({ receipts: [{ id: 'a' }] }));
    const pending = restoreFromMirror();
    await vi.advanceTimersByTimeAsync(5000);
    await expect(pending).resolves.toBe(false);
    expect(JSON.parse(store.getItem('kept.v1')!).receipts).toHaveLength(1);
  });

  it('a late answer cannot land after the app has moved on', async () => {
    /*
     * The reason the budget is on the READ and not on the restore that calls
     * it. A timeout one level up would let this resolution arrive after the
     * app had already mounted on an empty store — and the save effect would
     * commit that empty library, which the mirror copies, making a recoverable
     * loss permanent. Here the read has already been abandoned, so a late
     * answer reaches nobody.
     */
    const { restoreFromMirror } = await import('../src/lib/storage');
    const pending = restoreFromMirror();
    await vi.advanceTimersByTimeAsync(5000);
    await expect(pending).resolves.toBe(false);

    resolveRead?.({ data: JSON.stringify({ receipts: [{ id: 'ghost' }] }) });
    await vi.advanceTimersByTimeAsync(100);

    expect(store.getItem('kept.v1')).toBeNull();
  });
});
