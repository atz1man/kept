import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import { App } from './App';
import { Recovery } from './components/Recovery';
import { color } from '../tokens';
import { embedded } from '../lib/embed';
import { isNative } from '../lib/mirror';
import { restoreFromMirror, savedToStore } from '../lib/storage';
import { bootScript, shouldReload } from '../lib/stale-build';
import { collectShare, SHARED_MARK } from '../lib/share';

/**
 * On a phone the app is the whole viewport — every phone, the 430 and 440px
 * Pro Max sizes included (`.k-frame` in styles.css). Past a phone it renders
 * in a 430px column on a quiet ground. No drawn bezel: the handoff is explicit
 * that the iPhone frame is presentation for the prototype, not part of the
 * product, and a fake device chrome around a real installed app is a lie
 * about what you are using.
 */
function Shell() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: color.surfaceAlt,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        className="k-frame"
        style={{
          width: '100%',
          height: '100dvh',
          position: 'relative',
          overflow: 'hidden',
          background: color.canvas,
        }}
      >
        <Recovery>
          <App />
        </Recovery>
      </div>
    </div>
  );
}

function mount() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Shell />
    </StrictMode>,
  );
}

/*
 * On iOS, put the mirror back BEFORE the first read of the store.
 *
 * The order is the whole thing, and getting it the other way round would be
 * worse than having no mirror at all. `load` runs inside `useReducer`, so
 * mounting first means booting on the empty library the web view handed
 * back — and then the save effect commits that empty library, which the
 * mirror faithfully copies, because its one rule is to hold whatever was
 * committed. A recoverable loss would become a permanent one, in the moment
 * the rescue was supposed to happen.
 *
 * The web path is left exactly as it was, mounting synchronously, rather than
 * awaiting a promise that resolves to `false` having done nothing.
 */
if (isNative()) {
  void restoreFromMirror().finally(mount);
} else if (location.hash === SHARED_MARK) {
  /*
   * An order email shared in, held by the service worker, which sent this
   * page here to collect it. Collected BEFORE mounting, so the first state the
   * app builds already holds it and opens Add with it, exactly as the share
   * did when it arrived in the address — rather than opening on the library
   * and jumping. See `receiveShare` in public/sw.js for why it no longer
   * arrives in the address.
   *
   * Never by the landing page's demo: the worker gives a share to the first
   * page that asks, so a demo that asked would take an email meant for the
   * app and show it in the shop window, and the app would open on nothing.
   */
  if (embedded()) mount();
  else void collectShare(navigator.serviceWorker).finally(mount);
} else {
  mount();
}

/*
 * The service worker is a WEB mechanism, and only the web build needs it.
 *
 * On the web it is what makes the deadline checkable with no signal — the one
 * piece of infrastructure a local-first app genuinely needs. In the iOS bundle
 * it is worse than unnecessary: it was REGISTERING AND DOING NOTHING. The
 * worker's scope is `/app/`, because that is where the app lives on the web,
 * and the native shell loads the app from the ROOT — so the registration
 * succeeded and the page it exists to serve sat outside its scope. Measured by
 * serving dist-ios and asking: `registrations: ["/app/"], controlled: false`.
 *
 * Widening the scope would be the wrong fix. A Capacitor app's assets are
 * already local files in the bundle, so offline there is a property of the
 * BUNDLE rather than of a cache, and a worker adds a second, staler copy of
 * files that cannot go missing. Nothing is lost by leaving it to the web,
 * where `freshness` tests it properly.
 *
 * Nor from the landing page's demo, which is this app at /app/ (see embed.ts).
 * Somebody who has only read the marketing page has installed nothing, and
 * this put a worker and its cache on their device regardless. Measured in a
 * fresh profile: one visit to the landing page, and the origin held a
 * registration for /app/ and the cache `kept-<build>`.
 */
function registerWorker() {
  if (embedded() || isNative() || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/app/' }).catch(() => {
      // Offline caching is an enhancement; a registration failure (private
      // mode, unsupported context) must not take the app down with it.
    });
  });
}
registerWorker();

/*
 * A piece of the app that will not load is, on the web, almost always a tab
 * older than the deploy — see `lib/stale-build.ts` for what was measured and
 * for when a reload is and is not the answer.
 *
 * Every lazy import goes through Vite's preload helper, which fires this event
 * when one fails and then rethrows to the caller, so the screen says what it
 * would have said anyway while this finds out whether there is a newer build to
 * go to. The web only: in the iOS app every file is in the bundle, so there is
 * no deploy for a tab to be older than.
 */
const RELOADED_FROM = 'kept.reloadedFrom';

async function reloadIfOlderThanDeployed() {
  // Not the landing page's demo, which keeps nothing and starts afresh every
  // time it is opened, and which must not leave a mark in the tab's session
  // store either (see embed.ts).
  if (embedded()) return;
  const onScreen = document.querySelector('script[type="module"][src]')?.getAttribute('src') ?? null;
  let available: string | null = null;
  /*
   * The shell a reload would open. With the worker in charge this is the one it
   * precached, answered from its cache at once; without one it is the server's,
   * given three seconds — on a signal that never answers, nothing can be named,
   * so nothing is reloaded.
   */
  const gaveUp = new AbortController();
  const timer = setTimeout(() => gaveUp.abort(), 3000);
  try {
    const res = await fetch('/app/', { cache: 'no-cache', signal: gaveUp.signal });
    if (res.ok) available = bootScript(await res.text());
  } catch {
    // Offline, or no answer: there is no other build anyone can name.
  } finally {
    clearTimeout(timer);
  }
  let reloadedFrom: string | null = null;
  try {
    reloadedFrom = sessionStorage.getItem(RELOADED_FROM);
  } catch {
    // A session store that cannot be read cannot remember a reload either, so
    // the guard below cannot hold — and a reload that might repeat is not one
    // to start.
    return;
  }
  if (!shouldReload({ onScreen, available, reloadedFrom, saved: savedToStore() })) return;
  try {
    sessionStorage.setItem(RELOADED_FROM, onScreen ?? '');
  } catch {
    return; // As above: no memory of it, no reload.
  }
  window.location.reload();
}

if (!isNative()) {
  window.addEventListener('vite:preloadError', () => {
    void reloadIfOlderThanDeployed();
  });
}
