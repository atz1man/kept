/**
 * A second copy of the library, outside the web view.
 *
 * On the web this file does nothing at all. It exists for the iOS build, where
 * the app is a WKWebView and `localStorage` is not where user data belongs.
 *
 * The reasoning, because it decides the shape of everything below. This app's
 * entire promise is that the receipts are yours, live on your device, and go
 * nowhere else — which also means there is no server holding a copy, so a
 * local loss is a total loss. Inside an app, WKWebView keeps its website data
 * under `Library/WebKit`. That location is treated as reclaimable and is not
 * part of a device backup, so a restored phone, or a phone that ran short of
 * space, can hand the app back an empty store with no error and no signal.
 * `storage.ts` already refuses to let a failed write pass silently, for exactly
 * this reason; this is the same argument one layer down, and the failure it
 * guards is worse because nothing would even report it.
 *
 * So the receipts are written a second time, to the app's Documents directory,
 * which is user data, is backed up, and is not reclaimed. `localStorage`
 * remains the live store — the reducer saves synchronously and every screen
 * reads from it, and none of that changes — and this is a mirror behind it.
 *
 * ONE RULE, stated once because special cases are how the copies drift apart:
 * the mirror holds whatever `save` last committed. Not "the newest", not "the
 * biggest" — whatever was committed. That is what makes erasing safe: the
 * erase leaves an empty library in `localStorage`, `save` commits it, and the
 * mirror is emptied by the same path everything else uses, rather than by a
 * rule of its own that could be forgotten.
 */

export type Source = 'local' | 'mirror' | 'fresh';

/**
 * Is this string a stored library, as opposed to absent, corrupt, or something
 * else entirely?
 *
 * Deliberately weaker than `hydrate`, which answers a different question.
 * `hydrate` turns anything into *a* usable state and falls back to a fresh one
 * when it cannot — correct for booting, and exactly wrong for choosing between
 * two candidates, because it would report a fresh seeded library as a
 * perfectly good read of a corrupt store. What matters here is only whether
 * this string is a library at all; `hydrate` still validates every row after.
 */
export function looksLikeState(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const value: unknown = JSON.parse(raw);
    return (
      typeof value === 'object' &&
      value !== null &&
      Array.isArray((value as { receipts?: unknown }).receipts)
    );
  } catch {
    return false;
  }
}

/**
 * Which copy to boot from.
 *
 * The live store wins whenever it is readable, because the mirror is written
 * after it and can only ever be the same or older. The mirror is a rescue, not
 * a peer: it is read when the web view has handed back nothing or handed back
 * something unreadable, which on iOS means the data was reclaimed rather than
 * that the user has no receipts.
 *
 * The corrupt case is the one worth naming. Without a mirror, `load` meets
 * unparseable JSON and starts clean — the only sane thing it could do, and
 * still a total loss of somebody's receipts. With one, that same store is a
 * reason to reach for the copy instead.
 */
export function chooseSource(local: string | null, mirror: string | null): Source {
  if (looksLikeState(local)) return 'local';
  if (looksLikeState(mirror)) return 'mirror';
  return 'fresh';
}

/**
 * True only inside the native shell.
 *
 * Read off the bridge's own global rather than by importing `@capacitor/core`,
 * so the web bundle does not carry the package at all — the same rule that
 * keeps exceljs and leaflet out of it. Every function below returns a no-op
 * answer when this is false, so the web build behaves exactly as it did.
 */
export function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  const bridge = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return bridge?.isNativePlatform?.() === true;
}

/** One file, named for what it holds rather than for the app that wrote it. */
const MIRROR_FILE = 'kept-receipts.json';

/**
 * Imported here and nowhere else, and only once the platform check has passed,
 * so a browser never loads it.
 */
async function fs() {
  const mod = await import('@capacitor/filesystem');
  return { Filesystem: mod.Filesystem, Directory: mod.Directory, Encoding: mod.Encoding };
}

/**
 * How long the rescue may hold the app up.
 *
 * The read happens BEFORE the first render, so a call that never answers is a
 * blank screen — the failure `Recovery` exists for, reached by a path Recovery
 * cannot see, because nothing threw and nothing rendered. Three seconds is
 * long enough for a disk read of a file measured in kilobytes and short enough
 * that a person meets the app rather than a white rectangle.
 */
export const MIRROR_READ_BUDGET_MS = 3000;

/**
 * @param budgetMs Overridable for the same reason `derive` takes `today`
 *                 rather than reading the clock: a budget that cannot be
 *                 shortened is a budget that cannot be tested. Three attempts
 *                 to control it with fake timers instead all failed, because
 *                 the dynamic import below needs real async work that fake
 *                 time does not provide — so the budget kept expiring on the
 *                 IMPORT, and the test measured a hung import while claiming
 *                 to measure a hung read.
 */
export async function readMirror(budgetMs = MIRROR_READ_BUDGET_MS): Promise<string | null> {
  if (!isNative()) return null;

  /*
   * The budget is on the READ, deliberately, and not on the restore that calls
   * it. A timeout one level up would let the read land AFTER the app had
   * mounted on an empty store — and the save effect would then commit that
   * empty library, which the mirror faithfully copies, turning a recoverable
   * loss into a permanent one. That is the same ordering hazard `main.tsx`
   * documents, arriving by a different route. Giving up here means nothing
   * lands late, because nothing is still coming.
   */
  const read = (async () => {
    const { Filesystem, Directory, Encoding } = await fs();
    const file = await Filesystem.readFile({
      path: MIRROR_FILE,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    return typeof file.data === 'string' ? file.data : null;
  })().catch(() => {
    // No mirror yet is the ordinary case on a first launch, and an unreadable
    // one is not worth distinguishing: either way there is nothing to restore.
    // Caught HERE rather than around the race, so a rejection arriving after
    // the budget has expired is already handled and cannot surface as an
    // unhandled rejection in a shell that has moved on.
    return null;
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), budgetMs);
  });
  try {
    return await Promise.race([read, budget]);
  } finally {
    // Or a launch that read its mirror in 4ms would still hold a timer open
    // for the rest of the three seconds.
    clearTimeout(timer);
  }
}

/** Returns whether the write landed, on the same principle as `save`. */
export async function writeMirror(raw: string): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { Filesystem, Directory, Encoding } = await fs();
    await Filesystem.writeFile({
      path: MIRROR_FILE,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      data: raw,
    });
    return true;
  } catch {
    return false;
  }
}
