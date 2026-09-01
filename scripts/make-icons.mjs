/**
 * Renders every PNG the app ships from the single SVG source in public/icons.
 * Kept in the repo so the icon set can be regenerated from the mark rather
 * than maintained as files that quietly drift apart.
 *
 *   node scripts/make-icons.mjs
 *
 * The iOS assets are here rather than left to `npx cap add ios`, which writes
 * CAPACITOR'S OWN LOGO and says nothing about it. Shipping that is a home
 * screen carrying another company's mark, and a launch screen to match.
 *
 * iOS has two rules the web icons do not, and both are silent failures:
 *
 *   - NO ALPHA CHANNEL. Apple rejects an app icon that has one, opaque or
 *     otherwise, and every Playwright screenshot is RGBA — hence writeOpaquePng.
 *   - NO ROUNDED CORNERS. iOS applies its own mask, so the web icon's rx=112
 *     would be rounded twice and show dark wedges inside the system's curve.
 *     The iOS variant squares them off.
 */
import { chromium } from 'playwright';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { decodePng, writeOpaquePng } from './png.mjs';

const EXEC = process.env.CHROMIUM_PATH;
const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');

// The maskable variant: platforms crop up to 20% off every edge, so the mark
// is inset to survive a circular or squircle mask on any launcher.
const maskable = svg
  .replace('<rect width="512" height="512" rx="112"', '<rect width="512" height="512" rx="0"')
  .replace('translate(146 92) scale(5.55)', 'translate(176 130) scale(4.2)');

// Square corners and a ground that reaches every edge: iOS masks it itself.
const iosIcon = svg.replace('<rect width="512" height="512" rx="112"', '<rect width="512" height="512" rx="0"');

/*
 * The launch screen is CREAM, not ink, because capacitor.config.ts already
 * commits the shell to #FDFAF1 — the ground the app itself draws. A launch
 * screen in the icon's ink would put a dark flash between the system's
 * background and the first paint, which is the exact seam that setting exists
 * to remove.
 */
const inner = svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>'));
/*
 * Placed with a transform on a group, NOT as a nested <svg x y width height>.
 * The nested form is the obvious way to write it and Chromium did not scale by
 * the inner viewBox, so the mark rendered at several times its size and ran off
 * the canvas — which the generator reported as a success, because it had drawn
 * something. Only looking at the file caught it.
 */
const MARK = 512;
const splash = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732">`
  + `<rect width="2732" height="2732" fill="#FDFAF1"/>`
  + `<g transform="translate(${(2732 - MARK) / 2} ${(2732 - MARK) / 2})">${inner}</g>`
  + `</svg>`;

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const page = await browser.newPage();

for (const [name, size, source] of [
  ['icon-180.png', 180, svg],
  ['icon-192.png', 192, svg],
  ['icon-512.png', 512, svg],
  ['icon-maskable-512.png', 512, maskable],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>${source}`,
  );
  const buf = await page.screenshot({ omitBackground: true });
  writeFileSync(new URL(`../public/icons/${name}`, import.meta.url), buf);
  console.log(`${name} ${size}x${size} ${buf.length}b`);
}

/*
 * iOS. Written through the PNG writer rather than straight from the
 * screenshot, so the alpha channel is gone rather than merely unused.
 */
const shoot = async (source, size, background) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:${background}}svg{display:block;width:${size}px;height:${size}px}</style>${source}`,
  );
  return page.screenshot();
};

const ICON = new URL('../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', import.meta.url);
const TMP = new URL('../ios/App/App/Assets.xcassets/AppIcon.appiconset/.tmp.png', import.meta.url);
writeFileSync(TMP, await shoot(iosIcon, 1024, '#171410'));
writeOpaquePng(ICON, decodePng(TMP), [23, 20, 16]);
rmSync(TMP);
console.log(`AppIcon-512@2x.png 1024x1024 ${readFileSync(ICON).length}b, no alpha`);

writeFileSync(TMP, await shoot(splash, 2732, '#FDFAF1'));
const splashImage = decodePng(TMP);
rmSync(TMP);
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  // All three entries in the imageset point at the same artwork, which is what
  // the template does: one square, scaled to fill whatever the device is.
  const out = new URL(`../ios/App/App/Assets.xcassets/Splash.imageset/${name}`, import.meta.url);
  writeOpaquePng(out, splashImage, [253, 250, 241]);
  console.log(`${name} 2732x2732 ${readFileSync(out).length}b`);
}

await browser.close();
