import { buildFromCacheNames, type SupportFacts } from '../lib/support';
import { isNative } from '../lib/mirror';
import { embedded } from '../lib/embed';

/** The bytes this app holds in local storage — where every receipt lives, and where the browser's quota bites. */
function localStorageBytes(): number | null {
  // The landing page's demo has none of its own, and must not report the
  // real app's (see embed.ts).
  if (embedded()) return null;
  try {
    let chars = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === null) continue;
      chars += key.length + (localStorage.getItem(key)?.length ?? 0);
    }
    // UTF-16: two bytes a character, which is how browsers count the quota.
    return chars * 2;
  } catch {
    return null;
  }
}

/**
 * Everything `supportDetails` needs, read from this device. Each part is
 * allowed to fail on its own — a private window refuses storage, a page with
 * no service worker has no caches — and fails to "unknown", never to an error
 * on the one screen that may already be showing one.
 */
export async function gatherSupportFacts(receipts: SupportFacts['receipts'], error?: SupportFacts['error']): Promise<SupportFacts> {
  const facts: SupportFacts = {
    version: __KEPT_VERSION__,
    build: null,
    platform: isNative() ? 'iPhone app' : 'web',
    userAgent: typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent,
    receipts,
    storageBytes: null,
    persisted: null,
    error: error ?? null,
    now: new Date(),
  };
  /*
   * In the landing page's demo the build, the storage and whether the browser
   * keeps it all belong to the real app, which the demo does not reach (see
   * embed.ts). They stay unknown there; the demo's own receipts, which are in
   * memory, are still counted.
   */
  if (embedded()) return facts;
  try {
    if (typeof caches !== 'undefined') facts.build = buildFromCacheNames(await caches.keys());
  } catch {
    facts.build = null;
  }
  try {
    facts.persisted = typeof navigator !== 'undefined' && navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  } catch {
    facts.persisted = null;
  }
  facts.storageBytes = localStorageBytes();
  return facts;
}
