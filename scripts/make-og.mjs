/**
 * Renders the link preview: the picture a messaging app or a social site
 * shows when someone pastes https://getquidsin.co.uk.
 *
 *   npm run og
 *
 * Without one, a shared link was a bare URL, or whatever the platform scraped
 * on its own. The site's whole growth path is somebody telling a friend, so
 * the picture under that message is the first impression.
 *
 * Drawn from the same sources as the site, the way make-icons.mjs draws the
 * app icon: the hero gradient and ink from `src/tokens.ts`, the mark from
 * `public/icons/icon.svg`, the headline and tagline from the landing page and
 * `lib/brand.ts`, and the self-hosted Geist. 1200×630 is the size every major
 * platform crops to, and the file is opaque, because a preview with an alpha
 * channel is drawn over whatever background the app has: black in a dark
 * WhatsApp, white in a light one.
 *
 * test/site-meta.test.ts holds the page to the file: the tags name this
 * image, at this size, at the site's own origin.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { heroGradient, palette } from '../src/tokens.ts';
import { TAGLINE_LEAD } from '../src/lib/brand.ts';
import { decodePng, writeOpaquePng } from './png.mjs';

const ROOT = new URL('..', import.meta.url);
const OUT = new URL('public/og.png', ROOT).pathname;
const WIDTH = 1200;
const HEIGHT = 630;

const svg = readFileSync(new URL('public/icons/icon.svg', ROOT), 'utf8');
const font = readFileSync(new URL('public/fonts/geist.woff2', ROOT)).toString('base64');
// The headline is the landing page's own h1, read out of it, so the picture
// and the page cannot say two different things.
const landing = readFileSync(new URL('src/landing/Landing.tsx', ROOT), 'utf8');
const HEADLINE = (landing.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/) ?? [])[1];
if (!HEADLINE) throw new Error('could not read the landing page’s h1 — Landing.tsx changed shape');
const HOST = new URL(JSON.parse(readFileSync(new URL('store/listing.json', ROOT), 'utf8')).urls.marketing).host;

const c = palette.light;
const html = `<!doctype html><html><head><style>
  @font-face { font-family: Geist; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 900; }
  html, body { margin: 0; }
  body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; font-family: Geist, sans-serif;
    background-color: ${c.heroEnd}; background-image: ${heroGradient(c)}; color: ${c.white};
    position: relative; box-sizing: border-box; padding: 72px 80px; display: flex; flex-direction: column; }
  .disc { position: absolute; border-radius: 999px; background: ${c.onHeroGlass}; }
  .brand { display: flex; align-items: center; gap: 18px; font-size: 38px; font-weight: 600; letter-spacing: -0.5px; position: relative; }
  .brand svg { width: 64px; height: 64px; }
  h1 { font-size: 76px; line-height: 1.02; letter-spacing: -0.04em; font-weight: 700; margin: auto 0 0; max-width: 900px; position: relative; }
  .foot { display: flex; justify-content: space-between; align-items: baseline; margin-top: 34px; font-size: 28px; font-weight: 600; color: ${c.onHeroSoft}; position: relative; }
  .host { color: ${c.white}; }
</style></head><body>
  <div class="disc" style="width:720px;height:720px;right:-260px;top:-360px;opacity:.35"></div>
  <div class="disc" style="width:460px;height:460px;left:-200px;bottom:-300px;opacity:.25"></div>
  <div class="brand">${svg}<span>Quids In</span></div>
  <h1>${HEADLINE}</h1>
  <div class="foot"><span>${TAGLINE_LEAD}</span><span class="host">${HOST}</span></div>
</body></html>`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
const tmp = `${OUT}.rgba.png`;
await page.screenshot({ path: tmp, type: 'png' });
await browser.close();
writeOpaquePng(OUT, decodePng(tmp));
(await import('node:fs')).rmSync(tmp);
console.log(`✓ ${OUT} (${WIDTH}×${HEIGHT})`);
