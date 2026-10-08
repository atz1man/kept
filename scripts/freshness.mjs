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
 *   - a signal that connects and never answers;
 *   - a tab left open across a deploy, then a file chosen in it;
 *   - and a feed signature that changes.
 *
 * And one question about what the worker must NOT do with the network: carry
 * an order email shared into the app to the server (see `sharing`).
 *
 * Each runs in its own browser profile, against a server on the same port, so
 * no step inherits another's worker. The deploy is a real second build of the
 * same source with every chunk renamed (see `buildDeploy`).
 *
 * Needs a build: npm run build && node scripts/freshness.mjs
 */
import './uk-clock.mjs';
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
/** How long a launch on a signal that never answers may take to show it. */
const LIE_FI_BUDGET_MS = 5000;

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
 * Every wait is on a condition, never a sleep standing in for one, except the
 * last step's, which is proving a negative and says so.
 */
const FIRST_VISIT = 'a first visit, never reloaded, opens with the network gone';
const AFTER_DEPLOY = 'after a deploy and one online launch, the new version opens with the network gone';
const DROPPED = 'a deploy whose download drops one request leaves the installed version opening offline';
const LIE_FI = `on a signal that connects and never answers, the app is on screen within ${LIE_FI_BUDGET_MS / 1000} s`;
const OPEN_TAB = 'a tab left open across a deploy still reads a file';
const TAKEN_OVER = 'and once the new version has taken that tab over, a file reloads it into a working app';
const NOT_KEPT = 'nothing a server answered for a missing file is kept as that file';
const STAYS = 'offline with no newer version to go to, a file it cannot read does not reload the app away';

const ORDER = 'Argos order\nOrder date: 1 October 2026\n1 x Kettle £24.99\nTotal £24.99\n';
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

/**
 * Choose a file on the Add screen and say what became of it: 'read' when its
 * text reached the paste box in this same document, 'reloaded' when the
 * document was replaced, 'neither' when it did neither in ten seconds. With
 * `refusalEnds`, the app saying it could not read the file is an answer too
 * ('refused'); without it, that message is not final — a reload follows it.
 */
async function chooseFile(page, { refusalEnds = false } = {}) {
  await page.evaluate(() => {
    window.__keptSameDocument = true;
  });
  await page.getByRole('button', { name: 'Add a receipt' }).first().click();
  await page
    .locator('input[type=file][accept*="pdf"]')
    .setInputFiles({ name: 'order.txt', mimeType: 'text/plain', buffer: Buffer.from(ORDER) });
  return page
    .waitForFunction(
      (refusalEnds) => {
        if (!window.__keptSameDocument) return 'reloaded';
        if (document.getElementById('paste')?.value?.includes('Kettle')) return 'read';
        return refusalEnds && /couldn.t read that file/.test(document.body.innerText) ? 'refused' : false;
      },
      refusalEnds,
      { timeout: 10000, polling: 100 },
    )
    .then((handle) => handle.jsonValue(), () => 'neither');
}

/** "It works, or at worst reloads into a working app" — and working means the file reads there. */
async function worksAfter(page, outcome, step) {
  if (outcome === 'read') return true;
  if (outcome === 'reloaded') {
    const again = (await shows(page, 5000)) ? await chooseFile(page) : 'no library after the reload';
    if (again === 'read') return true;
    problems.push(`${step}: reloaded, then the file came to ${again}`);
    return false;
  }
  const said = await page.evaluate(() => document.querySelector('main')?.innerText ?? '').catch(() => '');
  problems.push(`${step}: neither read nor reloaded${/couldn.t read that file/i.test(said) ? ' — "Quids In couldn\'t read that file"' : ''}`);
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

  // A connection that is accepted and then carries nothing. Opened as a cold
  // launch from the home screen: a new window, with nothing already on screen.
  await step([LIE_FI], async (context) => {
    await serve('dist');
    const installed = await install(context, { reload: true });
    await stopServer();
    await startOwn(() => {
      /* accepted; never answered */
    });
    await installed.close();
    const page = await context.newPage();
    const started = Date.now();
    page.goto(`${ORIGIN}/app/`, { waitUntil: 'commit', timeout: LIE_FI_BUDGET_MS * 4 }).catch(() => {});
    results[LIE_FI] = await shows(page, LIE_FI_BUDGET_MS);
    if (!results[LIE_FI]) problems.push(`${LIE_FI}: nothing after ${Date.now() - started}ms`);
  });

  // The deploy lands while the app stays open — phones resume an app rather
  // than reload it — and the next thing asked of it is a lazily loaded piece.
  await step([OPEN_TAB], async (context) => {
    await serve('dist');
    const page = await install(context, { reload: true });
    await stopServer();
    await serve(DEPLOY_B);
    results[OPEN_TAB] = await worksAfter(page, await chooseFile(page), OPEN_TAB);
  });

  // The same, after the new version's worker has taken the old tab over —
  // which it does the moment the app is opened anywhere else, because it
  // claims every page. The old tab's pieces are then in nobody's cache and on
  // nobody's server, and only a reload can save it.
  await step([TAKEN_OVER, NOT_KEPT], async (context) => {
    await serve('dist');
    const page = await install(context, { reload: true });
    await stopServer();
    await serve(DEPLOY_B);
    const elsewhere = await context.newPage();
    await elsewhere.goto(`${ORIGIN}/app/`, { waitUntil: 'load' });
    const took = await onlyCache(page, cacheB);
    await elsewhere.close();
    if (!took) throw new Error('the new worker never took the open tab over');
    results[TAKEN_OVER] = await worksAfter(page, await chooseFile(page), TAKEN_OVER);
    // The server answered the old name with its index page, and a 200. Kept as
    // the script, it would answer every later ask for it — from the cache, first.
    const kept = await page.evaluate(async () => {
      const out = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const req of await cache.keys()) {
          const path = new URL(req.url).pathname;
          const type = (await cache.match(req)).headers.get('content-type') ?? '';
          if (path !== '/app/' && type.startsWith('text/html')) out.push(`${path} kept as ${type}`);
        }
      }
      return out;
    });
    results[NOT_KEPT] = kept.length === 0;
    for (const k of kept) problems.push(`${NOT_KEPT}: ${k}`);
  });

  /*
   * The reload's guard, asked in the direction that would hurt: with no
   * worker at all (a browser that will not run one) and no network, the piece
   * cannot load and there is NO newer version anywhere. A reload there trades
   * a working screen for the browser's error page, on the train. The failure
   * the screen already explains is the right answer.
   *
   * Proving a negative, so it waits a fixed while after the failure appears —
   * the decision is made from one fetch that a dead network refuses at once,
   * so a reload would have begun well inside it.
   */
  await step(
    [STAYS],
    async (context) => {
      await serve('dist');
      const page = await context.newPage();
      await page.goto(`${ORIGIN}/app/`, { waitUntil: 'load' });
      await page.getByRole('button', { name: 'Skip' }).click({ timeout: 5000 }).catch(() => {});
      if (!(await shows(page, 5000))) throw new Error('the app never showed its library');
      await goOffline([STAYS]);
      const outcome = await chooseFile(page, { refusalEnds: true });
      if (outcome !== 'refused') {
        problems.push(`${STAYS}: the file came to ${outcome}`);
        results[STAYS] = false;
        return;
      }
      await sleep(1500);
      results[STAYS] =
        (await page.evaluate(() => window.__keptSameDocument === true).catch(() => false)) &&
        (await page.getByText(/couldn.t read that file/).isVisible().catch(() => false));
      if (!results[STAYS]) problems.push(`${STAYS}: the screen did not stay`);
    },
    { serviceWorkers: 'block' },
  );

  results['and no page errors across the deploys'] = deployErrors.length === 0;
  problems.push(...deployErrors);
}

/*
 * An order email shared into the app, through the manifest's own share target.
 *
 * The target was a GET, so the browser opened `/app/?title=…&text=…` and the
 * email went to the server in the request line, before any of the app's code
 * ran — and with this worker in control too, because a launch is network
 * first. Measured on main: the server logged `GET /app/?title=Your John Lewis
 * order 40012345&text=Hi Jane Smith… 14 Elm Road, Leeds LS6 2AB…`. The address
 * bar was cleaned up afterwards, which changed history and not what was sent.
 *
 * Asked here because only this sweep runs its own server and so can read what
 * reached it — every request line AND every body, since a POST that reached
 * the server would carry the email in its body. The share is made as the
 * browser makes it: read from the BUILT manifest, a GET to its action or a
 * form POST in its enctype. So a manifest put back to GET fails here, and so
 * does a POST target with no worker answering it.
 *
 * An app installed under the old manifest goes on sharing by GET until the
 * browser refreshes what it installed, so that route is asked too; and an
 * older worker's cache, which kept the shared address on its copy of the
 * shell, has to be gone once this one takes over.
 */
const SHARE_ARRIVES = 'a shared order email opens Add, already read';
const SHARE_OFF_NETWORK = 'and the server never receives any of it';
const SHARE_NOWHERE = 'and it is in no cache and no address';
const SHARE_ONCE = 'and the worker keeps no copy once the page has it';
const LEGACY_SHARE = 'an app installed when sharing was a GET keeps the email off the server too';
const OLD_CACHE = 'an older worker’s cache holding a shared address is gone once this one takes over';

const SHARED = {
  title: 'Your John Lewis order 40012345',
  text: 'Hi Jane Smith, thanks for your order 40012345.\nDelivering to 14 Elm Road, Leeds LS6 2AB\nOrder placed 1 October 2026\nSony WH-1000XM5 £349.00\nOrder total: £349.00',
};
/** Pieces of the email that survive any encoding a request could give them. */
const SHARED_MARKERS = ['40012345', 'Jane', 'LS6'];
const carriesEmail = (text) => SHARED_MARKERS.some((m) => text.includes(m));

/** Share as the browser does for this manifest: GET to the action, or a form POST. */
async function shareInto(page, target, data) {
  const fields = Object.entries(target.params ?? {})
    .filter(([field]) => typeof data[field] === 'string')
    .map(([field, name]) => [name, data[field]]);
  if ((target.method ?? 'GET').toUpperCase() === 'GET') {
    await page.goto(`${ORIGIN}${target.action}?${new URLSearchParams(fields)}`, { waitUntil: 'load' });
    return;
  }
  // From a blank page, as a share sheet is not the app: a POST navigation to
  // the action, which is what the browser sends.
  await page.goto('about:blank');
  await Promise.all([
    page.waitForURL((u) => u.href.startsWith(`${ORIGIN}/app/`), { waitUntil: 'load' }),
    page.evaluate(({ action, enctype, fields }) => {
      const form = document.createElement('form');
      form.method = 'post';
      form.enctype = enctype;
      form.action = action;
      for (const [name, value] of fields) {
        const box = document.createElement('textarea');
        box.name = name;
        box.value = value;
        form.append(box);
      }
      document.body.append(form);
      form.submit();
    }, { action: `${ORIGIN}${target.action}`, enctype: target.enctype ?? 'application/x-www-form-urlencoded', fields }),
  ]);
}

/** The Add screen holding the email: on screen, in the paste box, and read. */
const addHolds = (page) =>
  page
    .waitForFunction(() => document.getElementById('paste')?.value?.includes('14 Elm Road'), null, { timeout: 10000 })
    .then(async () => (await page.getByRole('heading', { name: 'Add a receipt' }).isVisible()) && (await page.getByText('Found in your paste').isVisible()))
    .catch(() => false);

/** Every cached request and response address, for anything shared. */
const cachedAddresses = (page) =>
  page.evaluate(async () => {
    const out = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) {
        out.push(`${name} ${req.url}`);
        const res = await cache.match(req);
        if (res?.url) out.push(`${name} ${res.url} (response)`);
      }
    }
    return out.map(decodeURIComponent);
  });

/** Ask the worker for a share the way the page does; null when it holds none. */
const claimAgain = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const worker = navigator.serviceWorker.controller;
        if (!worker) return resolve('no worker');
        const channel = new MessageChannel();
        channel.port1.onmessage = (e) => resolve(e.data);
        setTimeout(() => resolve('no answer'), 2000);
        worker.postMessage({ type: 'kept-claim-share' }, [channel.port2]);
      }),
  ).catch((e) => `failed: ${e.message.split('\n')[0]}`);

async function sharing() {
  const target = JSON.parse(readFileSync(`${ROOT}dist/manifest.webmanifest`, 'utf8')).share_target;
  const before = deployErrors.length;
  /** What reached the server: method, address and body of every request. */
  const reached = [];
  const since = (mark) => reached.slice(mark);
  const names = [OLD_CACHE, SHARE_ARRIVES, SHARE_OFF_NETWORK, SHARE_NOWHERE, SHARE_ONCE, LEGACY_SHARE];

  await step(names, async (context) => {
    await startOwn((req, res) => {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        reached.push(`${req.method} ${req.url} ${body}`);
        serveFile(`${ROOT}dist`, req, res);
      });
    });

    // What a worker from before #120 left: the shell, kept under `/app/`,
    // carrying the shared address it was fetched from. Planted from a page
    // outside the worker's scope, before any worker exists here.
    const planter = await context.newPage();
    await planter.goto(`${ORIGIN}/privacy/`, { waitUntil: 'load' });
    const planted = await planter.evaluate(async () => {
      const res = await fetch('/app/?title=Your%20old%20order%20LEGACY&text=Hi%20Old%20Name');
      const cache = await caches.open('kept-000000000000');
      await cache.put('/app/', res);
      return (await cache.match('/app/'))?.url ?? null;
    });
    await planter.close();
    if (!planted?.includes('LEGACY')) throw new Error(`the older worker's cache could not be planted: ${planted}`);

    const page = await install(context, { reload: true });
    const took = await onlyCache(page, cacheOf(`${ROOT}dist`));
    const left = (await cachedAddresses(page)).filter((a) => a.includes('LEGACY'));
    results[OLD_CACHE] = took && left.length === 0;
    for (const a of left) problems.push(`${OLD_CACHE}: ${a}`);
    await page.close();

    // The share, as the manifest declares it.
    const mark = reached.length;
    const shared = await context.newPage();
    await shareInto(shared, target, SHARED);
    results[SHARE_ARRIVES] = await addHolds(shared);
    await sleep(500);
    const leaked = since(mark).filter(carriesEmail);
    // `> 0`: the launch itself reaches the server, so a log with nothing in it
    // is a server nobody was watching, not one that heard nothing.
    results[SHARE_OFF_NETWORK] = since(mark).length > 0 && leaked.length === 0;
    for (const l of leaked) problems.push(`${SHARE_OFF_NETWORK}: the server got ${l.replace(/\s+/g, ' ').slice(0, 160)}`);

    const kept = (await cachedAddresses(shared)).filter(carriesEmail);
    const address = shared.url();
    results[SHARE_NOWHERE] = kept.length === 0 && !carriesEmail(decodeURIComponent(address)) && new URL(address).search === '';
    for (const k of kept) problems.push(`${SHARE_NOWHERE}: cached ${k.slice(0, 160)}`);
    if (!results[SHARE_NOWHERE]) problems.push(`${SHARE_NOWHERE}: the address is ${decodeURIComponent(address).slice(0, 160)}`);

    // Handed over once: a second ask gets nothing, and neither does a reload.
    const again = await claimAgain(shared);
    await shared.reload({ waitUntil: 'load' });
    await sleep(600);
    const refilled = await shared.evaluate(() => document.getElementById('paste')?.value ?? '').catch(() => '');
    results[SHARE_ONCE] = again === null && !refilled.includes('14 Elm Road');
    if (!results[SHARE_ONCE]) problems.push(`${SHARE_ONCE}: a second ask answered ${JSON.stringify(again)}; after a reload the paste box held ${refilled.length} characters`);
    await shared.close();

    // An app installed under the old manifest: a GET carrying the email.
    const legacyMark = reached.length;
    const legacy = await context.newPage();
    await shareInto(legacy, { action: '/app/', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } }, SHARED);
    const legacyArrived = await addHolds(legacy);
    await sleep(500);
    const legacyLeaked = since(legacyMark).filter(carriesEmail);
    results[LEGACY_SHARE] =
      legacyArrived && since(legacyMark).length > 0 && legacyLeaked.length === 0 && !carriesEmail(decodeURIComponent(legacy.url()));
    if (!legacyArrived) problems.push(`${LEGACY_SHARE}: Add did not open with the email`);
    for (const l of legacyLeaked) problems.push(`${LEGACY_SHARE}: the server got ${l.replace(/\s+/g, ' ').slice(0, 160)}`);
  });

  results['and no page errors while sharing'] = deployErrors.length === before;
  problems.push(...deployErrors.slice(before));
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
  await sharing();
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

