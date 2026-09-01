import { describe, expect, it } from 'vitest';
import { isCameraCancellation, orphanedPhotos, photoName, photoPath } from '../src/lib/photos';

describe('a receipt id is not a filename', () => {
  it('keeps an ordinary one', () => {
    expect(photoName('r_m1abc_x9k2q')).toBe('r_m1abc_x9k2q.jpg');
  });

  /*
   * The reason this function exists. `readReceipt` accepts any non-empty
   * string as an id, because that is all an id has to be — and a BACKUP FILE
   * is untrusted input. An id of `../kept-receipts.json` would point a photo
   * write at the mirror, which holds every receipt the person owns.
   */
  it.each([
    ['../kept-receipts.json'],
    ['../../../../etc/passwd'],
    ['a/b/c'],
    ['..'],
    ['./x'],
    ['r_ok/../../escape'],
  ])('cannot escape the photo directory with %j', (id) => {
    const path = photoPath(id);
    if (path === null) return;
    expect(path.startsWith('receipts/')).toBe(true);
    expect(path).not.toContain('..');
    expect(path.slice('receipts/'.length)).not.toContain('/');
  });

  it('gives no photo at all to an id with nothing usable in it', () => {
    // Better than guessing a name: two such receipts would otherwise share one.
    expect(photoName('../..')).toBeNull();
    expect(photoPath('///')).toBeNull();
  });

  it('bounds the length, because a filesystem does', () => {
    expect(photoName('r'.repeat(500))!.length).toBe(124);
  });
});

describe('pictures that no longer belong to anything', () => {
  it('finds the ones whose receipt has gone', () => {
    // Somebody's shopping, still on the disk after the receipt was deleted.
    const files = ['a.jpg', 'b.jpg', 'c.jpg'];
    expect(orphanedPhotos(files, ['a', 'c'])).toEqual(['b.jpg']);
  });

  it('keeps every one that still has a receipt', () => {
    expect(orphanedPhotos(['a.jpg', 'b.jpg'], ['a', 'b'])).toEqual([]);
  });

  it('treats an empty library as everything being orphaned', () => {
    expect(orphanedPhotos(['a.jpg'], [])).toEqual(['a.jpg']);
  });

  it('compares the name that was WRITTEN, not the raw id', () => {
    /*
     * A receipt whose id needed cleaning is stored under the cleaned name. If
     * this compared raw ids it would fail to match its own file and delete a
     * picture belonging to a receipt the person still holds.
     */
    expect(orphanedPhotos(['rok.jpg'], ['r/o\\k'])).toEqual([]);
  });
});

describe('telling a cancelled camera from a broken one', () => {
  /*
   * The messages below are the plugin's own, copied from
   * node_modules/@capacitor/camera. The two that must NOT read as cancellation
   * are the two that actually happen on a real phone: a build missing a usage
   * description, and a person who said no to the camera. Both used to be caught
   * as if they were a tap on Cancel.
   */
  it.each([
    ['User cancelled photos app', true],
    ['User cancelled photos app.', true],
    ['You are missing NSCameraUsageDescription in your Info.plist file. Camera will not function without it.', false],
    ['User denied access to camera', false],
    ['Unable to load image', false],
    ['', false],
  ])('%j → cancellation: %s', (message, expected) => {
    expect(isCameraCancellation(new Error(message))).toBe(expected);
    // Capacitor throws a CapacitorException on the web, a plain object shape
    // over the bridge, and sometimes a bare string. All three carry the message.
    expect(isCameraCancellation({ message })).toBe(expected);
    expect(isCameraCancellation(message)).toBe(expected);
  });

  it('treats an error with nothing to read as a failure, not a cancellation', () => {
    // Wrong in this direction is a banner for someone who cancelled. Wrong the
    // other way is a camera that silently does nothing.
    for (const nothing of [undefined, null, {}, 0, new Error()]) {
      expect(isCameraCancellation(nothing)).toBe(false);
    }
  });
});
