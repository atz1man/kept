/**
 * Asking the browser to keep kept's storage.
 *
 * The web build keeps everything in this browser's storage and nowhere else,
 * and never asked the browser to hold on to it. Browsers clear storage they
 * judge unimportant when space runs short, and some clear what a site has
 * written after weeks without a visit — the very pattern of an app opened
 * when something is bought and then left alone. `persist()` is the one
 * request a page can make against that. Browsers decide for themselves
 * (Chrome grants it to sites that are installed or bookmarked; Safari to ones
 * added to the Home Screen), so this asks, quietly, and never claims more.
 *
 * Not used in the iPhone app, whose library is also mirrored to its own disk.
 */
export async function keepStorage(
  storage: Pick<StorageManager, 'persist' | 'persisted'> | undefined,
): Promise<boolean> {
  if (!storage || typeof storage.persist !== 'function' || typeof storage.persisted !== 'function') return false;
  try {
    if (await storage.persisted()) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}
