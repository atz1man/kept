/**
 * App Store screenshots, from the bundle that actually ships to a phone.
 *
 *   npm run build:ios && CHROMIUM_PATH=/path/to/chrome node scripts/store-screenshots.mjs
 *
 * Writes store/screenshots/iphone-6.9/*.png at 1290 × 2796 — the 6.9" slot,
 * which App Store Connect scales down for every smaller iPhone. iPhone only,
 * because the target is (see test/ios-device-family.test.ts).
 *
 * Why the iOS bundle and not the web one: they are not the same app. The
 * iOS build shows no prices and no free-tier cap (see lib/pricing.ts), so a
 * screenshot of the web build would show £ tiers the phone does not have —
 * and a screenshot that misrepresents the app is a rejection under 2.3.3. The
 * bundle is booted believing it is native, through the same message-bridge
 * emulation `npm run ios` uses, so `isNative()` is answered by Capacitor's own
 * detection rather than by a stub that says what we want.
 *
 * What this cannot give you is the iOS status bar and the real safe-area
 * insets. These are correct-size, correct-content screenshots of the real UI;
 * the final set is worth retaking in the Simulator once the app builds there
 * (`xcrun simctl io booted screenshot`), and these are the storyboard for it.
 *
 * The sample receipts are shown with their "sample" labels removed. That is
 * the only thing altered: the receipts, dates, windows and rights on screen
 * are the app's own seed, computed by the app.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const VITE_BIN = `${ROOT}node_modules/vite/bin/vite.js`;
const PORT = Number(process.env.KEPT_SHOTS_PORT ?? 4189);
const ORIGIN = `http://localhost:${PORT}`;
const OUT = `${ROOT}store/screenshots/iphone-6.9`;
/** 430 × 932 CSS pixels at 3× is 1290 × 2796, an accepted 6.9" size. */
const VIEWPORT = { width: 430, height: 932 };
const SCALE = 3;

if (!existsSync(`${ROOT}dist-ios/index.html`)) {
  console.error('✗ dist-ios is not built — run `npm run build:ios` first');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const server = spawn(
  process.execPath,
  [VITE_BIN, 'preview', '--outDir', 'dist-ios', '--port', String(PORT), '--strictPort'],
  { cwd: ROOT, detached: true, stdio: 'ignore' },
);
const stop = () => { try { process.kill(-server.pid, 'SIGKILL'); } catch { /* gone */ } };
process.on('exit', stop);
for (let i = 0; i < 60; i += 1) {
  try { if ((await fetch(ORIGIN)).ok) break; } catch { /* not yet */ }
  await new Promise((r) => setTimeout(r, 250));
}

// --lang, not only the context locale: Chromium draws a native date field
// from the BROWSER's language, and left alone it printed mm/dd/yyyy.
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--lang=en-GB'],
  env: { ...process.env, LANG: 'en_GB.UTF-8', LANGUAGE: 'en_GB:en', LC_ALL: 'en_GB.UTF-8' },
});
// A UK phone. Left to the default, Chromium is en-US, and the add screen's
// date field printed mm/dd/yyyy in a UK app's own screenshots.
const ctx = await browser.newContext({
  viewport: VIEWPORT, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true,
  locale: 'en-GB', timezoneId: 'Europe/London',
});
// The same bridge emulation as scripts/ios-bundle.mjs — see its comment for
// why a WKWebView message handler and not a stubbed `isNativePlatform`.
await ctx.addInitScript(() => {
  const w = window;
  w.webkit = w.webkit ?? {};
  w.webkit.messageHandlers = w.webkit.messageHandlers ?? {};
  w.webkit.messageHandlers.bridge = { postMessage: () => {} };
  w.Capacitor = w.Capacitor ?? { isNativePlatform: () => true, getPlatform: () => 'ios' };
});
const page = await ctx.newPage();
const settle = (ms = 600) => page.waitForTimeout(ms);

await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
await settle(4500); // outlasts MIRROR_READ_BUDGET_MS; the bridge never answers
await page.getByRole('button', { name: 'Skip' }).click().catch(() => {});
await settle();
const native = await page.evaluate(() => window.Capacitor?.isNativePlatform?.() === true);
if (!native) {
  console.error('✗ the bundle did not boot as native — these would be screenshots of the web app');
  await browser.close();
  process.exit(1);
}
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('kept.v1'));
  for (const r of s.receipts) delete r.demo;
  localStorage.setItem('kept.v1', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await settle(4500);

const shots = [];
const shoot = async (name) => {
  const path = `${OUT}/${String(shots.length + 1).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path });
  shots.push(path);
};

await shoot('deadlines');

await page.getByRole('button', { name: /Zara, Wool-blend/ }).click();
await settle();
await shoot('shop-clock-and-your-rights');
await page.getByRole('button', { name: 'Back', exact: true }).click();
await settle();

await page.getByRole('button', { name: 'Add a receipt' }).click();
await settle();
await page.fill('#paste', 'Your Argos order is confirmed\nOrder placed 22 Sep 2026\nTotal £59.99');
await page.getByRole('button', { name: 'Read it' }).click();
await settle();
// kept reads the shop, total and date; what the thing IS, the person types.
// Shown filled in, because that is the moment before Save.
await page.fill('#add-item', 'Kenwood hand mixer');
await settle(300);
await shoot('paste-an-order-email');

/*
 * Three, deliberately. Settings is left out because its Deadline alerts row
 * asks the notification plugin, the emulated bridge has none, and the row
 * correctly says "Not available here" — true of this harness, false of a
 * phone. The Watch tab is left out because its entries are the SEED feed:
 * sample policy changes about named retailers, dated weeks ago and not
 * labelled as samples the way the seed receipts are. Unverified claims about
 * real companies do not belong in marketing, whatever they say on screen.
 */

await page.getByRole('button', { name: 'Settings', exact: true }).click();
await settle();
const priced = await page.evaluate(() => /£\d/.test(document.body.innerText) && /Go unlimited|lifetime|\/ ?month/i.test(document.body.innerText));
await browser.close();
stop();
if (priced) {
  console.error('✗ a price is on screen in the iOS bundle — these screenshots would show tiers the app does not sell');
  process.exit(1);
}
for (const p of shots) console.log(`✓ ${p.replace(ROOT, '')}`);
