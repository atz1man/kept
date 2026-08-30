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
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { webcrypto as wc } from 'node:crypto';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const EXEC = process.env.CHROMIUM_PATH;
const PROBE = 'u_wiring_probe';

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
    const ctx = await browser.newContext({ viewport: { width: 402, height: 874 } });
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
    // The fetch is fired from an effect after mount; give it room to land.
    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem('kept.v1') ?? '{}').updates !== undefined,
    );
    await page.waitForTimeout(500);
    const ids = await page.evaluate(
      () => JSON.parse(localStorage.getItem('kept.v1')).updates.map((u) => u.id),
    );
    return { applied: ids.includes(PROBE), askedForSignature: asked.includes('/policy-feed.sig') };
  } finally {
    await browser.close();
    server.close();
  }
}

const build = (outDir, key) => execFileSync(
  'npx', ['vite', 'build', '--outDir', outDir],
  { stdio: 'pipe', env: key ? { ...process.env, VITE_FEED_PUBLIC_KEY: key } : process.env },
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
let wrong = 0;
console.log('');
for (const c of CASES) {
  const got = await launch(c.dir, port++, c);
  const ok = got.applied === c.applied && got.askedForSignature === c.askedForSignature;
  if (!ok) wrong += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${c.name}`);
  if (!ok) {
    console.log(`      used the feed: ${got.applied} (wanted ${c.applied})`);
    console.log(`      asked for a signature: ${got.askedForSignature} (wanted ${c.askedForSignature})`);
  }
}

/*
 * A sweep over no cases passes silently, reporting success for a question it
 * never asked — and this one would also pass if every build were the unsigned
 * one, so both builds have to be represented.
 */
if (new Set(CASES.map((c) => c.dir)).size !== 2) {
  console.log('  ✗ this check stopped exercising both builds');
  wrong += 1;
}
if (!CASES.some((c) => c.applied) || !CASES.some((c) => !c.applied)) {
  console.log('  ✗ this check stopped asking about both outcomes');
  wrong += 1;
}
// The probe has to be bytes a re-serialising verifier would get wrong, or the
// "signs what arrived" property above is untested and this file says otherwise.
if (FEED === JSON.stringify(JSON.parse(FEED))) {
  console.log('  ✗ the probe feed is canonical JSON, so it cannot catch a re-serialised verify');
  wrong += 1;
}

console.log(wrong ? `\n${wrong} of ${CASES.length} wrong\n` : `\nall ${CASES.length} as intended\n`);
process.exit(wrong ? 1 : 0);
