
/**
 * What a person can send when they write in about a problem — and nothing
 * about what they bought.
 *
 * Every support conversation at any scale opens with the same questions:
 * which version, which device, how much data, did something break and what
 * did it say. The app could answer none of them: the version was shown
 * nowhere, and the one screen that knows something broke (Recovery) wrote
 * the error to a console no person can open. So the answer was "it broke",
 * and the person who could fix it started from nothing.
 *
 * This is the whole of what goes out, and it is shown to the person before
 * they copy it. Counts and sizes, never contents: no shop, no item, no amount,
 * no date, no order number, no photo. `test/support.test.ts` plants a marker
 * in every field of a receipt and fails if any of them appears here.
 */
export interface SupportFacts {
  /** package.json's version, stamped at build time. */
  version: string;
  /**
   * The service worker's cache name for this build — derived from the built
   * files' content, so it changes exactly when the code does. Null where there
   * is no worker (the iPhone app, a first visit, a private window).
   */
  build: string | null;
  platform: 'iPhone app' | 'web';
  userAgent: string;
  /**
   * The stored receipts, or whatever is in the store's receipt list. Loosely
   * typed on purpose: the recovery screen reads the raw store, past the loader
   * that may be what threw, so only the two fields counted here are trusted.
   */
  receipts: readonly { status?: unknown; demo?: unknown }[];
  /** Bytes this app has written to local storage, where the browser says. */
  storageBytes: number | null;
  /** Whether the browser has agreed to keep this app's storage (`navigator.storage.persisted()`). */
  persisted: boolean | null;
  /** The render error, on the recovery screen only. */
  error?: { message: string; where?: string } | null;
  now: Date;
}

/** At most this many lines of where a render error happened: enough to find it, not a wall. */
const STACK_LINES = 6;

export function supportDetails(f: SupportFacts): string {
  const counts: Record<string, number> = { active: 0, sent: 0, returned: 0, kept: 0, other: 0 };
  for (const r of f.receipts) {
    const status = typeof r?.status === 'string' && r.status in counts && r.status !== 'other' ? r.status : 'other';
    counts[status] += 1;
  }
  const samples = f.receipts.filter((r) => r?.demo === true).length;
  const lines = [
    `Quids In ${f.version}${f.build ? ` (build ${f.build})` : ''} · ${f.platform}`,
    `Device: ${f.userAgent}`,
    `Receipts: ${f.receipts.length} (${counts.active} open, ${counts.sent} sent back, ${counts.returned} returned, ${counts.kept} kept${counts.other ? `, ${counts.other} unreadable` : ''}; ${samples} samples)`,
    `Storage: ${f.storageBytes === null ? 'unknown' : `${Math.round(f.storageBytes / 1024)} KB`}${f.persisted === null ? '' : f.persisted ? ', kept by the browser' : ', not yet kept by the browser'}`,
    `Copied: ${f.now.toISOString()}`,
  ];
  if (f.error) {
    lines.push(`Error: ${oneLine(f.error.message)}`);
    const where = (f.error.where ?? '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, STACK_LINES);
    if (where.length) lines.push(`Where: ${where.join(' ← ')}`);
  }
  return lines.join('\n');
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, 300);
}

/**
 * This build's id, from the service worker's cache name (`kept-<id>`, stamped
 * by vite.config.ts from the built files' content). Null when there is none.
 */
export function buildFromCacheNames(names: readonly string[]): string | null {
  const ours = names.filter((n) => /^kept-[0-9a-f]{6,}$/.test(n));
  // More than one means an update is waiting; the newest is not knowable from
  // the names, so say none rather than guess which one is running.
  return ours.length === 1 ? ours[0].slice('kept-'.length) : null;
}
