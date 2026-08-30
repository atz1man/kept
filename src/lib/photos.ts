import { isNative } from './mirror';

/**
 * The picture of the paper receipt.
 *
 * Kept on the filesystem, not in `localStorage`, because a photo is megabytes
 * and the whole library shares a quota measured in single figures — one snap
 * would evict every receipt the app has. Web builds have no camera path at all,
 * so every function here is a no-op off-device.
 *
 * THE FILE IS THE TRUTH, and there is deliberately no `photo` field on
 * `Receipt`. A flag would have to be kept in step with the disk, and the one
 * moment it certainly could not be is the one that matters: a backup restored
 * onto a different phone carries the receipts and none of the pictures, so
 * every flag would arrive set and every file would be missing. Asking the disk
 * cannot drift, and "no photo here" is the honest answer on that phone.
 *
 * That also means a backup needs no new field and an older build reading a
 * newer backup loses nothing it understands.
 */

const PHOTO_DIR = 'receipts';

/**
 * A receipt id is NOT a filename, and this is the whole reason this function
 * exists rather than a template string at each call site.
 *
 * `readReceipt` accepts any non-empty string as an id, because that is all an
 * id has to be. The app generates `r_<base36>_<rand>`, but a BACKUP FILE is
 * untrusted input and can carry anything — including `../` — and this app
 * already treats an imported file as something to be bounded rather than
 * believed. An id of `../kept-receipts.json` would otherwise point a photo
 * write straight at the mirror, which holds every receipt the person owns.
 *
 * So the id is reduced to characters that cannot mean anything to a path, and
 * an id with nothing usable left gets no photo rather than a guessed one.
 */
export function photoName(receiptId: string): string | null {
  const safe = receiptId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safe) return null;
  // Long ids are the app's own shape plus room; anything past this is not a
  // receipt id, and a filesystem has limits of its own.
  return `${safe.slice(0, 120)}.jpg`;
}

export function photoPath(receiptId: string): string | null {
  const name = photoName(receiptId);
  return name === null ? null : `${PHOTO_DIR}/${name}`;
}

/**
 * Which stored pictures no longer belong to a receipt.
 *
 * Pure, because it is the part worth testing: a photo whose receipt has been
 * deleted is somebody's shopping still sitting on the disk, and this app's
 * promise is that erasing means erasing. Compared on the SANITISED name, since
 * that is what was actually written — comparing raw ids would leave a file
 * behind for every receipt whose id needed cleaning.
 */
export function orphanedPhotos(files: readonly string[], receiptIds: readonly string[]): string[] {
  const held = new Set(receiptIds.map(photoName).filter((n): n is string => n !== null));
  return files.filter((f) => !held.has(f));
}

async function fs() {
  const mod = await import('@capacitor/filesystem');
  return { Filesystem: mod.Filesystem, Directory: mod.Directory };
}

/** Base64 in, no data-URI prefix — what @capacitor/camera hands back. */
export async function savePhoto(receiptId: string, base64: string): Promise<boolean> {
  const path = photoPath(receiptId);
  if (!isNative() || path === null) return false;
  try {
    const { Filesystem, Directory } = await fs();
    await Filesystem.mkdir({ path: PHOTO_DIR, directory: Directory.Documents, recursive: true }).catch(() => {
      // Already there, which is the ordinary case after the first photo.
    });
    await Filesystem.writeFile({ path, directory: Directory.Documents, data: base64 });
    return true;
  } catch {
    return false;
  }
}

export async function readPhoto(receiptId: string): Promise<string | null> {
  const path = photoPath(receiptId);
  if (!isNative() || path === null) return null;
  try {
    const { Filesystem, Directory } = await fs();
    const file = await Filesystem.readFile({ path, directory: Directory.Documents });
    return typeof file.data === 'string' ? file.data : null;
  } catch {
    // Absent is the ordinary answer: no photo was ever taken, or this library
    // arrived from a backup written on another phone.
    return null;
  }
}

export async function deletePhoto(receiptId: string): Promise<void> {
  const path = photoPath(receiptId);
  if (!isNative() || path === null) return;
  try {
    const { Filesystem, Directory } = await fs();
    await Filesystem.deleteFile({ path, directory: Directory.Documents });
  } catch {
    // Nothing to delete is success.
  }
}

/**
 * Every picture, gone.
 *
 * "Erase everything" removed the localStorage key and nothing else, which was
 * complete while everything lived there. A photo on the filesystem would
 * outlive the erase — the receipts gone from the screen and the shopping still
 * on the disk — and this app's privacy notice does not have an asterisk.
 */
export async function erasePhotos(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Filesystem, Directory } = await fs();
    await Filesystem.rmdir({ path: PHOTO_DIR, directory: Directory.Documents, recursive: true });
  } catch {
    // No directory means nothing was ever photographed.
  }
}

/**
 * Delete every picture whose receipt has gone, at launch rather than at delete.
 *
 * Deleting a receipt is UNDOABLE here — there is an undo bar and an
 * `undo-delete` action — so removing the photo at the moment of deletion would
 * make the undo restore a receipt whose picture had already been thrown away.
 * Waiting until the next launch costs nothing and is correct by construction:
 * an undone delete puts the receipt back long before this runs again.
 *
 * It also catches what no delete path ever could — a photo left behind by a
 * restore that replaced the library, or by a crash between the two writes.
 */
export async function cleanupPhotos(receiptIds: readonly string[]): Promise<number> {
  if (!isNative()) return 0;
  try {
    const { Filesystem, Directory } = await fs();
    const dir = await Filesystem.readdir({ path: PHOTO_DIR, directory: Directory.Documents });
    const files = dir.files.map((f) => (typeof f === 'string' ? f : f.name));
    const gone = orphanedPhotos(files, receiptIds);
    for (const name of gone) {
      await Filesystem.deleteFile({ path: `${PHOTO_DIR}/${name}`, directory: Directory.Documents }).catch(() => {
        // One that will not delete must not stop the rest.
      });
    }
    return gone.length;
  } catch {
    // No directory means nothing was ever photographed.
    return 0;
  }
}
