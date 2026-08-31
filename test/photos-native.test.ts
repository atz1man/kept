import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The disk side of the photo store, against a stubbed bridge.
 *
 * The important one is erasing. "Erase everything" removed the localStorage key
 * and nothing else, which was complete while everything lived there — a photo
 * on the filesystem would outlive it, leaving the receipts gone from the screen
 * and the shopping still on the disk. This app's privacy notice does not have
 * an asterisk, so the promise is worth a test rather than a comment.
 */

const removed: string[] = [];
const dirsRemoved: string[] = [];
let listing: { name: string }[] = [];
let readdirThrows = false;
let readFileReturns: unknown;

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Documents: 'DOCUMENTS' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    readdir: async () => {
      if (readdirThrows) throw new Error('ENOENT');
      return { files: listing };
    },
    deleteFile: async ({ path }: { path: string }) => void removed.push(path),
    rmdir: async ({ path }: { path: string }) => void dirsRemoved.push(path),
    mkdir: async () => {},
    writeFile: async () => {},
    readFile: async () => {
      if (readFileReturns === undefined) throw new Error('ENOENT');
      return { data: readFileReturns };
    },
  },
}));

beforeEach(() => {
  removed.length = 0;
  dirsRemoved.length = 0;
  listing = [];
  vi.resetModules();
  (globalThis as Record<string, unknown>).window = {
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    Capacitor: { isNativePlatform: () => true },
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

const settle = async () => {
  for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
};

describe('erasing everything', () => {
  it('takes the pictures with it', async () => {
    const { erasePhotos } = await import('../src/lib/photos');
    await erasePhotos();
    expect(dirsRemoved).toEqual(['receipts']);
  });

  it('is reached by wipe, not only callable in principle', async () => {
    // The wiring is the part that would rot: a correct erasePhotos nobody
    // calls leaves the photos exactly where they were.
    const { wipe } = await import('../src/lib/storage');
    wipe();
    await settle();
    expect(dirsRemoved).toEqual(['receipts']);
  });

  it('still reaches them when localStorage will not answer at all', async () => {
    /*
     * Safari in private mode throws on ACCESS, not on write, which this
     * codebase already knows — `storage()` catches it and degrades to an
     * in-memory session. `wipe` used to return early on that, before it had
     * touched anything, and the photographs do not live in localStorage. So on
     * the one device where the store is unreadable, "erase everything" left
     * every picture of a receipt exactly where it was, with nothing on screen
     * to say so.
     *
     * The order in `wipe` is what fixes it, and this is the only thing that
     * says so: putting the early return back leaves every other test green.
     */
    Object.defineProperty(globalThis.window as object, 'localStorage', {
      get() {
        throw new Error('SecurityError: access denied');
      },
      configurable: true,
    });
    const { wipe } = await import('../src/lib/storage');
    expect(() => wipe()).not.toThrow();
    await settle();
    expect(dirsRemoved).toEqual(['receipts']);
  });
});

describe('clearing up after deleted receipts', () => {
  it('deletes the pictures whose receipt has gone, and only those', async () => {
    listing = [{ name: 'keep.jpg' }, { name: 'gone.jpg' }];
    const { cleanupPhotos } = await import('../src/lib/photos');
    expect(await cleanupPhotos(['keep'])).toBe(1);
    expect(removed).toEqual(['receipts/gone.jpg']);
  });

  it('deletes nothing when every picture still has a receipt', async () => {
    listing = [{ name: 'a.jpg' }, { name: 'b.jpg' }];
    const { cleanupPhotos } = await import('../src/lib/photos');
    expect(await cleanupPhotos(['a', 'b'])).toBe(0);
    expect(removed).toEqual([]);
  });
});

describe('on the web', () => {
  it('touches the filesystem for none of it', async () => {
    delete (globalThis as Record<string, unknown>).window;
    const { cleanupPhotos, erasePhotos, savePhoto } = await import('../src/lib/photos');
    await erasePhotos();
    expect(await cleanupPhotos(['a'])).toBe(0);
    expect(await savePhoto('a', 'AAAA')).toBe(false);
    expect(dirsRemoved).toEqual([]);
    expect(removed).toEqual([]);
  });
});

describe('deleting one picture', () => {
  it('does nothing at all on the web, where there is no filesystem', () => {
    // `!isNative() || path === null` — both limbs, only ever exercised together.
    // Loosened to `&&`, the web build calls a plugin that is not there.
    delete (globalThis.window as unknown as Record<string, unknown>).Capacitor;
    return import('../src/lib/photos').then(async ({ deletePhoto }) => {
      await deletePhoto('r_ok');
      expect(removed).toEqual([]);
    });
  });

  it('does nothing for an id that leaves no usable filename', () => {
    /*
     * `photoPath` returns null for an id that sanitises away to nothing, and
     * this is the guard that stops that null reaching the plugin as a path.
     * Flip the `===` and a delete is attempted with no path at all.
     */
    return import('../src/lib/photos').then(async ({ deletePhoto }) => {
      await deletePhoto('///');
      expect(removed).toEqual([]);
    });
  });
});

describe('when there is nothing to clear up', () => {
  it('reports none cleared when the directory is not there at all', async () => {
    /*
     * The CATCH returns 0, and an empty listing does not reach it — the try
     * succeeds and returns 0 by the ordinary route, so the first version of
     * this test passed with the catch returning anything. `readdir` has to
     * throw, which is what happens on a device where nothing was ever
     * photographed. Claiming one deletion there would be inventing it.
     */
    readdirThrows = true;
    const { cleanupPhotos } = await import('../src/lib/photos');
    expect(await cleanupPhotos([])).toBe(0);
    readdirThrows = false;
  });
});

describe('reading one picture back', () => {
  it('returns nothing for an id that leaves no usable filename', async () => {
    const { readPhoto } = await import('../src/lib/photos');
    expect(await readPhoto('///')).toBeNull();
  });

  it('hands back the data when the platform gives a string', async () => {
    readFileReturns = 'QkFTRTY0';
    const { readPhoto } = await import('../src/lib/photos');
    expect(await readPhoto('r_ok')).toBe('QkFTRTY0');
    readFileReturns = undefined;
  });

  it('returns nothing when the platform gives something that is not a string', async () => {
    /*
     * Capacitor's Filesystem hands back a base64 STRING on a device and a Blob
     * on the web, and this is the line that tells them apart. Every test here
     * had `readFile` throwing, so it was never reached at all — flip the
     * comparison and a Blob is handed to an <img src> as if it were base64.
     */
    readFileReturns = { size: 12, type: 'image/jpeg' };
    const { readPhoto } = await import('../src/lib/photos');
    expect(await readPhoto('r_ok')).toBeNull();
    readFileReturns = undefined;
  });
});
