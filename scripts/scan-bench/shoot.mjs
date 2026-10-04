/**
 * Photographs every slip in slips.mjs the ways a hand actually does: flat
 * and filling the frame, turned, in perspective, and small on the table.
 * Writes scripts/scan-bench/out/ (ignored) for bench.ts to read.
 *
 *   CHROMIUM_PATH=/path/to/chrome node scripts/scan-bench/shoot.mjs
 *   npx vite-node scripts/scan-bench/bench.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { SLIPS } from './slips.mjs';

const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
// [name, transform on the slip, scale of the slip, table]
const POSES = [
  ['flat-fills', 'none', 1.9, 'plain'],
  ['tilt-8', 'rotateZ(8deg)', 1.25, 'wood'],
  ['tilt-neg15', 'rotateZ(-15deg)', 1.2, 'dark'],
  ['persp-25', 'perspective(700px) rotateX(28deg) rotateZ(4deg)', 1.3, 'wood'],
  ['persp-yaw', 'perspective(800px) rotateX(22deg) rotateY(-16deg) rotateZ(-9deg)', 1.25, 'dark'],
  ['small-20', 'rotateZ(20deg)', 0.8, 'wood'],
];
const TABLES = {
  plain: '#ddd8cf',
  wood: 'repeating-linear-gradient(95deg,#6d4c33 0 14px,#7a5739 14px 31px,#5f412b 31px 40px)',
  dark: 'radial-gradient(circle at 30% 20%,#4a4f57,#23262b)',
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/ /g, '&nbsp;');
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1 });
const meta = [];
for (const s of SLIPS) {
  for (const [pose, tf, scale, table] of POSES) {
    const lines = s.lines.map((l) => `<div>${l ? esc(l) : '&nbsp;'}</div>`).join('');
    // A lamp's fall-off over everything, as a kitchen photo has.
    await page.setContent(`<body style="margin:0;width:900px;height:1200px;overflow:hidden;background:${TABLES[table]};display:grid;place-items:center">
      <div style="transform:scale(${scale})"><div style="transform:${tf};background:#fbfaf6;color:#1a1a1a;width:340px;padding:26px 20px;font:15px/1.45 'DejaVu Sans Mono',monospace;box-shadow:0 12px 30px rgba(0,0,0,.35)">${lines}</div></div>
      <div style="position:fixed;inset:0;background:linear-gradient(170deg,rgba(255,255,255,.08),rgba(0,0,0,.18))"></div></body>`);
    const file = `${s.name}__${pose}.png`;
    await page.screenshot({ path: `${OUT}${file}` });
    meta.push({ file, pose, store: s.store, total: s.totalOverride ?? s.total, day: s.day });
  }
}
await browser.close();
writeFileSync(`${OUT}meta.json`, JSON.stringify(meta, null, 1));
console.log(`${meta.length} photos in ${OUT}`);
