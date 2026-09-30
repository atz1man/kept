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
import { answeringBridge } from './answering-bridge.mjs';

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
    return np.getByText('READ FROM YOUR PHOTO').waitFor({ timeout: 90_000 }).then(() => true).catch(() => false);
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

    // Something wrong with it: the letter goes to the share sheet with this
    // receipt's photo attached, byte for byte. A sheet that takes files is
    // installed here, recording what it is handed, as iOS's would be.
    await np.evaluate(() => {
      window.__shared = null;
      navigator.canShare = (d) => Array.isArray(d?.files) && d.files.every((f) => f instanceof File);
      navigator.share = async (d) => {
        const files = await Promise.all((d.files ?? []).map(async (f) => ({ name: f.name, type: f.type, b64: btoa(String.fromCharCode(...new Uint8Array(await f.arrayBuffer()))) })));
        window.__shared = { text: d.text, files };
      };
    });
    await np.getByRole('button', { name: 'Something wrong with it?' }).click();
    await np.waitForTimeout(600);
    const note = await np.getByText('Share sends the photo of your receipt with it').isVisible().catch(() => false);
    await np.getByRole('button', { name: 'Share', exact: true }).click().catch(() => {});
    await np.waitForTimeout(600);
    const sent = await np.evaluate(() => window.__shared);
    if (!note || !sent || !/^Dear Argos,/.test(sent.text ?? '') || sent.files.length !== 1 || sent.files[0].b64 !== photo || sent.files[0].type !== 'image/jpeg') {
      failures.push({
        what: 'the letter did not go to the share sheet with the receipt’s photo attached',
        saw: JSON.stringify({ note, text: sent?.text?.slice(0, 30), files: sent?.files?.map((f) => ({ name: f.name, type: f.type, same: f.b64 === photo })) }),
      });
    }

    // Shown full screen, to hand across a counter, and shut again with
    // Escape; focus goes in to Close, as a dialog's must.
    await np.getByRole('button', { name: 'Show it full screen' }).click().catch(() => {});
    await np.waitForTimeout(300);
    const dialog = np.getByRole('dialog', { name: 'The paper receipt' });
    const full = {
      open: await dialog.isVisible().catch(() => false),
      focused: await np.evaluate(() => document.activeElement?.textContent?.trim() ?? ''),
    };
    await np.keyboard.press('Escape');
    await np.waitForTimeout(300);
    full.shut = (await dialog.count()) === 0;
    if (!full.open || full.focused !== 'Close' || !full.shut) {
      failures.push({ what: 'the receipt photo did not open full screen as a dialog that Escape shuts', saw: JSON.stringify(full) });
    }

    // Removing asks first — the file cannot be brought back — and "Keep it"
    // keeps it. Only the second tap removes it.
    const onDisk = async () => (await photos()).length;
    const had = await onDisk();
    await np.getByRole('button', { name: 'Remove the photo' }).click().catch(() => {});
    await np.waitForTimeout(300);
    const asked = { stillThere: (await onDisk()) === had, offered: await np.getByRole('button', { name: 'Remove it for good' }).isVisible().catch(() => false) };
    await np.getByRole('button', { name: 'Keep it' }).click().catch(() => {});
    await np.waitForTimeout(300);
    asked.kept = (await onDisk()) === had && (await np.getByRole('img', { name: 'The paper receipt for this purchase' }).count()) === 1;
    await np.getByRole('button', { name: 'Remove the photo' }).click().catch(() => {});
    await np.getByRole('button', { name: 'Remove it for good' }).click().catch(() => {});
    await np.waitForTimeout(400);
    asked.removed = (await onDisk()) === had - 1;
    if (!asked.stillThere || !asked.offered || !asked.kept || !asked.removed) {
      failures.push({ what: 'removing a receipt photo did not ask first, or did not remove it when told', saw: JSON.stringify(asked) });
    }

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


/*
 * Deadline reminders, through the bridge, as the iPhone app lodges them.
 *
 * The reason the native app exists: a deadline arrives at 9am with kept
 * closed. `schedule-native.test.ts` holds the logic against a mocked plugin
 * module; this holds the wiring, through Capacitor's own core, on the bundle
 * that ships. What iOS is handed, whether a tapped reminder opens its receipt,
 * and whether switching alerts off really cancels the ones already waiting.
 */
{
  const actx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  await answeringBridge(actx, { notifications: 'granted' });
  const ap = await actx.newPage();
  const aerrors = [];
  ap.on('pageerror', (e) => aerrors.push(String(e)));
  await ap.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
  await ap.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  // The samples never raise a reminder (a notification is not a demonstration),
  // so add a real purchase: an Argos order from two days ago.
  const bought = new Date(Date.now() - 2 * 86_400_000);
  const when = bought.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  await ap.getByRole('button', { name: 'Add a receipt' }).click();
  await ap.locator('#paste').fill(`Thanks for your Argos order\nOrder date: ${when}\nKenwood Chef mixer\nTotal £249.99`);
  await ap.getByRole('button', { name: 'Read it' }).click();
  await ap.getByRole('button', { name: 'Save receipt' }).click();
  await ap.waitForTimeout(1200);
  const lodged = await ap.evaluate(() => window.__keptNotes().pending);
  const receipts = await ap.evaluate(() => JSON.parse(localStorage.getItem('kept.v1') ?? '{}').receipts ?? []);
  const mine = receipts.filter((r) => !r.demo);
  if (process.env.SHOW_NOTES) console.log(JSON.stringify({ lodged, ids: receipts.map((r) => r.id) }, null, 1));

  if (mine.length !== 1) {
    failures.push({ what: 'could not add a purchase to lodge reminders for', saw: `${mine.length} real receipts` });
  } else if (lodged.length === 0) {
    failures.push({ what: 'the iOS app lodged no deadline reminders for a purchase with a deadline', saw: '' });
  } else if (lodged.some((n) => n.extra?.receiptId !== mine[0].id)) {
    failures.push({ what: 'a reminder was lodged about a sample receipt', saw: lodged.map((n) => n.extra?.receiptId).join(',') });
  } else {
    const known = new Set(receipts.map((r) => r.id));
    const ids = lodged.map((n) => n.id);
    const bad = lodged.filter((n) => {
      const at = new Date(n.schedule?.at);
      return (
        !Number.isInteger(n.id) || n.id <= 0 || n.id > 2 ** 31 - 1 ||
        Number.isNaN(at.getTime()) || at.getTime() <= Date.now() || at.getHours() !== 9 || at.getMinutes() !== 0 ||
        !n.title || !n.body || !known.has(n.extra?.receiptId)
      );
    });
    if (new Set(ids).size !== ids.length) failures.push({ what: 'two reminders were lodged under one id, so iOS keeps only one', saw: ids.join(',') });
    if (bad.length > 0) failures.push({ what: 'a reminder iOS was handed is malformed (id, time, text or receipt)', saw: JSON.stringify(bad[0]).slice(0, 200) });

    // A tapped reminder opens the receipt it is about.
    const first = lodged[0];
    const item = receipts.find((r) => r.id === first.extra.receiptId)?.item ?? '';
    await ap.evaluate((n) => window.__tapNotification(n), first);
    await ap.waitForTimeout(600);
    const opened = await ap.evaluate(() => document.body.innerText);
    if (!/STORE POLICY/.test(opened) || !opened.includes(item)) {
      failures.push({ what: 'tapping a reminder did not open the receipt it was about', saw: `${item} · ${opened.slice(0, 120)}` });
    }

    /*
     * Kept, with a guarantee: the return reminders go, and one reminder is
     * lodged a month before cover ends — through the real plugin, at 9am on
     * that morning, which a unit test of `planAlerts` cannot show.
     */
    await ap.getByRole('button', { name: 'Edit', exact: true }).click();
    await ap.locator('#e-warranty').fill('12');
    await ap.getByRole('button', { name: 'Save changes' }).click();
    await ap.waitForTimeout(500);
    await ap.getByRole('button', { name: 'I’m keeping it' }).click();
    await ap.waitForTimeout(1200);
    const keptNotes = await ap.evaluate(() => window.__keptNotes().pending);
    const coverEnds = new Date(bought.getFullYear() + 1, bought.getMonth(), bought.getDate());
    const noticeDay = new Date(coverEnds.getFullYear(), coverEnds.getMonth(), coverEnds.getDate() - 30, 9, 0, 0, 0);
    const onlyWarranty = keptNotes.length === 1 && String(keptNotes[0].extra?.key).endsWith(':warranty');
    if (!onlyWarranty || new Date(keptNotes[0].schedule?.at).getTime() !== noticeDay.getTime()) {
      failures.push({
        what: 'a kept purchase with a guarantee did not leave exactly one reminder, a month before cover ends',
        saw: JSON.stringify(keptNotes.map((n) => ({ key: n.extra?.key, at: n.schedule?.at }))).slice(0, 300),
      });
    }

    // Off in Settings cancels what is waiting.
    await ap.getByRole('button', { name: 'Settings', exact: true }).click();
    await ap.waitForTimeout(500);
    await ap.getByRole('switch', { name: /Deadline alerts/ }).click();
    await ap.waitForTimeout(800);
    const left = await ap.evaluate(() => window.__keptNotes().pending.length);
    if (left !== 0) failures.push({ what: 'turning deadline alerts off left reminders waiting with iOS', saw: `${left} still pending` });
  }
  if (aerrors.length > 0) failures.push({ what: 'the reminders run raised page errors', saw: aerrors.join(' | ') });
  await actx.close();

  // Never asked: iOS asks once, when there is first something worth saying,
  // and then lodges it. Refused: nothing is lodged, and Settings says where to
  // change it rather than showing a switch that does nothing.
  // "Not now" on kept's card: iOS is never asked, so its one dialog is kept
  // for the day they switch reminders on; alerts go off and the card goes.
  {
    const nctx2 = await browser.newContext({ viewport: { width: 402, height: 874 } });
    await answeringBridge(nctx2, { notifications: 'prompt' });
    const np2 = await nctx2.newPage();
    await np2.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
    await np2.getByRole('button', { name: 'Skip' }).click().catch(() => {});
    await np2.getByRole('button', { name: 'Add a receipt' }).click();
    await np2.locator('#paste').fill(`Thanks for your Argos order\nOrder date: ${when}\nTotal £249.99`);
    await np2.getByRole('button', { name: 'Read it' }).click();
    await np2.getByRole('button', { name: 'Save receipt' }).click();
    await np2.waitForTimeout(1200);
    await np2.getByRole('button', { name: 'Not now' }).click().catch(() => {});
    await np2.waitForTimeout(800);
    const n2 = await np2.evaluate(() => window.__keptNotes());
    const alertsOn = await np2.evaluate(() => JSON.parse(localStorage.getItem('kept.v1') ?? '{}').settings?.deadlineAlerts);
    const cardGone = (await np2.getByRole('button', { name: 'Turn on reminders' }).count()) === 0;
    if (n2.asked !== 0 || n2.pending.length !== 0 || alertsOn !== false || !cardGone) {
      failures.push({ what: '"Not now" asked iOS anyway, lodged reminders, or left alerts on', saw: `asked ${n2.asked}, ${n2.pending.length} pending, alerts ${alertsOn}, card gone ${cardGone}` });
    }
    await nctx2.close();
  }

  for (const permission of ['prompt', 'denied']) {
    const pctx = await browser.newContext({ viewport: { width: 402, height: 874 } });
    await answeringBridge(pctx, { notifications: permission });
    const pp = await pctx.newPage();
    await pp.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
    await pp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
    await pp.getByRole('button', { name: 'Add a receipt' }).click();
    await pp.locator('#paste').fill(`Thanks for your Argos order\nOrder date: ${when}\nTotal £249.99`);
    await pp.getByRole('button', { name: 'Read it' }).click();
    await pp.getByRole('button', { name: 'Save receipt' }).click();
    await pp.waitForTimeout(1200);
    const n = await pp.evaluate(() => window.__keptNotes());
    if (permission === 'prompt') {
      /*
       * iOS asks once. The first purchase no longer raises its dialog out of
       * nowhere: kept's own card says what reminders are for, and only
       * "Turn on reminders" asks — once — after which they are lodged.
       */
      const card = pp.getByRole('button', { name: 'Turn on reminders' });
      const shown = (await card.count()) === 1;
      if (n.asked !== 0 || !shown) {
        failures.push({ what: 'a first purchase asked iOS before explaining, or never explained', saw: `asked ${n.asked}, card ${shown}` });
      } else {
        // axe over the card, which only the native build renders.
        await pp.addScriptTag({ path: `${ROOT}node_modules/axe-core/axe.min.js` });
        const axe = await pp.evaluate(async () =>
          (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map((v) => `${v.id} (${v.nodes.length})`),
        );
        if (axe.length > 0) failures.push({ what: 'axe violations on the reminders card', saw: axe.join(', ') });
        await card.click();
        await pp.waitForTimeout(1200);
        const after = await pp.evaluate(() => window.__keptNotes());
        const gone = (await pp.getByRole('button', { name: 'Turn on reminders' }).count()) === 0;
        if (after.asked !== 1 || after.pending.length === 0 || !gone) {
          failures.push({ what: 'turning reminders on did not ask iOS once and then lodge them', saw: `asked ${after.asked}, ${after.pending.length} pending, card gone ${gone}` });
        }
      }
    }
    if (permission === 'denied') {
      if (n.pending.length > 0) failures.push({ what: 'reminders were lodged with notifications refused', saw: `${n.pending.length} pending` });
      await pp.getByRole('button', { name: 'Settings', exact: true }).click();
      await pp.waitForTimeout(500);
      const text = await pp.evaluate(() => document.body.innerText);
      // The backup file carries receipts, not photos, and on the phone that
      // has photos Settings says so beside the button.
      if (!/Photos of receipts stay on this phone/.test(text)) {
        failures.push({ what: 'Settings in the iOS app does not say backups leave photos behind', saw: '' });
      }
      if (!/Blocked in iOS Settings/.test(text) || !/Settings › Notifications › kept/.test(text)) {
        failures.push({ what: 'Settings did not say iOS is blocking reminders, or where to turn them back on', saw: '' });
      }
    }
    await pctx.close();
  }
}


/*
 * The first screens say what the iPhone app does that the web cannot.
 *
 * Step two on the web says the clocks are checked "every time you open it",
 * which is the web's honest ceiling. The iPhone app lodges reminders with iOS,
 * so its own step two says so; it is the reason the app is native.
 */
{
  // The smallest iPhone the app supports, because the iPhone line is the
  // longer one and onboarding clips what does not fit rather than scrolling.
  const octx = await browser.newContext({ viewport: { width: 375, height: 667 } });
  await answeringBridge(octx);
  const op = await octx.newPage();
  await op.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
  await op.getByRole('button', { name: 'Next', exact: true }).click().catch(() => {});
  await op.waitForTimeout(400);
  const step2 = await op.evaluate(() => document.body.innerText);
  if (!/Two clocks/.test(step2)) {
    failures.push({ what: 'could not reach the second onboarding step on iOS', saw: step2.slice(0, 120) });
  } else if (!/arrives at 9am/.test(step2) || /every time you open it/.test(step2)) {
    failures.push({ what: 'the iPhone onboarding tells the web’s truth about reminders instead of its own', saw: step2.slice(0, 200) });
  } else {
    const fits = await op.evaluate(() => {
      const para = [...document.querySelectorAll('p')].find((p) => /arrives at 9am/.test(p.textContent ?? ''));
      const next = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Next');
      if (!para || !next) return { ok: false, why: 'paragraph or button not found' };
      const p = para.getBoundingClientRect();
      const box = para.parentElement.getBoundingClientRect();
      return { ok: p.bottom <= box.bottom && p.bottom <= next.getBoundingClientRect().top, why: `text ends ${Math.round(p.bottom)}, box ${Math.round(box.bottom)}` };
    });
    if (!fits.ok) failures.push({ what: 'the iPhone onboarding line is cut off on an iPhone SE', saw: fits.why });
  }
  await octx.close();
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
