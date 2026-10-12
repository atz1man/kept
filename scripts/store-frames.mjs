/**
 * App Store frames: each raw screenshot under a two-line headline, on the
 * hero's gradient, in a phone bezel — the set that goes to App Store Connect.
 *
 *   npm run build:ios && npm run store:screenshots && npm run store:frames
 *
 * Reads the four raw 1290 × 2796 shots `store:screenshots` writes and writes
 * the framed ones, at the same 6.9" size, to store/screenshots/framed/iphone-6.9/.
 * Both directories are gitignored: they are made from the app, not kept.
 *
 * The captions are claims in a shop window, so each is held to the code it
 * describes by test/store-frames.test.ts — the retailer count to the table,
 * the two periods to the law's constants, the privacy words to the pages
 * that make the same promise. Change one here and that test says whether it
 * is still true.
 *
 * Two failures this refuses rather than writes, because both have happened
 * once and both produce a confident-looking PNG: a frame in the fallback
 * typeface (Geist never loaded, so the headline set in Arial), and a frame
 * with no phone in it (the screenshot never decoded). Everything is embedded
 * as a data URI — `setContent` will not load `file://` — and checked before
 * the shutter.
 *
 * Not on the UK clock and not a CI sweep: it reads no date and checks nothing
 * about the app. It does report a crash under what it had already written.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { color, gradient } from '../src/tokens.ts';
import { reportOnCrash, sayCrash } from './crash-report.mjs';

/** The raw shot, then the headline's two lines (the second in gold), then the subline (\n breaks it where a sentence ends). */
export const CAPTIONS = [
  ['01-deadlines', 'Every return deadline,', 'in one place.', 'The shop’s real window for 101 UK retailers, counted for you.'],
  ['02-shop-clock-and-your-rights', 'Your legal rights,', 'counted too.', '30 days to reject a fault. 14 days to cancel online.\nIt shows which closes first.'],
  ['03-paste-an-order-email', 'Paste the order email.', 'It reads the rest.', 'Shop, total and date —\nand it asks when it isn’t sure.'],
  ['04-scan-a-till-receipt', 'Snap the till receipt.', 'Never uploaded.', 'Read on your phone. No account, nothing leaves it.'],
];

/** 1290 × 2796, an accepted 6.9" size — the same as the raw shots. */
export const SIZE = { width: 1290, height: 2796 };

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = `${ROOT}store/screenshots/iphone-6.9`;
const OUT = `${ROOT}store/screenshots/framed/iphone-6.9`;

const b64 = (file) => readFileSync(file).toString('base64');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The page for one frame. Colours are the app's tokens, the face its own Geist. */
export function frameHtml(font, shot, [, top, gold, sub]) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><style>
  @font-face{font-family:Geist;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}
  *{margin:0;box-sizing:border-box}
  body{width:${SIZE.width}px;height:${SIZE.height}px;overflow:hidden;font-family:Geist,sans-serif;
    background:${color.heroEnd};background-image:${gradient.hero};color:${color.white};position:relative}
  .cap{position:absolute;top:150px;left:96px;right:96px}
  h1{font-size:104px;line-height:1.05;font-weight:800;letter-spacing:-2.5px}
  h1 span{color:${color.gold}}
  p{margin-top:36px;font-size:46px;line-height:1.3;color:${color.onHeroSoft};font-weight:500}
  .phone{position:absolute;top:760px;left:115px;width:1060px;border-radius:84px;overflow:hidden;
    box-shadow:0 40px 120px rgba(0,0,0,.45);border:14px solid ${color.ink};background:${color.ink}}
  .phone img{display:block;width:100%}
  </style></head><body><div class="cap"><h1>${esc(top)}<br><span>${esc(gold)}</span></h1><p>${esc(sub).replace(/\n/g, '<br>')}</p></div>
  <div class="phone"><img alt="" src="data:image/png;base64,${shot}"></div></body></html>`;
}

async function main() {
  const missing = CAPTIONS.map(([name]) => `${RAW}/${name}.png`).filter((f) => !existsSync(f));
  if (missing.length) {
    console.error(`✗ no raw screenshot to frame — run \`npm run build:ios && npm run store:screenshots\` first:\n  ${missing.join('\n  ')}`);
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });

  const written = [];
  let browser;
  reportOnCrash(async (crash) => {
    for (const p of written) console.log(`✓ ${p.replace(ROOT, '')}`);
    sayCrash(crash);
    await browser?.close().catch(() => {});
    process.exit(1);
  });

  const { chromium } = await import('playwright');
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
  const font = b64(`${ROOT}public/fonts/geist.woff2`);
  const problems = [];

  for (const caption of CAPTIONS) {
    const name = caption[0];
    await page.setContent(frameHtml(font, b64(`${RAW}/${name}.png`), caption), { waitUntil: 'load' });
    const seen = await page.evaluate(async () => {
      await document.fonts.load('800 104px Geist');
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
      const img = document.images[0];
      return {
        font: document.fonts.check('800 104px Geist') && [...document.fonts].some((f) => f.family === 'Geist' && f.status === 'loaded'),
        width: img?.naturalWidth ?? 0,
        height: img?.naturalHeight ?? 0,
        // A headline line that wraps is a third line nobody designed for.
        lines: Math.round(document.querySelector('h1').getBoundingClientRect().height / (104 * 1.05)),
        // The phone runs off the bottom edge on purpose, taking the tab bar
        // with it; what must not happen is the words running into its top.
        gap: document.querySelector('.phone').getBoundingClientRect().top - document.querySelector('.cap').getBoundingClientRect().bottom,
      };
    });
    const wrong = [
      !seen.font && 'Geist did not load — this would be set in a fallback face',
      seen.width === 0 && 'the screenshot did not decode — this would be an empty bezel',
      seen.width && (seen.width !== SIZE.width || seen.height !== SIZE.height) && `the raw shot is ${seen.width} × ${seen.height}, not ${SIZE.width} × ${SIZE.height}`,
      seen.lines !== 2 && `the headline sets on ${seen.lines} lines, not 2`,
      seen.gap < 48 && `the caption comes within ${Math.round(seen.gap)}px of the phone`,
    ].filter(Boolean);
    if (wrong.length) {
      problems.push(`${name}: ${wrong.join('; ')}`);
      continue;
    }
    const path = `${OUT}/${name}.png`;
    await page.screenshot({ path, clip: { x: 0, y: 0, ...SIZE } });
    written.push(path);
  }
  await browser.close();

  for (const p of written) console.log(`✓ ${p.replace(ROOT, '')}`);
  if (problems.length) {
    for (const p of problems) console.error(`✗ ${p}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
