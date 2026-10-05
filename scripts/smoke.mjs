/**
 * End-to-end smoke test, run against a built preview server.
 *
 *   npm run build && npx vite preview --port 5183 &
 *   CHROMIUM_PATH=/path/to/chrome node scripts/smoke.mjs
 *
 * It checks what unit tests cannot: that the swipe gesture actually returns a
 * receipt, that an edit reaches the screen and the disk, that a backup file
 * genuinely round-trips through export and restore, that state survives a
 * reload (the whole local-first promise), that the page contacts NO third
 * party, and that nothing throws on the way through.
 */
import { chromium } from 'playwright';
import { reportOnCrash, sayCrash } from './crash-report.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ORIGIN = process.env.KEPT_ORIGIN ?? 'http://localhost:5183';
const EXEC = process.env.CHROMIUM_PATH;

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});

/**
 * "Nobody else" is a promise on the privacy card, so every request this suite
 * can see is checked against it.
 *
 * Watched at the CONTEXT rather than the page, because it was on the page and
 * the page is only the app. The landing page opens as a second page in this
 * same context, and the landing page is where a Google Fonts <link> would
 * plausibly come back — measured: one added there was loaded by the browser
 * and the check still reported a clean pass. The verdict is read at the very
 * end, so a request made on the last screen counts the same as one made on the
 * first.
 *
 * Watched at CREATION rather than by a line under each `newContext`, because
 * that was fourteen hand-kept lines and the promise is about all of them: the
 * one somebody forgets to add contributes nothing to `foreign`, and a check
 * looking for an empty set reads silence as a pass. Wrapping the constructor
 * makes the fifteenth context watched the day it is written.
 */
const foreign = new Set();
let requestsSeen = 0;
const newContext = browser.newContext.bind(browser);
browser.newContext = async (options) => {
  const context = await newContext(options);
  // Page-initiated requests only, which is the right scope: Chromium itself
  // dials accounts.google.com and its own component updater on startup, and
  // that is the harness, not the app. Checked rather than assumed — opening
  // this page records no non-origin request at all, and about:blank in the
  // same browser records the same nothing.
  context.on('request', (r) => {
    requestsSeen += 1;
    const u = new URL(r.url());
    if (u.origin !== ORIGIN && u.protocol !== 'data:' && u.protocol !== 'blob:') foreign.add(u.origin);
  });
  return context;
};
const ctx = await browser.newContext({
  viewport: { width: 402, height: 874 },
  acceptDownloads: true,
  permissions: ['notifications'],
});
const page = await ctx.newPage();

// Record every notification the app tries to show, through both delivery
// paths, so alert behaviour can be asserted rather than taken on trust.
await page.addInitScript(() => {
  window.__notes = [];
  const record = (title, opts) => window.__notes.push({ title, body: opts?.body, tag: opts?.tag });
  class StubNotification {
    static permission = 'granted';
    static requestPermission() { return Promise.resolve('granted'); }
    constructor(title, opts) { record(title, opts); }
  }
  window.Notification = StubNotification;
  navigator.serviceWorker?.ready.then((reg) => {
    const original = reg.showNotification?.bind(reg);
    reg.showNotification = (title, opts) => {
      record(title, opts);
      return original ? original(title, opts).catch(() => {}) : Promise.resolve();
    };
  }).catch(() => {});
});

const problems = [];

page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text()}`);
});

await page.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// A fresh install interrupts nobody. The demo set looks urgent — the home
// screen leads with "2 days left" — and a notification is not a
// demonstration: on a lock screen it is indistinguishable from a real one,
// and it carries £89 nobody spent.
const opening = await page.evaluate(() => window.__notes);
const results = {
  'a fresh install does not ping you about the sample receipts': opening.length === 0,
};

/*
 * Say what was learned, even when the run does not finish — see
 * crash-report.mjs for what this is here to prevent.
 */
let reported = false;
function report(crash) {
  if (reported) return;
  reported = true;
  let failed = Boolean(crash);
  for (const [name, ok] of Object.entries(results)) {
    console.log(`${ok ? '✓' : '✗'} ${name}`);
    if (!ok) failed = true;
  }
  if (foreign.size) console.log('  third-party origins:', [...foreign].join(', '));
  if (requestsSeen === 0) console.log('  no request was observed at all — the origin watch is not running');
  for (const p of problems) console.log('  ' + p);
  if (crash) sayCrash(crash);
  process.exit(failed ? 1 : 0);
}
reportOnCrash(report);

/*
 * A fresh install opens onboarding at its FIRST card.
 *
 * `obStep: 0` in the state this app boots with, and nothing held it: mutation
 * to 1 left the whole suite green, because everything here — this line
 * included — skips onboarding without looking at it, so the app would have
 * opened on the second of three cards with the first one unreachable. Asked
 * through the progress element's own accessible text, which is the sentence a
 * screen reader is given and therefore has to be right anyway.
 */
results['a fresh install opens onboarding at the first card'] =
  (await page
    .getByRole('progressbar', { name: 'Onboarding progress' })
    .getAttribute('aria-valuetext')
    .catch(() => null)) === 'Step 1 of 3';

await page.getByRole('button', { name: 'Skip' }).click();
await page.waitForTimeout(300);

/*
 * The policy banner has to be where someone reads their receipts.
 *
 * It is the only place a changed window is announced, and nothing looked for
 * it: gating it on `searching` instead of `!searching` hid it from the list and
 * showed it only mid-search, with every sweep green. The seed carries sample
 * changes for two of its sample receipts, so a fresh install always has one to
 * show — and says it is a sample, because it is (APN-84).
 */
results['a changed policy is announced on the receipts list'] =
  await page.getByRole('button', { name: /^Sample: .*changed (its|their) returns polic/ }).isVisible().catch(() => false);

/*
 * And one alert for a receipt the person actually added — only one, because
 * the gentler rung it passed on the way is recorded silently.
 *
 * Its own context: the alert fires on load, so it needs a launch with the
 * receipt already on disk, and this page's own state is about to be swiped
 * and edited by everything below.
 */
{
  const alertCtx = await browser.newContext({ viewport: { width: 402, height: 874 }, permissions: ['notifications'] });
  const alertPage = await alertCtx.newPage();
  // Both delivery paths, like the main harness above: with a worker
  // registered, deliver() goes through registration.showNotification and the
  // constructor is only the fallback — a stub for one of them records nothing
  // and reads as "no alert was raised".
  await alertPage.addInitScript(() => {
    window.__notes = [];
    const record = (title, opts) => window.__notes.push({ title, body: opts?.body, tag: opts?.tag });
    class StubNotification {
      static permission = 'granted';
      static requestPermission() { return Promise.resolve('granted'); }
      constructor(title, opts) { record(title, opts); }
    }
    window.Notification = StubNotification;
    navigator.serviceWorker?.ready.then((reg) => {
      const original = reg.showNotification?.bind(reg);
      reg.showNotification = (title, opts) => {
        record(title, opts);
        return original ? original(title, opts).catch(() => {}) : Promise.resolve();
      };
    }).catch(() => {});
  });
  await alertPage.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await alertPage.waitForTimeout(500);
  await alertPage.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    const { demo, ...urgent } = s.receipts.find((r) => r.id === 'seed_currys');
    s.receipts = [...s.receipts, { ...urgent, id: 'mine_urgent', item: 'My own headphones' }];
    s.onboardingSeen = true;
    localStorage.setItem('kept.v1', JSON.stringify(s));
  });
  await alertPage.reload({ waitUntil: 'networkidle' });
  await alertPage.waitForTimeout(900);
  const raised = await alertPage.evaluate(() => window.__notes);
  results['a due deadline on your own receipt raises exactly one alert'] =
    raised.length === 1 && raised[0].tag === 'mine_urgent:soon';
  /*
   * And the sent list is on disk, so the NEXT launch must not say it again.
   *
   * Asked here rather than on the main harness, where it used to sit. Down
   * there it read `window.__notes` — asserted empty two hundred lines earlier,
   * on a page that never raises an alert at all, because its receipts are the
   * sample set and samples do not interrupt. Empty was still empty, so it
   * passed. Measured: with the recording that suppresses the repeat deleted
   * outright (`dispatch({ type: 'alerted', ... })` in App.tsx), the whole smoke
   * suite still went green, this check included.
   *
   * Here there is something to repeat. `__notes` is re-created empty by the
   * init script on every load, so a second launch that says it again lands one
   * entry in the fresh list, and `raised.length === 1` keeps the question
   * honest: it can only be answered once an alert has actually been raised.
   */
  await alertPage.reload({ waitUntil: 'networkidle' });
  await alertPage.waitForTimeout(900);
  const relaunched = await alertPage.evaluate(() => window.__notes);
  results['an alert is not repeated on the next launch'] = raised.length === 1 && relaunched.length === 0;
  await alertCtx.close();
}

// Swipe the urgent row left past the commit threshold. Brought into view
// first, as a thumb would: below the balance and the quick actions the list
// starts under the fold, and a drag at off-screen coordinates touches nothing.
const row = page.getByRole('button', { name: /Currys, JBL/ });
await row.evaluate((el) => el.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(150);
const box = await row.boundingBox();
const y = box.y + box.height / 2;
await page.mouse.move(box.x + box.width - 40, y);
await page.mouse.down();
for (let dx = 0; dx <= 110; dx += 22) {
  await page.mouse.move(box.x + box.width - 40 - dx, y);
  await page.waitForTimeout(30);
}
await page.mouse.up();
await page.waitForTimeout(600);

results['swipe marks the receipt returned'] = await page.getByText('Money back', { exact: true }).isVisible();

/*
 * Sharing the win, both ways it can go.
 *
 * This check used to be `is the button now saying "Copied"` — which passed
 * because the button said that whether or not the copy happened. The clipboard
 * write fails on an insecure origin (every deployment of this over plain HTTP)
 * and wherever the permission is refused, and the person found out by pasting
 * nothing into a message to a friend.
 *
 * Its own contexts, because the only way to test what the screen says about
 * the clipboard is to control the clipboard.
 */
for (const [label, refuse] of [['confirms a copy that happened', false], ['does not claim one that did not', true]]) {
  const shareCtx = await browser.newContext({
    viewport: { width: 402, height: 874 },
    permissions: refuse ? [] : ['clipboard-write'],
  });
  const sharePage = await shareCtx.newPage();
  if (refuse) {
    await sharePage.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.reject(new Error('insecure origin')) },
        configurable: true,
      });
    });
  }
  await sharePage.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await sharePage.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await sharePage.waitForTimeout(300);
  await sharePage.getByRole('button', { name: /Currys, JBL/ }).click();
  await sharePage.waitForTimeout(300);
  await sharePage.getByRole('button', { name: 'Got my money back' }).click();
  await sharePage.waitForTimeout(700);
  await sharePage.getByRole('button', { name: 'Share', exact: true }).click();
  await sharePage.waitForTimeout(600);
  const said = await sharePage.locator('main').innerText();
  const claimsCopied = /Copied — paste it anywhere/.test(said);
  const showsTheLine = said.includes('Just got £89.00 back from Currys');
  results[`sharing ${label}`] = refuse ? !claimsCopied && showsTheLine : claimsCopied && !showsTheLine;
  /*
   * And what the card and the line actually claim.
   *
   * Both were unconditional. The card said "Recovered from Currys before the
   * window closed" on a receipt whose window had closed — the button is
   * offered on any active receipt — and the shareable line said "kept.
   * reminded me before the window shut" whether or not kept had said anything
   * at all, which is a claim about the product for the person to send to
   * their friends. Nothing has alerted about this receipt in this context: it
   * is a sample, and samples do not interrupt.
   */
  if (refuse) {
    results['the win does not claim a reminder that was never sent'] =
      !/reminded me before the window shut/.test(said) &&
      /keeps every return deadline in one place/.test(said) &&
      said.includes('Recovered from Currys before the window closed');
  }
  await shareCtx.close();
}

/*
 * Keeping it: the commonest end to a purchase, and it had no action.
 *
 * The exits were "returned" and Delete, so a kept item went on raising return
 * reminders, then sat at the top under WINDOW CLOSED in red for good, and
 * deleting it lost its warranty, its photo and its faulty-goods rights. Kept,
 * it leaves the urgency sections, loses its returns link, says so on its own
 * screen, and can be taken back.
 */
{
  const keepCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const kp = await keepCtx.newPage();
  await kp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await kp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await kp.waitForTimeout(300);
  await kp.getByRole('button', { name: /Currys, JBL/ }).click();
  await kp.waitForTimeout(300);
  // Asked before it is pressed, so a build without it says so by name rather
  // than stopping the run on a click that times out.
  const keepButton = kp.getByRole('button', { name: /I’m keeping it/ });
  if ((await keepButton.count()) === 0) {
    results['a kept receipt leaves the deadlines, loses its returns link, and says so'] = false;
    results['keeping it can be taken back'] = false;
    problems.push('keeping: an active receipt offers no “I’m keeping it”');
  } else {
    await keepButton.click();
    await kp.waitForTimeout(300);
    const detailSays = await kp.locator('main').innerText();
    const linkGone = (await kp.getByRole('link', { name: /Start your return/ }).count()) === 0;
    await kp.getByRole('button', { name: 'Back', exact: true }).click();
    await kp.waitForTimeout(300);
    const filed = await kp.evaluate(() => {
      const heads = [...document.querySelectorAll('h2')];
      const under = (label) => {
        const h = heads.find((x) => x.textContent.includes(label));
        return h ? h.nextElementSibling?.textContent ?? '' : '';
      };
      return { keeping: under('Keeping'), closed: under('Window closed'), urgent: under('Due soon'), later: under('Later') };
    });
    results['a kept receipt leaves the deadlines, loses its returns link, and says so'] =
      /Keeping it · since/.test(detailSays) && linkGone && /Currys/.test(filed.keeping) &&
      !/JBL/.test(filed.closed + filed.urgent + filed.later);
    if (!results['a kept receipt leaves the deadlines, loses its returns link, and says so']) problems.push(`keeping: ${JSON.stringify({ linkGone, filed })}`);

    await kp.getByRole('button', { name: /Currys, JBL.*keeping it/ }).click();
    await kp.waitForTimeout(300);
    await kp.getByRole('button', { name: 'Not keeping it after all' }).click();
    await kp.waitForTimeout(300);
    const backToActive = (await kp.getByRole('button', { name: 'Got my money back' }).count()) === 1;
    const stored = await kp.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.find((r) => /JBL/.test(r.item)));
    results['keeping it can be taken back'] = backToActive && stored?.status === 'active' && stored?.keptOn === undefined;
  }
  await keepCtx.close();
}

/*
 * Sharing the win as a picture, through the phone's own share sheet.
 *
 * The clipboard sentence above is the fallback. Where a share sheet exists,
 * the card goes to it as a 1080 × 1350 PNG drawn on the phone, beside the same
 * sentence, and the button says "Shared" only once the sheet has finished.
 * A cancelled sheet is the person changing their mind: nothing is claimed and
 * nothing is copied behind their back. The sheet is stubbed to record what it
 * was handed, because what it was handed is the whole question.
 */
for (const cancel of [false, true]) {
  const sheetCtx = await browser.newContext({ viewport: { width: 402, height: 874 }, permissions: ['clipboard-write'] });
  await sheetCtx.addInitScript((cancel) => {
    window.__sheet = null;
    window.__copied = null;
    navigator.canShare = (data) => Array.isArray(data?.files) && data.files.every((f) => f.type === 'image/png');
    navigator.share = async (data) => {
      const files = await Promise.all((data.files ?? []).map(async (f) => {
        const bmp = await createImageBitmap(f);
        return { name: f.name, type: f.type, size: f.size, width: bmp.width, height: bmp.height };
      }));
      window.__sheet = { text: data.text, files };
      if (cancel) throw new DOMException('Share canceled', 'AbortError');
    };
    const write = navigator.clipboard?.writeText?.bind(navigator.clipboard);
    if (navigator.clipboard) navigator.clipboard.writeText = (t) => { window.__copied = t; return write ? write(t) : Promise.resolve(); };
  }, cancel);
  const sp = await sheetCtx.newPage();
  await sp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await sp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await sp.waitForTimeout(300);
  await sp.getByRole('button', { name: /Currys, JBL/ }).click();
  await sp.waitForTimeout(300);
  await sp.getByRole('button', { name: 'Got my money back' }).click();
  await sp.waitForTimeout(700);
  await sp.getByRole('button', { name: 'Share', exact: true }).click();
  await sp.waitForTimeout(1500);
  const sheet = await sp.evaluate(() => window.__sheet);
  const copied = await sp.evaluate(() => window.__copied);
  const said = await sp.locator('main').innerText();
  const card = sheet?.files?.[0];
  if (!cancel) {
    results['the win is shared as a picture of the card, with its sentence'] =
      !!card && card.type === 'image/png' && card.width === 1080 && card.height === 1350 && card.size > 20_000 &&
      /kept-money-back\.png/.test(card.name) && /Just got £89\.00 back from Currys/.test(sheet.text ?? '') &&
      /Shared ✓/.test(said) && copied === null;
    if (!results['the win is shared as a picture of the card, with its sentence']) problems.push(`share sheet: ${JSON.stringify({ sheet, copied })}`);
  } else {
    results['a cancelled share claims nothing and copies nothing'] =
      !!sheet && !/Shared ✓|Copied — paste it anywhere/.test(said) && /^Share$/m.test(said) && copied === null;
    if (!results['a cancelled share claims nothing and copies nothing']) problems.push(`cancelled share: ${JSON.stringify({ said: said.slice(0, 80), copied })}`);
  }
  await sheetCtx.close();
}

/*
 * The backlog, settled in one tap.
 *
 * A library left alone fills with windows that shut months ago: red under
 * WINDOW CLOSED, the oldest on the hero card in place of the next deadline
 * that can still be met, and clearing them meant opening every one. One tap
 * keeps them all, the hero moves on to a window that is still open, and the
 * tap can be undone. A settled receipt's own screen stops counting down.
 */
{
  const backCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const bp = await backCtx.newPage();
  await bp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  const shutStores = await bp.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    s.onboardingSeen = true;
    const shut = s.receipts.slice(0, 2);
    for (const r of shut) { r.purchasedOn = '2025-01-06'; delete r.windowStartsOn; }
    localStorage.setItem('kept.v1', JSON.stringify(s));
    return shut.map((r) => r.store);
  });
  await bp.reload({ waitUntil: 'networkidle' });
  await bp.waitForTimeout(500);
  const heroBefore = await bp.locator('main').innerText();
  const keepAll = bp.getByRole('button', { name: 'I’m keeping all 2' });
  if ((await keepAll.count()) === 0) {
    results['closed windows can be kept in one tap, and the hero moves on'] = false;
    results['keeping the closed windows can be undone'] = false;
    results['a settled receipt stops counting down'] = false;
    results['a kept row says how long its guarantee runs'] = false;
    problems.push(`backlog: no “I’m keeping all 2” under “Window closed” (${shutStores.join(', ')})`);
  } else {
    await keepAll.click();
    await bp.waitForTimeout(400);
    const after = await bp.evaluate(() => {
      const heads = [...document.querySelectorAll('h2')];
      const under = (label) => heads.find((x) => x.textContent.includes(label))?.nextElementSibling?.textContent ?? '';
      return {
        text: document.querySelector('main').innerText,
        keeping: under('Keeping'),
        closedHead: heads.some((h) => h.textContent.includes('Window closed')),
        bar: [...document.querySelectorAll('[role="status"]')].map((x) => x.textContent).join(' | '),
      };
    });
    results['closed windows can be kept in one tap, and the hero moves on'] =
      /Window closed/.test(heroBefore) && !after.closedHead &&
      !/Window closed/.test(after.text) && /Next to close/.test(after.text) &&
      shutStores.every((store) => after.keeping.includes(store)) && /Moved 2 to Keeping it/.test(after.bar);
    if (!results['closed windows can be kept in one tap, and the hero moves on']) problems.push(`backlog kept: ${JSON.stringify({ closedHead: after.closedHead, keeping: after.keeping.slice(0, 80), bar: after.bar })}`);
    // Both were bought in January 2025 here. The mixer's 12-month guarantee
    // has ended and its row says so; the headphones' 24 months run into 2027.
    const rows = await bp.evaluate(() => {
      const h = [...document.querySelectorAll('h2')].find((x) => x.textContent.includes('Keeping'));
      return [...(h?.nextElementSibling?.querySelectorAll('li') ?? [])].map((li) => li.textContent);
    });
    const rowFor = (store) => rows.find((t) => t.startsWith(store)) ?? '';
    results['a kept row says how long its guarantee runs'] =
      /cover ended/.test(rowFor('Argos')) && !/covered until/.test(rowFor('Argos')) &&
      /covered until \d+ \w+ 2027/.test(rowFor('Currys'));
    if (!results['a kept row says how long its guarantee runs']) problems.push(`kept cover: ${JSON.stringify(rows)}`);

    // Its own screen, while kept: no countdown, no "RETURN BY".
    await bp.getByRole('button', { name: new RegExp(`^${shutStores[0]}, .*keeping it$`) }).click();
    await bp.waitForTimeout(400);
    const detail = await bp.locator('main').innerText();
    results['a settled receipt stops counting down'] =
      /The window ran to/.test(detail) && !/Return by|Window closed|days left/.test(detail) && /Keeping it · since/.test(detail);
    if (!results['a settled receipt stops counting down']) problems.push(`settled detail: ${detail.slice(0, 200)}`);
    await bp.getByRole('button', { name: 'Back', exact: true }).click();
    await bp.waitForTimeout(300);

    // Navigating away dismissed that offer, so keep again and take it back.
    const stored = () => bp.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.slice(0, 2).map((r) => r.status));
    const beforeUndo = await stored();
    for (const store of shutStores) {
      await bp.getByRole('button', { name: new RegExp(`^${store}, .*keeping it$`) }).click();
      await bp.waitForTimeout(300);
      await bp.getByRole('button', { name: 'Not keeping it after all' }).click();
      await bp.waitForTimeout(300);
      await bp.getByRole('button', { name: 'Back', exact: true }).click();
      await bp.waitForTimeout(300);
    }
    await bp.getByRole('button', { name: 'I’m keeping all 2' }).click();
    await bp.waitForTimeout(300);
    await bp.getByRole('button', { name: 'Undo' }).click();
    await bp.waitForTimeout(300);
    const undone = await stored();
    const closedBack = await bp.getByRole('heading', { name: /Window closed/ }).count();
    results['keeping the closed windows can be undone'] =
      beforeUndo.every((st) => st === 'kept') && undone.every((st) => st === 'active') && closedBack === 1;
    if (!results['keeping the closed windows can be undone']) problems.push(`backlog undo: ${JSON.stringify({ beforeUndo, undone, closedBack })}`);
  }
  await backCtx.close();
}

/*
 * A floor is not a closed window.
 *
 * An online order from a shop that counts from delivery, the arrival never
 * entered, is counted from the order: the EARLIEST its window can end. Past
 * that day it was filed under WINDOW CLOSED, swept into "I'm keeping all",
 * and told by a reminder "That window has closed" — measured on an Apple
 * order with two days really left. Here it is past its floor beside a
 * counter purchase that really has shut, so the closed section and its keep
 * button are on screen to be read, not merely absent; and the arrival date,
 * once given, has to turn the floor back into a deadline.
 */
{
  const fCtx = await browser.newContext({ viewport: { width: 402, height: 874 }, permissions: ['notifications'] });
  const fp = await fCtx.newPage();
  await fp.addInitScript(() => {
    window.__notes = [];
    class StubNotification {
      static permission = 'granted';
      static requestPermission() { return Promise.resolve('granted'); }
      constructor(title, opts) { window.__notes.push({ title, body: opts?.body }); }
    }
    window.Notification = StubNotification;
    navigator.serviceWorker?.ready.then((reg) => {
      reg.showNotification = (title, opts) => { window.__notes.push({ title, body: opts?.body }); return Promise.resolve(); };
    }).catch(() => {});
  });
  await fp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  const today = await fp.evaluate(() => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    s.onboardingSeen = true;
    s.receipts.push(
      // Bought at the counter 40 days ago on a 14-day window: really shut.
      { id: 'r_shut', store: 'Currys', item: 'Toaster', cat: 'kitchen', amount: 3000, purchasedOn: iso(40), windowDays: 14, policy: 'p', distance: false, status: 'active' },
      // Ordered from Apple 15 days ago: a day past the floor, arrival unknown.
      { id: 'r_floor', store: 'Apple', item: 'AirPods Pro', cat: 'audio', amount: 22900, purchasedOn: iso(15), windowDays: 14, policy: 'Apple · 14 days from delivery.', distance: true, status: 'active' },
    );
    localStorage.setItem('kept.v1', JSON.stringify(s));
    return iso(0);
  });
  await fp.reload({ waitUntil: 'networkidle' });
  await fp.waitForTimeout(600);
  const home = () => fp.evaluate(() => {
    const heads = [...document.querySelectorAll('h2')];
    const under = (re) => { const h = heads.find((x) => re.test(x.textContent)); return h ? (h.nextElementSibling?.matches('p') ? h.nextElementSibling.nextElementSibling : h.nextElementSibling)?.textContent ?? '' : null; };
    return {
      closed: under(/Window closed/),
      unsure: under(/when did it arrive/i),
      keep: [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => /^I’m keeping (it|all \d+)$/.test(t)),
      row: [...document.querySelectorAll('li button')].map((b) => b.getAttribute('aria-label') ?? '').find((l) => l.startsWith('Apple, AirPods Pro')) ?? '',
      hero: [...document.querySelectorAll('main button')].find((b) => /See what to do/.test(b.textContent))?.innerText ?? '',
    };
  });
  const before = await home();
  const filed = {
    // The section is there, holding the toaster: absence is not a pass.
    closedShown: /Toaster/.test(before.closed ?? ''),
    notClosed: !/AirPods/.test(before.closed ?? ''),
    keepOnlyShut: before.keep.length === 1 && before.keep[0] === 'I’m keeping it',
    asks: /AirPods/.test(before.unsure ?? '') && /, arrived when\?$/.test(before.row),
    hero: /May still be open/.test(before.hero) && !/Gone|Window closed/.test(before.hero),
  };
  // "I'm keeping it" settles the toaster and leaves the order alone.
  if (filed.keepOnlyShut) {
    await fp.getByRole('button', { name: 'I’m keeping it', exact: true }).click();
    await fp.waitForTimeout(400);
    const status = await fp.evaluate(() => Object.fromEntries(JSON.parse(localStorage.getItem('kept.v1')).receipts.filter((r) => r.id === 'r_shut' || r.id === 'r_floor').map((r) => [r.id, r.status])));
    filed.keptOnlyShut = status.r_shut === 'kept' && status.r_floor === 'active';
  }
  const notes = await fp.evaluate(() => window.__notes.filter((n) => /Apple · AirPods Pro/.test(n.body ?? '')));
  const said = {
    // Something was said about it, or there is nothing to check.
    alerted: notes.length > 0,
    hedged: notes.length > 0 && notes.every((n) => !/has closed|has passed/.test(n.title) && /may have/.test(n.title)),
    pointed: notes.some((n) => /add the day it arrived/.test(n.body)),
  };
  // The arrival date, offered where the row leads, and what it does.
  await fp.getByRole('button', { name: /^Apple, AirPods Pro/ }).first().click({ timeout: 3000 }).catch(() => {});
  await fp.waitForTimeout(400);
  const detail = await fp.locator('main').innerText();
  const arrival = {
    offered: (await fp.getByRole('button', { name: 'It arrived today' }).count()) === 1,
    hedged: !/Window closed/.test(detail) && /Earliest it could close/.test(detail) && /may still be open/.test(detail),
  };
  if (arrival.offered) {
    await fp.getByRole('button', { name: 'It arrived today' }).click();
    await fp.waitForTimeout(300);
    const stored = await fp.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.find((r) => r.id === 'r_floor'));
    arrival.stored = stored?.windowStartsOn === today;
    await fp.getByRole('button', { name: 'Back', exact: true }).click();
    await fp.waitForTimeout(300);
    const after = await home();
    arrival.relisted = after.unsure === null && /, 14 days left$/.test(after.row);
  }
  results['a floor gone by is not filed as closed or kept with the closed ones, and asks when it arrived'] = Object.values(filed).every(Boolean) && Object.keys(filed).length === 6;
  if (!results['a floor gone by is not filed as closed or kept with the closed ones, and asks when it arrived']) problems.push(`floor on home: ${JSON.stringify({ filed, before })}`);
  results['a floor gone by is not announced as closed'] = Object.values(said).every(Boolean);
  if (!results['a floor gone by is not announced as closed']) problems.push(`floor alert: ${JSON.stringify({ said, notes })}`);
  results['a floor gone by offers the arrival date, which turns it back into a deadline'] = !!(arrival.offered && arrival.hedged && arrival.stored && arrival.relisted);
  if (!results['a floor gone by offers the arrival date, which turns it back into a deadline']) problems.push(`floor arrival: ${JSON.stringify({ arrival, detail: detail.slice(0, 300) })}`);
  await fCtx.close();
}

/*
 * Something wrong with it: the rights, turned into the letter.
 *
 * The receipt's screen always said which remedy the law gives today; the
 * person was left to write to the shop themselves. Now it names today's
 * remedy and drafts the letter, with their words in it, and Copy puts exactly
 * that letter on the clipboard. The remedy follows the date: the headphones
 * (twelve days old) are rejected for a refund, the chest of drawers (over six months)
 * gets a repair without the presumption. A refund already made has no panel.
 */
{
  const faultCtx = await browser.newContext({ viewport: { width: 402, height: 874 }, permissions: ['clipboard-write'] });
  await faultCtx.addInitScript(() => {
    const write = navigator.clipboard?.writeText?.bind(navigator.clipboard);
    if (navigator.clipboard) navigator.clipboard.writeText = (t) => { window.__copied = t; return write ? write(t) : Promise.resolve(); };
  });
  const fp = await faultCtx.newPage();
  await fp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await fp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await fp.waitForTimeout(300);

  const letterFor = async (row, words) => {
    await fp.getByRole('button', { name: row }).first().click();
    await fp.waitForTimeout(300);
    const opener = fp.getByRole('button', { name: 'Something wrong with it?' });
    if ((await opener.count()) === 0) return null;
    await opener.click();
    await fp.waitForTimeout(200);
    if (words) await fp.getByLabel('What’s wrong with it?').fill(words);
    const panel = await fp.locator('[data-fault-panel]').innerText();
    const letter = await fp.getByLabel('The letter').innerText().catch(() => '');
    await fp.getByRole('button', { name: 'Copy the letter' }).click().catch(() => {});
    await fp.waitForTimeout(200);
    const copied = await fp.evaluate(() => window.__copied ?? null);
    const said = await fp.locator('[data-fault-panel]').innerText();
    await fp.getByRole('button', { name: 'Back', exact: true }).click();
    await fp.waitForTimeout(300);
    return { panel, letter, copied, said };
  };

  const fresh = await letterFor(/Currys, JBL/, 'The left ear cup crackles');
  const old = await letterFor(/IKEA, MALM/, '');
  results['something wrong: a new purchase is rejected for a refund, in a letter carrying their words'] =
    !!fresh && /reject it for a full refund/.test(fresh.panel) && /section 22/.test(fresh.letter) &&
    /The problem: The left ear cup crackles\./.test(fresh.letter) && !/section 23/.test(fresh.letter) &&
    fresh.copied === fresh.letter && /Copied ✓/.test(fresh.said);
  if (!results['something wrong: a new purchase is rejected for a refund, in a letter carrying their words']) problems.push(`fault fresh: ${JSON.stringify(fresh)?.slice(0, 300)}`);
  results['something wrong: an older one asks for a repair, and claims no presumption it has lost'] =
    !!old && /free repair or replacement/.test(old.panel) && /section 23/.test(old.letter) &&
    !/19\(14\)/.test(old.letter) && !/section 22/.test(old.letter);
  if (!results['something wrong: an older one asks for a repair, and claims no presumption it has lost']) problems.push(`fault old: ${JSON.stringify(old)?.slice(0, 300)}`);
  await faultCtx.close();
}

/*
 * A return can be taken back where it was made. The swipe that marks one
 * fires on a row you might have meant to open; delete had an undo and this
 * did not. Returned from its screen, celebrated, then undone from the bar:
 * the receipt is back in the deadlines and on disk as active.
 */
{
  const undoCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const up = await undoCtx.newPage();
  await up.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await up.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await up.waitForTimeout(300);
  await up.getByRole('button', { name: /Currys, JBL/ }).first().click();
  await up.waitForTimeout(300);
  await up.getByRole('button', { name: 'Got my money back' }).click();
  await up.waitForTimeout(400);
  const celebrated = /^Money back$/m.test(await up.locator('main').innerText());
  const undo = up.getByRole('button', { name: 'Undo' });
  const offered = (await undo.count()) === 1 && /Marked JBL Tune 770NC headphones returned/.test(await up.locator('[role="status"]').allInnerTexts().then((t) => t.join(' ')));
  if (offered) await undo.click();
  await up.waitForTimeout(400);
  const home = await up.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find((x) => x.textContent.includes('Due soon'));
    return { goNow: h?.nextElementSibling?.textContent ?? '', text: document.querySelector('main').innerText };
  });
  const stored = await up.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.find((r) => /JBL/.test(r.item)));
  results['a return can be undone from the bar, straight off the celebration'] =
    celebrated && offered && /Currys/.test(home.goNow) && !/^Money back$/m.test(home.text) &&
    stored?.status === 'active' && stored?.returnedOn === undefined;
  if (!results['a return can be undone from the bar, straight off the celebration']) problems.push(`undo return: ${JSON.stringify({ celebrated, offered, goNow: home.goNow.slice(0, 60), status: stored?.status })}`);
  await undoCtx.close();
}

/*
 * A paste with no order date. It used to become today, shown read-only as
 * "(assumed today)": a delivery email that says only "Arriving Tuesday"
 * started the clock days late, and correcting it meant saving first and
 * finding Edit. The date is a field now, starting at today and saying so; a
 * future date is refused before save; and the date chosen is the one saved.
 */
{
  const dCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const dp = await dCtx.newPage();
  await dp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await dp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await dp.getByRole('button', { name: 'Add a receipt' }).click();
  await dp.locator('#paste').fill('Your Argos order is on its way\nArriving Tuesday\nTotal £49.99');
  await dp.getByRole('button', { name: 'Read it' }).click();
  await dp.waitForTimeout(300);
  const field = dp.locator('#add-bought');
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const now = new Date();
  const earlier = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10));
  const tomorrow = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  let seen = { shown: false };
  if ((await field.count()) === 1) {
    seen.startsToday = (await field.inputValue()) === iso(now);
    await field.fill(tomorrow);
    await dp.waitForTimeout(150);
    seen.futureRefused = /in the future/.test(await dp.locator('#add-bought-note').innerText()) &&
      (await dp.getByRole('button', { name: 'Save receipt' }).isDisabled());
    await field.fill(earlier);
    await dp.waitForTimeout(150);
    await dp.getByRole('button', { name: 'Save receipt' }).click();
    await dp.waitForTimeout(400);
    const stored = await dp.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.find((r) => !r.demo));
    seen = { ...seen, shown: true, saved: stored?.purchasedOn === earlier };
  }
  results['a paste with no date asks for it, refuses the future, and saves the day chosen'] =
    seen.shown && seen.startsToday && seen.futureRefused && seen.saved;
  if (!results['a paste with no date asks for it, refuses the future, and saves the day chosen']) problems.push(`bought on: ${JSON.stringify(seen)}`);
  await dCtx.close();
}

/*
 * Asking for the guarantee. The reminder a month before cover ends can only
 * be about a guarantee kept knows of, and nothing asked for one: Add has no
 * field, and a receipt without one said nothing about it. A pasted coffee
 * machine's screen now asks, the button goes to the field, and once a length
 * is saved the screen counts it down instead of asking.
 */
{
  const gCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const gp = await gCtx.newPage();
  await gp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await gp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await gp.getByRole('button', { name: 'Add a receipt' }).click();
  await gp.locator('#paste').fill('Your John Lewis order is confirmed\nOrder date: 21 September 2026\nOrder total: £499.00');
  await gp.getByRole('button', { name: 'Read it' }).click();
  await gp.getByLabel(/what is it/i).fill('Sage Barista Express').catch(() => {});
  await gp.getByRole('button', { name: 'Save receipt' }).click();
  await gp.waitForTimeout(500);
  await gp.getByRole('button', { name: /John Lewis/ }).first().click();
  await gp.waitForTimeout(400);
  const asked = await gp.locator('main').innerText();
  const button = gp.getByRole('button', { name: 'Add its guarantee' });
  let after = '';
  if ((await button.count()) === 1) {
    await button.click();
    await gp.waitForTimeout(300);
    await gp.locator('#e-warranty').fill('24');
    await gp.getByRole('button', { name: 'Save changes' }).click();
    await gp.waitForTimeout(400);
    after = await gp.locator('main').innerText();
  }
  results['a receipt with no guarantee asks for one, and counts it down once given'] =
    /None recorded/.test(asked) && /Repairs should be free until/.test(after) && !/None recorded/.test(after);
  if (!results['a receipt with no guarantee asks for one, and counts it down once given']) problems.push(`guarantee ask: ${JSON.stringify({ asked: /None recorded/.test(asked), after: after.slice(0, 120) })}`);
  await gCtx.close();
}

/*
 * A shop with two windows. Liberty gives 30 days for an online order and 14
 * for one bought in the store, and the window the Add screen offers — and
 * saves — has to follow "How did you buy it?", not stay on whichever number
 * the paste suggested first.
 */
{
  const lCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const lp = await lCtx.newPage();
  await lp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await lp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await lp.getByRole('button', { name: 'Add a receipt' }).click();
  await lp.locator('#paste').fill('Liberty London\nYour order is confirmed\nOrder date: 21 September 2026\nSilk scarf £95.00\nOrder total: £95.00');
  await lp.getByRole('button', { name: 'Read it' }).click();
  await lp.waitForTimeout(300);
  const windowShown = async () => (/Return window\s*(\d+) days/.exec(await lp.locator('main').innerText()) ?? [])[1];
  const online = await windowShown();
  await lp.getByRole('radio', { name: 'In a shop' }).click();
  await lp.waitForTimeout(200);
  const inStore = await windowShown();
  await lp.getByLabel(/what is it/i).fill('Silk scarf').catch(() => {});
  await lp.getByRole('button', { name: 'Save receipt' }).click();
  await lp.waitForTimeout(500);
  const saved = await lp.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const v = localStorage.getItem(localStorage.key(i)) ?? '';
      const m = /"store":"Liberty"[^}]*?"windowDays":(\d+)/.exec(v) ?? /"windowDays":(\d+)[^}]*?"store":"Liberty"/.exec(v);
      if (m) return m[1];
    }
    return null;
  });
  const name = 'a shop with an online window offers the window for the way it was bought, and saves that one';
  results[name] = online === '30' && inStore === '14' && saved === '14';
  if (!results[name]) problems.push(`online window: ${JSON.stringify({ online, inStore, saved })}`);
  await lCtx.close();
}

/*
 * The web build's library lives only in this browser, and it never asked the
 * browser to keep it. It asks now, once, on open.
 */
{
  const pCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  await pCtx.addInitScript(() => {
    window.__persistAsked = 0;
    if (navigator.storage) {
      navigator.storage.persisted = async () => false;
      navigator.storage.persist = async () => (window.__persistAsked += 1, true);
    }
  });
  const pp = await pCtx.newPage();
  await pp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await pp.waitForTimeout(400);
  const asked = await pp.evaluate(() => window.__persistAsked);
  results['the web app asks the browser to keep its library'] = asked === 1;
  if (!results['the web app asks the browser to keep its library']) problems.push(`persist asked ${asked} times`);
  await pCtx.close();
}

/*
 * Which clock closes first. Four places said kept tells you, and no screen
 * did. The headphones' 14 days go before the 30-day right to reject; the
 * coat, ordered online with no arrival date, loses its right to reject first,
 * and because that clock runs from the day it arrived, it is a likelihood.
 */
{
  const fCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const fp = await fCtx.newPage();
  await fp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await fp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await fp.waitForTimeout(300);
  const lineFor = async (row) => {
    await fp.getByRole('button', { name: row }).first().click();
    await fp.waitForTimeout(300);
    const t = (await fp.locator('main').innerText()).split('\n').find((l) => /close first:|Closes first:/.test(l)) ?? '';
    await fp.getByRole('button', { name: 'Back', exact: true }).click();
    await fp.waitForTimeout(300);
    return t;
  };
  const headphones = await lineFor(/Currys, JBL/);
  const coat = await lineFor(/Zara, Wool-blend/);
  results['the receipt says which clock closes first, and hedges it when the arrival is unknown'] =
    /^Closes first: the shop’s own window, /.test(headphones) &&
    /^Likely to close first: your 30-day right to reject faulty goods for a full refund, no earlier than /.test(coat);
  if (!results['the receipt says which clock closes first, and hedges it when the arrival is unknown']) problems.push(`first to close: ${JSON.stringify({ headphones, coat })}`);
  await fCtx.close();
}

/*
 * Sent back, waiting for the refund. Posting a parcel on day 27 and seeing
 * the money on day 35 had nowhere to be: marked returned, the refund was
 * celebrated before it existed; left active, it went on saying "go now or
 * lose it" about a parcel in the post. Sent, it leaves the deadlines for its
 * own section, its screen says when to chase, and the refund, when it comes,
 * is recorded with the day it went back.
 */
{
  const sCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const sp = await sCtx.newPage();
  await sp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await sp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await sp.waitForTimeout(300);
  await sp.getByRole('button', { name: /Currys, JBL/ }).first().click();
  await sp.waitForTimeout(300);
  const send = sp.getByRole('button', { name: 'I’ve sent it back' });
  let seen = { offered: (await send.count()) === 1 };
  if (seen.offered) {
    await send.click();
    await sp.waitForTimeout(300);
    const detail = await sp.locator('main').innerText();
    seen.detail = /Sent back · /.test(detail) && /Waiting for the refund\. If it has not arrived by .+, chase it/.test(detail) && !/Return by|^days left$/m.test(detail);
    // (The ring's own "days left" line; the legal panel may rightly count
    // down the 30-day right to reject on the same screen.)
    await sp.getByRole('button', { name: 'Back', exact: true }).click();
    await sp.waitForTimeout(300);
    seen.filed = await sp.evaluate(() => {
      const heads = [...document.querySelectorAll('h2')];
      const under = (label) => heads.find((x) => x.textContent.includes(label))?.nextElementSibling?.textContent ?? '';
      return /Currys/.test(under('Sent back')) && !/JBL/.test(under('Due soon') + under('Later') + under('Window closed'));
    });
    await sp.getByRole('button', { name: /Currys, JBL.*waiting for the refund/ }).click();
    await sp.waitForTimeout(300);
    await sp.getByRole('button', { name: 'Got my money back' }).click();
    await sp.waitForTimeout(400);
    const stored = await sp.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.find((r) => /JBL/.test(r.item)));
    seen.refunded = stored?.status === 'returned' && typeof stored?.sentOn === 'string' && typeof stored?.returnedOn === 'string';
  }
  results['a parcel sent back waits for its refund apart from the deadlines, then counts from the day it went'] =
    seen.offered && seen.detail && seen.filed && seen.refunded;
  if (!results['a parcel sent back waits for its refund apart from the deadlines, then counts from the day it went']) problems.push(`sent back: ${JSON.stringify(seen)}`);
  await sCtx.close();
}

/*
 * Less than was paid. The one-tap return recorded the whole price, so a £30
 * refund on a £60 order counted £60 as kept back. The refund can now be
 * corrected on the receipt, and the list and its total follow it.
 */
{
  const rCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const rp = await rCtx.newPage();
  await rp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await rp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await rp.getByRole('button', { name: /Currys, JBL/ }).first().click();
  await rp.getByRole('button', { name: 'Got my money back' }).click();
  await rp.waitForTimeout(300);
  await rp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await rp.getByRole('button', { name: /Currys, JBL.*returned/ }).click();
  await rp.waitForTimeout(300);
  let seen = { offered: (await rp.getByRole('button', { name: 'Not the full amount?' }).count()) === 1 };
  if (seen.offered) {
    await rp.getByRole('button', { name: 'Not the full amount?' }).click();
    await rp.getByLabel('How much came back?').fill('999');
    seen.tooMuchRefused = /More than the £89\.00 it cost/.test(await rp.locator('main').innerText());
    await rp.getByLabel('How much came back?').fill('30');
    await rp.getByRole('button', { name: 'Save', exact: true }).click();
    await rp.waitForTimeout(300);
    const detail = await rp.locator('main').innerText();
    seen.detail = /Money back · £30\.00 recovered/.test(detail) && /of the £89\.00 it cost/.test(detail);
    await rp.getByRole('button', { name: 'Back', exact: true }).click();
    await rp.waitForTimeout(300);
    seen.row = (await rp.getByRole('button', { name: /Currys, JBL.*£30\.00 back, returned/ }).count()) === 1;
    const stored = await rp.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.find((r) => /JBL/.test(r.item)));
    seen.stored = stored?.refunded === 3000;
  }
  results['a refund of less than was paid is recorded, and the list counts it'] =
    seen.offered && seen.tooMuchRefused && seen.detail && seen.row && seen.stored;
  if (!results['a refund of less than was paid is recorded, and the list counts it']) problems.push(`partial refund: ${JSON.stringify(seen)}`);
  await rCtx.close();
}

/*
 * The refund that does not come. The app followed a return to the post box,
 * asked on day fourteen whether the money had arrived, and when it had not,
 * said "chase it" and nothing more. Now the tracking number is kept the day it
 * goes, and once the refund is late the receipt drafts the chase — citing
 * regulation 34 only for an online order sent back inside the cancellation
 * period, and asking plainly for anything else.
 */
{
  const cCtx = await browser.newContext({ viewport: { width: 402, height: 874 }, permissions: ['clipboard-write'] });
  await cCtx.addInitScript(() => {
    const write = navigator.clipboard?.writeText?.bind(navigator.clipboard);
    if (navigator.clipboard) navigator.clipboard.writeText = (t) => { window.__copied = t; return write ? write(t) : Promise.resolve(); };
  });
  const cp = await cCtx.newPage();
  await cp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await cp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await cp.waitForTimeout(300);
  const sendBack = async (row) => {
    await cp.getByRole('button', { name: row }).first().click();
    await cp.waitForTimeout(300);
    await cp.getByRole('button', { name: 'I’ve sent it back' }).click().catch(() => {});
    await cp.waitForTimeout(300);
  };
  await sendBack(/Zara, Wool/);
  const add = cp.getByRole('button', { name: 'Add the tracking number' });
  let seen = { offered: (await add.count()) === 1 };
  if (seen.offered) {
    await add.click();
    await cp.getByLabel('Tracking or proof-of-postage number').fill('X'.repeat(41));
    seen.tooLongRefused = /Longer than any tracking number/.test(await cp.locator('main').innerText());
    await cp.getByLabel('Tracking or proof-of-postage number').fill('  JD0002  1234 ');
    await cp.getByRole('button', { name: 'Save', exact: true }).click();
    await cp.waitForTimeout(300);
    const detail = await cp.locator('main').innerText();
    seen.shown = /Tracking · JD0002 1234/.test(detail);
    seen.notYetLate = (await cp.locator('[data-refund-chase]').count()) === 0;
    await cp.getByRole('button', { name: 'Back', exact: true }).click();
    await cp.waitForTimeout(300);
    await sendBack(/Currys, JBL/);
    await cp.getByRole('button', { name: 'Back', exact: true }).click();
    await cp.waitForTimeout(300);
    // Three weeks on: the Zara order went back ten days after it was placed,
    // the headphones over a counter. Both refunds are now late.
    await cp.evaluate(() => {
      const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
      const s = JSON.parse(localStorage.getItem('kept.v1'));
      for (const r of s.receipts) {
        if (r.id === 'seed_zara') Object.assign(r, { purchasedOn: iso(30), windowStartsOn: iso(29), sentOn: iso(20) });
        if (r.id === 'seed_currys') Object.assign(r, { purchasedOn: iso(25), sentOn: iso(15) });
      }
      localStorage.setItem('kept.v1', JSON.stringify(s));
    });
    await cp.reload({ waitUntil: 'networkidle' });
    await cp.waitForTimeout(300);
    seen.listed = (await cp.getByRole('button', { name: /Zara, Wool.*refund late/ }).count()) === 1 &&
      (await cp.getByRole('button', { name: /waiting for the refund/ }).count()) === 0;
    const chaseFor = async (row) => {
      await cp.getByRole('button', { name: row }).first().click();
      await cp.waitForTimeout(300);
      const panel = await cp.locator('[data-refund-chase]').innerText().catch(() => '');
      const letter = await cp.locator('[data-refund-chase]').getByLabel('The letter').innerText().catch(() => '');
      await cp.getByRole('button', { name: 'Copy the letter' }).click().catch(() => {});
      await cp.waitForTimeout(200);
      const copied = await cp.evaluate(() => window.__copied ?? null);
      await cp.getByRole('button', { name: 'Back', exact: true }).click();
      await cp.waitForTimeout(300);
      return { panel: /The refund is late/.test(panel), letter, copied: copied === letter };
    };
    seen.online = await chaseFor(/Zara, Wool/);
    seen.counter = await chaseFor(/Currys, JBL/);
  }
  const ok =
    seen.offered && seen.tooLongRefused && seen.shown && seen.notYetLate && seen.listed &&
    seen.online?.panel && /regulation 34/.test(seen.online.letter) && /The tracking reference is JD0002 1234\./.test(seen.online.letter) && seen.online.copied &&
    seen.counter?.panel && /Please make it now, or tell me why/.test(seen.counter.letter) && !/regulation|cancel/i.test(seen.counter.letter);
  results['a late refund is chased in a letter, citing the regulations only where they apply, with the tracking number kept'] = !!ok;
  if (!ok) problems.push(`refund chase: ${JSON.stringify(seen)?.slice(0, 400)}`);
  await cCtx.close();
}

/*
 * The order number. The parser read past it on purpose (it looks like a
 * price) and then threw it away, while returns forms, chat windows and the
 * letter to the shop all ask for it first. Read from a labelled line, it is
 * shown before save, kept on the receipt, and quoted in the letter.
 */
{
  const oCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const op = await oCtx.newPage();
  await op.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await op.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await op.getByRole('button', { name: 'Add a receipt' }).click();
  await op.locator('#paste').fill('Your John Lewis order\nOrder number: 12345678\nOrder placed 21 September 2026\nSony headphones £349.00\nOrder total: £349.00');
  await op.getByRole('button', { name: 'Read it' }).click();
  await op.waitForTimeout(300);
  const card = await op.locator('main').innerText();
  await op.getByRole('button', { name: 'Save receipt' }).click();
  await op.waitForTimeout(400);
  await op.getByRole('button', { name: /John Lewis/ }).first().click();
  await op.waitForTimeout(300);
  const detail = await op.locator('main').innerText();
  await op.getByRole('button', { name: 'Something wrong with it?' }).click();
  await op.waitForTimeout(200);
  const letter = await op.getByLabel('The letter').innerText().catch(() => '');
  results['the order number is read, kept, shown and quoted in the letter'] =
    /Order number\s*12345678/.test(card) && /Order 12345678/.test(detail) && /\nOrder number: 12345678\n/.test(letter);
  if (!results['the order number is read, kept, shown and quoted in the letter']) problems.push(`order number: ${JSON.stringify({ card: /12345678/.test(card), detail: /12345678/.test(detail), letter: letter.slice(0, 80) })}`);
  await oCtx.close();
}

/*
 * A basket, split by its own lines. The order lists three things; the card
 * says so before saving, and on the receipt "Split this receipt" offers each
 * as one tap — the name and price the order gave, not typed again — and the
 * part that comes out is that thing at that price, with the rest's total
 * down by the same.
 */
{
  const lCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const lp = await lCtx.newPage();
  await lp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await lp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await lp.getByRole('button', { name: 'Add a receipt' }).click();
  await lp.locator('#paste').fill('Boots\nThanks for your order\nOrder date: 21 September 2026\nNo7 serum £29.99\nToothbrush heads £12.98\nSPF 50 £11.99\nOrder total: £54.96');
  await lp.getByRole('button', { name: 'Read it' }).click();
  await lp.waitForTimeout(300);
  const card = await lp.locator('[data-lines]').innerText().catch(() => '');
  await lp.getByRole('button', { name: 'Save receipt' }).click();
  await lp.waitForTimeout(400);
  await lp.getByRole('button', { name: /^Boots, No7 serum/ }).first().click();
  await lp.waitForTimeout(300);
  await lp.getByRole('button', { name: 'Split this receipt' }).first().click();
  const offered = await lp.locator('[data-split-lines] button').allInnerTexts().catch(() => []);
  await lp.getByRole('button', { name: /^Split out Toothbrush heads/ }).click().catch(() => {});
  await lp.waitForTimeout(400);
  const part = await lp.locator('main').innerText();
  const stored = await lp.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.filter((r) => r.store === 'Boots' && !r.demo).map((r) => ({ item: r.item, amount: r.amount, lines: (r.lines ?? []).length })));
  results['a basket is split by its own lines, in one tap'] =
    /3 things on this receipt/.test(card) && offered.length === 3 &&
    /Toothbrush heads/.test(part) && /£12\.98/.test(part) &&
    stored.some((r) => r.item === 'Toothbrush heads' && r.amount === 1298 && r.lines === 0) &&
    stored.some((r) => r.item === 'No7 serum' && r.amount === 5496 - 1298 && r.lines === 2);
  if (!results['a basket is split by its own lines, in one tap']) problems.push(`lines: ${JSON.stringify({ card: card.slice(0, 80), offered, stored })}`);
  await lCtx.close();
}

/*
 * The quick actions under the balance each start the Add screen doing the
 * thing they name, within the same tap — so a browser still counts the file
 * picker as something the person asked for — and only once: coming back to
 * Add later from the tab bar does not open a picker nobody asked for.
 */
{
  const qCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const qp = await qCtx.newPage();
  await qp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await qp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  const chooserFrom = async (name) => {
    const chooser = qp.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null);
    await qp.getByRole('button', { name }).click();
    const c = await chooser;
    return c ? await c.element().evaluate((el) => `${el.id}|${el.accept}`) : null;
  };
  const scan = await chooserFrom('Scan a receipt');
  await qp.getByRole('button', { name: 'Receipts', exact: true }).click();
  const upload = await chooserFrom('Upload a PDF or email');
  await qp.getByRole('button', { name: 'Receipts', exact: true }).click();
  await qp.getByRole('button', { name: 'Paste an order email' }).click();
  await qp.waitForTimeout(200);
  const pasteFocused = await qp.evaluate(() => document.activeElement?.id === 'paste');
  // Back to Add from the tab bar: no picker this time.
  await qp.getByRole('button', { name: 'Receipts', exact: true }).click();
  const again = qp.waitForEvent('filechooser', { timeout: 1500 }).then(() => true).catch(() => false);
  await qp.getByRole('button', { name: 'Add a receipt' }).click();
  const reopened = await again;
  results['each quick action starts Add doing what it says, once'] =
    scan === 'add-photo|image/*' && /^add-file\|.*application\/pdf/.test(upload ?? '') && pasteFocused && !reopened;
  if (!results['each quick action starts Add doing what it says, once']) problems.push(`quick actions: ${JSON.stringify({ scan, upload, pasteFocused, reopened })}`);
  await qCtx.close();
}

/*
 * A figure the read was unsure of is marked on the card, and only that one.
 * A paste with no total line gives the largest figure as the total — a guess
 * — and the card says so beside it; a paste with a total line marks nothing.
 */
{
  const cCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const cp = await cCtx.newPage();
  await cp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await cp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await cp.getByRole('button', { name: 'Add a receipt' }).click();
  await cp.locator('#paste').fill('Argos\nOrder date: 21 September 2026\nKettle £29.00\nToaster £19.00\nDelivery £3.95');
  await cp.getByRole('button', { name: 'Read it' }).click();
  await cp.waitForTimeout(300);
  const guessed = await cp.locator('[data-check]').allInnerTexts().catch(() => []);
  const head = await cp.getByText(/to check$/).first().innerText().catch(() => '');
  await cp.locator('#paste').fill('Argos\nOrder date: 21 September 2026\nKettle £29.00\nOrder total: £29.00');
  await cp.getByRole('button', { name: 'Read it' }).click();
  await cp.waitForTimeout(300);
  const labelled = await cp.locator('[data-check]').count();
  results['a guessed total is marked to check, and a labelled one is not'] =
    guessed.length === 1 && /Total/.test(guessed[0]) && /£29\.00/.test(guessed[0]) && /largest figure/.test(guessed[0]) && /1 to check/.test(head) && labelled === 0;
  if (!results['a guessed total is marked to check, and a labelled one is not']) problems.push(`check: ${JSON.stringify({ guessed, head, labelled })}`);
  await cCtx.close();
}

/*
 * Store credit. A return that ended in credit rather than money had no way
 * to be said, and credit that lapses unspent is money lost as surely as a
 * missed window. It can be marked, dated from the credit note, and taken back.
 */
{
  const kCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const kp = await kCtx.newPage();
  await kp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await kp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await kp.getByRole('button', { name: /Currys, JBL/ }).first().click();
  await kp.getByRole('button', { name: 'Got my money back' }).click();
  await kp.waitForTimeout(300);
  await kp.getByRole('button', { name: 'Back to receipts' }).click();
  await kp.waitForTimeout(300);
  await kp.getByRole('button', { name: /Currys, JBL.*returned$/ }).click();
  await kp.waitForTimeout(300);
  const mark = kp.getByRole('button', { name: 'It came back as store credit' });
  const seen = { offered: (await mark.count()) === 1 };
  const stored = () => kp.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.find((r) => /JBL/.test(r.item)));
  if (seen.offered) {
    await mark.click();
    await kp.waitForTimeout(200);
    seen.said = /Store credit · £89\.00 at Currys/.test(await kp.locator('main').innerText());
    const today = await kp.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    const shift = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    await kp.locator('#credit-expires').fill(shift(today, -3));
    await kp.waitForTimeout(200);
    seen.beforeRefused = /It cannot run out before it was given/.test(await kp.locator('[data-credit]').innerText()) && (await stored())?.credit?.expires === undefined;
    await kp.locator('#credit-expires').fill(shift(today, 365));
    await kp.waitForTimeout(200);
    seen.dated = (await stored())?.credit?.expires === shift(today, 365);
    await kp.getByRole('button', { name: 'Back', exact: true }).click();
    await kp.waitForTimeout(300);
    seen.row = (await kp.getByRole('button', { name: /Currys, JBL.*£89\.00 in credit, returned$/ }).count()) === 1;
    await kp.getByRole('button', { name: /Currys, JBL.*returned$/ }).click();
    await kp.waitForTimeout(300);
    await kp.getByRole('button', { name: 'It was money after all' }).click();
    await kp.waitForTimeout(200);
    seen.undone = (await stored())?.credit === undefined && /Money back · £89\.00 recovered/.test(await kp.locator('main').innerText());
  }
  const ok = seen.offered && seen.said && seen.beforeRefused && seen.dated && seen.row && seen.undone;
  results['a refund that came as store credit can be said, dated from the note, and taken back'] = !!ok;
  if (!ok) problems.push(`store credit: ${JSON.stringify(seen)}`);
  await kCtx.close();
}

/*
 * A year of use. Money back and Keeping it only ever grow, and forty settled
 * rows sat below the deadlines that still needed something. Each shows its
 * latest three and "Show all N"; a list with one more than that is shown
 * whole, and a search shows everything it found.
 */
{
  const yCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const yp = await yCtx.newPage();
  await yp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await yp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await yp.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    const make = (i, status, extra) => ({
      id: `y${status}${i}`, store: `Shop ${status} ${i}`, item: `Thing ${i}`, cat: 'other', amount: 1000 + i,
      purchasedOn: '2026-01-10', windowDays: 28, policy: 'p', distance: false, status, ...extra,
    });
    s.receipts = [
      ...Array.from({ length: 6 }, (_, i) => make(i, 'returned', { returnedOn: `2026-02-${String(10 + i).padStart(2, '0')}` })),
      ...Array.from({ length: 4 }, (_, i) => make(i, 'kept', { keptOn: `2026-02-${String(10 + i).padStart(2, '0')}` })),
    ];
    localStorage.setItem('kept.v1', JSON.stringify(s));
  });
  await yp.reload({ waitUntil: 'networkidle' });
  await yp.waitForTimeout(300);
  const returnedRows = () => yp.getByRole('button', { name: /, returned$/ }).count();
  const more = yp.getByRole('button', { name: 'Show all 6' });
  const seen = {
    held: (await returnedRows()) === 3 && (await more.count()) === 1 && (await more.getAttribute('aria-expanded')) === 'false',
    latestFirst: /^Shop returned 5,/.test((await yp.getByRole('button', { name: /, returned$/ }).first().getAttribute('aria-label')) ?? ''),
    keptWhole: (await yp.getByRole('button', { name: /keeping it$/ }).count()) === 4 && (await yp.getByRole('button', { name: /^Show all 4$/ }).count()) === 0,
  };
  if (seen.held) {
    await more.click();
    await yp.waitForTimeout(200);
    seen.opened = (await returnedRows()) === 6 && (await yp.getByRole('button', { name: 'Show fewer' }).getAttribute('aria-expanded')) === 'true';
    await yp.getByRole('button', { name: 'Show fewer' }).click();
    await yp.waitForTimeout(200);
    seen.closed = (await returnedRows()) === 3;
    await yp.getByLabel(/Search/).first().fill('Shop returned 0');
    await yp.waitForTimeout(300);
    seen.searchFinds = (await returnedRows()) === 1 && /^Shop returned 0,/.test((await yp.getByRole('button', { name: /, returned$/ }).first().getAttribute('aria-label')) ?? '');
  }
  const ok = seen.held && seen.latestFirst && seen.keptWhole && seen.opened && seen.closed && seen.searchFinds;
  results['a long settled list shows its latest few, the rest a tap away, and a search finds any of them'] = !!ok;
  if (!ok) problems.push(`settled sections: ${JSON.stringify(seen)}`);
  await yCtx.close();
}

/*
 * Correcting what was read, and typing one in. The confirmation card's shop,
 * total and date were facts: a misread total could be fixed only by editing
 * the raw text and reading it again, or by saving and finding Edit — and with
 * no email and no paper there was no way in at all. "Correct it" turns the
 * rows into fields holding what was read; "Type it in yourself" opens the
 * same card blank, whose window follows the shop until the person sets one.
 */
{
  const tCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const tp = await tCtx.newPage();
  await tp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await tp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await tp.getByRole('button', { name: 'Add a receipt' }).click();
  await tp.locator('#paste').fill('Argos order · Kettle · Total £29.00 · 21 Aug 2026');
  await tp.getByRole('button', { name: 'Read it' }).click();
  await tp.waitForTimeout(300);
  const seen = { offered: (await tp.getByRole('button', { name: 'Something wrong? Correct it' }).count()) === 1 };
  const stored = (item) => tp.evaluate((i) => JSON.parse(localStorage.getItem('kept.v1')).receipts.find((r) => r.item === i), item);
  if (seen.offered) {
    await tp.getByRole('button', { name: 'Something wrong? Correct it' }).click();
    await tp.waitForTimeout(200);
    seen.heldWhatWasRead =
      (await tp.locator('#add-store').inputValue()) === 'Argos' && (await tp.locator('#add-total').inputValue()) === '29.00' &&
      (await tp.locator('#add-bought').inputValue()) === '2026-08-21' && (await tp.locator('#add-window').inputValue()) === '30';
    await tp.locator('#add-item').fill('Kettle');
    await tp.locator('#add-total').fill('19.00');
    await tp.getByRole('button', { name: 'Save receipt' }).click();
    await tp.waitForTimeout(400);
    const k = await stored('Kettle');
    seen.corrected = k?.amount === 1900 && k?.store === 'Argos' && k?.purchasedOn === '2026-08-21' && k?.windowDays === 30;
  }
  await tp.getByRole('button', { name: 'Add a receipt' }).click();
  await tp.waitForTimeout(200);
  const typeIt = tp.getByRole('button', { name: 'Type it in yourself' });
  seen.typeOffered = (await typeIt.count()) === 1;
  if (seen.typeOffered) {
    await typeIt.click();
    await tp.waitForTimeout(200);
    seen.blank = /^Type it in$/m.test(await tp.locator('main').innerText()) &&
      (await tp.getByRole('button', { name: 'Add the shop to save' }).isDisabled());
    await tp.locator('#add-item').fill('Face cream');
    await tp.locator('#add-store').fill('boots');
    await tp.locator('#add-total').fill('15');
    await tp.waitForTimeout(200);
    seen.followsShop = (await tp.locator('#add-window').inputValue()) === '35';
    await tp.locator('#add-window').fill('0');
    seen.zeroRefused = await tp.getByRole('button', { name: 'Fix the return window' }).isDisabled();
    await tp.locator('#add-window').fill('60');
    await tp.getByRole('button', { name: 'Save receipt' }).click();
    await tp.waitForTimeout(400);
    const today = await tp.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    const c = await stored('Face cream');
    seen.typed = c?.store === 'Boots' && c?.amount === 1500 && c?.windowDays === 60 && c?.purchasedOn === today;
  }
  const ok = seen.offered && seen.heldWhatWasRead && seen.corrected && seen.typeOffered && seen.blank && seen.followsShop && seen.zeroRefused && seen.typed;
  results['what was read can be corrected before saving, and a receipt can be typed in from nothing'] = !!ok;
  if (!ok) problems.push(`correct or type: ${JSON.stringify(seen)}`);
  await tCtx.close();
}

/*
 * On its way. The order email is when most people add a receipt, and it comes
 * before the parcel — while ASOS, Amazon and Apple count from the doormat. The
 * app counted from the order and said, deep in the detail, that this was a
 * floor. The row now says it is on its way, and one tap on the receipt moves
 * the window to the day it came.
 */
{
  const aCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const ap = await aCtx.newPage();
  await ap.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await ap.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await ap.waitForTimeout(300);
  const today = await ap.evaluate(() => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    s.receipts.push({
      id: 'r_asos', store: 'ASOS', item: 'Trainers', cat: 'clothing', amount: 6000, purchasedOn: iso(5),
      windowDays: 28, policy: 'ASOS · 28 days from delivery.', distance: true, status: 'active',
    });
    localStorage.setItem('kept.v1', JSON.stringify(s));
    return iso(0);
  });
  await ap.reload({ waitUntil: 'networkidle' });
  await ap.waitForTimeout(300);
  const row = ap.getByRole('button', { name: /^ASOS, Trainers/ });
  const seen = { listed: /^ASOS, Trainers \(on its way\), £60\.00, 23 days left$/.test((await row.getAttribute('aria-label').catch(() => '')) ?? '') };
  await row.click().catch(() => {});
  await ap.waitForTimeout(300);
  const tap = ap.getByRole('button', { name: 'It arrived today' });
  seen.offered = (await tap.count()) === 1;
  if (seen.offered) {
    await tap.click();
    await ap.waitForTimeout(300);
    seen.gone = (await ap.locator('[data-arrival]').count()) === 0;
    const stored = await ap.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.find((r) => r.id === 'r_asos'));
    seen.stored = stored?.arrivedOn === today && stored?.windowStartsOn === today;
    await ap.getByRole('button', { name: 'Back', exact: true }).click();
    await ap.waitForTimeout(300);
    seen.relisted = /^ASOS, Trainers, £60\.00, 28 days left$/.test((await row.getAttribute('aria-label').catch(() => '')) ?? '');
  }
  const ok = seen.listed && seen.offered && seen.gone && seen.stored && seen.relisted;
  results['an order on its way says so, and "It arrived today" starts the window at the doormat'] = !!ok;
  if (!ok) problems.push(`on its way: ${JSON.stringify(seen)}`);
  await aCtx.close();
}

/*
 * The celebration of a partial refund. The one-tap return records the whole
 * price, and the screen that follows it — the one that shows the figure, and
 * shares it — went straight back to the list, so "£89.00 back" was shown and
 * shared about a £30 refund. The figure can be corrected there, before the
 * share, and the share carries the corrected one.
 */
{
  const wCtx = await browser.newContext({ viewport: { width: 402, height: 874 }, permissions: ['clipboard-write'] });
  await wCtx.addInitScript(() => {
    // No share sheet here, so the win goes to the clipboard — caught on the way.
    delete Navigator.prototype.share;
    const write = navigator.clipboard?.writeText?.bind(navigator.clipboard);
    if (navigator.clipboard) navigator.clipboard.writeText = (t) => { window.__copied = t; return write ? write(t) : Promise.resolve(); };
  });
  const wp = await wCtx.newPage();
  await wp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await wp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await wp.getByRole('button', { name: /Currys, JBL/ }).first().click();
  await wp.getByRole('button', { name: 'Got my money back' }).click();
  await wp.waitForTimeout(400);
  const offer = wp.getByRole('button', { name: 'Not the full £89.00?' });
  const seen = { offered: (await offer.count()) === 1 };
  if (seen.offered) {
    await offer.click();
    await wp.getByLabel('How much came back?').fill('30');
    await wp.getByRole('button', { name: 'Save', exact: true }).click();
    await wp.waitForTimeout(300);
    const card = await wp.locator('main').innerText();
    seen.card = /Money back\s*£30\.00/.test(card) && /of the £89\.00 it cost/.test(card);
    await wp.getByRole('button', { name: 'Share', exact: true }).click();
    await wp.waitForTimeout(300);
    const copied = await wp.evaluate(() => window.__copied ?? '');
    seen.shared = /£30\.00/.test(copied) && !/£89\.00/.test(copied);
    const stored = await wp.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.find((r) => /JBL/.test(r.item)));
    seen.stored = stored?.refunded === 3000;
  }
  const ok = seen.offered && seen.card && seen.shared && seen.stored;
  results['a partial refund is corrected where it is celebrated, and the share says what came back'] = !!ok;
  if (!ok) problems.push(`celebrate partial: ${JSON.stringify(seen)}`);
  await wCtx.close();
}

/*
 * The receipt's actions, in the order a person needs them. "Got my money
 * back" led on every receipt — for an online order, before the parcel had
 * even gone — and Delete sat beside it as a pill of its own. The primary is
 * now the likelier next step for how it was bought, and Delete is last.
 */
{
  const aCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const ap = await aCtx.newPage();
  await ap.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await ap.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  const actions = async (row) => {
    await ap.getByRole('button', { name: row }).first().click();
    await ap.waitForTimeout(300);
    const out = await ap.evaluate(() => {
      const buttons = [...document.querySelectorAll('main button')].map((b) => ({ text: b.textContent.trim(), primary: b.classList.contains('k-primary') }));
      return { primary: buttons.filter((b) => b.primary).map((b) => b.text), last: buttons.at(-1)?.text };
    });
    await ap.getByRole('button', { name: 'Back', exact: true }).click();
    await ap.waitForTimeout(300);
    return out;
  };
  const counter = await actions(/Currys, JBL/);
  const online = await actions(/Zara, Wool/);
  const ok =
    counter.primary.includes('Got my money back') && !counter.primary.includes('I’ve sent it back') &&
    online.primary.includes('I’ve sent it back') && !online.primary.includes('Got my money back') &&
    counter.last === 'Delete' && online.last === 'Delete';
  results['a receipt leads with the likelier next step for how it was bought, and puts Delete last'] = !!ok;
  if (!ok) problems.push(`receipt actions: ${JSON.stringify({ counter, online })}`);
  await aCtx.close();
}

/*
 * Saved. The save dropped the person on the list with nothing to say it had
 * worked, or when it now has to go back by, and a receipt saved from the
 * wrong email could be taken out only by finding it and deleting it. The
 * list now says so, with the deadline, and offers it back.
 */
{
  const vCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const vp = await vCtx.newPage();
  await vp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await vp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  const count = () => vp.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.length);
  const before = await count();
  await vp.getByRole('button', { name: 'Add a receipt' }).click();
  await vp.locator('#paste').fill('Argos order · Kettle · Total £29.00 · 21 Sep 2026');
  await vp.getByRole('button', { name: 'Read it' }).click();
  await vp.waitForTimeout(300);
  await vp.locator('#add-item').fill('Kettle');
  await vp.getByRole('button', { name: 'Save receipt' }).click();
  await vp.waitForTimeout(400);
  const bar = vp.getByRole('status').filter({ hasText: /^Saved Kettle · return by / });
  const seen = { said: (await bar.count()) === 1, stored: (await count()) === before + 1 };
  if (seen.said) {
    await bar.getByRole('button', { name: 'Undo' }).click();
    await vp.waitForTimeout(300);
    seen.undone = (await count()) === before && (await vp.getByRole('button', { name: /Argos, Kettle/ }).count()) === 0;
    seen.gone = (await bar.count()) === 0;
  }
  const ok = seen.said && seen.stored && seen.undone && seen.gone;
  results['a save says so, with the deadline, and can be taken back'] = !!ok;
  if (!ok) problems.push(`saved: ${JSON.stringify(seen)}`);
  await vCtx.close();
}

/*
 * After the fault letter. It was drafted and then forgotten: nothing kept
 * that it went, and nothing asked whether the shop answered, though the
 * letter itself asks for a reply within a fortnight. Now "I've sent the letter"
 * records the day, the panel says when a reply was asked for, and once that
 * day passes it says where to go next.
 */
{
  const lCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const lp = await lCtx.newPage();
  await lp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await lp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await lp.getByRole('button', { name: /IKEA, MALM/ }).first().click();
  await lp.waitForTimeout(300);
  await lp.getByRole('button', { name: 'Something wrong with it?' }).click();
  await lp.getByLabel('What’s wrong with it?').fill('A drawer runner has snapped');
  const sentButton = lp.getByRole('button', { name: 'I’ve sent the letter' });
  const seen = { offered: (await sentButton.count()) === 1 };
  const stored = () => lp.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.find((r) => /MALM/.test(r.item)));
  if (seen.offered) {
    await sentButton.click();
    await lp.waitForTimeout(200);
    const today = await lp.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    const claim = (await stored())?.faultClaim;
    seen.recorded = claim?.sentOn === today && claim?.what === 'A drawer runner has snapped';
    seen.said = /Sent on .+, asking IKEA to reply by .+\./.test(await lp.locator('[data-fault-sent]').innerText().catch(() => '')) &&
      (await lp.getByRole('button', { name: 'Fault letter sent' }).count()) === 1;
    seen.notYet = !/No reply yet/.test(await lp.locator('[data-fault-sent]').innerText().catch(() => ''));
    // A fortnight and more on, with no reply.
    await lp.evaluate(() => {
      const d = new Date(); d.setDate(d.getDate() - 20);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const s = JSON.parse(localStorage.getItem('kept.v1'));
      for (const r of s.receipts) if (r.faultClaim) r.faultClaim.sentOn = iso;
      localStorage.setItem('kept.v1', JSON.stringify(s));
    });
    await lp.reload({ waitUntil: 'networkidle' });
    await lp.waitForTimeout(300);
    await lp.getByRole('button', { name: /IKEA, MALM/ }).first().click();
    await lp.waitForTimeout(300);
    await lp.getByRole('button', { name: 'Fault letter sent' }).click();
    await lp.waitForTimeout(200);
    seen.next = /No reply yet\? Citizens Advice’s consumer service can tell you what to do next\./.test(await lp.locator('[data-fault-sent]').innerText().catch(() => '')) &&
      (await lp.getByLabel('What’s wrong with it?').inputValue()) === 'A drawer runner has snapped';
    await lp.getByRole('button', { name: 'Not sent after all' }).click();
    await lp.waitForTimeout(200);
    seen.undone = (await stored())?.faultClaim === undefined && (await lp.getByRole('button', { name: 'Something wrong with it?' }).count()) === 1;
  }
  const ok = seen.offered && seen.recorded && seen.said && seen.notYet && seen.next && seen.undone;
  results['a sent fault letter is recorded, says when a reply is due, and where to go when none comes'] = !!ok;
  if (!ok) problems.push(`fault follow-up: ${JSON.stringify(seen)}`);
  await lCtx.close();
}

/*
 * The phone's own Back. The screens were never in the browser's history, so
 * on the web — an installed app on Android, or a tab — Back from a receipt or
 * from Edit left kept altogether. It now goes up one level, the app's own
 * Back button leaves no stray entry behind, and Back from the list still
 * leaves: going up is not the same as being trapped.
 */
{
  const bCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const bp = await bCtx.newPage();
  await bp.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
  await bp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await bp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await bp.waitForTimeout(300);
  const onHome = async () => (await bp.getByRole('button', { name: /Currys, JBL/ }).count()) > 0 && new URL(bp.url()).pathname === '/app/';
  const onDetail = async () => (await bp.getByRole('heading', { level: 1, name: 'Currys' }).count()) === 1;
  const back = async () => { await bp.goBack().catch(() => {}); await bp.waitForTimeout(400); };
  const seen = {};
  await bp.getByRole('button', { name: /Currys, JBL/ }).first().click();
  await bp.waitForTimeout(300);
  await bp.getByRole('button', { name: 'Edit', exact: true }).click();
  await bp.waitForTimeout(300);
  await back();
  seen.editToDetail = await onDetail();
  await back();
  seen.detailToHome = await onHome();
  // The app's own Back, then the browser's: one level each, no extra step.
  // Short, caught clicks: where Back has already left kept there is no row
  // to press, and that must read as this check failing, not as a timeout.
  const tap = (name) => bp.getByRole('button', { name, exact: true }).first().click({ timeout: 3000 }).then(() => true, () => false);
  seen.reopened = await tap(/Currys, JBL/);
  await bp.waitForTimeout(300);
  await tap('Back');
  await bp.waitForTimeout(400);
  seen.ownBack = await onHome();
  await back();
  seen.leaves = new URL(bp.url()).pathname === '/';
  const ok = seen.editToDetail && seen.detailToHome && seen.reopened && seen.ownBack && seen.leaves;
  results['the phone’s Back goes up a level, and leaves only from the list'] = !!ok;
  if (!ok) problems.push(`back: ${JSON.stringify(seen)}`);
  await bCtx.close();
}

/*
 * Coming up. Every dated thing ahead was already on its own receipt's screen,
 * and nothing put them side by side — "what do I have to do this month?"
 * meant opening every receipt. And the Watch tab was, until a real policy
 * change is published, all samples. It now opens on the next sixty days,
 * soonest first, each row opening its receipt.
 */
{
  const wCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const wp = await wCtx.newPage();
  await wp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await wp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await wp.getByRole('button', { name: /^Watch/ }).click();
  await wp.waitForTimeout(300);
  const rows = wp.getByRole('button', { name: /: Last day to return it\./ });
  const labels = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  const seen = {
    listed: labels.length >= 3,
    soonestFirst: /in 2 days: .*Currys, JBL/.test(labels[0] ?? ''),
  };
  if (seen.listed) {
    await rows.first().click();
    await wp.waitForTimeout(300);
    seen.opens = (await wp.getByRole('heading', { level: 1, name: 'Currys' }).count()) === 1;
  }
  const ok = seen.listed && seen.soonestFirst && seen.opens;
  results['the Watch tab opens on what is coming up, soonest first, and each row opens its receipt'] = !!ok;
  if (!ok) problems.push(`coming up: ${JSON.stringify({ ...seen, first: labels[0] })}`);
  await wCtx.close();
}

/*
 * A switch's name on one line. With the name and its status sharing the row
 * equally, "Blocked by your browser" split the name as well — "Deadline /
 * alerts" — on a phone. Nothing overflowed and no word was crushed, so no
 * sweep saw it; it was found by looking.
 */
{
  const tCtx = await browser.newContext({ viewport: { width: 320, height: 740 } });
  const tp = await tCtx.newPage();
  await tp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await tp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await tp.getByRole('button', { name: 'Settings', exact: true }).click();
  await tp.waitForTimeout(300);
  const lines = await tp.evaluate(() =>
    [...document.querySelectorAll('[role="switch"]')].map((sw) => {
      // The TEXT's line boxes: the span is a flex item, so its own box is
      // one rectangle however many lines the words take.
      const name = sw.querySelector('span');
      if (!name) return { name: null, lines: 0 };
      const range = document.createRange();
      range.selectNodeContents(name);
      const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
      return { name: name.textContent, lines: tops.size };
    }),
  );
  const ok = lines.length >= 2 && lines.every((l) => l.lines === 1);
  results['every switch in Settings keeps its name on one line, on a small phone'] = ok;
  if (!ok) problems.push(`switch names: ${JSON.stringify(lines)}`);
  await tCtx.close();
}

/*
 * Rights are shown while the thing is still with its owner. A returned
 * online order said "you can cancel for any reason until …, n days left"
 * about a right already used; one on its way back did the same. Bought three
 * days ago, so every right is live and only the status can hide them.
 */
{
  const rCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const rp = await rCtx.newPage();
  await rp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await rp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await rp.waitForTimeout(300);
  await rp.evaluate(() => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    const base = { cat: 'clothing', amount: 4000, purchasedOn: iso(3), arrivedOn: iso(2), windowDays: 28, policy: 'p', distance: true };
    s.receipts.push(
      { ...base, id: 'r_back', store: 'ASOS', item: 'Jacket', status: 'returned', sentOn: iso(1), returnedOn: iso(0) },
      { ...base, id: 'r_sent', store: 'Boohoo', item: 'Scarf', status: 'sent', sentOn: iso(1) },
      { ...base, id: 'r_kept', store: 'Next', item: 'Jumper', status: 'kept', keptOn: iso(0) },
    );
    localStorage.setItem('kept.v1', JSON.stringify(s));
  });
  await rp.reload({ waitUntil: 'networkidle' });
  await rp.waitForTimeout(300);
  const rightsOn = async (name, store) => {
    await rp.getByRole('button', { name }).first().click({ timeout: 3000 }).catch(() => {});
    await rp.waitForTimeout(300);
    const text = (await rp.locator('main').innerText().catch(() => '')) ?? '';
    const opened = (await rp.getByRole('heading', { level: 1, name: store }).count()) === 1;
    await rp.getByRole('button', { name: 'Back', exact: true }).click({ timeout: 3000 }).catch(() => {});
    await rp.waitForTimeout(300);
    return { opened, rights: /^Your legal rights?$/m.test(text), cancel: /cancel for any reason/i.test(text) };
  };
  const seen = { back: await rightsOn(/^ASOS, Jacket/, 'ASOS'), sent: await rightsOn(/^Boohoo, Scarf/, 'Boohoo'), kept: await rightsOn(/^Next, Jumper/, 'Next') };
  const ok = seen.back.opened && !seen.back.rights && !seen.back.cancel &&
    seen.sent.opened && !seen.sent.rights && !seen.sent.cancel &&
    seen.kept.opened && seen.kept.rights;
  results['a receipt that has gone back shows no live rights; a kept one keeps them'] = !!ok;
  if (!ok) problems.push(`settled rights: ${JSON.stringify(seen)}`);
  await rCtx.close();
}

/*
 * The samples, removed together. Their only way out was one at a time or
 * Erase everything, which takes the real receipts too. Not offered on the
 * list while the samples are all there is — then they ARE the app — and
 * offered once a real receipt sits beside them. A reload does not reseed.
 */
{
  const xCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const xp = await xCtx.newPage();
  await xp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await xp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await xp.waitForTimeout(300);
  const offer = () => xp.getByRole('button', { name: 'Remove the samples' });
  const stored = () => xp.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.map((r) => ({ id: r.id, demo: !!r.demo })));
  const seen = { notWhileAllSamples: (await offer().count()) === 0 };
  await xp.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    s.receipts.push({ id: 'r_mine', store: 'Argos', item: 'Desk lamp', cat: 'home', amount: 2500, purchasedOn: iso, windowDays: 30, policy: 'Argos.', distance: false, status: 'active' });
    localStorage.setItem('kept.v1', JSON.stringify(s));
  });
  await xp.reload({ waitUntil: 'networkidle' });
  await xp.waitForTimeout(300);
  seen.offered = (await offer().count()) === 1;
  await offer().click({ timeout: 3000 }).catch(() => {});
  await xp.waitForTimeout(300);
  const after = await stored();
  seen.onlyMine = after.length === 1 && after[0].id === 'r_mine';
  seen.listClean = !/sample ·/.test(await xp.locator('main').innerText()) && (await xp.getByRole('button', { name: /^Argos, Desk lamp/ }).count()) === 1;
  seen.offerGone = (await offer().count()) === 0;
  await xp.reload({ waitUntil: 'networkidle' });
  await xp.waitForTimeout(300);
  seen.noReseed = (await stored()).length === 1;
  // And Settings says nothing about samples that are not there.
  await xp.getByRole('button', { name: 'Settings', exact: true }).click({ timeout: 3000 }).catch(() => {});
  await xp.waitForTimeout(300);
  seen.settingsQuiet = !/Sample receipts/.test(await xp.locator('main').innerText());
  const ok = Object.values(seen).every(Boolean);
  results['the samples can be removed together, leaving the real receipts, and do not come back'] = ok;
  if (!ok) problems.push(`clear samples: ${JSON.stringify({ ...seen, after })}`);
  await xCtx.close();
}

/*
 * From Settings as well, where it is offered whenever there are samples:
 * someone who wants a clean list before adding anything should not have to
 * delete five receipts one at a time or erase the app to get it.
 */
{
  const yCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const yp = await yCtx.newPage();
  await yp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await yp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await yp.waitForTimeout(300);
  await yp.getByRole('button', { name: 'Settings', exact: true }).click({ timeout: 3000 }).catch(() => {});
  await yp.waitForTimeout(300);
  await yp.getByRole('button', { name: 'Remove the samples' }).click({ timeout: 3000 }).catch(() => {});
  await yp.waitForTimeout(300);
  const left = await yp.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.length);
  results['the samples can be removed from Settings before anything real is added'] = left === 0;
  if (left !== 0) problems.push(`clear samples from settings: ${left} left`);
  await yCtx.close();
}

/*
 * Store credit, spent. "Spend it before then" fired on credit used the week
 * it was given, and the only ways to stop it made the record false. Spent
 * is recorded, survives a reload — the stored copy goes through the same
 * sanitiser a backup does — drops out of what is coming up, and can be
 * taken back.
 */
{
  const cCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const cp = await cCtx.newPage();
  await cp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await cp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await cp.waitForTimeout(300);
  await cp.evaluate(() => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    s.receipts.push({ id: 'r_credit', store: 'Next', item: 'Rain jacket', cat: 'clothing', amount: 5000, purchasedOn: iso(-20), windowDays: 28, policy: 'p', distance: false, status: 'returned', returnedOn: iso(-2), credit: { expires: iso(20) } });
    localStorage.setItem('kept.v1', JSON.stringify(s));
  });
  await cp.reload({ waitUntil: 'networkidle' });
  await cp.waitForTimeout(300);
  const credit = () => cp.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.find((r) => r.id === 'r_credit')?.credit);
  const listed = async () => {
    await cp.getByRole('button', { name: /^Watch/ }).click({ timeout: 3000 }).catch(() => {});
    await cp.waitForTimeout(300);
    const n = await cp.getByRole('button', { name: /Store credit runs out/ }).count();
    await cp.getByRole('button', { name: 'Receipts', exact: true }).click({ timeout: 3000 }).catch(() => {});
    await cp.waitForTimeout(300);
    return n;
  };
  const open = async () => {
    await cp.getByRole('button', { name: /^Next, Rain jacket/ }).first().click({ timeout: 3000 }).catch(() => {});
    await cp.waitForTimeout(300);
  };
  const seen = { listedBefore: (await listed()) === 1 };
  await open();
  seen.spentTap = await cp.getByRole('button', { name: 'I’ve spent it' }).click({ timeout: 3000 }).then(() => true, () => false);
  await cp.waitForTimeout(300);
  seen.recorded = !!(await credit())?.spentOn;
  await cp.reload({ waitUntil: 'networkidle' });
  await cp.waitForTimeout(300);
  seen.survives = !!(await credit())?.spentOn;
  seen.notListed = (await listed()) === 0;
  await open();
  seen.says = /Store credit · spent/.test(await cp.locator('main').innerText());
  await cp.getByRole('button', { name: 'Not spent after all' }).click({ timeout: 3000 }).catch(() => {});
  await cp.waitForTimeout(300);
  const back = await credit();
  seen.takenBack = back?.spentOn === undefined && !!back?.expires;
  const ok = Object.values(seen).every(Boolean);
  results['store credit can be marked spent, which stops its reminder and survives a reload'] = ok;
  if (!ok) problems.push(`credit spent: ${JSON.stringify({ ...seen, back })}`);
  await cCtx.close();
}

/*
 * Three places the lifecycle said something false, found by an audit.
 * The headline was `active[0]`, samples included: somebody who had just
 * saved their first purchase read "£89.00 back if it goes back by…" about
 * headphones nobody bought, unlabelled. A swipe on an ONLINE order recorded
 * the money as back — the receipt's own screen leads with "I've sent it
 * back" for exactly that order. And "Not actually returned" on a receipt
 * that was posted first sent it to active, wiping the day it went.
 */
{
  const sCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const sp = await sCtx.newPage();
  await sp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await sp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await sp.waitForTimeout(300);
  const hero = () => sp.getByRole('button', { name: /Next to close|Window closed/ }).first().innerText().catch(() => '');
  const zara = async () => (await sp.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.find((r) => r.id === 'seed_zara')));
  const tap = (name) => sp.getByRole('button', { name }).first().click({ timeout: 3000 }).then(() => true, () => false);
  const seen = {};
  const before = await hero();
  seen.sampleSaysSo = /Sample · /.test(before);
  const today = await sp.evaluate(() => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    // Real, and later than every sample: only the samples-first rule puts
    // a sample above it.
    s.receipts.push({ id: 'r_argos', store: 'Argos', item: 'Desk lamp', cat: 'home', amount: 2500, purchasedOn: iso(0), windowDays: 60, policy: 'Argos.', distance: false, status: 'active' });
    localStorage.setItem('kept.v1', JSON.stringify(s));
    return iso(0);
  });
  await sp.reload({ waitUntil: 'networkidle' });
  await sp.waitForTimeout(300);
  const after = await hero();
  seen.realLeads = /Argos/.test(after) && !/Sample/.test(after);

  // Swipe the online order.
  const swipe = async () => {
    const row = sp.getByRole('button', { name: /^Zara, Wool-blend/ }).first();
    // Into the middle of the list first, as a thumb would: the tab bar is
    // docked across the full width now, so a row left half under it takes
    // the press on the bar instead.
    await row.evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => {});
    await sp.waitForTimeout(150);
    const box = await row.boundingBox();
    if (!box) return;
    const y = box.y + box.height / 2;
    await sp.mouse.move(box.x + box.width - 40, y);
    await sp.mouse.down();
    for (let dx = 0; dx <= 110; dx += 22) { await sp.mouse.move(box.x + box.width - 40 - dx, y); await sp.waitForTimeout(30); }
    await sp.mouse.up();
    await sp.waitForTimeout(500);
  };
  await swipe();
  let z = await zara();
  const bar = (await sp.locator('[role="status"]').allInnerTexts()).join(' ');
  seen.swipeSends = z?.status === 'sent' && z?.sentOn === today && !/^Money back$/m.test(await sp.locator('main').innerText());
  seen.offeredBack = /Marked Wool-blend overcoat sent back/.test(bar);
  await tap('Undo');
  await sp.waitForTimeout(400);
  z = await zara();
  seen.undone = z?.status === 'active' && z?.sentOn === undefined;

  // Posted, then refunded, then the refund taken back: one step, to waiting.
  await swipe();
  await sp.getByRole('button', { name: /^Zara, Wool-blend/ }).first().click({ timeout: 3000 }).catch(() => {});
  await sp.waitForTimeout(300);
  await tap('Add the tracking number');
  await sp.getByLabel('Tracking or proof-of-postage number').fill('JD0002', { timeout: 3000 }).catch(() => {});
  await sp.getByLabel('Tracking or proof-of-postage number').press('Enter').catch(() => {});
  await sp.waitForTimeout(200);
  seen.tracked = (await zara())?.returnRef === 'JD0002';
  await tap('Got my money back');
  await sp.waitForTimeout(400);
  await tap('Back to receipts');
  await sp.waitForTimeout(300);
  // With the bar up, the row just marked is the one a person reaches for,
  // and the list scrolled to its end must put it clear of the bar.
  seen.clearOfBar = await sp.evaluate(() => {
    const row = [...document.querySelectorAll('button')].find((b) => /^Zara, Wool-blend/.test(b.getAttribute('aria-label') ?? ''));
    let el = row?.parentElement;
    while (el && !(el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
    if (!row || !el || !document.querySelector('[role="status"] button')) return false;
    el.scrollTop = el.scrollHeight;
    const r = row.getBoundingClientRect();
    return row.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  });
  await sp.getByRole('button', { name: /^Zara, Wool-blend/ }).first().click({ timeout: 3000 }).catch(() => {});
  await sp.waitForTimeout(300);
  const posted = (await zara())?.sentOn;
  seen.refunded = (await zara())?.status === 'returned';
  seen.saysWhat = await tap('The refund hasn’t come');
  await sp.waitForTimeout(300);
  z = await zara();
  seen.backToWaiting = z?.status === 'sent' && z?.sentOn === posted && !!posted && z?.returnRef === 'JD0002';
  const ok = seen.sampleSaysSo && seen.realLeads && seen.swipeSends && seen.offeredBack && seen.undone && seen.tracked && seen.clearOfBar && seen.refunded && seen.saysWhat && seen.backToWaiting;
  results['the headline is a real receipt, a swipe sends an online order back, the list clears the undo bar, and a refund taken back leaves the posting'] = !!ok;
  if (!ok) problems.push(`lifecycle: ${JSON.stringify({ ...seen, before: before.slice(0, 80), after: after.slice(0, 80), bar: bar.slice(0, 80), z })}`);
  await sCtx.close();
}

/*
 * Cancelling an online order in writing. Cancelling is telling the shop,
 * and kept recorded only the posting, so it never knew the day the fourteen
 * to send it back count from. The notice is offered while the period runs,
 * the day it went is kept across a reload, the receipt then says when the
 * parcel must go by, and a counter purchase is offered nothing.
 */
{
  const nCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const np = await nCtx.newPage();
  await np.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await np.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await np.waitForTimeout(300);
  const today = await np.evaluate(() => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    s.receipts.push(
      { id: 'r_online', store: 'ASOS', item: 'Trainers', cat: 'clothing', amount: 6000, purchasedOn: iso(3), arrivedOn: iso(2), windowDays: 28, policy: 'p', distance: true, status: 'active', orderRef: 'AS-123' },
      { id: 'r_counter', store: 'Boots', item: 'Hairdryer', cat: 'other', amount: 3000, purchasedOn: iso(3), windowDays: 35, policy: 'p', distance: false, status: 'active' },
    );
    localStorage.setItem('kept.v1', JSON.stringify(s));
    return iso(0);
  });
  await np.reload({ waitUntil: 'networkidle' });
  await np.waitForTimeout(300);
  const open = async (name) => { await np.getByRole('button', { name }).first().click({ timeout: 3000 }).catch(() => {}); await np.waitForTimeout(300); };
  const back = async () => { await np.getByRole('button', { name: 'Back', exact: true }).click({ timeout: 3000 }).catch(() => {}); await np.waitForTimeout(300); };
  const stored = () => np.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.find((r) => r.id === 'r_online')?.cancelledOn);
  const seen = {};
  await open(/^Boots, Hairdryer/);
  seen.counterNone = (await np.getByRole('button', { name: 'Cancel the order in writing' }).count()) === 0;
  await back();
  await open(/^ASOS, Trainers/);
  await np.getByRole('button', { name: 'Cancel the order in writing' }).click({ timeout: 3000 }).catch(() => {});
  await np.waitForTimeout(300);
  const panel = (await np.locator('[data-cancel-panel]').innerText().catch(() => '')) ?? '';
  seen.letter = /Dear ASOS,/.test(panel) && /Order number: AS-123/.test(panel) && /regulation 34/.test(panel);
  await np.getByRole('button', { name: 'I’ve sent the notice' }).click({ timeout: 3000 }).catch(() => {});
  await np.waitForTimeout(300);
  seen.recorded = (await stored()) === today;
  await np.reload({ waitUntil: 'networkidle' });
  await np.waitForTimeout(300);
  seen.survives = (await stored()) === today;
  await open(/^ASOS, Trainers/);
  await np.getByRole('button', { name: 'Order cancelled' }).click({ timeout: 3000 }).catch(() => {});
  await np.waitForTimeout(300);
  seen.sendBy = /Send it back by .+ — the law gives fourteen days from cancelling\./.test((await np.locator('[data-cancel-sent]').innerText().catch(() => '')) ?? '');
  await np.getByRole('button', { name: 'Not sent after all' }).click({ timeout: 3000 }).catch(() => {});
  await np.waitForTimeout(300);
  seen.takenBack = (await stored()) === undefined;
  const ok = Object.values(seen).every(Boolean);
  results['an online order can be cancelled in writing, and the day it went decides when it must go back'] = ok;
  if (!ok) problems.push(`cancel notice: ${JSON.stringify({ ...seen, panel: panel.slice(0, 120) })}`);
  await nCtx.close();
}

/*
 * After the repair. The fault letter promised what came next — a refund if a
 * repair or replacement did not put it right (section 24) — and nothing in
 * the app followed it. Once a fault letter has gone, the next one is there.
 */
{
  const fCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const fp = await fCtx.newPage();
  await fp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await fp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await fp.waitForTimeout(300);
  await fp.evaluate(() => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    s.receipts.push({ id: 'r_fault', store: 'Currys', item: 'Kettle', cat: 'kitchen', amount: 4000, purchasedOn: iso(60), windowDays: 30, policy: 'p', distance: false, status: 'kept', keptOn: iso(55), faultClaim: { sentOn: iso(40), what: 'It trips the fuse' } });
    localStorage.setItem('kept.v1', JSON.stringify(s));
  });
  await fp.reload({ waitUntil: 'networkidle' });
  await fp.waitForTimeout(300);
  await fp.getByRole('button', { name: /^Currys, Kettle/ }).first().click({ timeout: 3000 }).catch(() => {});
  await fp.waitForTimeout(300);
  await fp.getByRole('button', { name: 'Fault letter sent' }).click({ timeout: 3000 }).catch(() => {});
  await fp.waitForTimeout(300);
  const seen = {};
  seen.tapped = await fp.getByRole('button', { name: 'It was repaired or replaced, and it’s still not right' }).click({ timeout: 3000 }).then(() => true, () => false);
  await fp.waitForTimeout(300);
  await fp.getByLabel(/what’s wrong with it now/i).fill('Still trips it', { timeout: 3000 }).catch(() => {});
  await fp.waitForTimeout(200);
  const text = (await fp.locator('[data-final-reject]').innerText().catch(() => '')) ?? '';
  seen.letter = /Final right to reject: Kettle/.test(text) && /section 24\(5\)/.test(text) && /The problem now: Still trips it\./.test(text) && /section 24\(10\)/.test(text);
  const ok = Object.values(seen).every(Boolean);
  results['after a fault letter, the final right to reject is one tap away'] = ok;
  if (!ok) problems.push(`final reject: ${JSON.stringify({ ...seen, text: text.slice(0, 160) })}`);
  await fCtx.close();
}

/*
 * When the shop will not pay. The refund chase and an unanswered fault
 * letter both ended at the shop; the card's two doors — Section 75 where the
 * price fits, a chargeback always — are now set out beside them.
 */
{
  const eCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const ep = await eCtx.newPage();
  await ep.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await ep.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await ep.waitForTimeout(300);
  await ep.evaluate(() => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    s.receipts.push(
      { id: 'r_late', store: 'Argos', item: 'Blender', cat: 'kitchen', amount: 15000, purchasedOn: iso(40), windowDays: 30, policy: 'p', distance: false, status: 'sent', sentOn: iso(20) },
      { id: 'r_small', store: 'Argos', item: 'Toaster', cat: 'kitchen', amount: 4000, purchasedOn: iso(40), windowDays: 30, policy: 'p', distance: false, status: 'sent', sentOn: iso(20) },
      { id: 'r_quiet', store: 'Currys', item: 'Kettle', cat: 'kitchen', amount: 4000, purchasedOn: iso(60), windowDays: 30, policy: 'p', distance: false, status: 'kept', keptOn: iso(55), faultClaim: { sentOn: iso(20) } },
    );
    localStorage.setItem('kept.v1', JSON.stringify(s));
  });
  await ep.reload({ waitUntil: 'networkidle' });
  await ep.waitForTimeout(300);
  const escalationOn = async (name, toggle) => {
    await ep.getByRole('button', { name }).first().click({ timeout: 3000 }).catch(() => {});
    await ep.waitForTimeout(300);
    if (toggle) { await ep.getByRole('button', { name: toggle }).click({ timeout: 3000 }).catch(() => {}); await ep.waitForTimeout(300); }
    const t = (await ep.locator('[data-escalation]').innerText().catch(() => '')) ?? '';
    await ep.getByRole('button', { name: 'Back', exact: true }).click({ timeout: 3000 }).catch(() => {});
    await ep.waitForTimeout(300);
    return t;
  };
  const big = await escalationOn(/^Argos, Blender/);
  const small = await escalationOn(/^Argos, Toaster/);
  const quiet = await escalationOn(/^Currys, Kettle/, 'Fault letter sent');
  const seen = {
    big: /Section 75/.test(big) && /£150\.00/.test(big) && /chargeback/.test(big),
    small: !/Section 75/.test(small) && /chargeback/.test(small),
    quiet: /chargeback/.test(quiet),
  };
  const ok = Object.values(seen).every(Boolean);
  results['a late refund and an unanswered fault letter set out Section 75 and chargeback'] = ok;
  if (!ok) problems.push(`escalation: ${JSON.stringify({ ...seen, big: big.slice(0, 80), small: small.slice(0, 80), quiet: quiet.slice(0, 80) })}`);
  await eCtx.close();
}

/*
 * Swapped for another. A swap had no way to be said, so it was recorded as
 * kept or as a refund — both false, and the refund counted money that never
 * came. The one that went back is settled with nothing recovered, the one
 * that came home opens as a receipt of its own, and it can be taken back.
 */
{
  const wCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const wp = await wCtx.newPage();
  await wp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await wp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await wp.waitForTimeout(300);
  await wp.evaluate(() => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    s.receipts.push({ id: 'r_jeans', store: 'Next', item: 'Jeans, 32 waist', cat: 'clothing', amount: 4000, purchasedOn: iso(4), windowDays: 28, policy: 'p', distance: false, status: 'active' });
    localStorage.setItem('kept.v1', JSON.stringify(s));
  });
  await wp.reload({ waitUntil: 'networkidle' });
  await wp.waitForTimeout(300);
  const stored = () => wp.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.filter((r) => r.id === 'r_jeans' || r.swappedFrom === 'r_jeans'));
  await wp.getByRole('button', { name: /^Next, Jeans/ }).first().click({ timeout: 3000 }).catch(() => {});
  await wp.waitForTimeout(300);
  const seen = {};
  seen.tapped = await wp.getByRole('button', { name: 'Swapped it for another' }).click({ timeout: 3000 }).then(() => true, () => false);
  await wp.waitForTimeout(300);
  seen.swapInOpen = /keeps that receipt’s dates/.test((await wp.locator('[data-swap-in]').innerText().catch(() => '')) ?? '');
  const after = await stored();
  const orig = after.find((r) => r.id === 'r_jeans');
  const swapIn = after.find((r) => r.swappedFrom === 'r_jeans');
  seen.settled = orig?.status === 'returned' && orig?.exchanged === true;
  seen.copied = !!swapIn && swapIn.status === 'active' && swapIn.purchasedOn === orig?.purchasedOn;
  await wp.getByRole('button', { name: 'Back', exact: true }).click({ timeout: 3000 }).catch(() => {});
  await wp.waitForTimeout(300);
  seen.rowSays = (await wp.getByRole('button', { name: /^Next, Jeans, 32 waist, swapped for another$/ }).count()) === 1;
  await wp.getByRole('button', { name: /swapped for another$/ }).first().click({ timeout: 3000 }).catch(() => {});
  await wp.waitForTimeout(300);
  await wp.getByRole('button', { name: 'Not swapped after all' }).click({ timeout: 3000 }).catch(() => {});
  await wp.waitForTimeout(300);
  const undone = await stored();
  seen.undone = undone.length === 1 && undone[0].status === 'active' && undone[0].exchanged === undefined;
  const ok = Object.values(seen).every(Boolean);
  results['a swap settles the one that went back with nothing recovered, opens the one that came home, and can be taken back'] = ok;
  if (!ok) problems.push(`swap: ${JSON.stringify({ ...seen, after, undone })}`);
  await wCtx.close();
}

/*
 * A swap is not taken back over what happened to the one that came home.
 * "Not swapped after all" removed every receipt the swap had produced,
 * whatever its state: swap the jeans, get the money back for the second pair,
 * tap it on the first, and the refund was deleted with the receipt it was on,
 * with no undo. It is refused now, and the screen says why; once the second
 * pair is back in hand the swap can be taken back, and that is offered back
 * from the bar like every other tap that removes a receipt.
 */
{
  const xCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const xp = await xCtx.newPage();
  await xp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await xp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await xp.waitForTimeout(300);
  await xp.evaluate(() => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    s.receipts.push({ id: 'r_jeans', store: 'Next', item: 'Jeans, 32 waist', cat: 'clothing', amount: 4000, purchasedOn: iso(4), windowDays: 28, policy: 'p', distance: false, status: 'active' });
    localStorage.setItem('kept.v1', JSON.stringify(s));
  });
  await xp.reload({ waitUntil: 'networkidle' });
  await xp.waitForTimeout(300);
  const stored = () => xp.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.filter((r) => r.id === 'r_jeans' || r.swappedFrom === 'r_jeans'));
  const original = () => xp.getByRole('button', { name: /^Next, Jeans, 32 waist, swapped for another$/ }).first().click({ timeout: 3000 }).catch(() => {});
  const seen = {};
  await xp.getByRole('button', { name: /^Next, Jeans/ }).first().click({ timeout: 3000 }).catch(() => {});
  await xp.waitForTimeout(300);
  await xp.getByRole('button', { name: 'Swapped it for another' }).click({ timeout: 3000 }).catch(() => {});
  await xp.waitForTimeout(300);
  // The second pair goes back for its money.
  await xp.getByRole('button', { name: 'Got my money back' }).click({ timeout: 3000 }).catch(() => {});
  await xp.waitForTimeout(400);
  await xp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await original();
  await xp.waitForTimeout(300);
  const said = (await xp.locator('main').innerText().catch(() => '')) ?? '';
  seen.said = /has gone back since\. To take this swap back, undo that on its own receipt first\./.test(said);
  // Tapped if it is there, as a person would: the question is what is left.
  const offered = await xp.getByRole('button', { name: 'Not swapped after all' }).count();
  if (offered) await xp.getByRole('button', { name: 'Not swapped after all' }).click({ timeout: 3000 }).catch(() => {});
  await xp.waitForTimeout(300);
  let rows = await stored();
  seen.notOffered = offered === 0;
  seen.refundKept =
    rows.length === 2 &&
    rows.some((r) => r.id === 'r_jeans' && r.status === 'returned' && r.exchanged === true) &&
    rows.some((r) => r.swappedFrom === 'r_jeans' && r.status === 'returned' && r.exchanged !== true);
  // The way back: the second pair back in hand on its own screen, then the swap.
  await xp.getByRole('button', { name: 'Open that receipt' }).click({ timeout: 3000 }).catch(() => {});
  await xp.waitForTimeout(300);
  await xp.getByRole('button', { name: 'Not actually returned' }).click({ timeout: 3000 }).catch(() => {});
  await xp.waitForTimeout(300);
  await xp.getByRole('button', { name: 'Back', exact: true }).click({ timeout: 3000 }).catch(() => {});
  await xp.waitForTimeout(300);
  await original();
  await xp.waitForTimeout(300);
  await xp.getByRole('button', { name: 'Not swapped after all' }).click({ timeout: 3000 }).catch(() => {});
  await xp.waitForTimeout(300);
  rows = await stored();
  seen.takenBack = rows.length === 1 && rows[0].status === 'active';
  seen.bar = (await xp.getByRole('status').allTextContents()).some((t) => /Marked Jeans, 32 waist not swapped/.test(t));
  await xp.getByRole('button', { name: 'Undo', exact: true }).click({ timeout: 3000 }).catch(() => {});
  await xp.waitForTimeout(300);
  rows = await stored();
  seen.undone =
    rows.length === 2 &&
    rows.some((r) => r.id === 'r_jeans' && r.status === 'returned' && r.exchanged === true) &&
    rows.some((r) => r.swappedFrom === 'r_jeans' && r.status === 'active');
  const ok = Object.values(seen).every(Boolean);
  results['a swap is not taken back over a refund on the one that came home, and taking one back can be undone'] = ok;
  if (!ok) problems.push(`unswap: ${JSON.stringify({ ...seen, offered, rows, said: said.slice(0, 200) })}`);
  await xCtx.close();
}

/*
 * One thing out of a basket. A receipt holds one item and one amount, and
 * returning one thing from three settled the whole receipt — the two that
 * stayed lost their guarantee reminder and their fault letter with it.
 */
{
  const sCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const sp = await sCtx.newPage();
  await sp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await sp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await sp.waitForTimeout(300);
  await sp.evaluate(() => {
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    s.receipts.push({ id: 'r_basket', store: 'Boots', item: 'Shopping', cat: 'beauty', amount: 6000, purchasedOn: iso(3), windowDays: 35, policy: 'p', distance: false, status: 'active', warranty: { months: 24 } });
    localStorage.setItem('kept.v1', JSON.stringify(s));
  });
  await sp.reload({ waitUntil: 'networkidle' });
  await sp.waitForTimeout(300);
  const stored = () => sp.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.filter((r) => r.id === 'r_basket' || r.splitFrom === 'r_basket'));
  await sp.getByRole('button', { name: /^Boots, Shopping/ }).first().click({ timeout: 3000 }).catch(() => {});
  await sp.waitForTimeout(300);
  const seen = {};
  seen.offered = await sp.getByRole('button', { name: 'Split this receipt' }).click({ timeout: 3000 }).then(() => true, () => false);
  await sp.waitForTimeout(200);
  await sp.getByLabel('What is it?').fill('Hairdryer', { timeout: 3000 }).catch(() => {});
  await sp.getByLabel('What did it cost?').fill('25', { timeout: 3000 }).catch(() => {});
  await sp.getByRole('button', { name: 'Split it out' }).click({ timeout: 3000 }).catch(() => {});
  await sp.waitForTimeout(400);
  let rows = await stored();
  const rest = rows.find((r) => r.id === 'r_basket');
  const part = rows.find((r) => r.splitFrom === 'r_basket');
  seen.split = rest?.amount === 3500 && part?.amount === 2500 && part?.item === 'Hairdryer' && part?.purchasedOn === rest?.purchasedOn && part?.warranty?.months === 24;
  seen.partOpen = /Split out of the Boots receipt for Shopping\./.test((await sp.locator('[data-split-part]').innerText().catch(() => '')) ?? '');
  // The part goes back on its own; the rest stays in hand with its guarantee.
  await sp.getByRole('button', { name: 'Got my money back' }).click({ timeout: 3000 }).catch(() => {});
  await sp.waitForTimeout(400);
  rows = await stored();
  seen.partAlone = rows.find((r) => r.splitFrom === 'r_basket')?.status === 'returned' && rows.find((r) => r.id === 'r_basket')?.status === 'active';
  const ok = Object.values(seen).every(Boolean);
  results['a basket can be split, and one thing returned while the rest stays in hand'] = ok;
  if (!ok) problems.push(`split: ${JSON.stringify({ ...seen, rows })}`);
  await sCtx.close();
}

// The tab bar floats over every screen; its buttons must stay clickable.
await page.getByRole('button', { name: 'Back to receipts' }).click();
await page.waitForTimeout(400);

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
/*
 * Asked here, at the first launch that reads onboardingSeen off the disk,
 * rather than two hundred lines further down where it used to sit.
 *
 * Down there it could only be reached in the world where it passed. Breaking
 * it — `onboardingSeen || embedded` flipped to `&&`, so a returning visitor
 * gets the welcome again every time — brought onboarding back over the
 * receipts list, and the suite died eleven lines later on a row it could no
 * longer see: `locator.click: Timeout 30000ms exceeded`. A Playwright timeout
 * at line 234 is not a sentence anybody can act on, and the check written to
 * say exactly what was wrong never ran at all.
 */
results['onboarding is not shown again'] = !(await page
  .getByRole('button', { name: 'Skip' })
  .isVisible()
  .catch(() => false));
results['the return survives a reload'] = await page.getByText('Money back ✓').isVisible();
// A returned receipt has to stay reachable: the swipe is a one-finger gesture
// on a row you might have meant to open, so it will fire by accident.
await page.getByRole('button', { name: /Currys, JBL.*returned/ }).click();
await page.waitForTimeout(400);
results['a returned receipt can still be opened'] =
  await page.getByText(/Money back · .* recovered/).isVisible();
// And says WHEN. The date has been stored since this screen was written and
// never shown: "£89.00 recovered ✓" reads the same whether the refund landed
// last week or last year.
// The day the app STORED, not "today" as this check computes it: a run that
// crosses midnight made the return on one day and asked about the next, and
// failed on a screen that was right.
{
  const returnedOn = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kept.v1')).receipts.find((r) => r.id === 'seed_currys')?.returnedOn ?? '');
  const day = returnedOn ? String(Number(returnedOn.slice(8, 10))) : 'no date stored';
  results['a returned receipt says when the money came back'] = await page
    .getByText(new RegExp(`recovered on ${day} `))
    .isVisible()
    .catch(() => false);
}
await page.getByRole('button', { name: 'Not actually returned' }).click();
await page.waitForTimeout(400);
results['a return can be undone'] =
  (await page.getByRole('button', { name: 'Got my money back' }).isVisible()) &&
  (await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kept.v1')).receipts.find((r) => r.id === 'seed_currys').status)) === 'active';
await page.getByRole('button', { name: 'Back', exact: true }).click();
await page.waitForTimeout(300);

// Delete was the only action with no way out. It offers one now — and the
// undo has to put the receipt back, not merely hide the message.
const receiptCount = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.length);
const beforeDelete = await receiptCount();
await page.getByRole('button', { name: /Argos, Kenwood/ }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Delete' }).click();
await page.waitForTimeout(400);
const afterDelete = await receiptCount();
await page.getByRole('button', { name: 'Undo' }).click();
await page.waitForTimeout(400);
results['a deleted receipt can be undone'] =
  afterDelete === beforeDelete - 1 &&
  (await receiptCount()) === beforeDelete &&
  // By role, not by text: the undo bar names the receipt it deleted, so a
  // text match here could be satisfied by the message rather than the row —
  // the same trap that made the backup check pass for the wrong reason.
  (await page.getByRole('button', { name: /Argos, Kenwood/ }).isVisible());

/*
 * The year-long window, read as a screen rather than as source.
 *
 * IKEA's 365 days put the deadline on the same day and month as the purchase,
 * and deciding the year per date rendered "RETURN BY 15 Feb 2027" six lines
 * above "bought 15 Feb" — the same string twice, a year apart, on the screen
 * whose whole job is dates. So: the two dates the detail screen shows together
 * must not read as the same day, and the pair carries the year or neither does.
 */
await page.getByRole('button', { name: /IKEA, MALM/ }).click();
await page.waitForTimeout(300);
const ikea = await page.evaluate(() => {
  const label = [...document.querySelectorAll('div')].find((d) => d.textContent.trim() === 'Return by');
  const deadline = label?.nextElementSibling?.textContent?.trim() ?? null;
  const bought = document.body.innerText.match(/bought ([^\n·]+)/)?.[1]?.trim() ?? null;
  return { deadline, bought };
});
const hasYear = (t) => /\b(19|20)\d{2}\b/.test(t);
results['a year-long window does not print the same date twice'] =
  !!ikea.deadline && !!ikea.bought && ikea.deadline !== ikea.bought &&
  hasYear(ikea.deadline) === hasYear(ikea.bought);
await page.getByRole('button', { name: 'Back', exact: true }).click();
await page.waitForTimeout(300);

// An edit must reach the screen, and the disk.
await page.getByRole('button', { name: /Zara, Wool-blend/ }).click();
await page.waitForTimeout(300);
// Zara counts from dispatch. The detail screen and the edit screen must name
// the same date — they disagreed by two days, because the preview counted
// from the purchase date and the receipt counted from dispatch.
const detailDeadline = await page.evaluate(() => {
  const label = [...document.querySelectorAll('div')].find((d) => d.textContent.trim() === 'Return by');
  return label?.nextElementSibling?.textContent?.trim() ?? null;
});

/*
 * The step the deadline is for: the shop's own returns page, one tap away,
 * leaving nothing behind. The same page `check:retailers` reads, opened in a
 * new tab with no referrer, and named by where it goes.
 */
{
  const link = page.getByRole('link', { name: /Start your return/ });
  const attrs = await link.evaluate((a) => ({ href: a.href, target: a.target, rel: a.rel, name: a.textContent.trim() })).catch(() => null);
  results['a receipt links to its shop’s own returns page, and sends nothing with it'] =
    !!attrs && attrs.href === 'https://www.zara.com/uk/en/help-center/ReturnPolicy' &&
    attrs.target === '_blank' && /\bnoreferrer\b/.test(attrs.rel) && /zara\.com/.test(attrs.name);
  if (!results['a receipt links to its shop’s own returns page, and sends nothing with it']) problems.push(`returns link: ${JSON.stringify(attrs)}`);
}

/*
 * Zara is the seed's one distance purchase, fifteen days old: the fourteen-day
 * cooling-off has just run out and the shop's own thirty days have not. That
 * is the one state where the rights block has to say which door is still open
 * — and `legalRights` is told by a boolean the screen passes in. Passing
 * `d.expired` instead of `!d.expired` swapped the sentence, so an EXPIRED
 * receipt would tell someone the shop will still take it back. The visible
 * ring on this screen was held; the legal reasoning under it was not.
 */
const legalToggle = page.locator('[aria-expanded]').filter({ hasText: /Your legal rights?/ });
const legalText = async () => (await page.locator('main').textContent().catch(() => '')) ?? '';
const rightsWhileOpen = await legalText();
results['a lapsed cooling-off says the shop’s own window is still open, when it is'] =
  rightsWhileOpen.includes('still open either way') &&
  !rightsWhileOpen.includes('anything that turns out to be faulty');

/*
 * And the disclosure has to disclose. `setLegalOpen((v) => v)` left the
 * section stuck while `aria-expanded` went on stating a position it never
 * moved from.
 */
const expandedAtFirst = await legalToggle.getAttribute('aria-expanded');
await legalToggle.click();
await page.waitForTimeout(250);
const expandedAfterOne = await legalToggle.getAttribute('aria-expanded');
const hiddenWhenClosed = !(await legalText()).includes('still open either way');
await legalToggle.click();
await page.waitForTimeout(250);
results['the legal rights section opens and closes, and says which'] =
  expandedAtFirst === 'true' && expandedAfterOne === 'false' && hiddenWhenClosed &&
  (await legalToggle.getAttribute('aria-expanded')) === 'true';
await page.getByRole('button', { name: 'Edit', exact: true }).click();
await page.waitForTimeout(300);
const editDeadline = (await page.locator('#e-window-hint').textContent()) ?? '';
results['both screens name the same deadline for a dispatch-clocked receipt'] =
  !!detailDeadline && editDeadline.includes(detailDeadline);
await page.fill('#e-item', '');
await page.getByRole('button', { name: 'Save changes' }).click();
await page.waitForTimeout(300);
results['an invalid edit is refused, not saved'] =
  (await page.getByRole('alert').count()) > 0 &&
  (await page.getByRole('button', { name: 'Save changes' }).isVisible());

/*
 * Refused to a screen reader too, and only the field that was refused.
 * `Field` wires `aria-invalid` for exactly this, and a11y.mjs checks that what
 * is shown is announced — not that what is announced is TRUE. `aria-invalid`
 * computed as `!error` passed every sweep, with each valid field announcing
 * itself as rejected and the rejected one announcing itself as fine.
 */
results['a refused field says so to a screen reader, and the others do not'] =
  (await page.locator('#e-item').getAttribute('aria-invalid')) === 'true' &&
  (await page.locator('#e-amount').getAttribute('aria-invalid')) === 'false';

await page.fill('#e-item', 'Charcoal wool coat');
await page.fill('#e-amount', '39.50');
await page.getByRole('button', { name: 'Save changes' }).click();
await page.waitForTimeout(400);
results['an edit reaches the receipt'] =
  (await page.getByText('Charcoal wool coat').first().isVisible()) &&
  (await page.getByText('£39.50').first().isVisible());

/*
 * The claim pack: opened from a receipt, laid out in date order with today
 * marked, and saved as a page that carries the purchase and loads nothing.
 * Back has to land on the receipt it came from, not the list.
 */
await page.getByRole('button', { name: 'Receipts', exact: true }).click();
await page.waitForTimeout(300);
// By the shop: the edit above renamed the item, and the pack must carry the new name.
await page.getByRole('button', { name: /^Zara, / }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: /^Claim pack/ }).click();
await page.waitForTimeout(400);
{
  const shape = await page.evaluate(() => ({
    h1: document.querySelector('main h1')?.textContent?.trim() ?? '',
    done: document.querySelectorAll('[data-pack-timeline] [data-event="done"]').length,
    deadlines: document.querySelectorAll('[data-pack-timeline] [data-event="open"], [data-pack-timeline] [data-event="gone"]').length,
    today: document.querySelectorAll('[data-pack-timeline] [data-today]').length,
  }));
  const [packFile] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
    page.getByRole('button', { name: 'Save a copy' }).click(),
  ]);
  const html = packFile ? readFileSync(await packFile.path(), 'utf8') : '';
  results['the claim pack lays out a receipt in date order, with today marked'] =
    /Charcoal wool coat/.test(shape.h1) && shape.done >= 1 && shape.deadlines >= 3 && shape.today === 1;
  results['the claim pack saves as a page that carries the purchase and loads nothing'] =
    !!packFile && /^kept-claim-zara-\d{4}-\d{2}-\d{2}\.html$/.test(packFile.suggestedFilename()) &&
    html.includes('Claim pack: Charcoal wool coat') && html.includes('Zara') && !/<script|https?:\/\//i.test(html);
  if (!results['the claim pack lays out a receipt in date order, with today marked']) problems.push(`claim pack: ${JSON.stringify(shape)}`);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForTimeout(300);
  results['Back from the claim pack lands on its receipt'] = await page.getByRole('button', { name: 'Edit', exact: true }).isVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForTimeout(300);
}

// Export, delete something, restore it back.
await page.getByRole('button', { name: 'Settings', exact: true }).click();
await page.waitForTimeout(300);
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Export a backup' }).click(),
]);
const backupPath = join(tmpdir(), 'kept-smoke-backup.json');
await download.saveAs(backupPath);
results['the export is a kept backup'] = JSON.parse(readFileSync(backupPath, 'utf8')).app === 'kept';

await page.getByRole('button', { name: 'Receipts', exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: /Boots, No7/ }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Delete' }).click();
await page.waitForTimeout(400);
// Asserted against stored state, not text on screen: the undo bar names the
// receipt it just deleted, so "is this string visible" answers the wrong
// question — and answered it wrongly the moment that bar was added.
const holds = (item) =>
  page.evaluate(
    (needle) => JSON.parse(localStorage.getItem('kept.v1')).receipts.some((r) => r.item === needle),
    item,
  );
const deleted = !(await holds('No7 skincare set'));

await page.getByRole('button', { name: 'Settings', exact: true }).click();
await page.waitForTimeout(300);
await page.setInputFiles('input[type=file]', backupPath);
await page.waitForTimeout(600);
await page.getByRole('button', { name: 'Receipts', exact: true }).click();
await page.waitForTimeout(400);
results['a deleted receipt comes back from a backup'] =
  deleted &&
  (await holds('No7 skincare set')) &&
  (await page.getByRole('button', { name: /Boots, No7/ }).isVisible());

/*
 * And a restore must not undo what happened since the file was written. The
 * backup above was taken while every receipt was active; take one back, then
 * restore that same file. Without the details/state split in mergeBackup the
 * refund silently reverts — the receipt returns to "Go now or lose it", its
 * refund date disappears, and the app starts telling someone to return
 * something they already returned.
 */
await page.getByRole('button', { name: /Currys, JBL/ }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Got my money back' }).click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: 'Back to receipts' }).click().catch(() => {});
await page.waitForTimeout(400);
const refunded = (item) =>
  page.evaluate((needle) => {
    const r = JSON.parse(localStorage.getItem('kept.v1')).receipts.find((x) => x.item === needle);
    return r ? { status: r.status, returnedOn: r.returnedOn ?? null } : null;
  }, item);
const afterReturning = await refunded('JBL Tune 770NC headphones');

await page.getByRole('button', { name: 'Settings', exact: true }).click();
await page.waitForTimeout(300);
await page.setInputFiles('input[type=file]', backupPath);
await page.waitForTimeout(600);
const afterRestoring = await refunded('JBL Tune 770NC headphones');
results['restoring an older backup does not undo a refund taken since'] =
  afterReturning?.status === 'returned' &&
  afterRestoring?.status === 'returned' &&
  afterRestoring.returnedOn === afterReturning.returnedOn;

/*
 * And not the AMOUNT of a refund either, which is where the first fix stopped:
 * the device kept a receipt's status and three dates and took every other
 * field from the file, so a £30 refund on the £89 headphones, recorded after
 * the export, came back from a restore as the whole £89 — under "Nothing
 * already here was lost". The device's copy of a receipt it holds is the
 * newer one, all of it (`mergeBackup`), and the note says so.
 */
{
  const seen = {};
  await page.getByRole('button', { name: 'Receipts', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Currys, JBL.*returned/ }).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Not the full amount?' }).click({ timeout: 3000 }).catch(() => {});
  await page.getByLabel('How much came back?').fill('30', { timeout: 3000 }).catch(() => {});
  await page.getByRole('button', { name: 'Save', exact: true }).click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
  const refund = () => page.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.find((r) => /JBL/.test(r.item))?.refunded ?? null);
  seen.partial = (await refund()) === 3000;
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.waitForTimeout(300);
  await page.setInputFiles('input[type=file]', backupPath);
  await page.waitForTimeout(600);
  seen.kept = (await refund()) === 3000;
  const said = (await page.getByRole('status').allTextContents()).join(' ');
  seen.said = /already here\. Nothing already here was changed\./.test(said);
  const ok = Object.values(seen).every(Boolean);
  results['restoring an older backup keeps a partial refund taken since, and says nothing here changed'] = ok;
  if (!ok) problems.push(`restore after a partial refund: ${JSON.stringify({ ...seen, said: said.slice(0, 160) })}`);
}

await page.getByRole('button', { name: 'Receipts', exact: true }).click();
await page.waitForTimeout(300);

// A file that is not a backup must be refused without touching anything.
await page.getByRole('button', { name: 'Settings', exact: true }).click();
await page.waitForTimeout(300);
const junkPath = join(tmpdir(), 'kept-smoke-junk.json');
writeFileSync(junkPath, '{"app":"not-kept"}');
await page.setInputFiles('input[type=file]', junkPath);
await page.waitForTimeout(500);
// Every live region, not `.first()`. The question is whether the person is
// TOLD, and the app grew a second status region — the one that announces a
// screen change — which is earlier in the DOM and made this read the wrong
// element the day it was added.
const spoken = await page.getByRole('status').allTextContents();
const refused = spoken.some((t) => (t ?? '').includes('not a kept backup'));
await page.getByRole('button', { name: 'Receipts', exact: true }).click();
await page.waitForTimeout(300);
results['a file that is not a backup is refused, and nothing is lost'] =
  refused && (await holds('No7 skincare set'));

// An order email shared in from another app must land already read — the
// three-step strip on the Add screen promises exactly this. Shared by GET, as
// an app installed under the old manifest still shares: the manifest's own
// target is a POST now, answered by the service worker so the email never
// reaches the server, and `freshness` asks that — it runs its own server and
// can read what arrived there. This is the route that has to keep working
// for an install the browser has not yet refreshed.
const shareUrl =
  `${ORIGIN}/app/?title=${encodeURIComponent('Your Currys order')}` +
  `&text=${encodeURIComponent('Order placed 16 Aug 2026\nTotal £129.00')}`;
await page.goto(shareUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
results['a shared order lands on Add, already read'] =
  (await page.getByRole('heading', { name: 'Add a receipt' }).isVisible()) &&
  (await page.getByText('Found in your paste').isVisible());
// The payload must not linger in the address bar, or a reload re-adds it.
results['the shared payload is stripped from the URL'] = !/[?&]text=/.test(page.url());

// The sample policy changes stay samples after the served feed has been read
// (APN-84). They used to carry the served feed's own ids and be replaced by
// it — the same five unchecked claims about named shops, published as news.
// The served feed is empty until a real change is checked; the samples are
// labelled on the tab, keep the label on disk, and appear once each. That a
// served change actually ARRIVES is feed:wiring's job, with a probe of its own.
await page.getByRole('button', { name: /^Watch/ }).click();
await page.waitForTimeout(600);
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).updates);
const updateIds = stored.map((u) => u.id);
results['the sample policy changes are labelled, and held once each'] =
  updateIds.length > 0 &&
  updateIds.length === new Set(updateIds).size &&
  stored.every((u) => u.demo === true) &&
  (await page.getByText('sample', { exact: true }).count()) === stored.length &&
  (await page.getByText(/These are samples/).isVisible().catch(() => false));
// Both halves, because the reassurance alone is what this check used to
// accept: Zara's fee change left the window at 30 days, so the card said
// "deadline unchanged" and stopped — dropping the one sentence in the update
// worth acting on, which is the £1.95 the change is actually about.
/*
 * And the switch that claims to control that download has to control it.
 *
 * It was a stored boolean nothing read: the row said "Policy watch · Every
 * launch · on", turning it off changed the word to "Off", and the feed
 * downloaded on every launch regardless. Counted at the network, in its own
 * context, because this is the app's only outbound request and the claim is
 * about whether it happens at all.
 */
{
  const watchCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const watchPage = await watchCtx.newPage();
  let feedHits = 0;
  watchPage.on('request', (r) => {
    if (new URL(r.url()).pathname === '/policy-feed.json') feedHits += 1;
  });
  await watchPage.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await watchPage.waitForTimeout(900);
  const hitsWhileOn = feedHits;
  await watchPage.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    s.settings.policyWatch = false;
    s.onboardingSeen = true;
    localStorage.setItem('kept.v1', JSON.stringify(s));
  });
  feedHits = 0;
  await watchPage.reload({ waitUntil: 'networkidle' });
  await watchPage.waitForTimeout(1200);
  results['switching policy watch off actually stops the download'] = hitsWhileOn > 0 && feedHits === 0;
  // And the Watch tab stops claiming it. "Fetched each time you open the app"
  // was printed whether or not the switch was on — a sentence that became
  // false the moment the switch started actually stopping the fetch.
  await watchPage.getByRole('button', { name: /^Watch/ }).click();
  await watchPage.waitForTimeout(600);
  const saidWhileOff = await watchPage.locator('main').innerText();
  await watchPage.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    s.settings.policyWatch = true;
    localStorage.setItem('kept.v1', JSON.stringify(s));
  });
  await watchPage.reload({ waitUntil: 'networkidle' });
  await watchPage.waitForTimeout(600);
  await watchPage.getByRole('button', { name: /^Watch/ }).click();
  await watchPage.waitForTimeout(600);
  const saidWhileOn = await watchPage.locator('main').innerText();
  results['the watch tab does not claim a fetch that is switched off'] =
    /Policy watch is off/.test(saidWhileOff) &&
    !/fetched each time you open the app/.test(saidWhileOff) &&
    /fetched each time you open the app/.test(saidWhileOn);
  await watchCtx.close();
}

results['a policy change is checked against the receipts held'] =
  (await page.getByText('Affects your receipts', { exact: true }).first().isVisible()) &&
  (await page.getByText(/deadline unchanged/).first().isVisible()) &&
  (await page.getByText(/drop off in store to keep it free/).first().isVisible());

/*
 * The parser names no shop rather than guessing one — "walking boots" is not a
 * Boots order — so the add screen has to let someone say which shop it was,
 * and naming one Kept knows has to bring that shop's REAL window with it.
 * Asserted against what lands in storage, not against the preview: the preview
 * agreeing with itself is what the agreement suite is for.
 */
await page.getByRole('button', { name: 'Add a receipt' }).click();
await page.waitForTimeout(300);
await page.fill('#paste', 'Your Vinted order · walking boots · Total £40.00 · 20 Aug 2026');
await page.getByRole('button', { name: 'Read it' }).click();
await page.waitForTimeout(400);
results['an unrecognised shop is asked for rather than guessed'] =
  (await page.locator('#add-store').count()) === 1 &&
  (await page.getByText('Not recognised').isVisible());
await page.fill('#add-store', 'Boots');
await page.waitForTimeout(300);
/*
 * The arrival date decides where both statutory clocks start, and this screen
 * had no rule for it: the browser marked the field invalid for a date before
 * the order and the app saved it anyway — 19 days early in the case that found
 * it, which reports a live right as expired. The edit screen validated it; the
 * add screen did not.
 */
await page.fill('#add-arrived', '2001-01-01');
await page.waitForTimeout(300);
const heldBeforeBadDate = await page.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.length);
const badDateSave = page.getByRole('button', { name: /Fix the arrival date/ });
await badDateSave.click({ force: true }).catch(() => {});
await page.waitForTimeout(400);
results['an arrival before the purchase is refused, not saved'] =
  (await badDateSave.isDisabled().catch(() => false)) &&
  (await page.getByText('It cannot have arrived before you ordered it').isVisible().catch(() => false)) &&
  (await page.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.length)) === heldBeforeBadDate;
// The visible error above was held; the announced one was not. Same defect
// as the edit screen's, on an input this screen wires by hand.
const arrivalInvalidWhenBad = await page.locator('#add-arrived').getAttribute('aria-invalid');
await page.fill('#add-arrived', '');
await page.waitForTimeout(300);
results['a refused arrival date says so to a screen reader, and stops once cleared'] =
  arrivalInvalidWhenBad === 'true' &&
  (await page.locator('#add-arrived').getAttribute('aria-invalid')) === 'false';

await page.getByRole('button', { name: /^Save/ }).click();
await page.waitForTimeout(600);
const named = await page.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.at(-1));
results['naming a shop by hand brings its verified window'] =
  named.store === 'Boots' && named.windowDays === 35 && named.policy.startsWith('Boots ·');

/*
 * The delivery date, read out of the paste rather than out of the person.
 *
 * Both statutory clocks run from delivery, this screen asks for that date in
 * so many words, and the order email being pasted says it three lines above
 * the total — so it was asking someone to copy it across by hand. Checked as
 * far as the saved receipt, not just the field: a pre-fill that never reaches
 * disk is a decoration.
 */
await page.getByRole('button', { name: 'Add a receipt' }).click();
await page.waitForTimeout(300);
await page.fill('#paste', 'John Lewis · Order placed 24 August 2026 · Sony headphones · Order total: £329.00 · Delivered 27 August 2026');
await page.getByRole('button', { name: 'Read it' }).click();
await page.waitForTimeout(400);
const prefilled = await page.inputValue('#add-arrived').catch(() => '');
await page.getByRole('button', { name: /^Save/ }).click();
await page.waitForTimeout(600);
const delivered = await page.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.at(-1));
results['a delivery date in the paste is read, not asked for'] =
  prefilled === '2026-08-27' && delivered.arrivedOn === '2026-08-27' && delivered.purchasedOn === '2026-08-24';

/*
 * The last day, which is the day the ring matters most and drew nothing.
 *
 * `daysLeft` is 0 on the last day a thing can go back, and the arc was
 * `daysLeft / windowDays` — so the screen read "0 days left · RETURN BY 29
 * Aug" beside an empty grey track, with no red anywhere on it. Counted
 * inclusive of today now, and the number is coloured like the count on the
 * home hero, which had always done this.
 */
{
  const lastCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const lastPage = await lastCtx.newPage();
  await lastPage.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await lastPage.waitForTimeout(400);
  await lastPage.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
    s.receipts = [
      { id: 'lastday', store: 'ASOS', item: 'Running shoes', cat: 'clothing', amount: 6500,
        purchasedOn: ago(28), windowDays: 28, policy: 'ASOS · 28 days', distance: false, status: 'active' },
      { id: 'gonelong', store: 'Argos', item: 'Toaster', cat: 'kitchen', amount: 2999,
        purchasedOn: ago(400), windowDays: 30, policy: 'Argos · 30 days', distance: false, status: 'active' },
    ];
    s.onboardingSeen = true;
    localStorage.setItem('kept.v1', JSON.stringify(s));
  });
  await lastPage.reload({ waitUntil: 'networkidle' });
  await lastPage.waitForTimeout(700);
  const ring = async (name) => {
    await lastPage.getByRole('button', { name }).click();
    await lastPage.waitForTimeout(400);
    const seen = await lastPage.evaluate(() => {
      const arc = document.querySelectorAll('svg circle')[1];
      const num = [...document.querySelectorAll('div')].find((d) => /^(\d+|closed)$/.test(d.textContent?.trim() ?? ''));
      return {
        drawn: Number(arc.getAttribute('stroke-dasharray')) - Number(arc.getAttribute('stroke-dashoffset')),
        stroke: arc.getAttribute('stroke'),
        numberColour: num ? getComputedStyle(num).color : null,
      };
    });
    await lastPage.getByRole('button', { name: 'Back', exact: true }).click();
    await lastPage.waitForTimeout(300);
    return seen;
  };
  const lastDay = await ring(/ASOS, Running shoes/);
  const longGone = await ring(/Argos, Toaster/);
  results['the ring still shows something on the last day'] =
    // The danger red, `color.danger` (#C2261C): the number sits on a white card now, not ink.
    lastDay.drawn > 1 && lastDay.numberColour === 'rgb(194, 38, 28)' &&
    // And nothing once the window has actually gone, rather than sweeping backwards.
    longGone.drawn <= 0;
  await lastCtx.close();
}

/*
 * Everything returned — and the two claims that state makes.
 *
 * "Every return made it back in time" was printed unconditionally, and a
 * return can be made after the shop's window shuts, by goodwill or the
 * faulty-goods route. Same fault as the celebrate card: a claim about timing
 * that nothing checked. And the money-back rows are hand-built rather than a
 * ReceiptRow, so the "sample ·" marker added to the list never reached them —
 * a demo receipt stopped saying what it was the moment it was ticked off, on
 * the list where "which of these were mine" is the question.
 */
{
  const doneCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const donePage = await doneCtx.newPage();
  await donePage.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await donePage.waitForTimeout(400);
  const markAll = (late) => `() => {
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    const d = new Date();
    d.setDate(d.getDate() + (${late} ? 400 : 0));
    s.receipts = s.receipts.map((r) => ({ ...r, status: 'returned', returnedOn: d.toISOString().slice(0, 10) }));
    s.onboardingSeen = true;
    localStorage.setItem('kept.v1', JSON.stringify(s));
  }`;
  await donePage.evaluate(eval(markAll(false)));
  await donePage.reload({ waitUntil: 'networkidle' });
  await donePage.waitForTimeout(700);
  const inTime = await donePage.locator('main').innerText();
  await donePage.evaluate(eval(markAll(true)));
  await donePage.reload({ waitUntil: 'networkidle' });
  await donePage.waitForTimeout(700);
  const late = await donePage.locator('main').innerText();
  results['"every return made it back in time" is only said when it did'] =
    /Every return made it back in time/.test(inTime) &&
    !/Every return made it back in time/.test(late) &&
    // The money is true either way.
    /recovered — not bad/.test(late);
  results['a sample receipt still says so once it is returned'] = /sample · JBL Tune 770NC/.test(inTime);
  await doneCtx.close();
}

/*
 * A library with a backlog: the hero must not contradict itself.
 *
 * `bucket` keeps an expired-but-unreturned receipt at the top, deliberately —
 * the money may still be recoverable and demoting it would hide the row a
 * person most needs to see. So on any list with one, the hero shows it. Its
 * headline said "Gone — the window closed on your Towels" while the label
 * above said NEXT WINDOW TO CLOSE and the line below said "£193.25 back if it
 * goes back by 21 Mar", a date five months past. Three statements, one card,
 * two of them false.
 */
{
  const backlogCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const backlogPage = await backlogCtx.newPage();
  await backlogPage.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await backlogPage.waitForTimeout(400);
  await backlogPage.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    const old = new Date();
    old.setDate(old.getDate() - 200);
    s.receipts = [
      { id: 'gone', store: 'M&S', item: 'Towels', cat: 'other', amount: 19325,
        purchasedOn: old.toISOString().slice(0, 10), windowDays: 35, policy: 'M&S · 35 days',
        distance: false, status: 'active' },
      // A real receipt still inside its window, so the footer below has real
      // money to show: once any real receipt exists the samples stop counting,
      // and without this the right answer would be £0.00.
      { id: 'fresh', store: 'Argos', item: 'Toaster', cat: 'kitchen', amount: 2499,
        purchasedOn: new Date().toISOString().slice(0, 10), windowDays: 30, policy: 'Argos · 30 days',
        distance: false, status: 'active' },
      ...s.receipts,
    ];
    s.onboardingSeen = true;
    localStorage.setItem('kept.v1', JSON.stringify(s));
  });
  await backlogPage.reload({ waitUntil: 'networkidle' });
  await backlogPage.waitForTimeout(700);
  const shown = await backlogPage.locator('main').innerText();
  results['an expired receipt is not sold as a window still to close'] =
    /the window closed on your Towels/.test(shown) &&
    /Window closed/.test(shown) &&
    !/Next to close/.test(shown) &&
    // And no promise of money back by a date five months gone.
    !/£193\.25 back if it goes back/.test(shown) &&
    // Nor filed under the one thing that cannot be done about it.
    /Window closed · check your rights/.test(shown);

  /*
   * And the third statement on the same card: its footer.
   *
   * "£X still returnable" summed every ACTIVE receipt, and the expired one is
   * active on purpose — so the card that had just said WINDOW ALREADY CLOSED
   * counted that receipt's £193.25 as money still to come back, three lines
   * below. Read off the rendered figure and checked against the two sums the
   * page itself holds, rather than against a number written here that would go
   * stale with the seed.
   */
  const footer = /(£[\d,]+\.\d\d)/.exec(await backlogPage.locator('[data-balance="returnable"]').innerText().catch(() => ''));
  const sums = await backlogPage.evaluate(() => {
    // Real receipts only: the samples stop counting towards a total the moment
    // a real receipt exists (`countsAsMoney`), and there are two here.
    const rs = JSON.parse(localStorage.getItem('kept.v1')).receipts.filter((r) => r.status === 'active' && !r.demo);
    return { all: rs.reduce((n, r) => n + r.amount, 0), gone: (rs.find((r) => r.id === 'gone') ?? {}).amount ?? 0 };
  });
  const shownPence = footer ? Math.round(parseFloat(footer[1].replace(/[£,]/g, '')) * 100) : -1;
  results['money past the shop’s window is not counted as still returnable'] =
    // The second clause is the point: if the expired receipt were worth
    // nothing, the two totals would be equal and the first clause would pass
    // over a difference that was never there.
    shownPence === sums.all - sums.gone && sums.gone > 0;

  await backlogCtx.close();
}

/*
 * The retailer's own clock, for the one shop in the table that does not start
 * it at the till.
 *
 * `clockStart` was declared on all twenty entries and read by nothing, so a
 * Zara receipt anyone ADDED counted its 30 days from the order — the safe
 * direction, since dispatch is later, but it can say "window closed" on a day
 * Zara would still take the coat back. Two receipts, because the rule is not
 * "set it when the email mentions dispatch": Argos counts from the purchase
 * and a receipt carrying Zara's clock would be worse than one carrying none.
 */
const addPaste = async (paste, item) => {
  await page.getByRole('button', { name: 'Add a receipt' }).click();
  await page.waitForTimeout(300);
  await page.fill('#paste', paste);
  await page.getByRole('button', { name: 'Read it' }).click();
  await page.waitForTimeout(400);
  await page.fill('#add-item', item);
  await page.getByRole('button', { name: /^Save/ }).click();
  await page.waitForTimeout(600);
  return page.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.at(-1));
};
const zaraAdded = await addPaste('Zara · Order placed 13 August 2026 · Wool coat · Total £34.99 · Dispatched 15 August 2026', 'Wool coat');
const argosAdded = await addPaste('Argos · Order placed 13 August 2026 · Kettle · Total £29.00 · Dispatched 15 August 2026', 'Kettle');
results['a dispatch-clocked shop counts from dispatch, and only that shop'] =
  zaraAdded.store === 'Zara' && zaraAdded.windowStartsOn === '2026-08-15' &&
  argosAdded.store === 'Argos' && argosAdded.windowStartsOn === undefined;

/*
 * The Add card's deadline is the deadline that gets saved.
 *
 * The preview counted from the purchase date while the save stored the
 * arrival date for a shop that counts from delivery: an Amazon paste delivered
 * on the 10th previewed 1 Oct and saved 10 Oct — nine days early on the card,
 * changing the moment it was saved. Read off the card, then off the receipt.
 */
await page.getByRole('button', { name: 'Add a receipt' }).click();
await page.waitForTimeout(300);
await page.fill('#paste', 'Your Amazon.co.uk order · Ordered 1 September 2026 · Delivered 10 September 2026 · Order total £49.99');
await page.getByRole('button', { name: 'Read it' }).click();
await page.waitForTimeout(400);
const amazonCard = await page.locator('main').innerText();
const previewed = /Deadline\s*\n?\s*([^\n]+)/.exec(amazonCard)?.[1]?.trim() ?? '';
await page.fill('#add-item', 'Desk lamp');
await page.getByRole('button', { name: /^Save/ }).click();
await page.waitForTimeout(600);
const amazonAdded = await page.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.at(-1));
results['the Add card previews the deadline that is saved'] =
  amazonAdded.store === 'Amazon' && amazonAdded.windowStartsOn === '2026-09-10' &&
  /^10 Oct\b/.test(previewed);

/*
 * The item is read from the paste, not typed. The parser read the shop, the
 * total and the dates and left the one thing that names the receipt blank.
 * Read off the field, which stays editable.
 */
await page.getByRole('button', { name: 'Add a receipt' }).click();
await page.waitForTimeout(300);
await page.fill('#paste', 'Argos order confirmation\nOrder placed: 5 Sep 2026\nItem: Kenwood kMix stand mixer\nTotal to pay: £199.99');
await page.getByRole('button', { name: 'Read it' }).click();
await page.waitForTimeout(400);
results['the item is read from the paste, and left editable'] =
  (await page.inputValue('#add-item').catch(() => '')) === 'Kenwood kMix stand mixer' &&
  (await page.locator('#add-item').isEditable().catch(() => false));
await page.getByRole('button', { name: 'Receipts', exact: true }).click();
await page.waitForTimeout(300);

/*
 * A paste with a shop and no total asks for the total.
 *
 * The card read "Total: Not found" above a live Save, which stored a £0.00
 * receipt — understating the returnable total, the alerts and the
 * celebration, with nothing ever asking for the figure.
 */
await page.getByRole('button', { name: 'Add a receipt' }).click();
await page.waitForTimeout(300);
await page.fill('#paste', 'Thanks for shopping at Zara, order 12345 · 20 September 2026');
await page.getByRole('button', { name: 'Read it' }).click();
await page.waitForTimeout(400);
const saveBlocked = await page.getByRole('button', { name: 'Add the total to save' }).isDisabled().catch(() => false);
const before = await page.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.length);
await page.getByRole('button', { name: 'Add the total to save' }).click({ force: true }).catch(() => {});
await page.waitForTimeout(300);
const unchanged = (await page.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.length)) === before;
await page.fill('#add-total', '12,50');
const decimalComma = await page.locator('#add-total').getAttribute('aria-invalid');
await page.fill('#add-total', '42.00');
await page.fill('#add-item', 'Scarf');
await page.getByRole('button', { name: /^Save receipt/ }).click();
await page.waitForTimeout(600);
const zaraTotal = await page.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.at(-1));
results['a paste with no total asks for one instead of saving £0'] =
  saveBlocked && unchanged && decimalComma === 'true' && zaraTotal.item === 'Scarf' && zaraTotal.amount === 4200;

/*
 * A shop that changed its window since this build shipped.
 *
 * The feed exists to carry exactly that, and `newWindowDays` was read for one
 * thing only: telling the holder of an existing receipt how their deadline
 * compares. So the Watch tab would say "new purchases get 16 days less; yours
 * keeps the 30 days it was bought under" — and the Add screen next door would
 * hand a NEW Currys purchase the table's number anyway. A deadline later than
 * the shop will honour, on a receipt added minutes after the app said so.
 *
 * Driven through the real screen rather than the function, because the
 * function had a caller before this and it was not this one.
 */
{
  const feedCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const feedPage = await feedCtx.newPage();
  await feedPage.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await feedPage.waitForTimeout(400);
  // Dated AFTER the seeded Currys entry, which is itself a change carrying a
  // window: the first version of this dated it in January and the app
  // correctly preferred the July one, which is the rule working rather than
  // failing. The test data was wrong, not the code.
  const feedDays = await feedPage.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('kept.v1'));
    s.onboardingSeen = true;
    s.updates = [
      {
        id: 'currys-shortened',
        store: 'Currys',
        changedOn: '2026-08-10',
        text: 'Currys shortened its returns window.',
        affectsStores: ['Currys'],
        affectNote: 'new purchases only',
        newWindowDays: 7,
      },
    ];
    localStorage.setItem('kept.v1', JSON.stringify(s));
    return 7;
  });
  await feedPage.reload({ waitUntil: 'networkidle' });
  await feedPage.waitForTimeout(600);
  await feedPage.getByRole('button', { name: 'Add a receipt' }).click();
  await feedPage.waitForTimeout(300);
  await feedPage.fill('#paste', 'Currys · Order placed 20 August 2026 · Kettle · Total £29.00');
  await feedPage.getByRole('button', { name: 'Read it' }).click();
  await feedPage.waitForTimeout(400);
  await feedPage.fill('#add-item', 'Kettle');
  await feedPage.getByRole('button', { name: /^Save/ }).click();
  await feedPage.waitForTimeout(600);
  const added = await feedPage.evaluate(() =>
    JSON.parse(localStorage.getItem('kept.v1')).receipts.find((r) => r.item === 'Kettle'));
  results['a shop that changed its window gives a new purchase the new one'] =
    !!added && added.windowDays === feedDays &&
    // And the sentence quoting it moves with it, or the row would read
    // "Currys · 14 days" above a deadline seven days out — a drift this
    // codebase has already had once. It also has to say WHERE the number came
    // from: the fallback wording was written for a window someone typed, and
    // "as entered, not verified. Check the receipt" is untrue of one the app
    // took from its own policy watch.
    /7-day return window, from a policy change on 10 August 2026/.test(added.policy ?? '');
  await feedCtx.close();
}

/*
 * And when the paste does NOT say when it was dispatched, the deadline is a
 * floor and has to be shown as one — the same hedge the statutory clocks make
 * about an unknown arrival, pointing the other way. Presented as a fact, it
 * says "window closed" on a day Zara would still take the coat back.
 */
const zaraNoDispatch = await addPaste('Zara · Order placed 13 August 2026 · Linen shirt · Total £25.99', 'Linen shirt');
await page.getByRole('button', { name: /Zara, Linen shirt/ }).click();
await page.waitForTimeout(400);
const zaraDetail = await page.locator('main').innerText();
await page.getByRole('button', { name: 'Back', exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: /Argos, Kettle/ }).click();
await page.waitForTimeout(400);
const argosDetail = await page.locator('main').innerText();
await page.getByRole('button', { name: 'Back', exact: true }).click();
await page.waitForTimeout(300);
/*
 * The third clock. Apple, Amazon and ASOS count their own windows from the
 * day the parcel lands, and each carried a `gotcha` saying so in prose while
 * `clockStart` said 'purchase' and the app counted from the order. With the
 * arrival date in hand — which the paste now reads — it counts from there.
 */
const asosAdded = await addPaste(
  'ASOS · Order placed 10 August 2026 · Trainers · Order total: £60.00 · Delivered 14 August 2026',
  'Trainers',
);
results['a shop that counts from delivery starts its window there'] =
  asosAdded.store === 'ASOS' && asosAdded.arrivedOn === '2026-08-14' && asosAdded.windowStartsOn === '2026-08-14' &&
  // And Argos, which counts from the till, records the arrival without
  // starting its window on it — the statutory clocks still run from there.
  argosAdded.arrivedOn === undefined && argosAdded.windowStartsOn === undefined;

results['an unknown dispatch date is shown as a floor, not a deadline'] =
  zaraNoDispatch.windowStartsOn === undefined &&
  /earliest it can be, never the latest/.test(zaraDetail) &&
  // And not said about a shop that counts from the till, where it is false.
  !/earliest it can be/.test(argosDetail);

/*
 * And the person can then supply it, which is the half that makes the hedge
 * something other than an instruction to do the impossible. The field is
 * offered only on a shop that counts from dispatch: Argos does not, and a
 * receipt carrying the wrong clock is worse than one carrying none.
 */
await page.getByRole('button', { name: /Zara, Linen shirt/ }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Edit', exact: true }).click();
await page.waitForTimeout(400);
const dispatchFieldOnZara = await page.locator('#e-dispatched').count();
// Guarded: the failure this exists to catch removes the field, and an
// unguarded fill would kill the harness before it printed a verdict.
await page.fill('#e-dispatched', '2026-08-16').catch(() => {});
await page.getByRole('button', { name: 'Save changes' }).click().catch(() => {});
await page.waitForTimeout(600);
const zaraFixed = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('kept.v1')).receipts.find((r) => r.item === 'Linen shirt'));
await page.getByRole('button', { name: 'Back', exact: true }).click().catch(() => {});
await page.waitForTimeout(300);
await page.getByRole('button', { name: /Argos, Kettle/ }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Edit', exact: true }).click();
await page.waitForTimeout(400);
const dispatchFieldOnArgos = await page.locator('#e-dispatched').count();
await page.getByRole('button', { name: 'Cancel' }).click().catch(() => {});
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Back', exact: true }).click().catch(() => {});
await page.waitForTimeout(300);
results['the dispatch date can be supplied, on the shop it belongs to'] =
  dispatchFieldOnZara === 1 && dispatchFieldOnArgos === 0 && zaraFixed.windowStartsOn === '2026-08-16';


/*
 * What is on screen when the app cannot render.
 *
 * A throw anywhere below the root unmounts the whole tree — measured before
 * the boundary existed: a blank page, no text, not one button, while the
 * receipts sat intact in localStorage with no server holding a copy. A reload
 * recovers only when the fault is on a screen you had to navigate to; a fault
 * on the first screen, or one a particular stored receipt causes, lands back
 * in the blank state on every launch.
 *
 * Driven by making a platform call the render depends on throw, which is a
 * real class of failure (an old engine, a locale bug) and does not need a
 * test-only hook in the app. Its own context, because a page that cannot
 * render is not a page the rest of this script can carry on using.
 */
{
  const brokenCtx = await browser.newContext({ viewport: { width: 402, height: 874 }, acceptDownloads: true });
  const broken = await brokenCtx.newPage();
  await broken.addInitScript(() => {
    // money() formats every amount on every screen through this.
    // eslint-disable-next-line no-extend-native
    Number.prototype.toLocaleString = function toLocaleString() {
      throw new Error('simulated platform failure');
    };
  });
  // The first load lands on onboarding, which formats no money and so renders
  // fine. Get past it, then reload into the screen that does.
  await broken.goto(`${ORIGIN}/app/`, { waitUntil: 'domcontentloaded' });
  await broken.waitForTimeout(500);
  await broken.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('kept.v1') ?? '{}');
    stored.onboardingSeen = true;
    localStorage.setItem('kept.v1', JSON.stringify(stored));
  });
  await broken.reload({ waitUntil: 'domcontentloaded' });
  await broken.waitForTimeout(900);

  results['a render failure is not a blank page'] =
    (await broken.getByRole('heading', { name: 'Something in kept broke' }).isVisible().catch(() => false)) &&
    (await broken.getByRole('button', { name: 'Save my receipts to a file' }).isVisible().catch(() => false));

  // The rescue must produce the receipts, without going through the loader or
  // the reader that may be what failed.
  const rescue = broken.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  await broken.getByRole('button', { name: 'Save my receipts to a file' }).click().catch(() => {});
  const download = await rescue;
  let rescued = null;
  if (download) {
    const path = join(tmpdir(), 'kept-smoke-rescue.json');
    await download.saveAs(path);
    rescued = JSON.parse(readFileSync(path, 'utf8'));
  }
  results['the rescue hands back the receipts that were on the device'] =
    !!rescued && rescued.app === 'kept' && Array.isArray(rescued.receipts) && rescued.receipts.length > 0;

  // And it says what broke, for the person to send — the error and how much
  // is stored, never what any of it is. It was written to the console alone.
  const told = await broken.locator('[data-support] pre').textContent().catch(() => '');
  const shops = (rescued?.receipts ?? []).map((r) => r.store).filter(Boolean);
  results['the broken screen says what broke, and nothing about the purchases'] =
    /Error: Error: simulated platform failure/.test(told ?? '') &&
    new RegExp(`Receipts: ${shops.length} \\(`).test(told ?? '') &&
    // The device line is the browser's own user agent ("AppleWebKit…"), which
    // a shop's name can coincide with; every other line is ours.
    shops.length > 0 && shops.every((shop) => !(told ?? '').split('\n').filter((l) => !l.startsWith('Device:')).join('\n').includes(shop));
  if (!results['the broken screen says what broke, and nothing about the purchases']) problems.push(`recovery support: ${JSON.stringify(told)}`);

  await brokenCtx.close();
}

/*
 * The version is on screen, and what a person sends to support is what they
 * were shown: copied to the real clipboard, with the version and the counts,
 * and not one shop's name from the list they are holding.
 */
{
  const supCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  await supCtx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  const sp = await supCtx.newPage();
  await sp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await sp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await sp.getByRole('button', { name: 'Settings', exact: true }).click();
  await sp.waitForTimeout(500);
  const shown = await sp.locator('[data-support]').innerText().catch(() => '');
  // Guarded, as the price checks are: the failure this exists to catch is a
  // missing button, and an unguarded click would end the run before it said so.
  await sp.getByRole('button', { name: 'Copy details for support' }).click({ timeout: 2000 }).catch(() => {});
  await sp.waitForTimeout(300);
  const copied = await sp.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  const stored = await sp.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.map((r) => r.store));
  results['the version is shown, and support gets counts, not purchases'] =
    /^Kept \d+\.\d+\.\d+/.test(shown) && /^Kept \d+\.\d+\.\d+/.test(copied) &&
    new RegExp(`Receipts: ${stored.length} \\(`).test(copied) &&
    stored.length > 0 && stored.every((shop) => !copied.split('\n').filter((l) => !l.startsWith('Device:')).join('\n').includes(shop)) &&
    /Copied — paste it/.test(await sp.locator('[data-support] [role="status"]').innerText().catch(() => ''));
  if (!results['the version is shown, and support gets counts, not purchases']) problems.push(`support: ${JSON.stringify({ shown: shown.slice(0, 80), copied: copied.slice(0, 200) })}`);
  await supCtx.close();
}

/*
 * A store the app cannot read must survive the save that follows.
 *
 * `load` falls back to a fresh state on corrupt JSON, and the first change
 * after that used to save the fallback over the only copy. It is set aside
 * now, and Settings hands it back as a file. Planted as a truncated write —
 * the ordinary way a store becomes unreadable — in a context of its own.
 */
{
  const badCtx = await browser.newContext({ viewport: { width: 402, height: 874 }, acceptDownloads: true });
  const bad = await badCtx.newPage();
  const truncated = '{"version":1,"onboardingSeen":true,"receipts":[{"id":"mine","store":"Currys","item":"Kettle"';
  await bad.addInitScript((raw) => {
    if (!sessionStorage.getItem('planted')) {
      localStorage.setItem('kept.v1', raw);
      sessionStorage.setItem('planted', '1');
    }
  }, truncated);
  await bad.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await bad.waitForTimeout(600);
  await bad.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await bad.getByRole('button', { name: 'Settings', exact: true }).click().catch(() => {});
  await bad.waitForTimeout(400);
  const aside = await bad.evaluate(() => localStorage.getItem('kept.v1.unreadable'));
  const offered = await bad.getByRole('button', { name: 'Save them as a file' }).isVisible().catch(() => false);
  const got = bad.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  await bad.getByRole('button', { name: 'Save them as a file' }).click().catch(() => {});
  const file = await got;
  let saved = null;
  if (file) {
    const path = join(tmpdir(), 'kept-smoke-set-aside.json');
    await file.saveAs(path);
    saved = readFileSync(path, 'utf8');
  }
  await bad.waitForTimeout(300);
  results['an unreadable store survives the next save, and is offered back'] =
    aside === truncated && offered && saved === truncated &&
    (await bad.evaluate(() => localStorage.getItem('kept.v1.unreadable'))) === null &&
    !(await bad.getByRole('button', { name: 'Save them as a file' }).isVisible().catch(() => false));
  await badCtx.close();
}

/*
 * A paper receipt, scanned — end to end, with real pixels and real OCR.
 *
 * The receipt is rendered as an image in its own page and photographed with
 * a screenshot, then handed to "Scan a paper receipt". Tesseract reads it on
 * this machine, from this app's own files: the check also fails if a single
 * request leaves the app's origin, because a CDN default in the OCR library
 * would hand a third party every scan. A rendered receipt is not a creased
 * thermal slip — that is what TestFlight is for — but it proves the wiring:
 * photo in, text read, the till receipt translated, the card filled.
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
  const photo = await shotPage.locator('#r').screenshot({ type: 'png' });
  await shotPage.close();

  const scanCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const scanPage = await scanCtx.newPage();
  // Requests from the page AND its workers — the OCR worker fetches the
  // engine and the model itself, which is exactly where a CDN default hides.
  const elsewhere = [];
  let ownOcr = 0;
  scanPage.on('request', (r) => {
    const u = new URL(r.url());
    if (!['http:', 'https:'].includes(u.protocol)) return;
    if (u.origin !== ORIGIN) elsewhere.push(u.origin);
    else if (u.pathname.startsWith('/ocr/')) ownOcr += 1;
  });
  await scanPage.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await scanPage.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await scanPage.getByRole('button', { name: 'Add a receipt' }).click();
  await scanPage.waitForTimeout(300);
  await scanPage.setInputFiles('#add-photo', { name: 'receipt.png', mimeType: 'image/png', buffer: photo });
  const found = await scanPage.getByText('Read from your photo', { exact: true }).waitFor({ timeout: 90_000 }).then(() => true).catch(() => false);
  const card = found ? await scanPage.locator('main').innerText() : '';
  const item = found ? await scanPage.inputValue('#add-item').catch(() => '') : '';
  results['a photographed receipt is read on the device'] =
    found && /Argos/.test(card) && /£199\.99/.test(card) && /26 Sep/.test(card) && /KENWOOD MIXER/i.test(item);
  // Scored on its own, and not on nothing: the reader's files must have been
  // fetched from this app for "nothing else was" to mean anything.
  results['and nothing leaves the app while it is read'] = ownOcr > 0 && elsewhere.length === 0;
  if (elsewhere.length) problems.push(`scan reached: ${[...new Set(elsewhere)].join(', ')}`);
  if (!found) problems.push('scan: the card never appeared');
  else if (!results['a photographed receipt is read on the device']) problems.push(`scan read: ${card.slice(0, 300).replace(/\n/g, ' | ')} · item=${item}`);
  // The card says where its findings came from, and stops saying "photo" the
  // moment the text is no longer what the camera read.
  if (found) {
    await scanPage.locator('#paste').fill(`${await scanPage.inputValue('#paste')}\nThanks`);
    await scanPage.getByRole('button', { name: 'Read it' }).click();
    results['an edited scan is a paste again'] =
      (await scanPage.getByText('Found in your paste').isVisible().catch(() => false)) &&
      !(await scanPage.getByText('Read from your photo', { exact: true }).isVisible().catch(() => false));
  }

  /*
   * The same, with the phone's shadow across half of it — the way a receipt on
   * a kitchen table is actually photographed. One threshold for the whole
   * photo put the shaded half below it and read nothing at all: measured, 0
   * of 36 fields across every shadowed case (`readBestOf` has the numbers).
   */
  const shadePage = await browser.newPage({ viewport: { width: 460, height: 900 }, deviceScaleFactor: 2 });
  await shadePage.setContent(`<body style="margin:0;background:#6b5a48;padding:60px">
    <div id="r" style="position:relative;width:380px;padding:28px 24px;font:20px/1.5 'DejaVu Sans Mono',monospace;color:#111;background:#fff">
      <div style="text-align:center;font-weight:bold;font-size:30px">BOOTS</div>
      <div style="text-align:center">Oxford Street</div>
      <div>NO7 SERUM 30ML&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;29.99</div>
      <div>TOOTHBRUSH HEADS&nbsp;&nbsp;&nbsp;&nbsp;12.98</div>
      <div>SUBTOTAL&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;42.97</div>
      <div>TOTAL TO PAY&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;42.97</div>
      <div>CONTACTLESS&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;42.97</div>
      <div>21/09/26 09:14</div>
      <div style="position:absolute;inset:-60px;background:linear-gradient(160deg,rgba(0,0,0,0) 45%,rgba(0,0,0,.55) 55%,rgba(0,0,0,.62))"></div>
    </div></body>`);
  const shaded = await shadePage.screenshot({ type: 'png', fullPage: true });
  await shadePage.close();
  await scanPage.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await scanPage.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await scanPage.getByRole('button', { name: 'Add a receipt' }).click();
  await scanPage.waitForTimeout(300);
  await scanPage.setInputFiles('#add-photo', { name: 'shaded.png', mimeType: 'image/png', buffer: shaded });
  const shadeFound = await scanPage.getByText('Read from your photo', { exact: true }).waitFor({ timeout: 120_000 }).then(() => true).catch(() => false);
  const shadeCard = shadeFound ? await scanPage.locator('main').innerText() : '';
  results['a receipt half in shadow is read too'] =
    shadeFound && /Boots/.test(shadeCard) && /£42\.97/.test(shadeCard) && /21 Sep/.test(shadeCard);
  /*
   * A receipt that came as a FILE: a PDF e-receipt, and an order email saved
   * out of a mail app. The PDF is one of the unit suite's fixtures — a real
   * PDF with a real text layer — opened through the same control a person
   * uses, so pdf.js, its worker and the parser are exercised together, and
   * pdf.js's worker must come from this app like the OCR reader's files do.
   */
  {
    let ownPdf = 0;
    scanPage.on('request', (r) => { if (new URL(r.url()).pathname.includes('pdf')) ownPdf += new URL(r.url()).origin === ORIGIN ? 1 : 0; });
    const before = elsewhere.length;
    await scanPage.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
    await scanPage.getByRole('button', { name: 'Skip' }).click().catch(() => {});
    await scanPage.getByRole('button', { name: 'Add a receipt' }).click();
    await scanPage.waitForTimeout(300);
    const pdf = readFileSync(new URL('../test/fixtures/documents/john-lewis-delivered-vat-line-before-the-total.pdf', import.meta.url));
    await scanPage.setInputFiles('#add-file', { name: 'e-receipt.pdf', mimeType: 'application/pdf', buffer: pdf });
    const pdfFound = await scanPage.getByText('Read from your file', { exact: true }).waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
    const pdfCard = pdfFound ? await scanPage.locator('main').innerText() : '';
    const pdfItem = pdfFound ? await scanPage.inputValue('#add-item').catch(() => '') : '';
    results['a PDF e-receipt is read on the device'] =
      pdfFound && /John Lewis/.test(pdfCard) && /£349\.00/.test(pdfCard) && /2 Sep/.test(pdfCard) && /Sony WH-1000XM6/.test(pdfItem);
    results['and its reader is this app’s own'] = ownPdf > 0 && elsewhere.length === before;
    if (!results['a PDF e-receipt is read on the device']) problems.push(`pdf read: ${pdfFound ? pdfCard.slice(0, 300).replace(/\n/g, ' | ') : 'no card'} · item=${pdfItem}`);

    // A saved order email: the HTML part only, quoted-printable, the figure in
    // its own table cell — the shape an order email takes on disk.
    const eml = [
      'From: "Currys" <orders@mail.example>',
      'Subject: Thanks for your order',
      'Date: Mon, 21 Sep 2026 10:00:00 +0100',
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset="utf-8"',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      '<html><body><table><tr><td>Thanks for your order - 21/09/2026</td></tr>',
      '<tr><td>1 x Russell Hobbs kettle</td><td>=C2=A339.99</td></tr>',
      '<tr><td>Total</td><td align=3D"right">=C2=A329.99</td></tr></table></body></html>',
      '',
    ].join('\r\n');
    await scanPage.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
    await scanPage.getByRole('button', { name: 'Skip' }).click().catch(() => {});
    await scanPage.getByRole('button', { name: 'Add a receipt' }).click();
    await scanPage.waitForTimeout(300);
    await scanPage.setInputFiles('#add-file', { name: 'order.eml', mimeType: 'message/rfc822', buffer: Buffer.from(eml) });
    const emlFound = await scanPage.getByText('Read from your file', { exact: true }).waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);
    const emlCard = emlFound ? await scanPage.locator('main').innerText() : '';
    results['a saved order email is read on the device'] = emlFound && /Currys/.test(emlCard) && /£29\.99/.test(emlCard) && /21 Sep/.test(emlCard);
    if (!results['a saved order email is read on the device']) problems.push(`eml read: ${emlFound ? emlCard.slice(0, 300).replace(/\n/g, ' | ') : 'no card'}`);

    // And a file that is no receipt says so, rather than reading nothing.
    await scanPage.setInputFiles('#add-file', { name: 'song.bin', mimeType: 'application/octet-stream', buffer: Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 0, 0]) });
    results['a file that is no receipt is named as such'] = await scanPage
      .getByText('That file is none of those', { exact: false })
      .waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
  }

  /*
   * And at an angle, on a table — how a receipt is actually photographed,
   * and the case the reader was never given: the slip turned fifteen degrees
   * and in perspective, small in a frame of wood grain. Read as taken, its
   * lines run uphill and the grain reads as text; the paper has to be found
   * and laid flat first (lib/flatten.ts).
   */
  const anglePage = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1 });
  await anglePage.setContent(`<body style="margin:0;width:900px;height:1200px;overflow:hidden;background:repeating-linear-gradient(95deg,#6d4c33 0 14px,#7a5739 14px 31px,#5f412b 31px 40px);display:grid;place-items:center">
    <div style="transform:scale(1.25)"><div style="transform:perspective(800px) rotateX(22deg) rotateY(-16deg) rotateZ(-9deg);background:#fbfaf6;color:#1a1a1a;width:340px;padding:26px 20px;font:15px/1.45 'DejaVu Sans Mono',monospace;box-shadow:0 12px 30px rgba(0,0,0,.35)">
      <div>Currys</div><div>Tottenham Court Rd</div><div>&nbsp;</div>
      <div>LG&nbsp;OLED55C4&nbsp;TV&nbsp;&nbsp;&nbsp;&nbsp;1,299.00</div><div>CARE&nbsp;&amp;&nbsp;REPAIR&nbsp;3YR&nbsp;&nbsp;&nbsp;149.00</div><div>&nbsp;</div>
      <div>TOTAL&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;1,448.00</div><div>AMEX&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;1,448.00</div><div>&nbsp;</div>
      <div>24/09/2026&nbsp;15:20</div>
    </div></div></body>`);
  const angled = await anglePage.screenshot({ type: 'png' });
  await anglePage.close();
  await scanPage.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await scanPage.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await scanPage.getByRole('button', { name: 'Add a receipt' }).click();
  await scanPage.waitForTimeout(300);
  await scanPage.setInputFiles('#add-photo', { name: 'angled.png', mimeType: 'image/png', buffer: angled });
  const angleFound = await scanPage.getByText('Read from your photo', { exact: true }).waitFor({ timeout: 120_000 }).then(() => true).catch(() => false);
  const angleCard = angleFound ? await scanPage.locator('main').innerText() : '';
  results['a receipt photographed at an angle on a table is laid flat and read'] =
    angleFound && /Currys/.test(angleCard) && /£1,448\.00/.test(angleCard) && /24 Sep/.test(angleCard);
  if (!results['a receipt photographed at an angle on a table is laid flat and read']) problems.push(`angled read: ${angleFound ? angleCard.slice(0, 300).replace(/\n/g, ' | ') : 'no card'}`);

  /*
   * Offline, a scan either works or says the connection is why it did not.
   *
   * Whether it works depends on the browser. The reader's worker fetches its
   * engine itself; where the browser routes a dedicated worker's requests
   * through the service worker they are cached after the first scan, and
   * where it does not they are fetched every time. One Chromium build here
   * bypassed the service worker and could not scan offline; CI's newer one did
   * not show the connection message within a minute, so either it scanned or
   * it hung, and the outcome is now reported to tell which. What must hold in
   * any browser is the message. It used to blame the photo ("flat, straight and in good
   * light"), sending someone offline to retake a picture that could never
   * have worked.
   */
  await scanCtx.setOffline(true);
  await scanPage.goto(`${ORIGIN}/app/`).catch(() => {});
  await scanPage.getByRole('button', { name: 'Add a receipt' }).click().catch(() => {});
  await scanPage.waitForTimeout(300);
  await scanPage.setInputFiles('#add-photo', { name: 'offline.png', mimeType: 'image/png', buffer: photo }).catch(() => {});
  const offlineOutcome = await Promise.race([
    scanPage.getByText('Read from your photo', { exact: true }).waitFor({ timeout: 90_000 }).then(() => 'read'),
    scanPage.getByText(/needs a connection/).waitFor({ timeout: 90_000 }).then(() => 'connection'),
    scanPage.getByText(/flat, straight and in good light/).waitFor({ timeout: 90_000 }).then(() => 'photo'),
  ]).catch(() => 'nothing');
  results['an offline scan works, or blames the connection, never the photo'] =
    offlineOutcome === 'read' || offlineOutcome === 'connection';
  if (!results['an offline scan works, or blames the connection, never the photo']) problems.push(`offline scan: ${offlineOutcome}`);
  await scanCtx.setOffline(false);

  /*
   * The same, with the browser still saying it is online. CI's Chromium kept
   * `navigator.onLine` true while offline, the first fix read that flag, and
   * the photo got the blame again. Wifi with no internet does the same on a
   * real phone. So the reader is made unreachable here with the flag left
   * alone, and the message still has to name the connection.
   */
  await scanCtx.route('**/ocr/**', (r) => r.abort());
  await scanPage.goto(`${ORIGIN}/app/`).catch(() => {});
  await scanPage.getByRole('button', { name: 'Add a receipt' }).click().catch(() => {});
  await scanPage.waitForTimeout(300);
  const stillOnline = await scanPage.evaluate(() => navigator.onLine);
  await scanPage.setInputFiles('#add-photo', { name: 'unreachable.png', mimeType: 'image/png', buffer: photo }).catch(() => {});
  const unreachableOutcome = await Promise.race([
    scanPage.getByText('Read from your photo', { exact: true }).waitFor({ timeout: 90_000 }).then(() => 'read'),
    scanPage.getByText(/needs a connection/).waitFor({ timeout: 90_000 }).then(() => 'connection'),
    scanPage.getByText(/flat, straight and in good light/).waitFor({ timeout: 90_000 }).then(() => 'photo'),
  ]).catch(() => 'nothing');
  results['an unreachable reader blames the connection, even when the browser says online'] =
    stillOnline && (unreachableOutcome === 'read' || unreachableOutcome === 'connection');
  if (!results['an unreachable reader blames the connection, even when the browser says online']) {
    problems.push(`unreachable reader: online=${stillOnline} ${unreachableOutcome}`);
  }
  await scanCtx.unroute('**/ocr/**');
  if (!results['a receipt half in shadow is read too']) {
    problems.push(`shaded scan read: ${shadeFound ? shadeCard.slice(0, 300).replace(/\n/g, ' | ') : 'no card'}`);
  }
  await scanCtx.close();
}

// The free tier is claimed on the pricing page, in Settings and on the Add
// screen. Fill it and the Save must actually refuse.
/*
 * First: the five receipts a fresh install arrives with must not spend the
 * allowance. Settings opened at "5 of 10 free receipts" before the person had
 * added anything, and the wall came after five of their own — with a price on
 * it. Read off the meter, because that is where somebody sees it.
 *
 * Its own context, because "a fresh install" is the whole claim and this page
 * has by now added, edited and returned things.
 */
{
  const freshCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const freshPage = await freshCtx.newPage();
  await freshPage.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await freshPage.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await freshPage.waitForTimeout(300);
  await freshPage.getByRole('button', { name: 'Settings', exact: true }).click();
  await freshPage.waitForTimeout(400);
  const meter = await freshPage.getByRole('progressbar').getAttribute('aria-valuenow');
  const seededCount = await freshPage.evaluate(() =>
    JSON.parse(localStorage.getItem('kept.v1')).receipts.filter((r) => r.demo && r.status === 'active').length);
  results['the demo set does not spend the free tier'] = seededCount > 0 && meter === '0';
  await freshCtx.close();
}

/*
 * The switches in Settings, driven from the screen.
 *
 * Every other check that depends on a setting writes it straight into storage
 * — `policyWatch` is set that way above — which proves the app READS the
 * setting and says nothing about whether the switch WRITES it. Measured:
 * `Toggle` calling `onChange(value)` instead of `onChange(!value)` made every
 * switch in Settings inert, and all eight sweeps passed. So did `toggleAlerts`
 * reading `want` backwards, which switches alerts ON when someone switches
 * them off — the defect `policyWatch` was fixed for, one layer up.
 *
 * Each switch is flipped twice and must land in the opposite state both times,
 * on screen AND on disk, so neither direction can be the one that works.
 * Its own context with notifications granted: turning alerts back on must not
 * lodge anything against the page the alert checks below read.
 */
{
  const switchCtx = await browser.newContext({ viewport: { width: 402, height: 874 }, permissions: ['notifications'] });
  /*
   * The same stand-in the main page uses, and for the same reason: CI runs
   * Chromium's headless shell, where Notification.permission reads 'denied'
   * whatever the context grants, so the app — correctly — says "Blocked by
   * your browser" and disables the switch. Measured: full Chromium left it
   * enabled, the headless shell did not, and this check hung CI on a click.
   * The stand-in shows nothing, so turning alerts back on here cannot put a
   * notification anywhere.
   */
  await switchCtx.addInitScript(() => {
    class StubNotification {
      static permission = 'granted';
      static requestPermission() { return Promise.resolve('granted'); }
    }
    window.Notification = StubNotification;
  });
  const sp = await switchCtx.newPage();
  await sp.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await sp.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await sp.waitForTimeout(300);
  await sp.getByRole('button', { name: 'Settings', exact: true }).click();
  await sp.waitForTimeout(400);
  const flip = async (name, key) => {
    const sw = sp.getByRole('switch', { name });
    // A disabled switch is a failed check, not a thirty-second hang that ends
    // the run and hides every check after it.
    if (await sw.isDisabled().catch(() => true)) return false;
    const before = await sw.getAttribute('aria-checked');
    await sw.click();
    await sp.waitForTimeout(400);
    const after = await sw.getAttribute('aria-checked');
    const stored = await sp.evaluate((k) => JSON.parse(localStorage.getItem('kept.v1')).settings[k], key);
    return before !== null && after === String(before !== 'true') && stored === (after === 'true');
  };
  const bothWays = async (name, key) => (await flip(name, key)) && (await flip(name, key));
  results['the policy watch switch writes what it shows, both ways'] = await bothWays(/Policy watch/, 'policyWatch');
  results['the deadline alerts switch writes what it shows, both ways'] = await bothWays(/Deadline alerts/, 'deadlineAlerts');

  /*
   * The privacy policy, reached the way guideline 5.1.1 asks for: from inside
   * the app. And back again, because in the iOS app there is no browser
   * chrome — the page's own link is the only way out.
   */
  await sp.getByRole('link', { name: 'Privacy policy' }).click();
  await sp.waitForLoadState('networkidle');
  const onPolicy =
    new URL(sp.url()).pathname === '/privacy/' &&
    (await sp.getByRole('heading', { level: 1, name: 'Privacy' }).isVisible().catch(() => false)) &&
    (await sp.locator('#contact').count()) === 1;
  await sp.getByRole('link', { name: /kept\./ }).first().click();
  await sp.waitForLoadState('networkidle');
  results['the privacy policy is one tap from Settings, with a way back'] =
    onPolicy && new URL(sp.url()).pathname === '/';
  await switchCtx.close();
}

await page.evaluate(() => {
  const state = JSON.parse(localStorage.getItem('kept.v1'));
  // Deliberately NOT demo rows: the point is ten receipts the person added.
  const { demo, ...base } = state.receipts[0];
  state.receipts = Array.from({ length: 10 }, (_, i) => ({ ...base, id: `q${i}`, item: `Item ${i}`, status: 'active' }));
  localStorage.setItem('kept.v1', JSON.stringify(state));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Add a receipt' }).click();
await page.waitForTimeout(300);
await page.fill('#paste', 'Your Apple order · Total £129.00 · 25 Aug');
await page.getByRole('button', { name: 'Read it' }).click();
await page.waitForTimeout(400);
const cappedSave = page.getByRole('button', { name: /Unlock unlimited to save this/ });
const beforeBlocked = await page.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.length);
await cappedSave.click({ force: true }).catch(() => {});
await page.waitForTimeout(300);
results['a full free tier actually refuses the save'] =
  (await cappedSave.isDisabled()) &&
  (await page.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).receipts.length)) === beforeBlocked;

/*
 * Tapping a price must not behave as though money changed hands.
 *
 * It did: the tier tiles dispatched plan:'pro' on the spot, so someone who
 * pressed the price watched the paywall vanish with no card box, no
 * confirmation and no word either way. The only reading available to them was
 * that they had just been charged it. Payments are not built, so nothing
 * was — which is exactly the thing the screen has to say.
 */
const planOf = () => page.evaluate(() => JSON.parse(localStorage.getItem('kept.v1')).settings.plan);
await page.getByRole('button', { name: 'Settings', exact: true }).click();
await page.waitForTimeout(400);
const priceButton = page.getByRole('button', { name: /^Unlock unlimited · £\d+\.\d{2}/ });
const pressed = ((await priceButton.innerText().catch(() => '')).match(/£\d+\.\d{2}/) ?? [])[0];
await priceButton.click();
await page.waitForTimeout(400);
const notice = page.getByRole('dialog');
const noticeSaid = (await notice.innerText().catch(() => '')) || '';
// The sheet names the price that was pressed, read off the button rather than
// written here, so a change of price is not a change to this check.
results['tapping a price does not pretend to charge for it'] =
  (await planOf()) === 'free' &&
  /charge/i.test(noticeSaid) &&
  !!pressed && noticeSaid.includes(pressed);
// And it must be leaveable without buying anything. The clicks below are
// guarded because the failure this section exists to catch removes the sheet
// entirely: an unguarded click would kill the harness before it printed a
// single verdict, and a suite that dies is not a suite that failed.
await page.getByRole('button', { name: 'Not now' }).click({ timeout: 2000 }).catch(() => {});
await page.waitForTimeout(400);
results['the notice can be dismissed, and nothing is unlocked'] =
  (await planOf()) === 'free' && (await page.getByRole('dialog').count()) === 0;
// The unlock itself is real, and the screen keeps saying it was free.
await priceButton.click({ timeout: 2000 }).catch(() => {});
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Unlock everything, free' }).click({ timeout: 2000 }).catch(() => {});
await page.waitForTimeout(500);
results['unlocking says, where the price was, that nothing was charged'] =
  (await planOf()) === 'pro' &&
  /Nothing was charged/.test(await page.locator('main').innerText());
await page.evaluate(() => {
  const state = JSON.parse(localStorage.getItem('kept.v1'));
  state.settings.plan = 'free';
  localStorage.setItem('kept.v1', JSON.stringify(state));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);

/*
 * The marketing page embeds this same build at this same origin, so the demo
 * was reading and writing the real app's storage — swipe a receipt in the shop
 * window and you had changed what the installed app shows. It must be able to
 * do anything and change nothing.
 */
const storedBefore = await page.evaluate(() => localStorage.getItem('kept.v1'));
const landing = await ctx.newPage();
await landing.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
await landing.waitForTimeout(1200);
// This context is phone-width, so the demo sits well below the fold. Without
// scrolling to it the drag below lands on empty page and the check measures
// nothing.
await landing.locator('iframe[title="kept — live app demo"]').scrollIntoViewIfNeeded();
await landing.waitForTimeout(600);
const demo = landing.frameLocator('iframe[title="kept — live app demo"]');
const demoRow = demo.getByRole('button', { name: /Currys, JBL/ });
// And the row into the middle of the demo's own screen: the app opens on its
// balance, so the list starts below the fold inside the frame too.
await demoRow.evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => {});
await landing.waitForTimeout(300);
const demoBox = await demoRow.boundingBox();
if (demoBox) {
  const y = demoBox.y + demoBox.height / 2;
  await landing.mouse.move(demoBox.x + demoBox.width - 30, y);
  await landing.mouse.down();
  for (let dx = 0; dx <= 110; dx += 22) {
    await landing.mouse.move(demoBox.x + demoBox.width - 30 - dx, y);
    await landing.waitForTimeout(30);
  }
  await landing.mouse.up();
  await landing.waitForTimeout(700);
}
results['the landing demo works'] = await demo.getByText('Money back', { exact: true }).isVisible().catch(() => false);
/*
 * The marketing page has to be able to reach the product.
 *
 * Its call to action was an App Store badge with `href="#"` — a promise of an
 * iOS app that does not exist, pointing at nothing — and the nav button beside
 * it went to the pricing section. The page's only mention of /app/ was the
 * demo iframe's src, so someone who read the whole thing and wanted to use
 * kept had nowhere to click. A funnel with no exit is not something any other
 * check here would notice: nothing overflows, nothing fails contrast, and a
 * dead link is a perfectly valid one.
 */
// EVERY link that offers to open the app, not the first one that happens to.
// Checking one of them passes while the others are dead — which it did: the
// nav button satisfied this while the hero's still pointed at "#".
const ctas = await landing.evaluate(() =>
  [...document.querySelectorAll('a')]
    .filter((a) => /open kept/i.test(a.textContent ?? ''))
    .map((a) => a.getAttribute('href')),
);
results['the landing page has a way into the app'] =
  ctas.length >= 2 && ctas.every((h) => h === '/app/');

// And one of them is followed, because an href is not a working link.
await landing.getByRole('link', { name: /Open kept/ }).last().click();
await landing.waitForTimeout(900);
results['and its call to action actually opens it'] = new URL(landing.url()).pathname === '/app/';
await landing.goBack({ waitUntil: 'networkidle' }).catch(() => {});
await landing.waitForTimeout(400);

results['the landing demo cannot touch the real app’s data'] =
  (await page.evaluate(() => localStorage.getItem('kept.v1'))) === storedBefore;
await landing.close();

/*
 * The demo, asked to do the most it offers rather than the least.
 *
 * A swipe in the frame, above, is the gentlest thing a visitor does there, and
 * it was the only thing this suite asked of it. Erase everything, pressed in
 * the demo, wrote an empty library over the visitor's real one — measured,
 * [Sofa, Kettle, Coat] became [] — because that screen called the store
 * directly, and nothing on its path asked whether this was the demo. Opened
 * here as `/app/?embed=1`, which is the demo, framed or not.
 *
 * The real app's data is planted, and read back, from a page that is not the
 * app (`/privacy/`), so nothing runs against it but the demo under test. Its
 * own contexts, so the main page's library is not in the way.
 */
{
  const demoCtx = await browser.newContext({ viewport: { width: 402, height: 874 }, acceptDownloads: true });
  const realOne = (id, item, pence) => ({
    id, store: 'John Lewis', item, cat: 'other', amount: pence, purchasedOn: '2026-09-28',
    windowDays: 35, policy: 'John Lewis · 35 days', distance: false, status: 'active',
  });
  const realLibrary = JSON.stringify({
    version: 1, onboardingSeen: true, updates: [], alertsSent: [],
    settings: { urgentDays: 7, plan: 'free', deadlineAlerts: false, policyWatch: false, remindersExplained: true },
    receipts: [realOne('r_1', 'Sofa', 89900), realOne('r_2', 'Kettle', 4999), realOne('r_3', 'Coat', 12000)],
  });
  const plant = async (cells) => {
    const p = await demoCtx.newPage();
    await p.goto(`${ORIGIN}/privacy/`, { waitUntil: 'domcontentloaded' });
    await p.evaluate((c) => {
      localStorage.clear();
      for (const [k, v] of Object.entries(c)) localStorage.setItem(k, v);
    }, cells);
    await p.close();
  };
  const onDisk = async () => {
    const p = await demoCtx.newPage();
    await p.goto(`${ORIGIN}/privacy/`, { waitUntil: 'domcontentloaded' });
    const cells = await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
    await p.close();
    return cells;
  };
  const itemsIn = (raw) => {
    try {
      return JSON.parse(raw).receipts.map((r) => r.item).join(', ');
    } catch {
      return null;
    }
  };
  const openDemo = async (ctx = demoCtx) => {
    const p = await ctx.newPage();
    await p.goto(`${ORIGIN}/app/?embed=1`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(400);
    return p;
  };

  // Erase everything: the demo's own receipts go, and nothing else.
  await plant({ 'kept.v1': realLibrary });
  const eraser = await openDemo();
  await eraser.getByRole('button', { name: 'Settings', exact: true }).click();
  await eraser.waitForTimeout(300);
  await eraser.getByRole('button', { name: 'Erase everything' }).click();
  await eraser.waitForTimeout(300);
  const warning = await eraser.locator('main').innerText();
  await eraser.getByRole('button', { name: 'Erase everything' }).click({ timeout: 2000 }).catch(() => {});
  await eraser.waitForTimeout(600);
  await eraser.getByRole('button', { name: 'Receipts', exact: true }).click({ timeout: 2000 }).catch(() => {});
  await eraser.waitForTimeout(400);
  const demoCleared = await eraser.getByText('Nothing tracked yet').isVisible().catch(() => false);
  await eraser.close();
  results['erasing in the demo clears the demo and leaves the real library alone'] =
    demoCleared && itemsIn((await onDisk())['kept.v1']) === 'Sofa, Kettle, Coat';
  // It counted the demo's five samples and said "from this device".
  results['the demo’s erase says it clears the demo, not this device'] =
    /in this demo/.test(warning) && !/from this device/.test(warning);

  // The copy a bad launch set aside: the demo showed it, and saving it from
  // there threw the real one away.
  const realAside = '{"version":1,"onboardingSeen":true,"receipts":[{"id":"mine","store":"Currys","item":"Kettle"';
  await plant({ 'kept.v1': realLibrary, 'kept.v1.unreadable': realAside });
  const asideDemo = await openDemo();
  await asideDemo.getByRole('button', { name: 'Settings', exact: true }).click();
  await asideDemo.waitForTimeout(300);
  const offered = await asideDemo.getByRole('button', { name: 'Save them as a file' }).isVisible().catch(() => false);
  await asideDemo.getByRole('button', { name: 'Save them as a file' }).click({ timeout: 2000 }).catch(() => {});
  await asideDemo.waitForTimeout(600);
  await asideDemo.close();
  results['the demo neither offers nor discards the real set-aside copy'] =
    !offered && (await onDisk())['kept.v1.unreadable'] === realAside;

  // Merely opened, over a store the app cannot read: reading it was enough
  // for the demo's launch to set a copy aside.
  const truncated = '{"version":1,"receipts":[{"id":"r1","store":"Currys"';
  await plant({ 'kept.v1': truncated });
  await (await openDemo()).close();
  const afterOpening = await onDisk();
  results['opening the demo writes nothing, even over a store it cannot read'] =
    afterOpening['kept.v1'] === truncated && Object.keys(afterOpening).length === 1;

  // The crash screen, inside the demo: its rescue read the real store and
  // handed the visitor's library over as a file, under a sentence about the
  // demo's samples. Broken the way the rescue check above breaks the app.
  await plant({ 'kept.v1': realLibrary });
  const crashed = await demoCtx.newPage();
  await crashed.addInitScript(() => {
    // eslint-disable-next-line no-extend-native
    Number.prototype.toLocaleString = function toLocaleString() {
      throw new Error('simulated platform failure');
    };
  });
  await crashed.goto(`${ORIGIN}/app/?embed=1`, { waitUntil: 'domcontentloaded' });
  await crashed.waitForTimeout(900);
  const crashSays = await crashed.locator('main').innerText().catch(() => '');
  const rescueOffered = await crashed.getByRole('button', { name: 'Save my receipts to a file' }).isVisible().catch(() => false);
  results['the demo’s crash screen does not hand over the real library'] =
    /Something in kept broke/.test(crashSays) && /This is the demo/.test(crashSays) && !rescueOffered;
  await crashed.close();
  await demoCtx.close();

  /*
   * Notifications, from the demo opened outside any frame, which the frame
   * check in notify.ts never covered. Permission is the ORIGIN's, so a prompt
   * the demo raised and the visitor refused would block the real app's alerts.
   */
  const notifying = async (permission) => {
    const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, permissions: ['notifications'] });
    await ctx.addInitScript((granted) => {
      window.__asked = 0;
      window.__shown = 0;
      class StubNotification {
        static permission = granted;
        static requestPermission() {
          window.__asked += 1;
          StubNotification.permission = 'granted';
          return Promise.resolve('granted');
        }
        constructor() {
          window.__shown += 1;
        }
      }
      window.Notification = StubNotification;
      if (window.ServiceWorkerRegistration) {
        ServiceWorkerRegistration.prototype.showNotification = function showNotification() {
          window.__shown += 1;
          return Promise.resolve();
        };
      }
    }, permission);
    return ctx;
  };
  const askCtx = await notifying('default');
  const asking = await openDemo(askCtx);
  await asking.getByRole('button', { name: 'Settings', exact: true }).click();
  await asking.waitForTimeout(300);
  const alertsSwitch = asking.getByRole('switch', { name: /Deadline alerts/ });
  const switchFound = await alertsSwitch.isVisible().catch(() => false);
  await alertsSwitch.click({ timeout: 2000 }).catch(() => {});
  await asking.waitForTimeout(400);
  results['the demo asks for no notification permission'] =
    switchFound && (await asking.evaluate(() => window.__asked)) === 0;
  await askCtx.close();

  // A receipt of the visitor's own making, four days from its deadline: the
  // samples never raise an alert, so this is the one the demo would warn about.
  const toldCtx = await notifying('granted');
  const told = await openDemo(toldCtx);
  const bought = new Date(Date.now() - 10 * 86_400_000);
  await told.getByRole('button', { name: 'Add a receipt' }).click();
  await told.waitForTimeout(300);
  await told.fill('#paste', `Your Currys order · Total £49.00 · ${bought.getDate()} ${bought.toLocaleString('en-GB', { month: 'short' })}`);
  await told.getByRole('button', { name: 'Read it' }).click();
  await told.waitForTimeout(300);
  await told.fill('#add-item', 'Toaster');
  await told.getByRole('button', { name: 'Save receipt' }).click();
  await told.waitForTimeout(1500);
  const toasterHeld = await told.getByText('Toaster').first().isVisible().catch(() => false);
  results['the demo shows no notification, even about a receipt added to it'] =
    toasterHeld && (await told.evaluate(() => window.__shown)) === 0;
  await toldCtx.close();

  // The service worker, in a profile that has never opened the app: reading
  // the marketing page installed it, and its cache, from the demo's frame.
  const freshCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const visit = await freshCtx.newPage();
  await visit.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' });
  await visit.locator('iframe[title="kept — live app demo"]').scrollIntoViewIfNeeded();
  const demoRan = await visit
    .frameLocator('iframe[title="kept — live app demo"]')
    .getByRole('button', { name: 'Settings', exact: true })
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  // The registration waited for the frame's own load event, so give it that.
  await visit.waitForTimeout(2000);
  const workers = await visit.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((r) => r.scope));
  results['visiting the landing page installs no service worker'] = demoRan && workers.length === 0;
  await freshCtx.close();
}

// The manifest has to be installable-shaped, because "add it to your home
// screen" is how the share target and the offline promise are reached at all.
// A POST target, in a form the worker reads: as a GET the email was sent to
// the server in the address (see `receiveShare` in public/sw.js).
const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
results['the manifest is installable and declares the share target'] =
  !!manifest.name && !!manifest.start_url && manifest.display === 'standalone' &&
  Array.isArray(manifest.icons) && manifest.icons.some((i) => i.sizes === '512x512') &&
  manifest.share_target?.method === 'POST' && manifest.share_target?.enctype === 'multipart/form-data';

/*
 * Offline is deliberately NOT tested here, and this note is the reason.
 *
 * It was, for a while, under a comment claiming "the network is cut
 * completely". It was not: `setOffline` governs the PAGE's network and leaves
 * a service worker's own fetches alone, so every request the worker answered
 * went on reaching the live server. Measured afterwards — both checks passed
 * against a worker that intercepted everything and cached NOTHING, which is an
 * app that dies the moment it is actually on a train. They proved a worker was
 * installed, and read as proof of the app's central claim.
 *
 * The only way to cut a worker's network is to stop the server, and a script
 * cannot stop a server it did not start. So offline belongs to
 * scripts/freshness.mjs, which starts its own.
 */

/*
 * Two tabs. Both hold the whole library in memory and both write all of it, so
 * the one with older state used to destroy whatever the other had added — a
 * setting toggle in the stale tab was enough, and it happened in silence.
 * Its own context so the tabs share an origin without disturbing the run.
 */
{
  const tabsCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const tabOne = await tabsCtx.newPage();
  await tabOne.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await tabOne.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await tabOne.waitForTimeout(400);
  const tabTwo = await tabsCtx.newPage();
  await tabTwo.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await tabTwo.waitForTimeout(600);

  await tabOne.bringToFront();
  await tabOne.getByRole('button', { name: 'Add a receipt' }).click();
  await tabOne.waitForTimeout(300);
  await tabOne.fill('#paste', 'Your Apple order · Total £129.00 · 25 Aug');
  await tabOne.getByRole('button', { name: 'Read it' }).click();
  await tabOne.waitForTimeout(300);
  await tabOne.fill('#add-item', 'AirPods Pro');
  await tabOne.getByRole('button', { name: 'Save receipt' }).click();
  await tabOne.waitForTimeout(600);

  // The stale tab now writes, for an unrelated reason.
  await tabTwo.bringToFront();
  await tabTwo.getByRole('button', { name: 'Settings', exact: true }).click();
  await tabTwo.waitForTimeout(300);
  await tabTwo.getByRole('switch', { name: /Policy watch/ }).click();
  await tabTwo.waitForTimeout(700);

  results['a second tab does not destroy the first tab’s receipt'] = await tabTwo.evaluate(() =>
    JSON.parse(localStorage.getItem('kept.v1')).receipts.some((r) => r.item === 'AirPods Pro'),
  );
  await tabsCtx.close();
}

/*
 * A write that does not land. There is no server behind this app, so a failed
 * save means the receipts are gone at the next launch while the screen still
 * shows them — it used to happen in complete silence. Its own context, because
 * breaking storage would derail every check after it.
 */
{
  const fullCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const fullPage = await fullCtx.newPage();
  await fullPage.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await fullPage.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await fullPage.waitForTimeout(300);
  await fullPage.evaluate(() => {
    const real = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (k, v) => {
      if (k === 'kept.v1') throw new DOMException('Quota', 'QuotaExceededError');
      return real(k, v);
    };
  });
  // Any change at all triggers a write.
  await fullPage.getByRole('button', { name: /Zara, Wool-blend/ }).click();
  await fullPage.waitForTimeout(300);
  await fullPage.getByRole('button', { name: 'Got my money back' }).click();
  await fullPage.waitForTimeout(500);
  await fullPage.getByRole('button', { name: 'Back to receipts' }).click();
  await fullPage.waitForTimeout(500);
  results['a failed save is not silent'] =
    await fullPage.getByText(/This device isn.t saving/).isVisible().catch(() => false);
  await fullCtx.close();
}

/*
 * Midnight, without a reload. Phones resume a PWA from the background rather
 * than reloading it, so a deadline tracker left open overnight must notice the
 * date turning over — it did not, and went on reporting yesterday's counts.
 * Its own page and context, because installing a clock rewrites timers.
 */
{
  const clockCtx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  const clockPage = await clockCtx.newPage();
  await clockPage.clock.install({ time: new Date('2026-09-10T22:00:00Z') });
  await clockPage.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
  await clockPage.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await clockPage.waitForTimeout(400);
  const heroDays = () =>
    clockPage.evaluate(() => {
      const label = [...document.querySelectorAll('span')].find((s) => s.textContent.trim() === 'Next to close');
      const spans = [...(label?.closest('button')?.querySelectorAll('span') ?? [])];
      return spans.find((s) => /^\d+$|^Today$|^Gone$/.test(s.textContent.trim()))?.textContent.trim() ?? null;
    });
  const beforeMidnight = await heroDays();
  await clockPage.clock.fastForward('03:00:00');
  await clockPage.waitForTimeout(600);
  const afterMidnight = await heroDays();
  results['the day count follows the clock past midnight'] =
    beforeMidnight === '2' && afterMidnight === '1';
  await clockCtx.close();
}

/*
 * A single unreadable row on disk must not take the app down. It did: a
 * receipt with no purchase date produced a completely blank screen on every
 * launch, with no way out but clearing site data by hand.
 */
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('kept.v1'));
  s.receipts = [{ ...s.receipts[0], id: 'corrupt', purchasedOn: undefined }, ...s.receipts.slice(1)];
  localStorage.setItem('kept.v1', JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
results['a corrupt stored receipt does not blank the app'] =
  (await page.getByText('Return deadlines, watched', { exact: true }).isVisible().catch(() => false)) &&
  (await page.evaluate(() => document.body.innerText.length)) > 100;

// Last, because it takes everything with it: erase must clear the disk, not
// just the screen, and must not resurrect the demo data on the next launch.
await page.goto(`${ORIGIN}/app/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Settings', exact: true }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Erase everything' }).click();
await page.waitForTimeout(300);
const heldBeforeWipe = await receiptCount();
await page.getByRole('button', { name: 'Keep them' }).click();
await page.waitForTimeout(300);
results['the first tap only asks'] = (await receiptCount()) === heldBeforeWipe && heldBeforeWipe > 0;

await page.getByRole('button', { name: 'Erase everything' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Erase everything' }).click();
await page.waitForTimeout(600);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
results['erasing clears the disk and does not reseed'] =
  (await receiptCount()) === 0 && (await page.getByText('Nothing tracked yet').isVisible());

// Last, so that everything every context loaded has been seen.
/*
 * `requestsSeen > 0` is the vacuity guard, not decoration: an empty `foreign`
 * is the same value whether nothing foreign was fetched or nothing was
 * watched at all, and the second is what a broken wrapper or a Playwright
 * event rename would produce. A run that observed no request whatsoever has
 * not answered the question, so it does not get to say yes.
 */
results['nothing is fetched from a third party'] = requestsSeen > 0 && foreign.size === 0;
results['no console or page errors'] = problems.length === 0;

await browser.close();
report();
