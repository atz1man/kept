import { describe, expect, it } from 'vitest';
import { afterEach } from 'vitest';
import { discardSetAside, hydrate, load, save, onExternalChange, rescueBackup, setAsideData, DEFAULT_SETTINGS, URGENT_DAYS_MIN, URGENT_DAYS_MAX } from '../src/lib/storage';
import { MAX_AMOUNT_PENCE, MAX_WINDOW_DAYS } from '../src/lib/draft';
import { MAX_UPDATES } from '../src/lib/policy-feed';
import { toPence } from '../src/lib/money';
import { parseBackup } from '../src/lib/backup';
import type { Receipt } from '../src/lib/types';

const TODAY = new Date(2026, 7, 28);

const good: Receipt = {
  id: 'r1', store: 'Currys', item: 'Headphones', cat: 'audio', amount: toPence(89),
  purchasedOn: '2026-08-16', windowDays: 14, policy: 'p', distance: false, status: 'active',
};

const stored = (over: Record<string, unknown> = {}) => ({
  version: 1, receipts: [good], updates: [], onboardingSeen: true,
  settings: DEFAULT_SETTINGS, alertsSent: [], ...over,
});

describe('surviving whatever is on disk', () => {
  it('reads a well-formed store', () => {
    const s = hydrate(stored(), TODAY);
    expect(s.receipts).toEqual([good]);
    expect(s.onboardingSeen).toBe(true);
  });

  it('drops an unreadable receipt instead of taking the app down', () => {
    // This is the case that produced a blank screen on every launch, with no
    // way out but clearing site data by hand: one row missing its date.
    const s = hydrate(stored({ receipts: [{ ...good, purchasedOn: undefined }, { ...good, id: 'r2' }] }), TODAY);
    expect(s.receipts.map((r) => r.id)).toEqual(['r2']);
  });

  it.each([
    ['a missing date', { purchasedOn: undefined }],
    ['a malformed date', { purchasedOn: 'yesterday' }],
    ['a date that only looks real', { purchasedOn: '2026-02-31' }],
    ['a float amount', { amount: 12.5 }],
    ['a missing store', { store: undefined }],
    ['a zero window', { windowDays: 0 }],
    ['an unknown status', { status: 'maybe' }],
  ])('drops a receipt with %s', (_label, patch) => {
    expect(hydrate(stored({ receipts: [{ ...good, ...patch }] }), TODAY).receipts).toEqual([]);
  });

  it('keeps an empty library empty rather than reseeding the demo', () => {
    // Someone who erased everything must not find the demo receipts back.
    expect(hydrate(stored({ receipts: [] }), TODAY).receipts).toEqual([]);
  });

  it('starts fresh when the shape is not a store at all', () => {
    expect(hydrate(null, TODAY).receipts.length).toBeGreaterThan(0);
    expect(hydrate('nonsense', TODAY).receipts.length).toBeGreaterThan(0);
    expect(hydrate({ receipts: 'not an array' }, TODAY).receipts.length).toBeGreaterThan(0);
  });

  it('keeps one row when the store holds two with the same id', () => {
    // Two rows for one purchase means the money is counted twice, which is the
    // single thing this app must not do. A restore cannot produce one — the
    // merge matches by id — but nothing was checking the app's own store, and
    // it is the store that already produced the corrupt row this whole
    // function exists to survive.
    const s = hydrate(stored({ receipts: [good, { ...good, item: 'A second copy' }] }), TODAY);
    expect(s.receipts).toHaveLength(1);
    expect(s.receipts[0].item).toBe(good.item);
  });

  it('keeps both when the ids genuinely differ', () => {
    const s = hydrate(stored({ receipts: [good, { ...good, id: 'r2' }] }), TODAY);
    expect(s.receipts.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('drops an unreadable policy update and keeps the rest', () => {
    const update = { id: 'u1', store: 'Zara', changedOn: '2026-08-26', text: 'x', affectsStores: ['Zara'] };
    const s = hydrate(stored({ updates: [update, { broken: true }] }), TODAY);
    expect(s.updates.map((u) => u.id)).toEqual(['u1']);
  });

  it('reseeds the feed when nothing readable survived', () => {
    // The feed is downloadable content, so falling back is always safe.
    expect(hydrate(stored({ updates: [{ broken: true }] }), TODAY).updates.length).toBeGreaterThan(0);
  });

  it('recovers a store an oversized feed already filled', () => {
    // The cap is not only a guard on the next download. A device that took one
    // bad feed before the cap existed has it on disk, and every launch writes
    // it back; the next launch has to be able to shed it.
    const updates = Array.from({ length: MAX_UPDATES * 4 }, (_, i) => ({
      id: `u${i}`, store: 'Zara', changedOn: `2026-0${(i % 9) + 1}-01`.slice(0, 10),
      text: 'x', affectsStores: ['Zara'],
    }));
    expect(hydrate(stored({ updates }), TODAY).updates).toHaveLength(MAX_UPDATES);
  });

  it('fills in settings a older version never wrote', () => {
    const s = hydrate(stored({ settings: { urgentDays: 14 } }), TODAY);
    expect(s.settings).toEqual({ ...DEFAULT_SETTINGS, urgentDays: 14 });
  });

  describe('a preference it cannot read does not switch the app off', () => {
    /*
     * Receipts and policy updates have been validated on the way in since a
     * single bad row blanked the app. Settings were spread straight over the
     * defaults — and `urgentDays: "soon"`, or a negative, makes every
     * comparison against it false: a receipt five days from its deadline
     * renders relaxed, and the week-ahead alert never fires for anything.
     */
    const urgentOf = (settings: unknown) => hydrate(stored({ settings }), TODAY).settings.urgentDays;

    it.each([
      ['a word', 'soon'],
      ['a negative', -5],
      ['zero', 0],
      ['null', null],
      ['a fraction', 7.5],
      ['longer than the slider offers', 400],
    ])('falls back when the urgent window is %s', (_label, value) => {
      expect(urgentOf({ urgentDays: value })).toBe(DEFAULT_SETTINGS.urgentDays);
    });

    it('keeps a real one', () => {
      expect(urgentOf({ urgentDays: 14 })).toBe(14);
    });

    it('keeps the good fields beside an unreadable one', () => {
      // Per field, not all-or-nothing: one bad preference should not discard
      // the three beside it that were fine.
      const s = hydrate(stored({ settings: { urgentDays: 'soon', plan: 'pro', policyWatch: false } }), TODAY);
      expect(s.settings).toEqual({ ...DEFAULT_SETTINGS, plan: 'pro', policyWatch: false });
    });

    it.each([
      ['a string', 'yes'],
      ['a number', 1],
      ['null', null],
    ])('will not take %s for a switch', (_label, value) => {
      expect(hydrate(stored({ settings: { deadlineAlerts: value } }), TODAY).settings.deadlineAlerts)
        .toBe(DEFAULT_SETTINGS.deadlineAlerts);
    });

    it('refuses a plan it does not sell', () => {
      expect(hydrate(stored({ settings: { plan: 'enterprise' } }), TODAY).settings.plan).toBe('free');
    });

    it.each([
      ['a string', 'not an object'],
      ['null, which typeof still calls an object', null],
      ['a number', 42],
      ['an array', []],
    ])('survives settings stored as %s', (_label, settings) => {
      /*
       * NULL is the one that was missing, and it is the only one that mattered.
       * The guard is `typeof raw !== 'object' || raw === null`, and for every
       * other shape both limbs reach the same answer — a number falls through
       * and its absent properties default. `typeof null` is 'object', so
       * loosening that `||` to `&&` lets null through to a property access and
       * takes the whole load down with it.
       */
      expect(hydrate(stored({ settings }), TODAY).settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  it('ignores junk in the alert list rather than choking on it', () => {
    expect(hydrate(stored({ alertsSent: ['r1:soon', 42, null] }), TODAY).alertsSent).toEqual(['r1:soon']);
  });
});

describe('the rescue, for when the app cannot render', () => {
  /*
   * The one moment where getting the receipts OFF the device is the only thing
   * that matters. It must not run through `load`, `hydrate` or the receipt
   * reader, because any of those may be exactly what threw — so it validates
   * nothing, and these tests are mostly about what it declines to do.
   */
  const withStore = (impl: Partial<Storage>) => {
    (globalThis as { window?: unknown }).window = { localStorage: impl };
  };
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('has nothing to offer when nothing is stored', () => {
    withStore({ getItem: () => null });
    expect(rescueBackup()).toBeNull();
  });

  it('gives back a file the importer accepts', () => {
    withStore({ getItem: () => JSON.stringify({ version: 1, receipts: [good], settings: DEFAULT_SETTINGS }) });
    const out = rescueBackup()!;
    expect(out.readable).toBe(true);
    const doc = JSON.parse(out.text);
    expect(doc.app).toBe('kept');
    expect(doc.receipts).toEqual([good]);
    expect(typeof doc.exportedAt).toBe('string');
  });

  it('keeps a row the reader would have thrown away', () => {
    // The row that broke the app is the row most worth rescuing: it is the
    // person's receipt, and a human can repair it in a text editor.
    withStore({ getItem: () => JSON.stringify({ receipts: [{ id: 'r9', store: 'Boots' }] }) });
    expect(JSON.parse(rescueBackup()!.text).receipts).toEqual([{ id: 'r9', store: 'Boots' }]);
  });

  it.each([
    ['keeps a version the store already had', 3, 3],
    ['stamps the current one over a version that is not a number', 'three', 1],
  ])('%s', (_label, version, expected) => {
    /*
     * `typeof parsed.version === 'number'` in the rescue export. Flip it and a
     * real version is thrown away while a string one is written verbatim into a
     * file the importer will later read. Neither side was tested.
     */
    withStore({ getItem: () => JSON.stringify({ version, receipts: [good] }) });
    expect(JSON.parse(rescueBackup()!.text).version).toBe(expected);
  });

  it('hands back unparseable storage verbatim rather than nothing', () => {
    withStore({ getItem: () => '{"receipts": [tru' });
    const out = rescueBackup()!;
    expect(out.readable).toBe(false);
    expect(out.text).toBe('{"receipts": [tru');
  });

  it('survives a storage that refuses to be read at all', () => {
    withStore({ getItem: () => { throw new Error('blocked'); } });
    expect(rescueBackup()).toBeNull();
  });
});

describe('the ends of the range someone can actually choose', () => {
  /*
   * Found by mutation: the bounds are `>= MIN` and `<= MAX`, and flipping
   * either to a strict comparison rejects the exact value at that end, which
   * is then silently replaced by the default. The tests above cover values
   * well outside the range and none on its edge — so the one setting in this
   * app that changes when it warns you would have quietly refused two of its
   * own choices.
   */
  const urgentOf = (settings: unknown) => hydrate(stored({ settings }), TODAY).settings.urgentDays;

  it('keeps the shortest warning distance on offer', () => {
    expect(urgentOf({ urgentDays: URGENT_DAYS_MIN })).toBe(URGENT_DAYS_MIN);
  });

  it('keeps the longest', () => {
    expect(urgentOf({ urgentDays: URGENT_DAYS_MAX })).toBe(URGENT_DAYS_MAX);
  });

  it('still falls back just outside them', () => {
    expect(urgentOf({ urgentDays: URGENT_DAYS_MIN - 1 })).toBe(DEFAULT_SETTINGS.urgentDays);
    expect(urgentOf({ urgentDays: URGENT_DAYS_MAX + 1 })).toBe(DEFAULT_SETTINGS.urgentDays);
  });
});

describe('the app never discards what it already holds', () => {
  /*
   * `hydrate` reads the device's own store through the same `readReceipt` a
   * backup file comes through, and the first version of the import ceilings
   * applied there too — so a receipt already on someone's phone, above a limit
   * this build had only just invented, would have been dropped on next launch.
   * The layout sweep caught it within the hour: its adversarial fixture is
   * £1,299,999.99 and it simply stopped existing.
   *
   * On an app whose receipts live in one place, that is the expensive answer.
   * An absurd amount already on the device renders visibly wrong and the edit
   * screen refuses to save it, which is a correction the person can make; a
   * deleted row takes the shop, the item, the dates and the deadline with it,
   * and nobody can correct that.
   */
  const absurd = { ...good, id: 'big', amount: MAX_AMOUNT_PENCE + 1, windowDays: MAX_WINDOW_DAYS + 1 };

  it('keeps a stored receipt that the import path would refuse', () => {
    const s = hydrate(stored({ receipts: [absurd] }), TODAY);
    expect(s.receipts.map((r) => r.id)).toEqual(['big']);
    expect(s.receipts[0].amount).toBe(MAX_AMOUNT_PENCE + 1);
  });

  it('does not quietly shorten stored text either', () => {
    const long = { ...good, id: 'wordy', item: 'x'.repeat(5000) };
    const s = hydrate(stored({ receipts: [long] }), TODAY);
    expect(s.receipts[0].item).toHaveLength(5000);
  });

  it('still drops a stored row that is malformed rather than merely large', () => {
    // The reason hydrate validates at all: one bad row used to blank the app.
    const s = hydrate(stored({ receipts: [{ ...good, id: 'ok' }, { ...good, id: 'bad', amount: 12.5 }] }), TODAY);
    expect(s.receipts.map((r) => r.id)).toEqual(['ok']);
  });
});

describe('hearing another tab write', () => {
  /*
   * Two tabs of a local-first app both hold the whole library and both write
   * all of it, so the one with older state destroys whatever the other added
   * unless it adopts what it hears. The listener's guard —
   * `e.key !== KEY || e.newValue === null` — has three mutations and every one
   * survived, because nothing ever fired an event it was supposed to ignore.
   *
   * Both limbs matter. A different key is another app on the same origin. A
   * null newValue is a REMOVAL, and adopting one would hand `JSON.parse` the
   * string "null" and this tab a state with no receipts in it.
   */
  const listeners: ((e: StorageEvent) => void)[] = [];
  const fakeWindow = {
    addEventListener: (_t: string, fn: (e: StorageEvent) => void) => void listeners.push(fn),
    removeEventListener: () => {},
  };

  const fire = (key: string | null, newValue: string | null) => {
    const seen: unknown[] = [];
    listeners.length = 0;
    (globalThis as Record<string, unknown>).window = fakeWindow;
    const stop = onExternalChange((incoming) => seen.push(incoming), TODAY);
    listeners[0]?.({ key, newValue } as StorageEvent);
    stop();
    delete (globalThis as Record<string, unknown>).window;
    return seen;
  };

  it('adopts what the other tab stored', () => {
    expect(fire('kept.v1', JSON.stringify(stored()))).toHaveLength(1);
  });

  it('ignores a key that is not ours', () => {
    expect(fire('something.else', JSON.stringify(stored()))).toEqual([]);
  });

  it('ignores a removal rather than adopting an empty library', () => {
    expect(fire('kept.v1', null)).toEqual([]);
  });

  it('keeps what it has when the other tab wrote something unreadable', () => {
    expect(fire('kept.v1', 'not json')).toEqual([]);
  });
});

describe('the slider bounds and the rung they have to reach', () => {
  it('lets the urgent threshold go below the fixed "soon" rung', () => {
    /*
     * `alerts.ts` puts anything three days out or nearer on the 'soon' rung,
     * whatever the slider says, and `schedule.ts` drops the gentle rung below
     * four because at three they land on the same morning. That collision is
     * only reachable because the slider goes lower than three — raise the
     * minimum to four and the whole case those two files handle stops existing,
     * with nothing to say so.
     */
    expect(URGENT_DAYS_MIN).toBeLessThan(3);
    // And the top of the slider is three weeks, which is what the Settings row
    // says it offers — tied to the words rather than pinned as a bare 21.
    expect(URGENT_DAYS_MAX).toBe(7 * 3);
  });
});

describe('the round trip, which is the whole promise', () => {
  /*
   * `save` and `load` are the two ends of the only thing this app actually
   * undertakes to do: what you put in comes back. Until now neither end was
   * asked. `load` was imported by no test at all, and `save` was reached only
   * sideways by the mirror suite, which watches the second copy and never
   * reads the first one back.
   *
   * What that cost: inverting the `if (!raw)` in `load` — so that a store WITH
   * something in it is thrown away and a store with nothing in it is parsed —
   * left all 1068 tests passing. That mutant is every launch silently losing
   * every receipt, which is the worst thing this app can do, and the suite had
   * nothing to say about it.
   *
   * The discriminator these lean on is that a fresh state is NOT empty — it
   * carries the seed receipts (see `hydrate(null, …)` above). So a saved
   * library of zero receipts coming back as zero receipts is a fact only a
   * real read can produce; the inverted guard returns the seed instead.
   */
  const withStore = (impl: Partial<Storage>) => {
    (globalThis as { window?: unknown }).window = { localStorage: impl };
  };
  const memoryStore = () => {
    const cells = new Map<string, string>();
    return {
      cells,
      getItem: (k: string) => cells.get(k) ?? null,
      setItem: (k: string, v: string) => void cells.set(k, v),
      removeItem: (k: string) => void cells.delete(k),
    };
  };
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  const library = (receipts: Receipt[]) => ({
    version: 3, receipts, updates: [], onboardingSeen: true,
    settings: DEFAULT_SETTINGS, alertsLate: {}, alertsSent: [],
  });

  it('gives back the receipts that were saved', () => {
    const store = memoryStore();
    withStore(store);
    expect(save(library([good]))).toBe(true);
    const back = load(TODAY);
    expect(back.receipts).toEqual([good]);
    expect(back.onboardingSeen).toBe(true);
  });

  it('gives back an EMPTY library as empty, rather than reseeding it', () => {
    // The sharp one. Someone who has deleted every receipt has an empty store
    // that is not a fresh install, and a read that cannot tell those apart
    // hands them back the demo data they just cleared.
    const store = memoryStore();
    withStore(store);
    save(library([]));
    expect(load(TODAY).receipts).toEqual([]);
  });

  it('opens a fresh library when nothing has ever been saved', () => {
    withStore(memoryStore());
    const fresh = load(TODAY);
    expect(fresh.receipts.length).toBeGreaterThan(0);
    expect(fresh.onboardingSeen).toBe(false);
  });

  it('opens a fresh library rather than throwing on a store it cannot parse', () => {
    const store = memoryStore();
    withStore(store);
    save(library([good]));
    for (const k of store.cells.keys()) store.cells.set(k, '{ not json');
    expect(load(TODAY).receipts.length).toBeGreaterThan(0);
  });

  it('survives a launch with no store at all', () => {
    delete (globalThis as { window?: unknown }).window;
    expect(load(TODAY).receipts.length).toBeGreaterThan(0);
  });

  it('reports a write that did not land, so the banner has something true to say', () => {
    // The comment on `save` argues that swallowing this means someone adds a
    // receipt, watches it appear and loses it with no indication. That
    // argument had nothing holding it.
    withStore({
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
    });
    expect(save(library([good]))).toBe(false);
  });

  it('reports a write that did land', () => {
    withStore(memoryStore());
    expect(save(library([good]))).toBe(true);
  });

  it('declines to rewrite an identical library, and still says it is saved', () => {
    const store = memoryStore();
    let writes = 0;
    withStore({ ...store, setItem: (k: string, v: string) => { writes += 1; store.setItem(k, v); } });
    save(library([good]));
    expect(writes).toBe(1);
    expect(save(library([good]))).toBe(true);
    expect(writes).toBe(1);
  });

  it('has no store to read when there is no window', () => {
    delete (globalThis as { window?: unknown }).window;
    expect(save(library([good]))).toBe(false);
  });
});

/**
 * A launch that cannot read the store must not let the next save destroy it.
 *
 * `load` falls back — corrupt JSON to a fresh state, an unreadable row
 * dropped — and the first change after that saved the fallback over the only
 * copy. On the web there is no mirror: a truncated write, or one row from a
 * newer build, and every real receipt was gone with the samples in their place.
 */
describe('what a bad launch sets aside', () => {
  const memoryStore = () => {
    const cells = new Map<string, string>();
    return {
      cells,
      getItem: (k: string) => cells.get(k) ?? null,
      setItem: (k: string, v: string) => void cells.set(k, v),
      removeItem: (k: string) => void cells.delete(k),
    };
  };
  const use = (m: ReturnType<typeof memoryStore>) => {
    (globalThis as { window?: unknown }).window = { localStorage: m };
  };
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('keeps corrupt JSON through the save that replaces it', () => {
    const m = memoryStore();
    use(m);
    const broken = '{"version":1,"receipts":[{"id":"r1","store":"Currys"';
    m.cells.set('kept.v1', broken);
    save(load(TODAY));
    expect(m.cells.get('kept.v1')).not.toBe(broken);
    expect(setAsideData()).toBe(broken);
  });

  it('keeps the whole store when a row cannot be read, not only the rows that could', () => {
    const m = memoryStore();
    use(m);
    const raw = JSON.stringify({ version: 1, receipts: [good, { ...good, id: 'r2', status: 'archived' }] });
    m.cells.set('kept.v1', raw);
    const state = load(TODAY);
    expect(state.receipts.map((r) => r.id)).toEqual(['r1']);
    expect(setAsideData()).toBe(raw);
  });

  it('saves a file that restore reads back, every row it can read and the rest counted', () => {
    /*
     * Measured on main: Settings' "Save them as a file" wrote exactly what was
     * set aside, and restore refused it — "That's a JSON file, but not a kept
     * backup." The one copy made to keep receipts a build could not read
     * could not be read back by any build, including the newer one that
     * wrote them.
     */
    const m = memoryStore();
    use(m);
    const raw = JSON.stringify({ version: 1, receipts: [good, { ...good, id: 'r2', status: 'sent', sentOn: '2026-09-30' }, { ...good, id: 'r3', status: 'disputed' }] });
    m.cells.set('kept.v1', raw);
    save(load(TODAY));
    const file = setAsideData()!;
    const restored = parseBackup(file);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.summary.receipts.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(restored.summary.skipped).toBe(1);
  });

  it('sets nothing aside when everything was read', () => {
    const m = memoryStore();
    use(m);
    m.cells.set('kept.v1', JSON.stringify({ version: 1, receipts: [good] }));
    load(TODAY);
    expect(setAsideData()).toBeNull();
  });

  it('keeps the FIRST copy — the one written before anything was lost', () => {
    const m = memoryStore();
    use(m);
    m.cells.set('kept.v1', 'first, broken');
    save(load(TODAY));
    m.cells.set('kept.v1', 'second, broken');
    load(TODAY);
    expect(setAsideData()).toBe('first, broken');
    discardSetAside();
    expect(setAsideData()).toBeNull();
  });
});

describe('whether reminders have been explained', () => {
  it('starts unexplained, including for a library saved before the setting existed, and keeps the answer', () => {
    expect(DEFAULT_SETTINGS.remindersExplained).toBe(false);
    const old = hydrate({ version: 1, receipts: [], updates: [], onboardingSeen: true, alertsSent: [], settings: { urgentDays: 7, plan: 'free', deadlineAlerts: true, policyWatch: true } }, new Date(2026, 7, 28));
    expect(old.settings.remindersExplained).toBe(false);
    const answered = hydrate({ ...old, settings: { ...old.settings, remindersExplained: true } }, new Date(2026, 7, 28));
    expect(answered.settings.remindersExplained).toBe(true);
  });
});
