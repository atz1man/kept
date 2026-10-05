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

/**
 * What Settings says when the browser would not promise to keep the library.
 *
 * `keepStorage`'s answer was asked for and thrown away, so a browser that said
 * no — the usual answer for a site that is not installed — left the screen
 * saying "Everything lives on this device" with nothing about how long. On the
 * web that storage is the only copy, and it is the browser's to clear: when
 * space runs low, and (Safari) after a stretch without a visit. Said once, by
 * the backup buttons, with the two things that help; never on iPhone, whose
 * library is mirrored to its own disk, and never before the answer is in.
 */
export function storageNote(kept: boolean | null): string | null {
  return kept === false
    ? 'This browser hasn’t promised to keep what kept stores here, and can clear it when space runs low or after weeks without a visit. Adding kept to your Home Screen helps, and a backup is a copy it can’t clear.'
    : null;
}
