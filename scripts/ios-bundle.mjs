/**
 * Boot the bundle that actually ships to a phone.
 *
 *   npm run build:ios && CHROMIUM_PATH=/path/to/chrome node scripts/ios-bundle.mjs
 *
 * Every other sweep runs against `dist` — the WEB build, where the landing page
 * is at `/` and the app is at `/app/`. The iOS bundle is a different document
 * at a different path: `dist-ios`, app at the root. Nothing had ever loaded it.
 *
 * That gap hid a real one. The service worker registers with `scope: '/app/'`,
 * because that is where the app lives on the web. In the iOS bundle the app is
 * at `/`, so the registration succeeded and the page it exists to serve sat
 * outside its scope — measured here first, as
 * `registrations: ["/app/"], controlled: false`. A worker that runs on every
 * launch and can never control anything is the cost with none of the benefit,
 * and `freshness` says "the worker controls the page" about the OTHER bundle.
 *
 * The native bridge is stubbed rather than waited for, because the question is
 * what the app does when it believes it is native, and that is decidable here.
 * What this CANNOT answer is anything about iOS itself; see the README.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { reportOnCrash, sayCrash } from './crash-report.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const VITE_BIN = `${ROOT}node_modules/vite/bin/vite.js`;
const PORT = Number(process.env.KEPT_IOS_PORT ?? 4188);
const ORIGIN = `http://localhost:${PORT}`;
const EXEC = process.env.CHROMIUM_PATH;

const failures = [];
reportOnCrash(report);

if (!existsSync(`${ROOT}dist-ios/index.html`)) {
  console.error('✗ dist-ios is not built — run `npm run build:ios` first');
  process.exit(1);
}

// Its own port and its own server, so it cannot be pointed at the web build by
// accident. That mistake is the entire reason this file exists.
const server = spawn(
  process.execPath,
  [VITE_BIN, 'preview', '--outDir', 'dist-ios', '--port', String(PORT), '--strictPort'],
  { cwd: ROOT, detached: true, stdio: 'ignore' },
);
let serverUp = true;
async function stopServer() {
  if (!serverUp) return;
  serverUp = false;
  try {
    process.kill(-server.pid, 'SIGKILL');
  } catch {
    /* already gone */
  }
}
process.on('exit', () => {
  if (serverUp) {
    try {
      process.kill(-server.pid, 'SIGKILL');
    } catch {
      /* already gone */
    }
  }
});

async function waitForServer() {
  for (let i = 0; i < 100; i += 1) {
    if (await fetch(ORIGIN).then((r) => r.ok, () => false)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

if (!(await waitForServer())) {
  failures.push({ what: `the preview never came up on ${PORT}`, saw: '' });
  report();
}

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const ctx = await browser.newContext({ viewport: { width: 402, height: 874 } });

// Convince the app it is inside the native shell, which is the only state this
// bundle is ever loaded in. `isNative()` reads the bridge's own global.
await ctx.addInitScript(() => {
  window.Capacitor = { isNativePlatform: () => true };
});

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const seen = await page.evaluate(async () => {
  const regs = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistrations() : [];
  return {
    title: document.title,
    /*
     * Which BUNDLE booted, by the entry it loads.
     *
     * The first version of this asked for the tab bar, and it failed on a
     * correct app: a fresh install opens on onboarding, which has no
     * navigation yet. The two documents are distinguished by the entry they
     * pull — `app-*.js` against the landing page's `landing-*.js` — which is
     * a fact about the build rather than about which screen happens to be up.
     */
    entries: [...document.querySelectorAll('script[src]')].map((el) => el.getAttribute('src')),
    // And that it actually rendered something, so a blank page cannot pass for
    // a correct one just because the right file was requested.
    rendered: (document.getElementById('root')?.childElementCount ?? 0) > 0,
    // The marketing page's tell: it offers the app rather than being it.
    looksLikeLanding: /download|app store/i.test(document.body.innerText),
    workerScopes: regs.map((r) => r.scope),
  };
});

if (!seen.entries.some((src) => /\/assets\/app-/.test(src ?? ''))) {
  failures.push({
    what: 'the root of the iOS bundle does not load the app entry',
    saw: `${seen.title} — ${seen.entries.join(', ') || 'no scripts at all'}`,
  });
}
if (!seen.rendered) {
  failures.push({ what: 'the iOS bundle rendered nothing into #root', saw: seen.title });
}
if (seen.looksLikeLanding) {
  failures.push({ what: 'the root of the iOS bundle is the marketing page', saw: seen.title });
}
if (seen.workerScopes.length > 0) {
  failures.push({
    what: 'a service worker registered in the iOS bundle, where it can never control the page',
    saw: seen.workerScopes.join(', '),
  });
}
if (errors.length > 0) {
  failures.push({ what: 'the iOS bundle raised page errors', saw: errors.join(' | ') });
}

await browser.close();
await stopServer();
report();

function report(crash) {
  if (!crash && failures.length === 0) {
    console.log('✓ the iOS bundle boots as the app at its root, with no worker and no errors');
    process.exit(0);
  }
  for (const f of failures) console.log(`✗ ${f.what}\n    saw: ${f.saw}`);
  if (crash) sayCrash(crash);
  process.exit(1);
}
