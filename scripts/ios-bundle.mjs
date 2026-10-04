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
    onDetail: /Store policy/.test(document.body.innerText),
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
 * No price and no plan in Settings where the App Store sells nothing (APN-18).
 *
 * The web build sells an unlock that flips a local flag with no payment, and
 * says so. On the App Store that is a 3.1.1 rejection, so the iOS build shows
 * only what StoreKit sells, and this bridge declares no StoreKit at all: no
 * price, no plan, and since nothing can be bought, no cap. Asked here because
 * this is the only sweep that boots the bundle as native: every other one
 * would find the price, correctly, on the web. The App Store's own unlock is
 * walked below, with the App Store answering.
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
 * The iPhone's own scanner: Apple's document camera, read by Vision
 * (packages/receipt-scanner). The bridge answers it with what Vision hands
 * back for a till slip — each label and each figure its own piece, in no
 * order, as fractions of a tall page — and the card must read the shop, the
 * total and the date with no OCR run at all, and keep the page as proof.
 * Then a cancelled scan: nothing read, nothing said, and the plain camera NOT
 * opened in its place — cancelling is the person's answer.
 */
{
  const row = (text, n, x, jitter = 0) => ({ text, x, width: Math.min(0.9 - x, text.length * 0.025), height: 0.012, y: 1 - 0.06 - n * 0.016 + jitter });
  const pages = [{ width: 300, height: 900, jpeg: 'UEFHRQ==', lines: [
    row('1,448.00', 6, 0.66, 0.001), row('TOTAL', 6, 0.08), row('Currys', 0, 0.4), row('Tottenham Court Rd', 1, 0.22),
    row('LG OLED55C4 TV', 3, 0.08), row('1,299.00', 3, 0.66), row('CARE & REPAIR 3YR', 4, 0.08), row('149.00', 4, 0.7),
    row('AMEX', 7, 0.08), row('1,448.00', 7, 0.66), row('24/09/2026 15:20', 9, 0.08),
  ] }];
  const dctx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  await answeringBridge(dctx, { documentScan: pages });
  const dp = await dctx.newPage();
  await dp.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
  await dp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await dp.getByRole('button', { name: 'Add a receipt' }).click();
  await dp.getByRole('button', { name: /Scan a paper receipt/ }).click();
  const read = await dp.getByText('Read from your photo', { exact: true }).waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);
  const card = read ? await dp.locator('main').innerText() : '';
  if (!read || !/Currys/.test(card) || !/£1,448\.00/.test(card) || !/24 Sep/.test(card)) {
    failures.push({ what: 'the document camera’s reading did not make the card', saw: (card || await dp.locator('main').innerText()).slice(0, 240) });
  }
  if (read && !(await dp.getByRole('checkbox', { name: 'Keep the photo as proof of purchase' }).isChecked().catch(() => false))) {
    failures.push({ what: 'the document camera’s page was not offered as proof of purchase', saw: '' });
  }
  if ((await dp.evaluate(() => window.__cameraShots)) !== 0) failures.push({ what: 'the plain camera opened although the document camera was there', saw: '' });
  if (read) {
    await dp.getByRole('button', { name: 'Save receipt' }).click();
    await dp.waitForTimeout(600);
    const kept = await dp.evaluate(() => Object.entries(window.__keptDisk()).filter(([k]) => k.startsWith('receipts/')).map(([, v]) => v));
    if (kept.length !== 1 || kept[0] !== 'UEFHRQ==') failures.push({ what: 'saving did not keep the document camera’s page', saw: `${kept.length} photos` });
  }
  await dctx.close();

  const cctx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  await answeringBridge(cctx, { documentScan: 'cancel', shot: 'UEhPVE8=' });
  const cp = await cctx.newPage();
  await cp.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
  await cp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await cp.getByRole('button', { name: 'Add a receipt' }).click();
  await cp.getByRole('button', { name: /Scan a paper receipt/ }).click();
  await cp.waitForTimeout(800);
  const after = await cp.evaluate(() => ({ docs: window.__documentScans, shots: window.__cameraShots }));
  const said = await cp.locator('main').innerText();
  if (after.docs !== 1 || after.shots !== 0 || /couldn.t read/i.test(said)) {
    failures.push({ what: 'a cancelled document scan was not left alone', saw: JSON.stringify(after) });
  }
  await cctx.close();
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
    return np.getByText('Read from your photo', { exact: true }).waitFor({ timeout: 90_000 }).then(() => true).catch(() => false);
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
    // Once it has landed: the card fades in, and audited mid-fade its grey
    // text is blended toward the white under it — measured, #5E6168 (6.2:1)
    // read as #7A7D82 (4.1:1), a colour nobody sees once the fade is done.
    await np.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
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
    if (!/Store policy/.test(opened) || !opened.includes(item)) {
      failures.push({ what: 'tapping a reminder did not open the receipt it was about', saw: `${item} · ${opened.slice(0, 120)}` });
    }

    /*
     * Kept, with a guarantee: the return reminders go, and two stay, each
     * through the real plugin at 9am on its morning, which a unit test of
     * `planAlerts` cannot show — the 30 days to reject a fault, three days
     * before they end, and the guarantee, a month before cover ends.
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
    const rejectDay = new Date(bought.getFullYear(), bought.getMonth(), bought.getDate() + 30 - 3, 9, 0, 0, 0);
    const got = keptNotes.map((n) => [String(n.extra?.key).split(':').pop(), new Date(n.schedule?.at).getTime()]);
    const expected = [['reject', rejectDay.getTime()], ['warranty', noticeDay.getTime()]];
    if (JSON.stringify(got) !== JSON.stringify(expected)) {
      failures.push({
        what: 'a kept purchase with a guarantee did not leave exactly its two reminders: the right to reject, then the guarantee',
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
 * The unlock, bought through the App Store (StoreKit 2, packages/purchases).
 *
 * Every check above boots a build where nothing is for sale. These boot it
 * with the App Store answering as StoreKit does, at the cap (ten open receipts
 * of the person's own), and walk each way a purchase can end. What is held:
 * - the App Store's price is on the button, never the web's;
 * - Restore purchase sits beside it;
 * - a verified purchase lifts the cap there and then, so the receipt being
 *   added can be saved;
 * - nothing else unlocks;
 * - an approval or a refund, which only StoreKit can report, moves the plan
 *   by itself;
 * - going offline is not a way round the cap.
 * lib/app-store.ts decides all of it, and test/app-store.test.ts pins those
 * decisions. This asserts them on the bundle that ships, through Capacitor's
 * own core.
 */
{
  const ymd = (back) => {
    const d = new Date(Date.now() - back * 86_400_000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const library = (settings = {}) => JSON.stringify({
    version: 1, onboardingSeen: true, updates: [], alertsSent: [],
    settings: { plan: 'free', appStorePrice: null, deadlineAlerts: false, policyWatch: false, remindersExplained: true, ...settings },
    receipts: Array.from({ length: 10 }, (_, i) => ({
      id: `r_cap_${i}`, store: 'Argos', item: `Capped thing ${i + 1}`, cat: 'kitchen', amount: 1500 + i,
      purchasedOn: ymd(2), windowDays: 30, policy: '30 days to return', distance: false, status: 'active',
    })),
  });
  const boot = async (appStore, settings = {}) => {
    const c = await browser.newContext({ viewport: { width: 402, height: 874 } });
    await answeringBridge(c, { appStore });
    await c.addInitScript((lib) => {
      if (localStorage.getItem('kept.v1') === null) localStorage.setItem('kept.v1', lib);
    }, library(settings));
    const p = await c.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(700);
    return { c, p, errs };
  };
  const tab = async (p, name) => {
    await p.getByRole('button', { name, exact: true }).click().catch(() => {});
    await p.waitForTimeout(400);
  };
  const body = (p) => p.evaluate(() => document.body.innerText);
  const plan = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('kept.v1') ?? '{}').settings?.plan);
  const noteOf = (p) => p.locator('[data-store-note]').first().innerText().catch(() => '');
  const near = (text, word) => {
    const at = text.indexOf(word);
    return at < 0 ? text.slice(0, 160) : text.slice(Math.max(0, at - 40), at + 160);
  };
  const pasteOne = async (p) => {
    await p.getByRole('button', { name: 'Add a receipt' }).click().catch(() => {});
    await p.waitForTimeout(300);
    const when = new Date(Date.now() - 86_400_000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    await p.locator('#paste').fill(`Thanks for your Argos order\nOrder date: ${when}\nToaster\nTotal £24.99`);
    await p.getByRole('button', { name: 'Read it' }).click().catch(() => {});
    await p.waitForTimeout(400);
  };
  const buyButton = (p, price = '£9.99') => p.getByRole('button', { name: `Unlock unlimited · ${price} once`, exact: true });
  const done = async ({ c, errs }, what) => {
    if (errs.length > 0) failures.push({ what: `${what} raised page errors`, saw: errs.join(' | ') });
    await c.close();
  };

  // On sale: offered at the App Store's price, with Restore; bought at the cap.
  {
    const run = await boot({ price: '£9.99' });
    const { p } = run;
    await tab(p, 'Settings');
    const before = await body(p);
    if (!/Free plan/.test(before) || !/10 of 10 free receipts/.test(before) || (await buyButton(p).count()) !== 1) {
      failures.push({ what: 'the iPhone build does not offer the unlock at the App Store’s price, beside the free plan’s count', saw: near(before, 'Free plan') });
    }
    if ((await p.getByRole('button', { name: 'Restore purchase', exact: true }).count()) !== 1) {
      failures.push({ what: 'no Restore purchase beside a one-off unlock, which App Review asks for', saw: near(before, 'Unlock') });
    }
    // axe over controls only this build has: the web sweeps never see them.
    await p.addScriptTag({ path: `${ROOT}node_modules/axe-core/axe.min.js` });
    const axeStore = await p.evaluate(async () => {
      const r = await window.axe.run(document, { resultTypes: ['violations'] });
      return r.violations.map((v) => `${v.id} (${v.nodes.length})`);
    });
    if (axeStore.length > 0) failures.push({ what: 'axe violations where the iPhone app sells the unlock', saw: axeStore.join(', ') });
    await pasteOne(p);
    const refused = p.getByRole('button', { name: 'Unlock unlimited to save this' });
    if ((await refused.count()) !== 1 || (await buyButton(p).count()) !== 1) {
      failures.push({ what: 'at the cap the add screen neither refuses the save nor offers the App Store’s unlock', saw: (await body(p)).slice(0, 200) });
    } else {
      await buyButton(p).click();
      await p.waitForTimeout(700);
      const after = await body(p);
      const save = p.getByRole('button', { name: 'Save receipt', exact: true });
      if ((await plan(p)) !== 'pro' || !(await save.isEnabled().catch(() => false))) {
        failures.push({ what: 'a verified purchase did not lift the cap there and then', saw: `plan ${await plan(p)} · ${after.slice(0, 160)}` });
      }
      if (!/no limit on receipts now/.test(after)) {
        failures.push({ what: 'a purchase made at the cap was not acknowledged where it was made', saw: after.slice(0, 200) });
      }
      await save.click().catch(() => {});
      await p.waitForTimeout(600);
      const count = await p.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.length);
      if (count !== 11) failures.push({ what: 'the receipt being added when the cap lifted could not then be saved', saw: `${count} receipts` });
      await tab(p, 'Settings');
      const bought = await body(p);
      if (!/Unlocked/.test(bought) || !/Paid once, through the App Store/.test(bought)) {
        failures.push({ what: 'Settings does not say the unlock was bought through the App Store', saw: near(bought, 'Unlocked') });
      }
      if (/Nothing was charged|no card was taken/.test(bought)) {
        failures.push({ what: 'the iPhone app says nothing was charged after a real App Store purchase', saw: near(bought, 'charged') });
      }
      const purchases = await p.evaluate(() => window.__keptStore().purchases);
      if (purchases !== 1) failures.push({ what: 'one tap did not make exactly one purchase', saw: `${purchases} purchases` });
      // It stays bought: a relaunch asks StoreKit again, which agrees.
      await p.reload({ waitUntil: 'networkidle' });
      await p.waitForTimeout(700);
      await tab(p, 'Settings');
      if (!/Unlocked/.test(await body(p)) || (await plan(p)) !== 'pro') failures.push({ what: 'the unlock did not survive a relaunch', saw: `plan ${await plan(p)}` });
    }
    await done(run, 'buying the unlock');
  }

  // Another storefront: Apple's price for it, as Apple wrote it, never the web's £9.99.
  {
    const run = await boot({ price: '9,99 €' });
    await tab(run.p, 'Settings');
    const t = await body(run.p);
    if ((await buyButton(run.p, '9,99 €').count()) !== 1 || /£9\.99/.test(t)) {
      failures.push({ what: 'the button does not carry the App Store’s own price for the storefront', saw: near(t, 'Unlock') });
    }
    await done(run, 'another storefront');
  }

  // Each way a purchase can end without one: nothing unlocks, and each says what happened.
  for (const [ending, expect, what] of [
    ['cancelled', null, 'a cancelled sheet'],
    ['unverified', /couldn’t be checked/, 'a purchase whose signature does not check'],
    ['failed:network', /Couldn’t reach the App Store[\s\S]*kept unlocks by itself/, 'a purchase the connection dropped'],
    ['failed:not-allowed', /turned off on this iPhone/, 'a purchase Screen Time refused'],
  ]) {
    const run = await boot({ price: '£9.99', purchase: ending });
    const { p } = run;
    await tab(p, 'Settings');
    await buyButton(p).click().catch(() => {});
    await p.waitForTimeout(600);
    const note = await noteOf(p);
    if ((await plan(p)) !== 'free') failures.push({ what: `${what} unlocked the app`, saw: `plan ${await plan(p)}` });
    if (expect === null ? note !== '' : !expect.test(note)) failures.push({ what: `${what} was not worded as it should be`, saw: note || '(nothing said)' });
    if (/nothing was charged/i.test(note)) failures.push({ what: `${what} claimed nothing was charged, which it cannot know`, saw: note });
    if (!(await buyButton(p).isEnabled().catch(() => false))) failures.push({ what: `after ${what} the unlock cannot be tried again`, saw: '' });
    await done(run, what);
  }

  // Ask to Buy: waiting, said as such; then approved elsewhere, and unlocked with no second tap.
  {
    const run = await boot({ price: '£9.99', purchase: 'pending' });
    const { p } = run;
    await tab(p, 'Settings');
    await buyButton(p).click().catch(() => {});
    await p.waitForTimeout(600);
    const waiting = await noteOf(p);
    if (!/Waiting for approval/.test(waiting) || (await plan(p)) !== 'free') {
      failures.push({ what: 'a purchase waiting for approval was not said to be waiting', saw: `${waiting} · plan ${await plan(p)}` });
    }
    await p.evaluate(() => window.__approve());
    await p.waitForTimeout(800);
    const approved = await body(p);
    if ((await plan(p)) !== 'pro' || !/Unlocked/.test(approved)) {
      failures.push({ what: 'an approved Ask to Buy did not unlock the app by itself', saw: `plan ${await plan(p)} · ${near(approved, 'Unlock')}` });
    }
    const purchases = await p.evaluate(() => window.__keptStore().purchases);
    if (purchases !== 1) failures.push({ what: 'unlocking after an approval made another purchase', saw: `${purchases} purchases` });
    await done(run, 'Ask to Buy');
  }

  // Restore: a purchase from another phone comes back; a restore that finds none says so.
  {
    const run = await boot({ price: '£9.99', restoreFinds: 'owned' });
    const { p } = run;
    await tab(p, 'Settings');
    await p.getByRole('button', { name: 'Restore purchase', exact: true }).click().catch(() => {});
    await p.waitForTimeout(700);
    const t = await body(p);
    if ((await plan(p)) !== 'pro' || !/Restored/.test(t)) failures.push({ what: 'Restore purchase did not bring back a purchase the App Store holds', saw: `plan ${await plan(p)} · ${near(t, 'Restore')}` });
    if ((await p.evaluate(() => window.__keptStore().purchases)) !== 0) failures.push({ what: 'restoring made a purchase', saw: '' });
    await done(run, 'restoring a purchase');
  }
  {
    const run = await boot({ price: '£9.99' });
    const { p } = run;
    await tab(p, 'Settings');
    await p.getByRole('button', { name: 'Restore purchase', exact: true }).click().catch(() => {});
    await p.waitForTimeout(700);
    const note = await noteOf(p);
    if ((await plan(p)) !== 'free' || !/no unlock on this Apple ID/.test(note)) {
      failures.push({ what: 'a restore that found nothing did not say so, or unlocked anyway', saw: `${note || '(nothing said)'} · plan ${await plan(p)}` });
    }
    await done(run, 'restoring nothing');
  }

  // A refund: StoreKit revokes the purchase, the cap comes back, and the app says why.
  {
    const run = await boot({ price: '£9.99', owned: 'owned' }, { plan: 'pro', appStorePrice: '£9.99' });
    const { p } = run;
    await tab(p, 'Settings');
    if (!/Unlocked/.test(await body(p))) failures.push({ what: 'a purchase StoreKit holds did not show as unlocked', saw: '' });
    await p.evaluate(() => window.__refund());
    await p.waitForTimeout(800);
    const t = await body(p);
    if ((await plan(p)) !== 'free' || !/10 of 10 free receipts/.test(t) || !/refunded/.test(t)) {
      failures.push({ what: 'a refund did not put the cap back, with the reason', saw: `plan ${await plan(p)} · ${near(t, 'Free plan')}` });
    }
    await done(run, 'a refund');
  }
  // A refund while the app was closed is found at launch.
  {
    const run = await boot({ price: '£9.99', owned: 'revoked' }, { plan: 'pro', appStorePrice: '£9.99' });
    if ((await plan(run.p)) !== 'free') failures.push({ what: 'a refund made while the app was closed was not found at launch', saw: `plan ${await plan(run.p)}` });
    await done(run, 'a refund found at launch');
  }
  // A new phone whose record has not arrived yet: "none" relocks nothing.
  {
    const run = await boot({ price: '£9.99', owned: 'none' }, { plan: 'pro', appStorePrice: '£9.99' });
    if ((await plan(run.p)) !== 'pro') failures.push({ what: 'a paying customer was locked out because StoreKit had no record yet', saw: `plan ${await plan(run.p)}` });
    await done(run, 'a slow record');
  }

  // Offline, once the App Store has quoted a price: the cap stands, at that price, and the door says why it will not open.
  {
    const run = await boot({ offline: true }, { appStorePrice: '£9.99' });
    const { p } = run;
    await pasteOne(p);
    if ((await p.getByRole('button', { name: 'Unlock unlimited to save this' }).count()) !== 1 || (await buyButton(p).count()) !== 1) {
      failures.push({ what: 'going offline lifted the cap, which makes airplane mode the way to unlimited', saw: (await body(p)).slice(0, 200) });
    } else {
      await buyButton(p).click().catch(() => {});
      await p.waitForTimeout(600);
      const note = await noteOf(p);
      if (!/Couldn’t reach the App Store/.test(note)) failures.push({ what: 'an offline purchase did not say the App Store could not be reached', saw: note || '(nothing said)' });
    }
    await done(run, 'offline at the cap');
  }
  // Offline on a first launch, before the App Store has ever answered: no wall.
  {
    const run = await boot({ offline: true });
    await pasteOne(run.p);
    if (!(await run.p.getByRole('button', { name: 'Save receipt', exact: true }).isEnabled().catch(() => false))) {
      failures.push({ what: 'a first launch offline put up a cap before anything could be bought', saw: (await body(run.p)).slice(0, 200) });
    }
    await done(run, 'offline on a first launch');
  }

  // Purchases switched off: no button that can only be refused, and where to change it instead.
  {
    const run = await boot({ price: '£9.99', canPay: false });
    await tab(run.p, 'Settings');
    const t = await body(run.p);
    if ((await buyButton(run.p).count()) !== 0 || !/turned off on this iPhone[\s\S]*Screen Time/.test(t)) {
      failures.push({ what: 'with purchases switched off, the app offered a button that can only be refused', saw: near(t, 'Free plan') });
    }
    await done(run, 'purchases switched off');
  }

  // Not on sale (not live yet, or not in this storefront): no price, no plan, and no cap.
  {
    const run = await boot({ price: null });
    await tab(run.p, 'Settings');
    const t = await body(run.p);
    if (/£\d|Free plan|free receipts/.test(t)) failures.push({ what: 'the app offered an unlock the App Store does not sell', saw: near(t, '£') });
    await pasteOne(run.p);
    if (!(await run.p.getByRole('button', { name: 'Save receipt', exact: true }).isEnabled().catch(() => false))) {
      failures.push({ what: 'a cap stood where nothing could be bought to lift it', saw: (await body(run.p)).slice(0, 200) });
    }
    await done(run, 'nothing on sale');
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
