import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { APP_STORE, BADGE_PATH, IPHONE_ANSWER_ID } from '../src/landing/app-store-listing';
import { AppStoreButton } from '../src/landing/sections/primitives';
import { smartAppBanner } from '../vite.config';

/*
 * The App Store on the landing page. The page once carried a badge with
 * href="#": it promised an app that did not exist and went nowhere. These
 * hold the replacement to saying only what is true.
 */
const ROOT = join(__dirname, '..');
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe('the App Store button', () => {
  it('shows Apple’s badge only for a listing that exists, with the artwork Apple supplies', () => {
    if (APP_STORE.url) {
      expect(APP_STORE.url).toMatch(/^https:\/\/apps\.apple\.com\//);
      expect(existsSync(join(ROOT, 'public', BADGE_PATH)), `${BADGE_PATH} must be Apple's own artwork, in public/`).toBe(true);
      expect(APP_STORE.appId).toMatch(/^\d+$/);
    } else {
      const out = html(createElement(AppStoreButton));
      expect(out).not.toContain('Download on the App Store');
      expect(out).toContain('Coming to the App Store');
    }
  });

  it('before launch, goes somewhere real: the answer about using it on an iPhone today', () => {
    if (APP_STORE.url) return;
    const out = html(createElement(AppStoreButton));
    expect(out).toContain(`href="#${IPHONE_ANSWER_ID}"`);
    const faq = readFileSync(join(ROOT, 'src/landing/sections/Faq.tsx'), 'utf8');
    expect(faq).toContain('id: IPHONE_ANSWER_ID');
    expect(faq).toMatch(/The iPhone app is coming to the App Store/);
  });

  it('is on the hero, ahead of the web app', () => {
    const landing = readFileSync(join(ROOT, 'src/landing/Landing.tsx'), 'utf8');
    const store = landing.indexOf('<AppStoreButton />');
    const web = landing.indexOf('<OpenAppButton onHero />');
    expect(store).toBeGreaterThan(0);
    expect(store).toBeLessThan(web);
  });
});

describe('Safari’s Smart App Banner', () => {
  const run = (appId: string | null, filename: string) => {
    const t = smartAppBanner(appId).transformIndexHtml as { handler: (h: string, c: { filename: string }) => string };
    return t.handler('<html><head><title>x</title></head></html>', { filename });
  };

  it('is on the landing page once the app has an Apple ID', () => {
    expect(run('6740000000', '/repo/index.html')).toContain('<meta name="apple-itunes-app" content="app-id=6740000000">');
  });

  it('is nowhere before then, and never on the app, privacy or rights pages', () => {
    expect(run(null, '/repo/index.html')).not.toContain('apple-itunes-app');
    for (const page of ['app', 'privacy', 'rights']) expect(run('6740000000', `/repo/${page}/index.html`)).not.toContain('apple-itunes-app');
  });

  it('matches what the listing says today', () => {
    expect(APP_STORE.appId === null).toBe(APP_STORE.url === null);
  });
});
