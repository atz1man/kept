import { buildFromCacheNames, type SupportFacts } from '../lib/support';
import { isNative } from '../lib/mirror';

/** The bytes this app holds in local storage — where every receipt lives, and where the browser's quota bites. */
function localStorageBytes(): number | null {
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
  let build: string | null = null;
  try {
    if (typeof caches !== 'undefined') build = buildFromCacheNames(await caches.keys());
  } catch {
    build = null;
  }
  let persisted: boolean | null = null;
  try {
    persisted = typeof navigator !== 'undefined' && navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  } catch {
    persisted = null;
  }
  return {
    version: __KEPT_VERSION__,
    build,
    platform: isNative() ? 'iPhone app' : 'web',
    userAgent: typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent,
    receipts,
    storageBytes: localStorageBytes(),
    persisted,
    error: error ?? null,
    now: new Date(),
  };
}
