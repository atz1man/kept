import { readReceipt } from './backup';
import { chooseSource, isNative, readMirror, writeMirror } from './mirror';
import { erasePhotos } from './photos';
import { readFeed } from './policy-feed';
import { seedReceipts, seedUpdates } from './seed';
import type { PolicyUpdate, Receipt } from './types';
import { DEFAULT_URGENT_DAYS } from './urgency';

/**
 * Local-first persistence.
 *
 * There is no sync layer to add later and no account to attach one to: the
 * privacy notice says receipts never leave the device, so localStorage IS the
 * database. Everything below is written on that assumption — the schema is
 * versioned because the only migration path runs on the user's own phone,
 * and every read is defensive because the store can be cleared, quota-capped
 * or hand-edited between two launches and the app still has to open.
 */

const KEY = 'kept.v1';

/*
 * Written on every save, and — deliberately — compared with nothing.
 *
 * There is one schema, so there is nothing to migrate between and a version
 * check would be a branch nobody could take. What the field is FOR is the
 * moment there are two, and the decision it exists to enable has not been made
 * yet: what a build that understands version 1 should do when it opens a store
 * written by version 2. Silently reading it as version 1 and saving it back is
 * the answer nobody chooses on purpose, and on this app it is the expensive
 * one — the receipts live here and nowhere else, so a stale bundle served by a
 * worker after a rollback would be the only copy.
 *
 * Recorded here rather than guessed at: a migration written before there is
 * anything to migrate is a branch that has never run.
 */
const SCHEMA_VERSION = 1;

export interface Settings {
  urgentDays: number;
  /** The free tier caps the library; the paid tiers do not. */
  plan: 'free' | 'pro';
  deadlineAlerts: boolean;
  policyWatch: boolean;
}

export interface KeptState {
  version: number;
  receipts: Receipt[];
  updates: PolicyUpdate[];
  onboardingSeen: boolean;
  settings: Settings;
  /**
   * Dedup keys for deadline alerts already delivered. Persisted, because the
   * whole value of an alert is that it arrives once — a list that reset on
   * reload would re-announce the same coat every launch.
   */
  alertsSent: string[];
}

/**
 * The bounds the Settings slider offers. Kept here rather than in the screen
 * because they are also what a stored value has to satisfy to be believed.
 */
export const URGENT_DAYS_MIN = 2;
export const URGENT_DAYS_MAX = 21;

export const DEFAULT_SETTINGS: Settings = {
  urgentDays: DEFAULT_URGENT_DAYS,
  plan: 'free',
  deadlineAlerts: true,
  policyWatch: true,
};

export function freshState(today: Date): KeptState {
  return {
    version: SCHEMA_VERSION,
    receipts: seedReceipts(today),
    updates: seedUpdates(today),
    onboardingSeen: false,
    settings: { ...DEFAULT_SETTINGS },
    alertsSent: [],
  };
}

function storage(): Storage | null {
  // Safari in private mode throws on access, not on write. A thrown getter
  // must degrade to an in-memory session, never to a blank screen.
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Turn whatever was on disk into state the app can survive.
 *
 * Every row is validated with the same reader the backup importer uses, and an
 * unreadable one is dropped rather than trusted. This is not paranoia about a
 * file someone chose to import — it is about the app's own store, which held a
 * receipt with no purchase date and produced a completely blank screen on
 * every launch thereafter, with no way out but clearing site data by hand.
 *
 * Dropping a row loses something. It loses one receipt instead of all of them
 * plus the app, and the row was already unreadable.
 *
 * Separated from `load` so it can be tested without a browser.
 */
/**
 * Settings, field by field, with anything unreadable falling back to its
 * default rather than through.
 *
 * The receipts and the policy updates have been validated on the way in since
 * the day a single bad row blanked the app. The settings were spread straight
 * over the defaults, which quietly undid the point: `urgentDays: "soon"`, or a
 * negative, makes every comparison against it false, so a receipt five days
 * from its deadline renders as RELAXED — grey, no warning — and the
 * week-ahead alert never fires for anything, ever. The app's whole job,
 * switched off by a value nothing was checking.
 *
 * Per field rather than all-or-nothing: one unreadable preference should not
 * discard the three beside it that were fine.
 */
function readSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SETTINGS };
  const s = raw as Record<string, unknown>;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  const urgent =
    typeof s.urgentDays === 'number' &&
    Number.isInteger(s.urgentDays) &&
    s.urgentDays >= URGENT_DAYS_MIN &&
    s.urgentDays <= URGENT_DAYS_MAX
      ? s.urgentDays
      : DEFAULT_SETTINGS.urgentDays;
  return {
    urgentDays: urgent,
    plan: s.plan === 'pro' ? 'pro' : 'free',
    deadlineAlerts: bool(s.deadlineAlerts, DEFAULT_SETTINGS.deadlineAlerts),
    policyWatch: bool(s.policyWatch, DEFAULT_SETTINGS.policyWatch),
  };
}

export function hydrate(raw: unknown, today: Date): KeptState {
  if (typeof raw !== 'object' || raw === null) return freshState(today);
  const parsed = raw as Partial<KeptState>;
  if (!Array.isArray(parsed.receipts)) return freshState(today);

  // Validated row by row, and then deduplicated by id — which the row reader
  // cannot do, because it only ever sees one row at a time.
  //
  // Two rows for one purchase means the money is counted twice, which is the
  // single thing this app must not do: one duplicated id turns £89 still
  // returnable into £178, and collides the React keys in three lists on the
  // way. A restore has never been able to produce one (mergeBackup matches by
  // id), but nothing checked the app's own store, and it is the store that
  // already produced the corrupt row this function exists to survive. The
  // first occurrence wins — neither is more correct, and deterministic beats
  // clever.
  const receipts: Receipt[] = [];
  const seen = new Set<string>();
  for (const row of parsed.receipts) {
    const r = readReceipt(row);
    if (!r || seen.has(r.id)) continue;
    seen.add(r.id);
    receipts.push(r);
  }

  // Policy updates are downloadable content, not user data — reseeding is
  // always safe and keeps the feed current on an old install. Validated the
  // same way, through the reader the network path already uses.
  const storedUpdates = Array.isArray(parsed.updates)
    ? readFeed({ feed: 'kept-policy', updates: parsed.updates }) ?? []
    : [];

  return {
    version: SCHEMA_VERSION,
    receipts,
    updates: storedUpdates.length ? storedUpdates : seedUpdates(today),
    onboardingSeen: parsed.onboardingSeen === true,
    settings: readSettings(parsed.settings),
    alertsSent: Array.isArray(parsed.alertsSent) ? parsed.alertsSent.filter((k) => typeof k === 'string') : [],
  };
}

/**
 * Put the mirror back, when the web view has lost the live store.
 *
 * Runs before the app mounts and only on iOS; on the web it resolves
 * immediately having done nothing. It writes into `localStorage` rather than
 * returning a state, so that `load` and every screen below it stay exactly as
 * they were — the rescue is invisible to the rest of the app, which is the
 * point. Returns whether it actually restored anything, so a caller can say so.
 */
export async function restoreFromMirror(): Promise<boolean> {
  if (!isNative()) return false;
  const store = storage();
  if (!store) return false;
  let local: string | null = null;
  try {
    local = store.getItem(KEY);
  } catch {
    local = null;
  }
  /*
   * Ask before reading the file. I recorded this as saving a disk read, and
   * that undersold it: an ordinary launch never touches the filesystem at all,
   * so a plugin call that hangs cannot delay the app for anyone whose store is
   * intact. The read has its own budget for when it IS reached
   * (MIRROR_READ_BUDGET_MS), but the cheapest way to survive a hanging bridge
   * is not to call it. The mutation that removes this line is only invisible
   * while the bridge answers.
   */
  if (chooseSource(local, null) === 'local') return false;
  const mirror = await readMirror();
  if (!mirror || chooseSource(local, mirror) !== 'mirror') return false;
  try {
    store.setItem(KEY, mirror);
    return true;
  } catch {
    return false;
  }
}

export function load(today: Date): KeptState {
  const store = storage();
  const raw = store?.getItem(KEY);
  if (!raw) return freshState(today);
  try {
    return hydrate(JSON.parse(raw), today);
  } catch {
    // Corrupt JSON: start clean rather than trap the user on a broken launch.
    return freshState(today);
  }
}

/**
 * Returns whether the write actually landed.
 *
 * Not throwing inside a render is right; staying silent about it is not. There
 * is no server here, so a failed write is not a degraded experience — it is
 * the data being gone at the next launch, while the screen still shows it. The
 * caller surfaces this; swallowing it means someone adds a receipt, watches it
 * appear, closes the app, and loses it with no indication anything went wrong.
 */
export function save(state: KeptState): boolean {
  const store = storage();
  if (!store) return false;
  try {
    const next = JSON.stringify(state);
    // Skip an identical write. Adopting another tab's state sets this state,
    // which would otherwise write straight back what was just read — churning
    // the quota for nothing.
    if (store.getItem(KEY) === next) return true;
    store.setItem(KEY, next);
    /*
     * And again, outside the web view, on iOS only. Deliberately not awaited:
     * the reducer saves synchronously and cannot wait, and a mirror that fails
     * to write is a degraded state rather than a loss — the live store already
     * has it. That is why this does not feed the failure banner, which means
     * "your receipts are not saved" and would be untrue here. See mirror.ts.
     */
    void writeMirror(next);
    return true;
  } catch {
    // Quota exceeded, or a store that refuses writes entirely.
    return false;
  }
}

/**
 * Notice another tab writing.
 *
 * Two tabs of a local-first app both hold the whole library in memory and both
 * write all of it. Without this, the one with older state destroys whatever
 * the other added the moment it changes anything at all — a setting toggle was
 * enough — and it does so silently, which is the same species of loss the
 * failed-save banner exists for.
 *
 * The `storage` event only fires in OTHER documents of the origin, so this
 * cannot hear itself.
 */
export function onExternalChange(handler: (state: KeptState) => void, today: Date): () => void {
  const listener = (e: StorageEvent) => {
    if (e.key !== KEY || e.newValue === null) return;
    try {
      handler(hydrate(JSON.parse(e.newValue), today));
    } catch {
      // A write we cannot read is not worth adopting; this tab keeps what it
      // has, which is at least coherent.
    }
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}

/**
 * Erase everything this app has stored.
 *
 * On a product whose entire promise is that the data is yours and lives here,
 * being able to take it all back is not a nice-to-have. Uninstalling clears a
 * native app; a web app's storage outlives a closed tab and clearing it by
 * hand means digging through browser settings.
 */
export function wipe(): void {
  /*
   * The pictures and the mirror are dealt with OUTSIDE the localStorage guard,
   * and the ordering here is the whole correctness of this function.
   *
   * Neither of them lives in localStorage, so returning early on a store that
   * will not answer — Safari in private mode throws on access — would leave the
   * photographs and the second copy of every receipt behind, on the one path
   * where the person has explicitly asked for them to be gone.
   */
  void erasePhotos();

  const store = storage();
  let existing: string | null = null;
  try {
    existing = store?.getItem(KEY) ?? null;
  } catch {
    // Unreadable is not a reason to skip the write below.
  }

  /*
   * AN EMPTY LIBRARY IS WRITTEN, NOT THE KEY REMOVED, and the difference is a
   * window in which an erase undoes itself.
   *
   * Removing the key left the app depending on the save effect that follows to
   * commit the emptied state a moment later. Between the two, localStorage held
   * nothing and the mirror still held everything — and `chooseSource` reads
   * exactly that as "the web view lost the store, put it back". So an erase
   * followed by the app being killed, which is precisely what somebody does
   * after erasing, came back on the next launch with every receipt restored.
   * Measured, not reasoned about: the probe returned two receipts.
   *
   * Writing the emptied library is synchronous, so the window does not exist
   * rather than being made small. `chooseSource` then answers "local" from the
   * instant this returns, whatever the mirror still holds.
   *
   * It keeps the rest of the blob — settings, the policy feed, whether
   * onboarding has been seen — because that is what the reducer's `wipe` does
   * a moment later, and two paths writing different post-erase states would be
   * the same fact disagreeing with itself. Only the receipts and the record of
   * having spoken about them go.
   */
  const erased = erasedFrom(existing);
  try {
    store?.setItem(KEY, erased);
  } catch {
    // A storage that refuses writes has nothing persisted to erase either; the
    // in-memory state is reset by the caller regardless.
  }
  // And the second copy, so the file on disk stops holding what was erased.
  void writeMirror(erased);
}

/** The stored blob with the receipts taken out — or a valid empty one. */
function erasedFrom(raw: string | null): string {
  try {
    const parsed: unknown = JSON.parse(raw ?? '');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return JSON.stringify({ ...(parsed as object), receipts: [], alertsSent: [] });
    }
  } catch {
    // Unparseable is the same answer as absent: write a clean empty library.
  }
  /*
   * Deliberately minimal. `hydrate` fills every other key from its own
   * defaults, so spelling them out here would be a second copy of what a
   * default is — and the one thing this MUST satisfy is `looksLikeState`, or
   * the mirror wins on the next launch and the erase is undone after all.
   */
  return JSON.stringify({ version: SCHEMA_VERSION, receipts: [] });
}

/**
 * A backup built from whatever is on disk, without hydrating any of it.
 *
 * For the one moment when the app cannot render: the receipts are still in
 * localStorage and there is no server holding a copy, so the only thing that
 * matters is getting them off the device. That rescue must not run through the
 * code that just failed — not `load`, not `hydrate`, not a receipt reader —
 * because any of those may be exactly what threw. So it parses and copies,
 * validating nothing, and hands back the same shape the importer accepts.
 *
 * Returns null only when there is genuinely nothing to save. Unparseable JSON
 * is still handed back verbatim: it is the person's data, it is what is
 * actually stored, and a file they can keep beats a file they cannot have.
 */
export function rescueBackup(): { text: string; readable: boolean } | null {
  const store = storage();
  let raw: string | null = null;
  try {
    raw = store?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<KeptState>;
    return {
      readable: true,
      text: JSON.stringify(
        {
          app: 'kept',
          exportedAt: new Date().toISOString(),
          version: typeof parsed.version === 'number' ? parsed.version : SCHEMA_VERSION,
          receipts: Array.isArray(parsed.receipts) ? parsed.receipts : [],
          settings: parsed.settings ?? { ...DEFAULT_SETTINGS },
        },
        null,
        2,
      ),
    };
  } catch {
    return { text: raw, readable: false };
  }
}

/** The Settings screen's "Export a backup" — the user's data, in their hands. */
export function exportBackup(state: KeptState): string {
  return JSON.stringify(
    { app: 'kept', exportedAt: new Date().toISOString(), version: state.version, receipts: state.receipts, settings: state.settings },
    null,
    2,
  );
}
