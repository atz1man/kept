/**
 * What each page makes a phone download before it can paint, held to a
 * ceiling. Run after `vite build`: `npm run budget`.
 *
 * Bytes, not milliseconds. `perf.mjs` stays out of CI because wall-clock time
 * on a shared runner measures the runner; a byte count is the same on every
 * machine, so a threshold over it fails only when the app changed. The app
 * keeps its two heavy readers off the first load on purpose — the photo
 * reader's model is fifteen megabytes and the PDF reader half a megabyte
 * gzipped, both imported only when a scan or a PDF needs them — and nothing
 * held that true: one static import of either and every launch on a train
 * waits for it, with every suite still green.
 *
 * A page's first load is what its HTML names: the entry script, the chunks it
 * preloads, and its stylesheets. Gzipped, because that is what crosses the
 * network. The ceilings are what each page weighed when this was written plus
 * about fifteen per cent, so ordinary growth fits and a new dependency on the
 * critical path does not. Raising one is allowed; it should be a decision
 * written in the commit, not a number nudged until CI passes.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = process.env.DIST ?? 'dist';

/** Gzipped bytes allowed on each page's first load, and what it weighed when set. */
const BUDGETS = {
  'app/index.html': { ceiling: 160_000, measured: 138_247 },
  'index.html': { ceiling: 76_000, measured: 65_472 },
  'privacy/index.html': { ceiling: 58_000, measured: 50_515 },
  'rights/index.html': { ceiling: 69_000, measured: 59_976 },
};

/** The scripts and stylesheets a built page names, as paths under dist. */
function firstLoad(html) {
  return [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
}

let failed = false;
for (const [page, { ceiling }] of Object.entries(BUDGETS)) {
  const files = firstLoad(readFileSync(join(DIST, page), 'utf8'));
  const gz = files.reduce((sum, f) => sum + gzipSync(readFileSync(join(DIST, f)), { level: 9 }).length, 0);
  // A page that names nothing has not been measured, whatever it weighs.
  const ok = files.length > 0 && gz <= ceiling;
  if (!ok) failed = true;
  console.log(`${ok ? '✓' : '✗'} ${page}: ${files.length} files, ${gz.toLocaleString('en-GB')} bytes gzipped (ceiling ${ceiling.toLocaleString('en-GB')})`);
}
process.exit(failed ? 1 : 0);
