/*
 * Kept's service worker.
 *
 * The app's promise is that a deadline is checkable anywhere — on the train,
 * in the shop, with no signal — so offline is a feature, not a fallback.
 *
 * It caches nothing but this app's own static assets. There is no receipt
 * data here and no request to anywhere else: the receipts live in
 * localStorage on the device, and the only origin this worker ever talks to
 * is the one it was served from. The one thing of the person's it ever
 * touches is an order email shared into the app, and that it holds in memory
 * for the moment it takes the page to collect it — see `receiveShare`.
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
 * app's shell and nothing else.
 *
 * A server that has no file at a path usually answers with its index page —
 * vite preview does, with a 200, and so do most static hosts set up for an
 * app. So after a deploy, a tab still open on the old build asked for its old
 * `documents-….js`, got the new `index.html` with a 200, and this worker
 * cached that page AS the script. The import failed with "kept couldn't read
 * that file", and failed again on every try, because the cache now answered
 * first. Measured: `/assets/documents-M14BQAN-.js cached as text/html`.
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

/*
 * Every cache but this build's own goes, and that is also what clears the
 * shared order emails an older worker left behind. Before #120 a launch was
 * network-first AND written to the cache, and the share target was a GET, so
 * the response kept as `/app/` carried the address it was fetched from —
 * `/app/?title=Your John Lewis order…&text=Hi Jane Smith… 14 Elm Road…` —
 * measured in Cache Storage, where Erase everything never reached. Those
 * caches have older names than this one, so taking over deletes them;
 * `npm run freshness` plants one and checks it is gone.
 */
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
      if (res.ok && fits(path, res)) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(path, copy));
      }
      return res;
    })
    .catch(() => fromCache(path).then((hit) => hit ?? Response.error()));
}

/*
 * An order email shared into the app, kept OFF the network.
 *
 * The share target was a GET, so the browser opened
 * `/app/?title=…&text=…` and the email — a name, a home address, an order
 * number, what was bought — went to the server in the request line, before any
 * of the app's code could run. Measured, with this worker in control: the
 * server logged `GET /app/?title=Your John Lewis order 40012345&text=Hi Jane
 * Smith… 14 Elm Road, Leeds LS6 2AB…`. The page stripping the address bar
 * afterwards changed what was in history, not what had been sent. On an app
 * whose privacy page says there is no server that receives your receipts.
 *
 * So the manifest's share target is a POST, and this answers it here: the
 * form is read in the worker, the text is held in this worker's MEMORY, and
 * the answer is a 303 to `/app/#shared`. The page that opens asks for the text
 * by message (`receiveShare` in src/lib/share.ts) and the worker hands it over
 * and forgets it. So the text is never in a request — the redirected launch
 * asks for plain `/app/`, and a fragment is not sent — never in a URL, never
 * in a cache, and never on disk.
 *
 * A GET carrying the old parameters is answered the same way, because an app
 * installed under the old manifest goes on sharing by GET until the browser
 * next refreshes what it installed, and this worker is in front of every one
 * of those launches.
 *
 * WITHOUT a worker in control none of this runs, and the browser sends the
 * POST to the server — the text then crosses the network in a request body,
 * though still not in an address or in history. The share target only exists
 * on an installed app, and installing one is opening it, which registers this
 * worker, so that is the narrow case where it registered and has since gone:
 * site data cleared under an icon left on the home screen, or a first install
 * that failed and has not yet been retried. The page reads nothing out of a
 * POST, so the share is lost there rather than read; nothing on this side can
 * stop a request the browser makes before any of this app's code exists.
 */
const SHARE_KEYS = ['title', 'text', 'url'];

/** The fragment the page looks for. Not sent to any server; carries no content. */
const SHARED_MARK = '#shared';

/**
 * How long a shared email waits for the page to collect it.
 *
 * Long enough for a slow phone's cold start behind a launch that may itself
 * wait LAUNCH_WAIT_MS on a signal that never answers; short enough that a
 * share nobody collected is not in memory for the rest of the worker's life.
 * The page collects it in milliseconds in practice. `waitUntil` keeps the
 * worker alive for exactly this long and no longer.
 */
const SHARE_HOLD_MS = 30000;

/** The one share in flight, or null. Memory only, on purpose. */
let heldShare = null;

function receiveShare(event, url) {
  let release = () => {};
  event.waitUntil(new Promise((resolve) => (release = resolve)));
  event.respondWith(
    readShare(event.request, url).then(
      (parts) => {
        const there = SHARE_KEYS.some((k) => parts[k]);
        if (there) holdShare(parts, release);
        else release();
        // Whatever else was on the address stays; the payload goes.
        const back = new URL(url);
        for (const k of SHARE_KEYS) back.searchParams.delete(k);
        return Response.redirect(`${back.pathname}${back.search}${there ? SHARED_MARK : ''}`, 303);
      },
      () => {
        release();
        return Response.redirect('/app/', 303);
      },
    ),
  );
}

async function readShare(req, url) {
  const parts = {};
  if (req.method === 'POST') {
    const form = await req.formData();
    for (const k of SHARE_KEYS) {
      const v = form.get(k);
      if (typeof v === 'string' && v.trim()) parts[k] = v;
    }
  } else {
    for (const k of SHARE_KEYS) {
      const v = url.searchParams.get(k);
      if (v && v.trim()) parts[k] = v;
    }
  }
  return parts;
}

function holdShare(parts, release) {
  // A second share replaces the first rather than queueing behind it: the page
  // that opens is for the newer one.
  if (heldShare) heldShare.release();
  const held = { parts, release };
  heldShare = held;
  setTimeout(() => {
    if (heldShare === held) heldShare = null;
    release();
  }, SHARE_HOLD_MS);
}

/*
 * The hand-over. Asked once, by the page `/app/#shared` opens, over a channel
 * of its own; answered with the parts, or with null when nothing is held. The
 * first ask takes it and the worker keeps no copy, so a reload, a second tab
 * or a second ask gets nothing.
 */
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'kept-claim-share') return;
  const port = event.ports?.[0];
  const held = heldShare;
  heldShare = null;
  port?.postMessage(held ? held.parts : null);
  held?.release();
});

const carriesShare = (url) => SHARE_KEYS.some((k) => url.searchParams.has(k));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // A share, by the manifest's POST or an older install's GET. Before the
  // method check below, which would otherwise wave the POST through to the
  // network: that is the leak this exists to close.
  if (
    req.mode === 'navigate' &&
    url.origin === self.location.origin &&
    url.pathname === '/app/' &&
    (req.method === 'POST' || (req.method === 'GET' && carriesShare(url)))
  ) {
    receiveShare(event, url);
    return;
  }

  if (req.method !== 'GET') return;

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
  // cache first and fill on miss. Only with the file that was asked for: see
  // `fits`.
  event.respondWith(
    fromCache(req).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok && res.type === 'basic' && fits(url.pathname, res)) {
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
