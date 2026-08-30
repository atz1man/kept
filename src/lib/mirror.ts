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

export async function readMirror(): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const { Filesystem, Directory, Encoding } = await fs();
    const file = await Filesystem.readFile({
      path: MIRROR_FILE,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    return typeof file.data === 'string' ? file.data : null;
  } catch {
    // No mirror yet is the ordinary case on a first launch, and an unreadable
    // one is not worth distinguishing: either way there is nothing to restore.
    return null;
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
