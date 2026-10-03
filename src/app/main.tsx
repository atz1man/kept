import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import { App } from './App';
import { Recovery } from './components/Recovery';
import { color } from '../tokens';
import { isNative } from '../lib/mirror';
import { restoreFromMirror } from '../lib/storage';

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
 */
if (!isNative() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/app/' }).catch(() => {
      // Offline caching is an enhancement; a registration failure (private
      // mode, unsupported context) must not take the app down with it.
    });
  });
}
