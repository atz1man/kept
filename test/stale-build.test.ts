import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bootScript, shouldReload, type StaleCheck } from '../src/lib/stale-build';

/**
 * When a piece of the app will not load, a reload is the cure only if there is
 * a newer build to reload INTO, and only if the store already holds what is on
 * screen. `freshness` asks both directions in a browser — a tab taken over by a
 * deploy reloads into it; a tab offline with nowhere to go stays put. These pin
 * the decision at its edges, which a browser walk visits once each.
 */
const A = '/assets/app-AAAA.js';
const B = '/assets/app-BBBB.js';
const stale: StaleCheck = { onScreen: A, available: B, reloadedFrom: null, saved: true };

describe('reloading a tab older than the deploy', () => {
  it('reloads when another build is there to open', () => {
    expect(shouldReload(stale)).toBe(true);
  });

  it('does not when the build a reload would open is the one on screen', () => {
    // It would fail the same way after the reload, having thrown the screen away.
    expect(shouldReload({ ...stale, available: A })).toBe(false);
  });

  it('does not when nothing could be asked — offline, or no answer', () => {
    expect(shouldReload({ ...stale, available: null })).toBe(false);
    expect(shouldReload({ ...stale, onScreen: null })).toBe(false);
  });

  it('does not when the last save did not reach the store', () => {
    // A reload loads the store, not the screen: what only memory holds would go.
    expect(shouldReload({ ...stale, saved: false })).toBe(false);
  });

  it('leaves a build only once per tab, so it cannot loop', () => {
    expect(shouldReload({ ...stale, reloadedFrom: A })).toBe(false);
    // Having left A once, a later deploy can still move it on from B.
    expect(shouldReload({ onScreen: B, available: '/assets/app-CCCC.js', reloadedFrom: A, saved: true })).toBe(true);
  });
});

describe('naming a build by the script it boots from', () => {
  it('reads the app document this build emits', () => {
    const html = readFileSync(join(__dirname, '..', 'app', 'index.html'), 'utf8');
    expect(bootScript(html)).toBe('/src/app/main.tsx');
  });

  it('reads the shape Vite writes, ignoring the preloads beside it', () => {
    const html = `<head>
  <link rel="preload" href="/fonts/geist.woff2" as="font" type="font/woff2" crossorigin />
  <script type="module" crossorigin src="/assets/app-C7YpjjYO.js"></script>
  <link rel="modulepreload" crossorigin href="/assets/tokens-D7geEi-h.js">
</head>`;
    expect(bootScript(html)).toBe('/assets/app-C7YpjjYO.js');
  });

  it('skips a classic script and finds the module after it', () => {
    expect(bootScript('<script src="/legacy.js"></script><script src="/assets/app-X.js" type="module"></script>')).toBe('/assets/app-X.js');
  });

  it('names nothing when there is no module script, rather than guessing', () => {
    expect(bootScript('<html><body>Service unavailable</body></html>')).toBeNull();
  });
});
