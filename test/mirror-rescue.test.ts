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
      // A write to a phone is not instant, and two of them are not ordered.
      // The gate lets a test hold the FIRST one open while the next is issued
      // — a promise rather than a sleep, deliberately: `mirror-budget.test.ts`
      // runs a 25ms budget on real timers a few files away and says in its own
      // comment that it loses under load. A suite that sleeps is that load.
      if (writeGate) {
        const held = writeGate;
        writeGate = null;
        gateEntered?.();
        gateEntered = null;
        await held;
      }
      if (writeThrows > 0) {
        writeThrows -= 1;
        throw new Error('no space');
      }
      if (cutOff === 'writing') {
        // `writeFile` on iOS is `atomically: false`: a write killed part-way
        // leaves the first part of the file and nothing after it.
        cutOff = null;
        files.set(path, data.slice(0, Math.floor(data.length / 2)));
        throw new Error('killed');
      }
      files.set(path, data);
    },
    rename: async ({ from, to }: { from: string; to: string }) => {
      /*
       * What Capacitor 6 does on iOS, step for step (Filesystem.swift:132-149):
       * remove the destination if it is a file, then `moveItem`. Not an atomic
       * replace, and the mirror is written around exactly that, so the mock
       * must not be kinder than the phone.
       */
      if (cutOff === 'renaming') {
        cutOff = null;
        throw new Error('killed');
      }
      files.delete(to);
      if (cutOff === 'removed') {
        cutOff = null;
        throw new Error('killed');
      }
      if (!files.has(from)) throw new Error('ENOENT');
      files.set(to, files.get(from)!);
      files.delete(from);
    },
  },
}));

/**
 * Where the next mirror write is cut off, as the app being killed would cut
 * it: part-way through writing the pending file, after it but before the
 * rename began, or inside the rename between its remove and its move.
 */
let cutOff: 'writing' | 'renaming' | 'removed' | null = null;

/** Held open across the NEXT write only. See the ordering tests below. */
let writeGate: Promise<void> | null = null;
/** Called by the mock when a write actually reaches that gate. */
let gateEntered: (() => void) | null = null;
/** How many of the next writes fail outright. */
let writeThrows = 0;

/**
 * Blocks the next write until `release` is called, and says when it has
 * actually arrived.
 *
 * `entered` is not a nicety, and it has to be signalled from inside the mock
 * rather than when the gate is made. Releasing before a write has reached the
 * gate holds nothing up at all — both writes are still inside
 * `await filesystem()` at that point — and two drafts of the ordering test
 * below passed with the queue and without it for exactly that reason, the
 * second while carrying an `entered` that resolved the moment it was created.
 */
function holdNextWrite(): { entered: Promise<void>; release: () => void } {
  let release!: () => void;
  writeGate = new Promise<void>((r) => {
    release = r;
  });
  const entered = new Promise<void>((r) => {
    gateEntered = r;
  });
  return { entered, release };
}

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

/**
 * The mirror write is deliberately not awaited by `save`, so wait for it.
 *
 * This was twenty event-loop ticks and a hope, and it failed about one run in
 * three — the erase guard below, of all of them. `mirrorSettled` exists for
 * this: it resolves when the writes actually have. The ticks stay after it for
 * everything else this file waits on, which is not the mirror.
 */
/** Drains the microtask queue: one macrotask tick is enough for all of it. */
async function flush() {
  await new Promise((r) => setTimeout(r, 0));
}

async function settle() {
  const { mirrorSettled } = await import('../src/lib/mirror');
  await mirrorSettled();
  for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  await mirrorSettled();
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
  writeGate = null;
  gateEntered = null;
  writeThrows = 0;
  cutOff = null;
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

  it('does not write an empty store when there is no mirror to read', async () => {
    /*
     * A real property, and one this suite did not state: a launch with no
     * mirror leaves the store exactly as it found it rather than writing
     * anything into it.
     *
     * It does not, however, discriminate the `!mirror ||` guard beside it —
     * `chooseSource` can never answer 'mirror' when the mirror is null, so both
     * halves of that condition reach the same answer and no test can separate
     * them. Said here rather than left looking like coverage it is not.
     */
    boot(true);
    const { restoreFromMirror } = await import('../src/lib/storage');
    expect(files.has('kept-receipts.json')).toBe(false);
    expect(await restoreFromMirror()).toBe(false);
    expect(store.getItem(KEY)).toBeNull();
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


  it.each([
    ['an array', '[1,2,3]'],
    ['a bare number', '42'],
    ['unparseable junk', 'not json'],
  ])('erases to a clean empty library when the store held %s', async (_label, raw) => {
    /*
     * `erasedFrom` keeps the rest of a stored object and empties the receipts,
     * guarded by `parsed && typeof parsed === 'object' && !Array.isArray`. Both
     * `&&`s survived the suite, and the array is why the last limb is there: an
     * array parses as an object, and spreading one writes
     * `{"0":1,"1":2,"2":3,"receipts":[],"alertsSent":[]}` — a shape
     * `looksLikeState` accepts, so the next launch boots on that instead of
     * falling through to a fresh install.
     *
     * Reached through `wipe`, which is the only caller.
     */
    boot(true);
    const { wipe } = await import('../src/lib/storage');
    store.setItem(KEY, raw);
    wipe();
    const after = JSON.parse(store.getItem(KEY)!);
    expect(after.receipts).toEqual([]);
    expect(Object.keys(after).sort()).toEqual(['receipts', 'version']);
  });

  it('an erase takes what a bad launch set aside, too', async () => {
    // `load` keeps an unreadable store under a key of its own so the next save
    // cannot destroy it. Those are the same receipts; "Erase everything" that
    // left them behind would be an erase that did not.
    boot(true);
    const { load, setAsideData, wipe } = await import('../src/lib/storage');
    store.setItem(KEY, '{"receipts": [truncated');
    load(new Date(2026, 7, 28));
    expect(setAsideData()).not.toBeNull();
    wipe();
    expect(setAsideData()).toBeNull();
  });

  it('an erase survives the app being killed before the next save', async () => {
    /*
     * The window this closes. `wipe` used to REMOVE the localStorage key and
     * leave the emptied state to the save effect that follows a moment later.
     * Between the two, localStorage held nothing and the mirror still held
     * everything — which `chooseSource` reads, correctly for every other
     * situation, as "the web view lost the store, put it back".
     *
     * So: erase, then close the app. Which is exactly what somebody does after
     * erasing. Measured before the fix, the next launch handed back both
     * receipts.
     *
     * Note there is no `save` between the wipe and the restore. That absence is
     * the whole test, and putting one back makes it pass on the old code too.
     */
    boot(true);
    const { save, wipe, restoreFromMirror } = await import('../src/lib/storage');
    save(JSON.parse(library(['a', 'b'])));
    await settle();

    wipe();

    expect(await restoreFromMirror()).toBe(false);
    expect(JSON.parse(store.getItem(KEY)!).receipts).toEqual([]);
  });

  it('takes the second copy with it, rather than only the live store', async () => {
    // A file on disk still holding every receipt is the erase having removed
    // them from the screen and nowhere else — the thing the photo erase was
    // added for, one layer over.
    boot(true);
    const { save, wipe } = await import('../src/lib/storage');
    save(JSON.parse(library(['a', 'b'])));
    await settle();

    wipe();
    await settle();

    expect(JSON.parse(files.get('kept-receipts.json')!).receipts).toEqual([]);
  });

  it('keeps what is not a receipt, so the two erase paths agree', async () => {
    /*
     * The reducer's `wipe` clears receipts and alertsSent and keeps the rest.
     * If this wrote a different post-erase state, the app would show one thing
     * for the instant before the save effect ran and another after — settings
     * reset and then unreset, onboarding reappearing and then not.
     */
    boot(true);
    const { save, wipe } = await import('../src/lib/storage');
    save({ ...JSON.parse(library(['a'])), onboardingSeen: true, settings: { urgentDays: 9 } });
    await settle();

    wipe();

    const after = JSON.parse(store.getItem(KEY)!);
    expect(after.receipts).toEqual([]);
    expect(after.alertsSent).toEqual([]);
    expect(after.onboardingSeen).toBe(true);
    expect(after.settings).toEqual({ urgentDays: 9 });
  });

  it('takes the held policy news too, and both erase paths put back the same samples', async () => {
    /*
     * Measured before this: two hundred feed entries dated 9999-12-31 survived
     * Erase everything and went on crowding every genuine change out of the
     * capped list. The news is the same for everyone, but Erase is the way out
     * a bad feed was promised, and it was not one.
     */
    boot(true);
    const { save, wipe, hydrate } = await import('../src/lib/storage');
    const { reducer } = await import('../src/app/state');
    const { seedUpdates } = await import('../src/lib/seed');
    const today = new Date(2026, 9, 4);
    const poison = { id: 'held', store: 'Currys', changedOn: '2026-10-01', text: 'x', affectsStores: ['Currys'], affectNote: '' };
    save({ ...JSON.parse(library(['a'])), updates: [poison] });
    await settle();

    wipe();

    const after = JSON.parse(store.getItem(KEY)!);
    expect(after.updates).toBeUndefined();
    const relaunched = hydrate(after, today).updates;
    expect(relaunched).toEqual(seedUpdates(today));
    const held = hydrate({ ...JSON.parse(library(['a'])), updates: [poison] }, today);
    expect(held.updates.map((u) => u.id)).toEqual(['held']);
    const erasedOnScreen = reducer(held as unknown as Parameters<typeof reducer>[0], { type: 'wipe' }, today);
    expect(erasedOnScreen.updates).toEqual(relaunched);
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

describe('two mirror writes in flight at once', () => {
  /*
   * Neither caller can await this one — `save` runs inside the reducer and
   * `wipe` is synchronous by design — so a save and the erase that follows it
   * were regularly both in flight, with nothing deciding which reached the
   * disk last. Each crosses the bridge to native and back; nothing about that
   * is ordered.
   *
   * Measured before the fix, with the save taking 30ms and the erase issued
   * straight after taking none: the file ended up holding BOTH RECEIPTS after
   * the erase. The live store is correctly empty and `chooseSource` answers
   * "local", so the app looks erased while every receipt sits in a file in
   * Documents — which, since this branch opted Documents into the Files app,
   * somebody can open.
   *
   * It is the same defect as the one at the top of this file, reached from the
   * other side: there the erase left the mirror alone, here it writes to it
   * and loses the race.
   */
  it('let nothing overtake a write still in flight', async () => {
    boot(true);
    const { writeMirror, mirrorSettled } = await import('../src/lib/mirror');
    const gate = holdNextWrite();
    const first = writeMirror('library');
    await gate.entered;
    const second = writeMirror('erased');
    await flush();

    /*
     * THE assertion, and it took three drafts to find one that could fail.
     *
     * Comparing the final contents does not discriminate: unqueued, the second
     * write is two microtask hops behind the first, so releasing the first
     * still lets it land before the second and the order comes out right by
     * arithmetic. Both writes have to be in flight at once with the first held
     * open past the second's completion, and what that looks like is this —
     * while the first is held, NOTHING may have reached the disk. Unqueued,
     * 'erased' is already there.
     */
    expect(files.get('kept-receipts.json')).toBeUndefined();

    gate.release();
    await Promise.all([first, second]);
    expect(files.get('kept-receipts.json')).toBe('erased');
    await mirrorSettled();
  });

  it('is the erase that wins, through save and wipe rather than by hand', async () => {
    // The same thing said in the app's own words, so the guard survives
    // someone rewriting how a mirror write is issued.
    boot(true);
    const { save, wipe } = await import('../src/lib/storage');
    const { mirrorSettled } = await import('../src/lib/mirror');
    /*
     * A restatement in the app's own words, so the guard survives someone
     * rewriting how a mirror write is issued. It is NOT the discriminating
     * test — `save` and `wipe` are both synchronous and hand back no promise,
     * so there is nothing here to wait on precisely. The case above is the one
     * that fails without the queue every time.
     */
    const gate = holdNextWrite();
    save(JSON.parse(library(['a', 'b'])));
    wipe();
    await gate.entered;
    gate.release();
    await mirrorSettled();
    expect(JSON.parse(files.get('kept-receipts.json')!).receipts).toEqual([]);
  });

  it('does not let one failed write strand the queue', async () => {
    // The tail is chained on, so a rejection that escaped would stop every
    // later erase from ever reaching the disk.
    boot(true);
    const { writeMirror, mirrorSettled } = await import('../src/lib/mirror');
    writeThrows = 1;
    expect(await writeMirror('first')).toBe(false);
    expect(await writeMirror('second')).toBe(true);
    await mirrorSettled();
    expect(files.get('kept-receipts.json')).toBe('second');
  });
});

describe('a mirror write cut off part-way', () => {
  /*
   * The phone is killed in the middle of a save — swiped away, or the battery
   * gone — and the web view's storage is lost before the next launch. That
   * launch is the one the mirror exists for, so it must find a whole library
   * on disk whatever point the write had reached.
   *
   * Capacitor 6 on iOS writes a file in place (`atomically: false`,
   * Filesystem.swift:49) and renames by removing the destination and then
   * moving (Filesystem.swift:132-149), so a write is a pending file renamed
   * over the mirror, and every point it can be stopped at leaves one copy
   * whole. The mock above stops it at each.
   */
  const MIRROR = 'kept-receipts.json';
  const PENDING = 'kept-receipts.json.next';

  /** The next launch, with the web view's storage gone and the disk kept. */
  async function relaunchWithStoreLost() {
    vi.resetModules();
    boot(true);
    return import('../src/lib/storage');
  }

  const ids = (raw: string | null) => (JSON.parse(raw!).receipts as { id: string }[]).map((r) => r.id);

  it('killed while writing: the next launch gets the library before it', async () => {
    boot(true);
    const { save } = await import('../src/lib/storage');
    save(JSON.parse(library(['a', 'b'])));
    await settle();

    cutOff = 'writing';
    save(JSON.parse(library(['a', 'b', 'c'])));
    await settle();

    const { restoreFromMirror } = await relaunchWithStoreLost();
    expect(await restoreFromMirror()).toBe(true);
    expect(ids(store.getItem(KEY))).toEqual(['a', 'b']);
    // And it was a real fragment that was passed over, not a write that never began.
    expect(files.get(PENDING)).toBeTruthy();
    expect(() => JSON.parse(files.get(PENDING)!)).toThrow();
  });

  it('killed between the rename’s remove and its move: the next launch gets the new library', async () => {
    // What `_copy` leaves when it is stopped after `removeItem` (:139) and
    // before `moveItem` (:144): no mirror at all, and the new library pending.
    files.set(PENDING, library(['a', 'b', 'c']));
    const { restoreFromMirror } = await relaunchWithStoreLost();
    expect(await restoreFromMirror()).toBe(true);
    expect(ids(store.getItem(KEY))).toEqual(['a', 'b', 'c']);
  });

  it('an erase killed before its rename stays an erase', async () => {
    /*
     * The case that decides which file the read asks first. The erase reached
     * the pending file and not the mirror, so the mirror still holds every
     * receipt. Read mirror-first, this launch would put them all back — the
     * erase undone, again, by the copy that was meant to protect the library.
     */
    files.set(MIRROR, library(['a', 'b']));
    files.set(PENDING, JSON.stringify({ version: 1, receipts: [] }));
    const { restoreFromMirror } = await relaunchWithStoreLost();
    const { readMirror } = await import('../src/lib/mirror');
    expect(ids(await readMirror())).toEqual([]);
    expect(await restoreFromMirror()).toBe(true);
    expect(ids(store.getItem(KEY))).toEqual([]);
  });

  it('each cut-off point leaves the disk the read is built for', async () => {
    // The two states above, reached through the real write rather than set by
    // hand, so they are what a killed write leaves and not what a test wished.
    boot(true);
    const { save, wipe } = await import('../src/lib/storage');
    save(JSON.parse(library(['a', 'b'])));
    await settle();

    cutOff = 'removed';
    save(JSON.parse(library(['a', 'b', 'c'])));
    await settle();
    expect(files.has(MIRROR)).toBe(false);
    expect(ids(files.get(PENDING)!)).toEqual(['a', 'b', 'c']);

    save(JSON.parse(library(['a', 'b'])));
    await settle();
    cutOff = 'renaming';
    wipe();
    await settle();
    expect(ids(files.get(MIRROR)!)).toEqual(['a', 'b']);
    expect(ids(files.get(PENDING)!)).toEqual([]);
  });

  it('a write that is still pending does not report that it landed', async () => {
    boot(true);
    const { writeMirror } = await import('../src/lib/mirror');
    cutOff = 'renaming';
    expect(await writeMirror(library(['a']))).toBe(false);
    cutOff = 'removed';
    expect(await writeMirror(library(['a']))).toBe(false);
    expect(await writeMirror(library(['a']))).toBe(true);
  });

  it('the ordinary path leaves nothing pending', async () => {
    boot(true);
    const { save, wipe } = await import('../src/lib/storage');
    save(JSON.parse(library(['a', 'b'])));
    await settle();
    expect([...files.keys()]).toEqual([MIRROR]);
    wipe();
    await settle();
    expect([...files.keys()]).toEqual([MIRROR]);
  });

  it('a cut-off mirror with nothing pending is read as it always was', async () => {
    // No pending file to prefer, so the fragment comes back as text and the
    // choice between copies is made exactly as before: it is not a library.
    const truncated = library(['a', 'b']).slice(0, 30);
    files.set(MIRROR, truncated);
    const { restoreFromMirror } = await relaunchWithStoreLost();
    const { readMirror, chooseSource } = await import('../src/lib/mirror');
    expect(await readMirror()).toBe(truncated);
    expect(chooseSource(null, truncated)).toBe('fresh');
    expect(chooseSource(library(['a']), truncated)).toBe('local');
    expect(await restoreFromMirror()).toBe(false);
    expect(store.getItem(KEY)).toBeNull();
  });

  it('after an erase, no file in Documents holds an erased receipt', async () => {
    /*
     * Including the fragment a killed write left pending. It is not a
     * library, so no launch would ever read it back — but it is the shopping
     * in plain text, sitting where the Files app can open it, and "Erase
     * everything" that left it there would be an erase that did not.
     */
    boot(true);
    const { save, wipe } = await import('../src/lib/storage');
    save(JSON.parse(library(['stand-mixer', 'kettle'])));
    await settle();
    cutOff = 'writing';
    save(JSON.parse(library(['stand-mixer', 'kettle', 'toaster'])));
    await settle();
    expect(files.get(PENDING)).toContain('stand-mixer');

    wipe();
    await settle();

    expect([...files.keys()]).toEqual([MIRROR]);
    for (const [name, text] of files) {
      for (const id of ['stand-mixer', 'kettle', 'toaster']) expect(text, name).not.toContain(id);
    }
  });
});
