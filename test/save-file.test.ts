import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SaveOutcome } from '../src/lib/save-file';

/*
 * Where a backup actually goes, and what the app is allowed to say about it.
 *
 * kept has no account and no server, and says so on four screens: the file is
 * the only way anything moves to a new phone, and on the crash screen it is
 * the only copy there is. Both places built it the web way — a blob URL on an
 * `<a download>`, clicked — and WKWebView does not honour that attribute.
 * Downloads there go through WKDownloadDelegate, which Capacitor's view
 * controller does not implement, so the click did nothing whatever.
 *
 * That the native write lands is a claim about iOS these tests cannot settle.
 * What they settle is the half that was a defect rather than a limitation:
 * the outcome is now observed, so the screen cannot report a save that did
 * not happen — which is precisely what the crash screen did, saying "Saved."
 * about somebody's last copy the moment the anchor was clicked.
 */

const writes: { path: string; directory: string; encoding: string; data: string }[] = [];
let writeThrows = false;

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    writeFile: async (opts: { path: string; directory: string; encoding: string; data: string }) => {
      if (writeThrows) throw new Error('no space');
      writes.push(opts);
      return { uri: `file:///Documents/${opts.path}` };
    },
  },
  Directory: { Documents: 'DOCUMENTS', Cache: 'CACHE', Data: 'DATA' },
  Encoding: { UTF8: 'utf8' },
}));

function native() {
  (globalThis as Record<string, unknown>).window = { Capacitor: { isNativePlatform: () => true } };
}

/**
 * A browser, with the two APIs the download route needs.
 *
 * The object-URL pair is added to the REAL `URL` rather than a stand-in put in
 * its place. Replacing the global outright takes `new URL(...)` down with it,
 * and this file is not the only thing in a worker that constructs one — a way
 * of failing that shows up somewhere else entirely, once, and does not
 * reproduce.
 */
function web(clickThrows = false) {
  const clicked: { href?: string; download?: string }[] = [];
  const revoked: string[] = [];
  (globalThis as Record<string, unknown>).window = {};
  const url = URL as unknown as Record<string, unknown>;
  url.createObjectURL = () => 'blob:kept/1';
  url.revokeObjectURL = (u: string) => revoked.push(u);
  (globalThis as Record<string, unknown>).Blob = class {
    constructor(public parts: unknown[]) {}
  };
  (globalThis as Record<string, unknown>).document = {
    createElement: () => {
      const a: { href?: string; download?: string; click: () => void } = {
        click: () => {
          if (clickThrows) throw new Error('blocked');
          clicked.push({ href: a.href, download: a.download });
        },
      };
      return a;
    },
  };
  return { clicked, revoked };
}

beforeEach(() => {
  writes.length = 0;
  writeThrows = false;
  vi.resetModules();
});

afterEach(() => {
  for (const key of ['window', 'Blob', 'document']) {
    delete (globalThis as Record<string, unknown>)[key];
  }
  const url = URL as unknown as Record<string, unknown>;
  delete url.createObjectURL;
  delete url.revokeObjectURL;
});

describe('saving a backup', () => {
  it('writes through the filesystem plugin on native, not an anchor', async () => {
    native();
    const { saveJsonFile } = await import('../src/lib/save-file');
    const outcome = await saveJsonFile('kept-backup-2026-08-31.json', '{"receipts":[]}');
    expect(outcome).toEqual({ to: 'files', name: 'kept-backup-2026-08-31.json' });
    expect(writes).toEqual([
      {
        path: 'kept-backup-2026-08-31.json',
        data: '{"receipts":[]}',
        directory: 'DOCUMENTS',
        encoding: 'utf8',
      },
    ]);
  });

  it('writes to Documents, the only directory a person can open', async () => {
    /*
     * Cache and Data are both writable and neither appears in the Files app.
     * A backup in one of those is as lost as one that was never written, so
     * the destination is part of the fix rather than an implementation detail.
     */
    native();
    const { saveJsonFile } = await import('../src/lib/save-file');
    await saveJsonFile('b.json', '{}');
    expect(writes[0].directory).toBe('DOCUMENTS');
  });

  it('still uses the browser download on the web', async () => {
    const { clicked, revoked } = web();
    const { saveJsonFile } = await import('../src/lib/save-file');
    expect(await saveJsonFile('kept-backup-2026-08-31.json', '{}')).toEqual({ to: 'download' });
    expect(clicked).toEqual([{ href: 'blob:kept/1', download: 'kept-backup-2026-08-31.json' }]);
    // The object URL is released whether or not anyone looks at it; a page
    // that keeps making backups otherwise keeps every one of them alive.
    expect(revoked).toEqual(['blob:kept/1']);
    expect(writes).toEqual([]);
  });
});

describe('what may be said afterwards', () => {
  it('reports nowhere when the native write fails', async () => {
    native();
    writeThrows = true;
    const { saveJsonFile, savedWhere } = await import('../src/lib/save-file');
    const outcome = await saveJsonFile('b.json', '{}');
    expect(outcome).toEqual({ to: 'nowhere' });
    expect(savedWhere(outcome).toLowerCase()).not.toContain('saved');
  });

  it('reports nowhere when the browser refuses the click', async () => {
    web(true);
    const { saveJsonFile, savedWhere } = await import('../src/lib/save-file');
    const outcome = await saveJsonFile('b.json', '{}');
    expect(outcome).toEqual({ to: 'nowhere' });
    expect(savedWhere(outcome).toLowerCase()).not.toContain('saved');
  });

  it('never claims a save for an outcome that is not one', async () => {
    /*
     * The property the crash screen leans on, asserted over every outcome the
     * type allows rather than the two above — a fourth would otherwise arrive
     * with no one asking this question of it.
     */
    const { savedWhere } = await import('../src/lib/save-file');
    const claims = (o: SaveOutcome) => /saved/i.test(savedWhere(o));
    expect(claims({ to: 'download' })).toBe(true);
    expect(claims({ to: 'files', name: 'b.json' })).toBe(true);
    expect(claims({ to: 'nowhere' })).toBe(false);
  });

  it('tells someone where to look on each platform', async () => {
    const { savedWhere } = await import('../src/lib/save-file');
    expect(savedWhere({ to: 'files', name: 'kept-backup-2026-08-31.json' })).toContain('On My iPhone');
    expect(savedWhere({ to: 'files', name: 'kept-backup-2026-08-31.json' })).toContain(
      'kept-backup-2026-08-31.json',
    );
    expect(savedWhere({ to: 'download' })).toContain('downloads');
  });
});

describe('the name on the file', () => {
  it('says what it is a backup of, and when it was taken', async () => {
    const { backupFilename } = await import('../src/lib/save-file');
    const day = new Date('2026-08-31T22:30:00Z');
    expect(backupFilename('backup', day)).toBe('kept-backup-2026-08-31.json');
    expect(backupFilename('rescue', day)).toBe('kept-rescue-2026-08-31.json');
  });
});

describe('the Documents directory being reachable at all', () => {
  const PLIST = join(__dirname, '..', 'ios', 'App', 'App', 'Info.plist');

  it('is opted into the Files app, or the write above is pointless', () => {
    /*
     * Without UIFileSharingEnabled the directory exists and appears nowhere.
     * The write would succeed, the screen would say where it went, and the
     * folder named would not be there — a more convincing version of the bug
     * this replaced. Nothing here runs on iOS, so this is a guard a reader
     * can check rather than a runner, the same standing as safe-area.test.ts.
     */
    const plist = readFileSync(PLIST, 'utf8');
    for (const key of ['UIFileSharingEnabled', 'LSSupportsOpeningDocumentsInPlace']) {
      expect(plist).toMatch(new RegExp(`<key>${key}</key>\\s*<true/>`));
    }
  });

  it('names the folder a person will see, which is the display name', () => {
    // "Files › On My iPhone › kept" is only true while CFBundleDisplayName is
    // kept; the sentence and the plist have to agree or the instruction sends
    // someone to a folder that is not there.
    const plist = readFileSync(PLIST, 'utf8');
    const shown = plist.match(/<key>CFBundleDisplayName<\/key>\s*<string>([^<]*)<\/string>/)?.[1];
    expect(shown).toBe('kept');
  });
});
