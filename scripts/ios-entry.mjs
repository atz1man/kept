/**
 * Make the APP the entry point of the iOS bundle.
 *
 * The web build is two entries: the landing page at `/` and the app at
 * `/app/`. That is right for the web and wrong inside a native shell, which
 * loads the root of `webDir` and would otherwise open on marketing copy that
 * invites you to download the app you are already inside.
 *
 * A copy, not a rewrite: every asset the app references is an ABSOLUTE path
 * (`/assets/...`, `/fonts/...`), so the same document works unchanged when it
 * is served from the root instead of from `/app/`. Verified rather than
 * assumed — the check below refuses if a relative asset path ever appears,
 * because that is the day this stops being a copy and starts being a rewrite.
 */
import { copyFileSync, existsSync, readFileSync } from 'node:fs';

const DIR = 'dist-ios';
const from = `${DIR}/app/index.html`;
const to = `${DIR}/index.html`;

if (!existsSync(from)) {
  console.error(`✗ ${from} does not exist — run \`vite build --outDir ${DIR}\` first`);
  process.exit(1);
}

const html = readFileSync(from, 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
if (refs.length === 0) {
  console.error('✗ the app entry references no assets at all — this check would pass over anything');
  process.exit(1);
}
const relative = refs.filter((r) => !r.startsWith('/') && !/^[a-z]+:/i.test(r));
if (relative.length > 0) {
  console.error('✗ the app entry has relative asset paths, so it cannot simply be moved to the root:');
  for (const r of relative) console.error(`    ${r}`);
  process.exit(1);
}

/*
 * And the worker in THIS bundle has to have been stamped.
 *
 * The vite plugin fails loudly when the placeholder is missing, but it is
 * silent when the file is missing — it catches and returns, on the reasonable
 * grounds that a partial build has no worker to stamp. That silence is what
 * made the outDir bug invisible: pointed at the wrong directory it stamped
 * someone else's worker, or nothing at all, and the iOS bundle shipped a cache
 * name of `__BUILD_ID__` that is identical in every build ever made. A service
 * worker whose cache name never changes never evicts, so an installed app
 * would be pinned to the first version it ever saw. Asked here because this is
 * the script that knows the iOS bundle is finished.
 */
const sw = `${DIR}/sw.js`;
if (!existsSync(sw)) {
  console.error(`✗ ${sw} was not emitted — the iOS bundle has no service worker`);
  process.exit(1);
}
const worker = readFileSync(sw, 'utf8');
if (worker.includes('__BUILD_ID__')) {
  console.error(`✗ ${sw} still holds __BUILD_ID__ — its cache name would never change, so an`);
  console.error('  installed app would be pinned to the first version it ever cached.');
  process.exit(1);
}

copyFileSync(from, to);
console.log(`✓ ${to} is the app (${refs.length} asset paths, all absolute), worker stamped`);
