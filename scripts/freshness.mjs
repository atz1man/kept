/*
 * Does what we deploy actually reach an installed app — and does the app still
 * work when nothing is deployed to it at all?
 *
 * Kept makes two promises that pull against each other. "Verified policy
 * updates the day they change" needs the network to win; "check a deadline on
 * the train, with no signal" needs the cache to. The service worker is where
 * they meet, and where either can quietly stop being true — quietly, because a
 * frozen feed looks exactly like a quiet week and a working app looks exactly
 * like a working app.
 *
 * It had already stopped being true. A worker is consulted BEFORE the HTTP
 * cache, so the app's own `cache: 'no-cache'` on the feed fetch was not a
 * defence, and the cache-first rule written for hashed bundles swallowed the
 * one file whose entire purpose is to change: an installed app never saw
 * another policy update until the next deploy renamed the cache.
 *
 * This sweep owns its own server, on its own port, for one reason: the offline
 * half cannot be faked. Playwright's `setOffline` and `route` both govern the
 * PAGE's network and leave a service worker's own fetches untouched — measured,
 * after an earlier version of this file passed a network-only worker with no
 * cache fallback at all and reported success for a question it never asked. So
 * the server is stopped for real, and what happens next is what happens on the
 * train.
 *
 * It also asks what a phone actually does between deploys, because each of these
 * was a white screen or a dead feature on main, and the checks above could not
 * see one of them — they reload the page before going offline, which is the one
 * order of events that hides all of it:
 *
 *   - a first visit, never reloaded, then no signal;
 *   - a deploy, one online launch, then no signal;
 *   - a deploy whose download drops one request, then no signal;
 *   - and a feed signature that changes.
 *
 * Each runs in its own browser profile, against a server on the same port, so
 * no step inherits another's worker. The deploy is a real second build of the
 * same source with every chunk renamed (see `buildDeploy`).
 *
 * Needs a build: npm run build && node scripts/freshness.mjs
 */
import { chromium } from 'playwright';
import { reportOnCrash, sayCrash } from './crash-report.mjs';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.KEPT_FRESHNESS_PORT ?? 4199);
const ORIGIN = `http://localhost:${PORT}`;
const EXEC = process.env.CHROMIUM_PATH;
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FEED_FILE = `${ROOT}dist/policy-feed.json`;
const FEED_URL = '/policy-feed.json';
const NEW_ID = 'freshness-probe-change';
const VITE_BIN = `${ROOT}node_modules/vite/bin/vite.js`;
const SIG_FILE = `${ROOT}dist/policy-feed.sig`;
/** The second deploy: the same source, built again with every chunk renamed. */
const DEPLOY_B = `${ROOT}dist-freshness-b`;
/** What the library's heading says — on screen means the app booted and read its store. */
const HEADING = 'Return deadlines, watched';

/** The three the offline half is for — named, so they can be marked unasked. */
const OFFLINE_CHECKS = [
  'the app launches with the network gone',
  'and is still usable, not just painted',
  'and the feed falls back to the copy already held',
];

if (!existsSync(FEED_FILE)) {
  console.log('✗ no build to serve — run `npm run build` first');
  process.exit(1);
}

const original = readFileSync(FEED_FILE, 'utf8');
const results = {};
const problems = [];
reportOnCrash(report);

/*
 * The port has to be free FIRST. `--strictPort` makes a second server exit
 * rather than slide to 4200, so a stray one left by an earlier run would be
 * the thing `startPreview` found, the thing every check ran against, and the
 * thing `stopServer` could not kill because it never started it. The sweep has
 * to own the server it stops, and this is the only moment it can say so.
 */
if (await fetch(`${ORIGIN}/app/`).then(() => true, () => false)) {
  console.log(`✗ something is already serving ${ORIGIN} — this sweep must own the server it stops`);
  process.exit(1);
}

/*
 * Its own preview server, in its own process group, so it can be stopped.
 *
 * Node running vite's own entry, not `npx vite` — and that is the whole of it
 * working. npm exec puts each child in a NEW process group: measured here, the
 * `npm exec` at pgid 22995, the `sh` it ran at 23011, and the node actually
 * holding the port at 23012. So `kill(-pid)` on what spawn handed back reached
 * npm and nothing else, and the server this sweep believed it had stopped went
 * on serving. The offline half then asked its questions of a machine that was
 * still online, and every one of them passed.
 *
 * Spawned directly, the pid IS the process holding the port, and `detached`
 * makes it the leader of its own group.
 *
 * Every server below — the preview of either build, and the two that misbehave
 * on purpose — goes through `running`, so whichever is up when a step throws is
 * the one `finally` stops.
 */
let running = null;

/** Whether anything accepts a connection on the port — a server that never answers included. */
const listening = () =>
  new Promise((resolve) => {
    const socket = connect({ port: PORT, host: 'localhost', autoSelectFamily: true });
    const done = (yes) => {
      socket.destroy();
      resolve(yes);
    };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(1000, () => done(false));
  });

/**
 * Stops whatever is running, and does not take the caller's word for it:
 * returns only once the port has actually stopped accepting. A kill that
 * silently missed is exactly the failure above, and it is invisible from the
 * signal alone.
 */
async function stopServer() {
  if (!running) return true;
  const server = running;
  running = null;
  await server.close();
  for (let i = 0; i < 50; i += 1) {
    if (!(await listening())) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

async function startPreview(outDir) {
  const child = spawn(process.execPath, [VITE_BIN, 'preview', '--outDir', outDir, '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
  });
  running = {
    close: async () => {
      // The negative pid kills the group — the server and anything it spawned —
      // and nothing else. `pkill -f vite` would take this script's own shell with it.
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* already gone */
      }
    },
  };
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`${ORIGIN}/app/`);
      if (res.ok) return true;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2',
};

/**
 * A server in this process, for the two networks vite preview cannot be:
 * one that accepts a connection and never answers (`answer` returns nothing),
 * and one that drops a single request. Bound to `localhost` as preview is, so
 * the browser reaches it at the same origin and the same worker.
 */
async function startOwn(answer) {
  const sockets = new Set();
  const server = createServer(answer);
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, 'localhost', resolve);
  });
  running = {
    close: async () => {
      server.close();
      // A stalled request holds its socket open for ever; close() alone waits on it.
      for (const socket of sockets) socket.destroy();
    },
  };
}

/** A file from a build, as a static host would serve it. */
function serveFile(dir, req, res) {
  let path = decodeURIComponent(new URL(req.url, ORIGIN).pathname);
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = readFileSync(join(dir, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}

/** The cache a build's worker keeps — named in its sw.js, so a step can wait for that worker. */
const cacheOf = (dir) => /const CACHE = '([^']+)'/.exec(readFileSync(join(dir, 'sw.js'), 'utf8'))?.[1] ?? null;

/** The script a build's app document boots from: which build is on screen. */
const bootOf = (dir) => /<script[^>]*type="module"[^>]*src="([^"]+)"/.exec(readFileSync(join(dir, 'app/index.html'), 'utf8'))?.[1] ?? null;

/*
 * The second deploy, built here rather than supplied, because a deploy is what
 * the steps below are about and a hand-made one would be a guess at what a
 * build emits.
 *
 * The same source, with one statement added to the end of every chunk. That is
 * enough to rename every chunk, which is what a deploy that touches shared
 * code does to an installed app — and the tab-left-open step needs it: a lazy
 * chunk whose name survived the deploy would still be on the server, and the
 * step would pass for a reason that has nothing to do with the worker. A
 * comment is not enough; the minifier strips it and every hash stays put
 * (measured — the first attempt built an identical app). The statement also
 * lets the page say which build it is running.
 */
async function buildDeploy() {
  const { build } = await import('vite');
  await build({
    root: ROOT,
    logLevel: 'error',
    build: { outDir: DEPLOY_B, emptyOutDir: true },
    plugins: [
      {
        name: 'freshness-second-deploy',
        renderChunk: (code) => ({ code: `${code}\n;globalThis.__keptDeploy = "B";`, map: null }),
      },
    ],
  });
}

/*
 * What a phone does between deploys.
 *
 * Every check above installs the worker and then RELOADS before going offline,
 * so the page's own bundles are fetched a second time, through the worker, and
 * cached. That is the one order of events that hides every defect below, and
 * it is not the order a person lives in. Measured on main, each of these was
 * a white screen, a launch that never came, or a feature that could not work
 * again — and this sweep passed.
 *
 * Each step runs in its own browser profile (its own worker, its own caches)
 * against a server on the same port, so nothing carries over between them.
 * Every wait is on a condition, never a sleep standing in for one.
 */
const FIRST_VISIT = 'a first visit, never reloaded, opens with the network gone';
const AFTER_DEPLOY = 'after a deploy and one online launch, the new version opens with the network gone';
const DROPPED = 'a deploy whose download drops one request leaves the installed version opening offline';

const deployErrors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function step(names, work, options = {}) {
  const context = await browser.newContext({ viewport: { width: 402, height: 874 }, ...options });
  context.on('page', (p) => p.on('pageerror', (e) => deployErrors.push(`pageerror (${names[0]}): ${e.message.split('\n')[0]}`)));
  try {
    await work(context);
  } catch (e) {
    problems.push(`${names[0]}: ${e.message.split('\n')[0]}`);
  } finally {
    for (const name of names) if (!(name in results)) results[name] = false;
    await Promise.race([context.close(), sleep(5000)]);
    await stopServer();
  }
}

/** Cut the network for real; when it will not go, the step's offline questions are unasked. */
async function goOffline(names) {
  if (await stopServer()) return;
  for (const name of names) results[name] = null;
  throw new Error('the server never stopped');
}

async function serve(dir) {
  if (!(await startPreview(dir))) throw new Error(`preview of ${dir} never came up on ${PORT}`);
}

/** The library's heading on screen: the app booted, from wherever, and read its store. */
const shows = (page, ms) =>
  page.getByText(HEADING, { exact: true }).waitFor({ state: 'visible', timeout: ms }).then(() => true, () => false);

const bootOn = (page) =>
  page.evaluate(() => document.querySelector('script[type="module"][src]')?.getAttribute('src') ?? null).catch(() => null);

/** Installed as a person installs it: open the app, past the welcome, worker in charge. */
async function install(context, { reload }) {
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/app/`, { waitUntil: 'load' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  if (reload) await page.reload({ waitUntil: 'load' });
  await page.getByRole('button', { name: 'Skip' }).click({ timeout: 5000 }).catch(() => {});
  if (!(await shows(page, 5000))) throw new Error('the app never showed its library online');
  return page;
}

/** Close and reopen the app; true when the library is on screen. */
const relaunch = (page) =>
  page.reload({ waitUntil: 'domcontentloaded' }).then(() => shows(page, 5000), () => false);

/** Wait until the only cache is the named one — that worker has activated and cleared the rest. */
async function onlyCache(page, name) {
  for (let i = 0; i < 80; i += 1) {
    const keys = await page.evaluate(() => caches.keys()).catch(() => []);
    if (keys.length === 1 && keys[0] === name) return true;
    await sleep(250);
  }
  return false;
}

async function acrossDeploys() {
  const bootA = bootOf(`${ROOT}dist`);
  const bootB = bootOf(DEPLOY_B);
  const cacheB = cacheOf(DEPLOY_B);
  if (!bootA || !bootB || bootA === bootB || !cacheB || cacheB === cacheOf(`${ROOT}dist`)) {
    // Two builds that boot the same script are one build, and every step below
    // would pass for want of a deploy. Not asked, rather than passed.
    throw new Error(`the second build is not a deploy: boots ${bootB} against ${bootA}, cache ${cacheB}`);
  }

  // The page loads its bundles before the worker exists — a first visit is
  // never controlled — so the worker must have fetched them itself.
  await step([FIRST_VISIT], async (context) => {
    await serve('dist');
    const page = await install(context, { reload: false });
    await goOffline([FIRST_VISIT]);
    results[FIRST_VISIT] = await relaunch(page);
  });

  // One online launch after a deploy is all most people give it. The new
  // version's bundles then went through the OLD worker into the old cache,
  // and the new worker deleted that cache as it took over.
  await step([AFTER_DEPLOY], async (context) => {
    await serve('dist');
    const page = await install(context, { reload: true });
    await stopServer();
    await serve(DEPLOY_B);
    await page.reload({ waitUntil: 'load' });
    const online = (await shows(page, 5000)) && (await bootOn(page)) === bootB;
    if (!online) problems.push(`${AFTER_DEPLOY}: the deploy did not reach the online launch`);
    const took = await onlyCache(page, cacheB);
    if (!took) problems.push(`${AFTER_DEPLOY}: the new worker never took over`);
    await goOffline([AFTER_DEPLOY]);
    results[AFTER_DEPLOY] = online && took && (await relaunch(page)) && (await bootOn(page)) === bootB;
  });

  // One request dropped while the new worker downloads the deploy — the
  // worker's own fetch of the shell, which nothing else asks for. The version
  // already installed must survive it: a failed download is no reason to
  // throw away a working copy.
  await step([DROPPED], async (context) => {
    await serve('dist');
    const page = await install(context, { reload: true });
    await stopServer();
    let dropped = false;
    await startOwn((req, res) => {
      if (new URL(req.url, ORIGIN).pathname === '/app/' && req.headers['sec-fetch-mode'] !== 'navigate') {
        dropped = true;
        res.writeHead(503);
        res.end('dropped');
        return;
      }
      serveFile(DEPLOY_B, req, res);
    });
    await page.reload({ waitUntil: 'load' });
    for (let i = 0; i < 80 && !dropped; i += 1) await sleep(250);
    if (!dropped) throw new Error('the new worker never asked for the shell');
    // Then until that worker has finished, one way or the other.
    let settled = false;
    for (let i = 0; i < 80 && !settled; i += 1) {
      settled = await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration('/app/');
        return !reg?.installing && !reg?.waiting && reg?.active?.state === 'activated';
      }).catch(() => false);
      if (!settled) await sleep(250);
    }
    if (!settled) throw new Error('the new worker never finished installing or failing');
    await goOffline([DROPPED]);
    results[DROPPED] = (await relaunch(page)) && (await bootOn(page)) === bootA;
  });

  results['and no page errors across the deploys'] = deployErrors.length === 0;
  problems.push(...deployErrors);
}

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const ctx = await browser.newContext({ viewport: { width: 402, height: 874 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

/** Ask for the feed from inside the page, so the worker is in the path. */
const askFeed = () =>
  page.evaluate(async (u) => {
    try {
      const res = await fetch(u, { cache: 'no-cache' });
      if (!res.ok) return { ok: false, why: `status ${res.status}` };
      const doc = await res.json();
      return { ok: true, ids: doc.updates.map((x) => x.id) };
    } catch (e) {
      return { ok: false, why: String(e.message) };
    }
  }, FEED_URL).catch((e) => ({ ok: false, why: e.message.split('\n')[0] }));

try {
  await buildDeploy();
  if (!(await startPreview('dist'))) throw new Error(`preview never came up on ${PORT}`);

  await page.goto(`${ORIGIN}/app/`, { waitUntil: 'load' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Reload so the worker is controlling this page rather than merely installed.
  await page.reload({ waitUntil: 'load' });
  results['the worker controls the page'] = await page.evaluate(() => !!navigator.serviceWorker.controller);

  const before = await askFeed();
  results['the feed is readable through the worker'] = before.ok && Array.isArray(before.ids);

  // Past onboarding, so the offline half lands on the screen that has to work
  // on the train rather than on a welcome card that would render regardless.
  await page.getByRole('button', { name: 'Skip' }).click().catch(() => {});
  await page.waitForTimeout(300);

  // Publish a change, exactly as a deploy of the feed alone would.
  const doc = JSON.parse(original);
  doc.updates = [
    ...doc.updates,
    {
      id: NEW_ID,
      store: 'Currys',
      changedOn: '2026-08-29',
      text: 'Currys shortened its returns window to 14 days.',
      affectsStores: ['Currys'],
      affectNote: 'new purchases only — yours keeps the window it was bought under',
      newWindowDays: 14,
    },
  ];
  writeFileSync(FEED_FILE, JSON.stringify(doc));

  const after = await askFeed();
  results['a policy change published today reaches an installed app'] = after.ok && after.ids.includes(NEW_ID);

  await page.reload({ waitUntil: 'load' });
  const next = await askFeed();
  results['and is still there on the next launch'] = next.ok && next.ids.includes(NEW_ID);

  /*
   * The feed's signature, which is half of the same answer: a feed is accepted
   * only when the signature covers exactly the bytes that came back. Asked of
   * the worker directly rather than through the app, because this build has no
   * key and so never fetches one — and the day it does, the worker must already
   * be passing a new signature through. It was not: cache-first kept the first
   * one for ever, so every genuine feed after it would have been refused.
   */
  const askSig = () =>
    page.evaluate(async () => {
      const res = await fetch('/policy-feed.sig', { cache: 'no-cache' });
      return res.ok ? (await res.text()).trim() : `status ${res.status}`;
    }).catch((e) => `failed: ${e.message.split('\n')[0]}`);
  writeFileSync(SIG_FILE, 'signature-one');
  const firstSig = await askSig();
  writeFileSync(SIG_FILE, 'signature-two');
  const secondSig = await askSig();
  results['a feed signature published today reaches an installed app too'] =
    firstSig === 'signature-one' && secondSig === 'signature-two';
  rmSync(SIG_FILE, { force: true });

  // Now the other promise, with the server genuinely gone.
  const reallyGone = await stopServer();
  results['the server really is unreachable'] = reallyGone;

  if (!reallyGone) {
    // Nothing below can mean anything while the port still answers: the app
    // would "work offline" by fetching, and the feed would "fall back" to the
    // live copy. Recorded as not asked, which is the honest word for it — the
    // version of this file that let them read ✓ is why the check above exists.
    for (const name of OFFLINE_CHECKS) results[name] = null;
  } else {

  // A worker that does not answer the navigation makes this reload fail
  // outright, which is a failing check and not a crashed sweep.
  const launched = await page
    .reload({ waitUntil: 'domcontentloaded' })
    .then(() => true)
    .catch((e) => {
      problems.push(`offline launch: ${e.message.split('\n')[0]}`);
      return false;
    });
  await page.waitForTimeout(600);

  // Not "something rendered" — the app's own promise is a deadline you can
  // check with no signal, so: the library is on screen, in the self-hosted
  // typeface, and it still navigates.
  results['the app launches with the network gone'] =
    launched &&
    (await page.getByText('Return deadlines, watched', { exact: true }).isVisible().catch(() => false)) &&
    (await page.evaluate(() => document.fonts.check('700 16px "Geist"')).catch(() => false));

  await page.locator('li button').first().click().catch(() => {});
  await page.waitForTimeout(400);
  results['and is still usable, not just painted'] = await page
    .getByText('Store policy')
    .isVisible()
    .catch(() => false);

  const offline = await askFeed();
  results['and the feed falls back to the copy already held'] = offline.ok && offline.ids.includes(NEW_ID);
  if (!offline.ok) problems.push(`offline feed: ${offline.why}`);

  }

  results['no page errors'] = problems.length === 0;
  // Said after that count, which is of what went wrong on the page, not of this.
  if (secondSig !== 'signature-two') problems.push(`signature after the change: ${secondSig}`);

  await acrossDeploys();
} finally {
  writeFileSync(FEED_FILE, original);
  rmSync(SIG_FILE, { force: true });
  await stopServer();
  await browser.close();
}

function report(crash) {
  let failed = Boolean(crash);
  for (const [name, ok] of Object.entries(results)) {
    if (ok === null) {
      console.log(`? ${name} — not asked, the server never stopped`);
      failed = true;
      continue;
    }
    console.log(`${ok ? '✓' : '✗'} ${name}`);
    if (!ok) failed = true;
  }
  for (const p of problems) console.log('  ' + p);
  if (crash) sayCrash(crash);
  else if (!failed) console.log('✓ a deploy reaches the app, and the app still works without one');
  process.exit(failed ? 1 : 0);
}
report();

