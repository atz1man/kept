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

/*
 * Emulate what a WKWebView actually provides, rather than the answer we want.
 *
 * The first version set `window.Capacitor = { isNativePlatform: () => true }`,
 * and it worked for exactly one call. `@capacitor/core` loads with the first
 * plugin import and REPLACES that global with its own — measured:
 * `platform: "web"`, `isNativePlatform(): false`, on the detail screen. The
 * sweep then reported the photo control missing, which was true of the page
 * and false of the app.
 *
 * A real iOS shell does not stub Capacitor; it injects a message bridge and
 * lets Capacitor detect it. Doing the same here makes the detection genuine,
 * and has the side effect of being more honest in a second way: plugin calls
 * go to a bridge that never answers, which is exactly the hung-call case
 * MIRROR_READ_BUDGET_MS exists for. The app boots through it.
 */
await ctx.addInitScript(() => {
  const w = window;
  // 1. The message bridge a WKWebView provides. Capacitor's own core reads
  //    this to decide the platform, so the detection stays genuine once the
  //    real runtime loads and rebuilds the global. It answers nothing, on
  //    purpose: that is the hung-call case the read budget exists for.
  w.webkit = w.webkit ?? {};
  w.webkit.messageHandlers = w.webkit.messageHandlers ?? {};
  w.webkit.messageHandlers.bridge = { postMessage: () => {} };
  // 2. And the global itself, because the native shell injects capacitor.js
  //    BEFORE the app bundle runs and a preview server does not. Without this
  //    the very first `isNative()` — the one main.tsx uses to decide whether
  //    to register a service worker — runs before any Capacitor code exists
  //    and answers false, which is true of this server and false of a phone.
  w.Capacitor = w.Capacitor ?? { isNativePlatform: () => true, getPlatform: () => 'ios' };
});

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
// Long enough to outlast MIRROR_READ_BUDGET_MS: the bridge never answers,
// so the app mounts by giving up on the mirror, which is worth exercising.
await page.waitForTimeout(4500);

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
/*
 * And the screens only the native build has.
 *
 * `ReceiptPhoto` renders null off-device, so contrast, a11y and layout — every
 * one of which runs against the WEB build — walk straight past it. New UI that
 * no sweep can see is the gap this whole file exists to close, and it would
 * have opened again the moment the control was added.
 */
await page.getByRole('button', { name: 'Skip' }).click().catch(() => {});
await page.waitForTimeout(400);
await page.locator('li button').first().click().catch(() => {});
await page.waitForTimeout(500);

const detail = await page.evaluate(() => {
  const shoot = [...document.querySelectorAll('button')].find((b) =>
    /photograph the receipt/i.test(b.textContent ?? ''),
  );
  return {
    // 'STORE POLICY' is the detail screen's own card label. The first version
    // of this used /RETURN BY|window/i, which the HOME screen also satisfies
    // — 'NEXT WINDOW TO CLOSE' — so it reported being somewhere it was not.
    onDetail: /STORE POLICY/.test(document.body.innerText),
    hasControl: !!shoot,
    // A control with no accessible name is a control a screen reader cannot
    // offer. axe checks this too, but naming it here says which one broke.
    controlName: shoot?.textContent?.trim() ?? '',
    // The claim beside it has to stay true: this keeps the picture, it does
    // not read it. An app that quietly started implying OCR would be making
    // the promise the disabled Add-screen button still says is not built.
    disclaims: /does not read it/i.test(document.body.innerText),
  };
});

if (!detail.onDetail) {
  failures.push({ what: 'could not open a receipt to check the native-only photo control', saw: '' });
} else {
  if (!detail.hasControl) {
    failures.push({ what: 'the photo control is missing on the detail screen in the native build', saw: '' });
  }
  if (detail.hasControl && !detail.controlName) {
    failures.push({ what: 'the photo control has no accessible name', saw: '' });
  }
  if (!detail.disclaims) {
    failures.push({
      what: 'the photo control no longer says it does not read the receipt, which is the claim that keeps it honest',
      saw: '',
    });
  }

  // axe over the screen the web sweeps cannot reach.
  await page.addScriptTag({ path: `${ROOT}node_modules/axe-core/axe.min.js` });
  const axe = await page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => `${v.id} (${v.nodes.length})`);
  });
  if (axe.length > 0) {
    failures.push({ what: 'axe violations on the native-only detail screen', saw: axe.join(', ') });
  }
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
