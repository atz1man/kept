import { filesystem, isNative } from './mirror';

/**
 * Handing a file to the person, on a platform that will not take one.
 *
 * The whole app has no account and no server, and says so on four screens: a
 * backup file is the only way anything moves to a new phone, and on the crash
 * screen it is the only copy there is. Both places built that file the way the
 * web does — a blob URL on an `<a download>`, clicked.
 *
 * WKWebView does not honour the download attribute. Downloads there go through
 * `WKDownloadDelegate`, which an app has to implement, and Capacitor's view
 * controller does not; a click on a blob: URL is simply not navigated. So in
 * the iOS app both buttons did nothing at all — and the crash screen, which
 * cannot see that nothing happened, went on to say "Saved." about the only
 * copy of somebody's receipts.
 *
 * Nothing here can be run on a device from this repository, so this is written
 * against the platform's documented behaviour rather than measured — the same
 * standing as `safe-area.test.ts` and the usage strings. What IS measured is
 * the half that was actually wrong: the message is now derived from the
 * outcome, so a write that did not happen cannot be reported as one.
 */
export type SaveOutcome =
  | { to: 'download' }
  | { to: 'files'; name: string }
  | { to: 'nowhere' };

/**
 * Documents, not Cache or Data: it is the only directory a person can reach,
 * and only because Info.plist opts in with `UIFileSharingEnabled` — see the
 * comment there. Written to a directory nobody can open, a backup is exactly
 * as lost as one the browser refused to download, with the added harm of
 * looking like it worked.
 */
export async function saveJsonFile(name: string, text: string): Promise<SaveOutcome> {
  if (isNative()) {
    try {
      const { Filesystem, Directory, Encoding } = await filesystem();
      await Filesystem.writeFile({
        path: name,
        data: text,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      return { to: 'files', name };
    } catch {
      return { to: 'nowhere' };
    }
  }
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return { to: 'download' };
  } catch {
    // A browser that refuses the click leaves nothing behind either, and the
    // caller has to be able to say so.
    return { to: 'nowhere' };
  }
}

/**
 * Where it went, in words, decided here so that no caller can invent a
 * reassurance the outcome does not support. The failure sentence deliberately
 * does not contain the word "saved" in any form: the crash screen's whole job
 * is to be believable about the last copy of somebody's receipts.
 */
export function savedWhere(outcome: SaveOutcome): string {
  switch (outcome.to) {
    case 'download':
      return 'Saved to your downloads.';
    case 'files':
      return `Saved to Files › On My iPhone › kept, as ${outcome.name}.`;
    case 'nowhere':
      return 'kept could not write the file, so nothing was written. Try again.';
  }
}

/** The name both callers build, differing only in what it is a backup of. */
export function backupFilename(kind: 'backup' | 'rescue', today: Date): string {
  return `kept-${kind}-${today.toISOString().slice(0, 10)}.json`;
}
