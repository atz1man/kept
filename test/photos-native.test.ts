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

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Documents: 'DOCUMENTS' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    readdir: async () => ({ files: listing }),
    deleteFile: async ({ path }: { path: string }) => void removed.push(path),
    rmdir: async ({ path }: { path: string }) => void dirsRemoved.push(path),
    mkdir: async () => {},
    writeFile: async () => {},
    readFile: async () => {
      throw new Error('ENOENT');
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
