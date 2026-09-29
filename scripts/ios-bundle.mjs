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

/**
 * A native bridge that ANSWERS, for the flows that need a camera or a disk.
 *
 * Capacitor's own core calls native through `PluginHeaders` and
 * `nativePromise`, so declaring Camera and Filesystem there and answering them
 * exercises the app's real plugin imports. The disk lives in sessionStorage so
 * it survives a reload, as a phone's Documents directory does; `slowMirrorMs`
 * delays reading the library's mirror file, as a slow disk would.
 */
async function answeringBridge(ctx, { shot = '', disk = {}, slowMirrorMs = 0 } = {}) {
  await ctx.addInitScript(({ shot, disk, slowMirrorMs }) => {
    const w = window;
    w.webkit = { messageHandlers: { bridge: { postMessage: () => {} } } };
    const KEY = '__keptDisk';
    if (sessionStorage.getItem(KEY) === null) sessionStorage.setItem(KEY, JSON.stringify(disk));
    const files = () => JSON.parse(sessionStorage.getItem(KEY));
    const put = (all) => sessionStorage.setItem(KEY, JSON.stringify(all));
    w.__keptDisk = files;
    const missing = () => Promise.reject(new Error('File does not exist.'));
    const plugins = {
      Camera: { getPhoto: async () => ({ base64String: shot, format: 'png', saved: false }) },
      Filesystem: {
        mkdir: async () => {},
        writeFile: async ({ path, data }) => (put({ ...files(), [path]: data }), { uri: path }),
        readFile: async ({ path }) => {
          if (path === 'kept-receipts.json' && slowMirrorMs > 0) await new Promise((r) => setTimeout(r, slowMirrorMs));
          const all = files();
          return path in all ? { data: all[path] } : missing();
        },
        readdir: async ({ path }) => ({
          files: Object.keys(files()).filter((k) => k.startsWith(`${path}/`)).map((k) => ({ name: k.slice(path.length + 1) })),
        }),
        deleteFile: async ({ path }) => {
          const all = files();
          delete all[path];
          put(all);
        },
        rmdir: async () => {},
        stat: async ({ path }) => (path in files() ? { type: 'file', size: files()[path].length } : missing()),
      },
    };
    w.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'ios',
      PluginHeaders: Object.entries(plugins).map(([name, methods]) => ({
        name,
        methods: Object.keys(methods).map((m) => ({ name: m, rtype: 'promise' })),
      })),
      nativePromise: (plugin, method, options) => plugins[plugin][method](options ?? {}),
    };
  }, { shot, disk, slowMirrorMs });
}

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

/*
 * No price and no plan anywhere in Settings on iOS (APN-18).
 *
 * The web build sells three tiers that unlock a local flag with no payment,
 * and says so. On the App Store that is a 3.1.1 rejection, so the iOS build
 * shows none of it — and since nothing can be bought there, no cap either.
 * Asked here because this is the only sweep that boots the bundle as native:
 * every other one would find the prices, correctly, on the web.
 */
await page.getByRole('button', { name: 'Settings', exact: true }).click().catch(() => {});
await page.waitForTimeout(500);
const settingsText = await page.evaluate(() => document.body.innerText);
if (!/Deadline alerts/.test(settingsText)) {
  failures.push({ what: 'could not open Settings to check the iOS build sells nothing', saw: '' });
} else if (/£\d|Free plan|free receipts|Unlocked/.test(settingsText)) {
  failures.push({
    what: 'the iOS build shows a price or a plan, which App Review reads as unlocking outside In-App Purchase',
    saw: (settingsText.match(/.*(£\d|Free plan|free receipts|Unlocked).*/) ?? [''])[0],
  });
}


/*
 * A scanned receipt keeps its photo, as the iPhone app would.
 *
 * On a phone, "Scan a paper receipt" photographs the slip and reads it, and
 * used to throw the picture away, so anyone wanting it as proof of purchase
 * had to open the receipt they had just saved and photograph the slip again.
 * The photo is now kept with the receipt unless the person unticks it.
 *
 * Everything above talks to a bridge that answers nothing. This context gets
 * one that answers the two plugins the flow needs, Camera and Filesystem, the
 * way Capacitor's own core calls native: a `PluginHeaders` entry per plugin
 * and `nativePromise` to answer it. It is the core that routes the calls, not
 * a stubbed module, so the app's real plugin imports are what get exercised.
 * The camera hands back a rendered till receipt; the disk is a Map the check
 * reads afterwards. It also proves the OCR files ship in THIS bundle: `ocr/`
 * resolved from the iOS root, not the web build's /app/.
 */
{
  const shotPage = await browser.newPage({ viewport: { width: 420, height: 640 } });
  await shotPage.setContent(`<body style="margin:0;background:#fff">
    <div id="r" style="width:360px;padding:28px 24px;font:22px/1.5 'DejaVu Sans Mono',monospace;color:#111;background:#fff">
      <div style="text-align:center;font-weight:bold;font-size:30px">ARGOS</div>
      <div>KENWOOD MIXER&nbsp;&nbsp;&nbsp;199.99</div>
      <div>TOTAL&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;199.99</div>
      <div>VISA&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;199.99</div>
      <div>26/09/2026 14:32</div>
    </div></body>`);
  const photo = (await shotPage.locator('#r').screenshot({ type: 'png' })).toString('base64');
  await shotPage.close();

  const nctx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  await answeringBridge(nctx, { shot: photo });
  const np = await nctx.newPage();
  const nerrors = [];
  np.on('pageerror', (e) => nerrors.push(String(e)));
  const elsewhere = [];
  np.on('request', (r) => {
    const u = new URL(r.url());
    if (['http:', 'https:'].includes(u.protocol) && u.origin !== ORIGIN) elsewhere.push(u.origin);
  });
  await np.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
  await np.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  const photos = () => np.evaluate(() => Object.entries(window.__keptDisk()).filter(([k]) => k.startsWith('receipts/')));

  const scan = async () => {
    await np.getByRole('button', { name: 'Add a receipt' }).click();
    await np.getByRole('button', { name: /Scan a paper receipt/ }).click();
    return np.getByText('FOUND IN YOUR PASTE').waitFor({ timeout: 90_000 }).then(() => true).catch(() => false);
  };

  // 1. Scanned and saved as it comes: the photo goes with the receipt.
  const read = await scan();
  const keep = np.getByRole('checkbox', { name: 'Keep the photo as proof of purchase' });
  const offered = read && (await keep.isChecked().catch(() => false));
  if (!read) {
    failures.push({ what: 'a scan in the iOS bundle never produced a card', saw: (await np.locator('main').innerText()).slice(0, 200) });
  } else if (!offered) {
    failures.push({ what: 'a scan in the iOS bundle did not offer to keep the photo, ticked', saw: '' });
  }
  if (read) {
    // axe over the card with the checkbox on it, which no web sweep renders.
    await np.addScriptTag({ path: `${ROOT}node_modules/axe-core/axe.min.js` });
    const axe = await np.evaluate(async () =>
      (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map((v) => `${v.id} (${v.nodes.length})`),
    );
    if (axe.length > 0) failures.push({ what: 'axe violations on the scanned card in the native build', saw: axe.join(', ') });

    await np.getByRole('button', { name: 'Save receipt' }).click();
    await np.waitForTimeout(600);
    const kept = await photos();
    if (kept.length !== 1 || kept[0][1] !== photo) {
      failures.push({ what: 'saving a scanned receipt did not keep the photo the camera took', saw: `${kept.length} photos on disk` });
    }
    await np.getByText(/KENWOOD MIXER/i).first().click().catch(() => {});
    await np.waitForTimeout(600);
    const shown = await np.getByRole('img', { name: 'The paper receipt for this purchase' }).isVisible().catch(() => false);
    if (!shown) failures.push({ what: 'the kept photo is not on the receipt’s own screen', saw: '' });

    // 2. Unticked: the next receipt saves without it. Counted against the
    //    disk as it stood, so a first save that kept nothing is not reported
    //    here a second time under the wrong name.
    const before = (await photos()).length;
    if (await scan()) {
      const box = np.getByRole('checkbox', { name: 'Keep the photo as proof of purchase' });
      if ((await box.count()) === 0) {
        failures.push({ what: 'the second scan offered no way to leave the photo out', saw: '' });
      } else {
        await box.uncheck();
        await np.getByRole('button', { name: 'Save receipt' }).click();
        await np.waitForTimeout(600);
        const after = (await photos()).length;
        if (after !== before) failures.push({ what: 'an unticked photo was kept anyway', saw: `${after - before} more on disk` });
      }
    } else {
      failures.push({ what: 'the second scan in the iOS bundle never produced a card', saw: '' });
    }
  }
  if (elsewhere.length > 0) failures.push({ what: 'the iOS scan reached another origin', saw: [...new Set(elsewhere)].join(', ') });
  if (nerrors.length > 0) failures.push({ what: 'the scan in the iOS bundle raised page errors', saw: nerrors.join(' | ') });
  await nctx.close();
}


/*
 * A library rescued from a slow mirror, with its photos.
 *
 * The web view has handed back an empty store, which is what the mirror is
 * for, and reading the mirror takes longer than MIRROR_READ_BUDGET_MS. The app
 * must mount rather than hang, and until this was fixed it then saved the
 * fresh library over the mirror and cleared every photo as orphaned: the
 * receipts that were four seconds from arriving were gone for good. Now the
 * mirror is held until the read answers, and the library comes back.
 */
{
  // A real library to rescue: the app's own first save, with one receipt
  // renamed so it cannot be mistaken for the fresh one.
  const seedCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  await answeringBridge(seedCtx);
  const sp = await seedCtx.newPage();
  await sp.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
  await sp.waitForTimeout(800);
  const saved = JSON.parse((await sp.evaluate(() => localStorage.getItem('kept.v1'))) ?? 'null');
  await seedCtx.close();
  if (!saved?.receipts?.length) {
    failures.push({ what: 'could not make a library to rescue', saw: '' });
  } else {
    saved.onboardingSeen = true;
    saved.receipts[0].item = 'Rescued from the mirror';
    // An id of its own: a sample's id would also be in the fresh library, so
    // its photo could never look orphaned and the check below would be empty.
    saved.receipts[0].id = 'r_rescued_1';
    const id = saved.receipts[0].id;
    const library = JSON.stringify(saved);
    const photoPath = `receipts/${id.replace(/[^a-zA-Z0-9_-]/g, '')}.jpg`;

    const rctx = await browser.newContext({ viewport: { width: 402, height: 874 } });
    await answeringBridge(rctx, { disk: { 'kept-receipts.json': library, [photoPath]: 'UEhPVE8=' }, slowMirrorMs: 4500 });
    const rp = await rctx.newPage();
    const rerrors = [];
    rp.on('pageerror', (e) => rerrors.push(String(e)));
    await rp.goto(`${ORIGIN}/`);
    const back = await rp.getByText('Rescued from the mirror').first().waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);
    await rp.waitForTimeout(800);
    const disk = await rp.evaluate(() => window.__keptDisk());
    if (!back) failures.push({ what: 'a library behind a slow mirror never came back', saw: (await rp.locator('body').innerText()).slice(0, 160) });
    if (!String(disk['kept-receipts.json']).includes('Rescued from the mirror')) {
      failures.push({ what: 'the fresh boot overwrote a mirror nobody had read yet', saw: String(disk['kept-receipts.json']).slice(0, 120) });
    }
    if (!(photoPath in disk)) failures.push({ what: 'a slow mirror cost the library its photos', saw: Object.keys(disk).join(', ') });
    if (rerrors.length > 0) failures.push({ what: 'the slow-mirror launch raised page errors', saw: rerrors.join(' | ') });
    await rctx.close();
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
