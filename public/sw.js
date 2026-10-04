/*
 * Kept's service worker.
 *
 * The app's promise is that a deadline is checkable anywhere — on the train,
 * in the shop, with no signal — so offline is a feature, not a fallback.
 *
 * It caches nothing but this app's own static assets. There is no receipt
 * data here and no request to anywhere else: the receipts live in
 * localStorage on the device, and the only origin this worker ever talks to
 * is the one it was served from.
 */

/*
 * Stamped at build time — see the stampServiceWorker plugin in vite.config.ts.
 * The name has to change when the assets do: `activate` below evicts every
 * cache that is not the current one, and with a fixed name that is nothing at
 * all. Each deploy's hashed bundles would then accumulate forever, competing
 * for the same storage quota the app keeps the user's receipts in — and this
 * app shows a standing warning when that quota runs out.
 *
 * Left as a literal so this file is still valid, servable JavaScript when
 * read straight out of public/.
 */
const CACHE = 'kept-__BUILD_ID__';

/**
 * Every file this build's app can ask for, stamped beside the cache name by
 * the same plugin: the scripts and stylesheet the app document loads, and
 * every chunk those can import later — reading a PDF, scanning a receipt — so
 * a feature reached for the first time on the train is already here.
 *
 * These were once left out on purpose, on the grounds that hashed names change
 * every build and a hard-coded list would go stale, and picked up at runtime
 * instead. A list written BY the build cannot go stale, and leaving them to
 * runtime left the app a white screen offline twice over. Measured on main:
 *
 *   - a first visit, then offline: the page loaded its bundles before this
 *     worker existed, so the cache held the shell and nothing it names —
 *     `#root` empty, every script and the stylesheet failed;
 *   - a deploy, one online launch, then offline: the new build's bundles were
 *     fetched through the OLD worker into the old cache, which the new worker's
 *     `activate` then deleted, leaving it a shell naming files it did not hold.
 *
 * Empty when this file is read straight out of public/ (the dev server, which
 * has no build), so the shell alone is precached there, as it always was.
 */
const BUILD = [/* __BUILD_FILES__ */];

/** The document every launch opens, and the files it names that no build emits. */
const SHELL = ['/app/', '/manifest.webmanifest', '/icons/icon.svg', '/fonts/geist.woff2'];

/*
 * All or nothing, and NO catch — the install fails if any of it does.
 *
 * It had one, on the grounds that a single 404 "would leave the worker
 * uninstalled; better to install with a partial cache and fill the rest at
 * runtime". The partial cache was the defect. A worker
 * that installs goes on to activate, and `activate` deletes every cache but its
 * own — so one dropped request while a deploy precached threw away a complete
 * working copy and replaced it with an empty one. Measured: the new worker's
 * fetch of `/app/` answered 503 once, the worker activated with a cache of
 * nothing, and the next offline launch was the browser's own error page.
 *
 * A failed install is the safe failure: the worker already in charge stays in
 * charge with the cache it has, and the browser tries the update again at the
 * next launch. Nothing is put until everything has arrived, so a failure here
 * leaves no half-filled cache behind it either.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

async function precache() {
  const arrived = await Promise.all(
    [...SHELL, ...BUILD].map(async (path) => {
      // `no-cache`: the HTTP cache may confirm a copy but not answer for the
      // server, so an hour-old shell cannot be precached under a new build.
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok || !fits(path, res)) {
        throw new Error(`precache: ${path} answered ${res.status} ${res.headers.get('content-type')}`);
      }
      return [path, res];
    }),
  );
  const cache = await caches.open(CACHE);
  await Promise.all(arrived.map(([path, res]) => cache.put(path, res)));
}

/**
 * Whether a response is the kind of file that was asked for. HTML is this
 * app's shell and nothing else: a server with no file at a path usually
 * answers with its index page and a 200, and that page must never be
 * precached as one of the app's files.
 *
 * Deliberately no stricter than that. Demanding a JavaScript type for `.js`
 * would refuse a host that serves `.mjs` as octet-stream — and here a refusal
 * fails the install, so a fussy rule would pin people to an old build.
 */
function fits(path, res) {
  const html = /^text\/html/i.test(res.headers.get('content-type') ?? '');
  return path === '/app/' ? html : !html;
}

/*
 * Read from this worker's OWN cache, never from whichever cache happens to
 * match: a cache left by a worker that failed to install holds another build.
 * And ignoring Vary, because servers vary on Origin (vite preview does, on
 * every file) and the cached copy was fetched by this worker while the page's
 * own requests carry an Origin — a same-origin file is the same bytes whoever
 * asks. Measured: without it the precache is never matched, and removing it
 * fails exactly the `freshness` steps that removing the precache does.
 */
const fromCache = (key) => caches.open(CACHE).then((c) => c.match(key, { ignoreVary: true }));

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/**
 * Same-origin content that changes at a FIXED url, and so must never be served
 * cache-first.
 *
 * The rule below — "everything else is immutable per URL" — is true of hashed
 * bundles, fonts and icons, and false of exactly these. Kept's claim
 * is that it ships a verified policy change the day it happens; cache-first
 * froze the feed at whatever shipped the day this worker installed, and the
 * app's own `cache: 'no-cache'` on that fetch bought nothing, because a
 * service worker is consulted before the HTTP cache it addresses. An installed
 * app therefore never saw another policy update until the next deploy changed
 * the cache name. Measured in a real browser before this list existed.
 *
 * The signature beside it, for the same reason and a sharper one. The app
 * accepts a feed only when the signature covers exactly the bytes that came
 * back, so the two are a pair — and with the feed network-first and the
 * signature cache-first, the first signature an installed app ever fetched was
 * the only one it would ever see. Once signing is switched on, every genuine
 * feed after the first would be refused as tampered, on installed web apps
 * only. Measured: a changed `/policy-feed.sig` still read as the old one
 * through the worker.
 */
const FRESH = ['/policy-feed.json', '/policy-feed.sig'];

/**
 * How long a launch waits on the network before opening the copy it holds.
 *
 * Network first is right for a launch — it is how a deploy arrives — and it
 * had no limit. On a signal that connects and then carries nothing (a train
 * between stations, a shop's back corner) the fetch neither answers nor fails,
 * and a fallback that waits for it to fail never runs. Measured, with every
 * file already cached and a server that accepts and never answers: nothing on
 * screen after 60 seconds. "Offline works" was true only of a network honest
 * enough to refuse.
 *
 * Three seconds is about where a person decides the app is broken. The answer
 * that arrives later is not wasted: the next launch asks again.
 */
const LAUNCH_WAIT_MS = 3000;

/*
 * A launch: the network's answer if it comes in time, the held shell if not.
 *
 * Not written to the cache. The shell this worker holds is the one it
 * precached with the files it names, and that pairing is the point — a shell
 * from the network after a deploy names a NEW build's files, and kept here it
 * would be opened offline over a cache that has none of them, which is the
 * white screen again. A new shell arrives with its own worker, because the
 * worker's cache name is a hash of the shell.
 */
function launch(event) {
  const network = fetch(event.request);
  return new Promise((resolve) => {
    const held = () => fromCache('/app/');
    const timer = setTimeout(() => held().then((hit) => hit && resolve(hit)), LAUNCH_WAIT_MS);
    network.then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      () => {
        clearTimeout(timer);
        held().then((hit) => resolve(hit ?? Response.error()));
      },
    );
  });
}

/**
 * Network first, with the cache behind it, for the files that change at a
 * fixed url. Offline still works — the fallback is the last copy successfully
 * fetched.
 */
function networkFirst(req, path) {
  return fetch(req)
    .then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(path, copy));
      }
      return res;
    })
    .catch(() => fromCache(path).then((hit) => hit ?? Response.error()));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Cross-origin requests are not this worker's business — and the app makes
  // none. Letting them fall through keeps that true rather than quietly
  // becoming a cache for whatever a future dependency decides to fetch.
  if (url.origin !== self.location.origin) return;

  // Navigations: network first, so a deployed update is picked up on the
  // next online launch, with the precached shell behind it for offline — and
  // for a network that will not answer at all.
  if (req.mode === 'navigate') {
    event.respondWith(launch(event));
    return;
  }

  // The feed and its signature, for the same reason and by the same route.
  if (FRESH.includes(url.pathname)) {
    event.respondWith(networkFirst(req, url.pathname));
    return;
  }

  // Everything else — hashed bundles, fonts, icons — is immutable per URL, so
  // cache first and fill on miss.
  event.respondWith(
    fromCache(req).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

/**
 * A deadline alert exists to get someone back into the app, so clicking one
 * must land them there — focusing the tab they already have open rather than
 * stacking up a second copy of the app beside it.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/app/') && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow('/app/');
    }),
  );
});
