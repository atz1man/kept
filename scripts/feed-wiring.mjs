/**
 * Does the signature check actually sit between the network and the deadline?
 *
 *   CHROMIUM_PATH=/path/to/chrome node scripts/feed-wiring.mjs
 *
 * `test/feed-signature.test.ts` proves the verifier is a verifier and the
 * policy is the policy. Neither says whether `App.tsx` CALLS them, in the right
 * order, on the right bytes — and the wiring is where this sort of thing gets
 * lost: a check that runs and whose answer is dropped passes every unit test it
 * has. So this one builds the real app twice and asks the only question that
 * matters at the end: did the update the network offered reach the store?
 *
 * It reads `localStorage` rather than the screen, because "the update was
 * accepted" is a fact about state, and scraping for the text of a card would
 * also pass if the card were drawn from the bundled feed.
 *
 * The key comes from VITE_FEED_PUBLIC_KEY at build time, generated fresh here.
 * An earlier version of this file patched `feed-signature.ts` and put it back
 * afterwards, which works right up until it crashes between the two.
 */
import { chromium } from 'playwright';
import { reportOnCrash, sayCrash } from './crash-report.mjs';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { webcrypto as wc } from 'node:crypto';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const EXEC = process.env.CHROMIUM_PATH;
const PROBE = 'u_wiring_probe';
/** How long a feed gets to reach the store before it counts as refused. */
const SETTLE_MS = 6000;
/*
 * And how long the whole of one case gets, browser and server included.
 *
 * From reading rather than from an incident, and worth saying so: nothing has
 * hung here. Every wait INSIDE `launch` is already bounded, by Playwright's own
 * default — the navigation and both `waitForFunction`s. Two are not.
 * `browser.close()` in the `finally` takes no timeout and returns when the
 * browser process does, and `execFileSync` below waits on a build for as long
 * as the build takes. A step that stops answering is worse than one that
 * fails: it reports nothing, holds a runner until GitHub's six-hour limit, and
 * shows a pull request as still deciding rather than as broken.
 *
 * Five cases in twenty-five seconds is five apiece, so two minutes is twenty
 * times the room the work needs, and exceeding it is a fault rather than a
 * slow afternoon. The build gets an order of magnitude over the two seconds it
 * takes. Both numbers are ours, so neither is pinned by a test.
 */
const CASE_BUDGET_MS = 120_000;
const BUILD_BUDGET_MS = 300_000;

/** Rejects rather than waiting forever. The caller names the case it was for. */
const withDeadline = (work, ms) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`nothing came back in ${ms / 1000}s`)), ms);
  work.then(resolve, reject).finally(() => clearTimeout(timer));
});

/*
 * Findings are gathered rather than printed as they happen, so a run that dies
 * still says what it had established. This one has more ways to die than most:
 * it generates a key, shells out to TWO builds, and starts five servers and
 * five browsers.
 *
 * Installed HERE, above all of that, and the placement is the whole point. My
 * first version registered the handler after the builds — which left the most
 * likely failure in a sandbox, a Chromium the pinned Playwright does not have,
 * printing a raw stack trace and nothing else. That reads as the feature being
 * broken rather than the environment being wrong, which is the exact
 * misdiagnosis this file's own comments warn about. Verified by throwing before
 * the first build and watching it report.
 *
 * `report` is a function declaration, so it is hoisted and can be handed over
 * before the code below it has run; on the crash path it never touches CASES,
 * which may not be initialised yet.
 */
const results = [];
reportOnCrash(report);

const b64 = (b) => Buffer.from(new Uint8Array(b)).toString('base64');
const pair = await wc.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const PUBLIC_KEY = b64(await wc.subtle.exportKey('spki', pair.publicKey));

/*
 * A store the seed already holds, so an accepted update has somewhere to land,
 * and an id nothing bundled uses — the probe can only have come off the wire.
 */
/*
 * Pretty-printed with a trailing newline, because that is how
 * `public/policy-feed.json` is actually served — and because a probe served as
 * canonical JSON cannot tell the difference between signing the bytes and
 * signing `JSON.stringify(JSON.parse(body))`. It made the check pass either
 * way, which is the exact defect the verifier's own comment says it prevents.
 */
const FEED = `${JSON.stringify({
  feed: 'kept-policy',
  updatedAt: '2026-08-29',
  updates: [{
    id: PROBE, store: 'Zara', changedOn: '2026-08-29',
    text: 'Probe entry, reachable only through the network.',
    affectsStores: ['Zara'],
  }],
}, null, 2)}\n`;
const SIGNATURE = b64(await wc.subtle.sign(
  { name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(FEED),
));
// One character different, carrying a signature that is genuinely ours. This is
// the attack: not a forged signature, a real one moved onto other bytes.
const TAMPERED = FEED.replace('through the network', 'through the netwerk');

const TYPES = {
  '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

const serve = (dir, port) => new Promise((resolve, reject) => {
  const server = createServer((req, res) => {
    let path = req.url.split('?')[0];
    if (path.endsWith('/')) path += 'index.html';
    try {
      const body = readFileSync(join(dir, path));
      res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not here');
    }
  });
  server.on('error', reject);
  server.listen(port, () => resolve(server));
});

async function launch(dir, port, { body, signature }) {
  const server = await serve(dir, port);
  const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
  try {
    /*
     * THE SERVICE WORKER IS BLOCKED, and that is not tidiness.
     *
     * `/policy-feed.json` is network-first in `sw.js`, so on a page the worker
     * controls, the app's fetch goes to the worker and the worker fetches.
     * whether Playwright's `page.route` intercepts a request a WORKER made is
     * not something this file can rely on — so the probe sometimes arrived and
     * sometimes did not, and the run reported the app REFUSING a feed it had
     * simply never been shown. That is the worst direction for this gate to be
     * wrong in: it invents the failure it exists to catch.
     *
     * Blocking it is also the honest scope. This sweep asks whether App.tsx
     * verifies before it applies. `freshness` is the sweep that owns what the
     * worker does, and it starts and stops its own server to ask it properly.
     */
    const ctx = await browser.newContext({
      viewport: { width: 402, height: 874 },
      serviceWorkers: 'block',
    });
    const page = await ctx.newPage();
    const asked = [];
    page.on('request', (r) => asked.push(new URL(r.url()).pathname));
    await page.route('**/policy-feed*', (route) => {
      if (route.request().url().includes('.sig')) {
        return signature === null
          ? route.fulfill({ status: 404, body: '' })
          : route.fulfill({ status: 200, contentType: 'text/plain', body: signature });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body });
    });
    await page.goto(`http://localhost:${port}/app/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem('kept.v1') ?? '{}').updates !== undefined,
    );

    /*
     * POLLED, not slept on, and both directions get the same budget.
     *
     * This was `waitForTimeout(500)` and it failed about one run in some
     * number — once, here, under the load of the browsers this script starts
     * itself. The fetch is fired from an effect after mount, then verified with
     * WebCrypto, then dispatched, then saved; 500ms is a guess at how long all
     * of that takes on an unloaded machine, and a guess that runs short turns
     * an ACCEPTED feed into a reported refusal. That is the wrong direction to
     * be flaky in: it invents the failure this gate exists to catch.
     *
     * A refusal case therefore spends the whole budget, which is the honest
     * cost of proving a negative — and the budget is long enough that
     * exceeding it is a real fault rather than a slow afternoon.
     */
    const applied = await page
      .waitForFunction(
        (probe) => JSON.parse(localStorage.getItem('kept.v1')).updates.some((u) => u.id === probe),
        PROBE,
        { timeout: SETTLE_MS },
      )
      .then(() => true)
      .catch(() => false);
    return { applied, askedForSignature: asked.includes('/policy-feed.sig') };
  } finally {
    await browser.close();
    server.close();
  }
}

const build = (outDir, key) => execFileSync(
  'npx', ['vite', 'build', '--outDir', outDir],
  {
    stdio: 'pipe',
    timeout: BUILD_BUDGET_MS,
    env: key ? { ...process.env, VITE_FEED_PUBLIC_KEY: key } : process.env,
  },
);

build('dist-wiring-unsigned', null);
build('dist-wiring-signed', PUBLIC_KEY);

const CASES = [
  // The state this ships in. Behaviour must be exactly what it was before
  // signing existed, and no second request may be made for a signature that
  // could not be checked anyway.
  { name: 'no key · an unsigned feed is used, as it always was',
    dir: 'dist-wiring-unsigned', body: FEED, signature: null, applied: true, askedForSignature: false },
  { name: 'key · a correctly signed feed is used',
    dir: 'dist-wiring-signed', body: FEED, signature: SIGNATURE, applied: true, askedForSignature: true },
  // The one that pays for all of this: our own signature, moved onto bytes we
  // did not write. `windowInForceFor` would otherwise count down from whatever
  // these said.
  { name: 'key · a feed altered after signing is refused',
    dir: 'dist-wiring-signed', body: TAMPERED, signature: SIGNATURE, applied: false, askedForSignature: true },
  // A server that simply stops signing must not quietly turn the feature off.
  { name: 'key · a feed with no signature at all is refused',
    dir: 'dist-wiring-signed', body: FEED, signature: null, applied: false, askedForSignature: true },
  { name: 'key · a signature that is not one is refused',
    dir: 'dist-wiring-signed', body: FEED, signature: 'bm90LWEtc2ln', applied: false, askedForSignature: true },
];

let port = 4361;
for (const c of CASES) {
  let got;
  try {
    got = await withDeadline(launch(c.dir, port++, c), CASE_BUDGET_MS);
  } catch (e) {
    /*
     * Reported and exited here rather than left to the crash handler, because
     * this is not a crash: the run simply stopped answering, and the honest
     * word for the cases below it is unrun rather than failed. `report` says
     * how many never ran; this says which one stopped.
     */
    results.push({ name: c.name, ok: false, stopped: e.message, got: {}, want: c });
    report();
  }
  results.push({
    name: c.name,
    ok: got.applied === c.applied && got.askedForSignature === c.askedForSignature,
    got,
    want: c,
  });
}

function report(crash) {
  console.log('');
  for (const r of results) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}`);
    if (r.stopped) {
      console.log(`      ${r.stopped} — a check that never returns is not a check that passed`);
      continue;
    }
    if (!r.ok) {
      console.log(`      used the feed: ${r.got.applied} (wanted ${r.want.applied})`);
      console.log(`      asked for a signature: ${r.got.askedForSignature} (wanted ${r.want.askedForSignature})`);
    }
  }
  let wrong = results.filter((r) => !r.ok).length;

  /*
   * The vacuity guards, and they only mean anything on a run that finished:
   * a crash leaves cases unrun, which is not the same as a check that stopped
   * asking. Saying "it stopped exercising both builds" about a run that died
   * on the first one would be a second, invented failure on top of the real
   * one.
   */
  if (!crash) {
    if (results.length !== CASES.length) {
      console.log(`  ✗ ${CASES.length - results.length} case(s) never ran`);
      wrong += 1;
    }
    if (new Set(CASES.map((c) => c.dir)).size !== 2) {
      console.log('  ✗ this check stopped exercising both builds');
      wrong += 1;
    }
    if (!CASES.some((c) => c.applied) || !CASES.some((c) => !c.applied)) {
      console.log('  ✗ this check stopped asking about both outcomes');
      wrong += 1;
    }
    // The probe has to be bytes a re-serialising verifier would get wrong, or
    // the "signs what arrived" property is untested and this file says
    // otherwise.
    if (FEED === JSON.stringify(JSON.parse(FEED))) {
      console.log('  ✗ the probe feed is canonical JSON, so it cannot catch a re-serialised verify');
      wrong += 1;
    }
  }

  if (crash) {
    sayCrash(crash);
    process.exit(1);
  }
  console.log(wrong ? `\n${wrong} of ${CASES.length} wrong\n` : `\nall ${CASES.length} as intended\n`);
  process.exit(wrong ? 1 : 0);
}

report();
