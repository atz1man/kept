/**
 * Fields read from each photo shoot.mjs took, as taken (the whole photo,
 * stretched — what scan.ts did before) against now (lib/flatten.ts's
 * `readable`, exactly what scan.ts does), through the app's own two-pass read
 * and parser. Prints a line per photo and a total per pose.
 *
 *   npx vite-node scripts/scan-bench/bench.ts       (ONLY=currys to filter)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createWorker, OEM } from 'tesseract.js';
// @ts-expect-error a JS helper
import { decodePng, writeOpaquePng } from '../png.mjs';
import { readable, toGray, type Gray } from '../../src/lib/flatten';
import { readBestOf, readFlattenedOrAsTaken, fromScan, type Reader } from '../../src/lib/receipt-scan';
import { parseReceiptText } from '../../src/lib/parse';

const DIR = new URL('./out', import.meta.url).pathname;
const TMP = new URL('./out/tmp', import.meta.url).pathname;
mkdirSync(TMP, { recursive: true });
const TODAY = new Date(2026, 8, 30);
const only = process.env.ONLY;
const meta = (JSON.parse(readFileSync(`${DIR}/meta.json`, 'utf8')) as { file: string; pose: string; store: string | null; total: string; day: string }[])
  .filter((m) => !only || m.file.includes(only));

function toPng(g: Gray, name: string): string {
  const rgba = new Uint8Array(g.width * g.height * 4);
  for (let i = 0; i < g.data.length; i++) { rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = g.data[i]; rgba[i * 4 + 3] = 255; }
  const path = `${TMP}/${name}`;
  writeOpaquePng(path, { width: g.width, height: g.height, channels: 4, data: Buffer.from(rgba) });
  return path;
}

const worker = await createWorker('eng', OEM.LSTM_ONLY, { langPath: new URL('../../node_modules/@tesseract.js-data/eng/4.0.0_best_int', import.meta.url).pathname, cachePath: TMP });
const readerOf = (path: string): Reader => async (how) => {
  await worker.setParameters({ thresholding_method: how === 'global' ? '0' : '2' });
  return (await worker.recognize(path)).data.text;
};
const read = (path: string) => readBestOf(readerOf(path), TODAY);
function score(ocr: string, m: (typeof meta)[number]) {
  const out = parseReceiptText(fromScan(ocr), TODAY);
  if (!out.ok) return { store: false, total: false, day: false };
  const v = out.value;
  const pence = Math.round(parseFloat(m.total.replace(/[£,]/g, '')) * 100);
  return { store: m.store === null ? true : v.store === m.store, total: v.amount === pence, day: v.dateFound && v.purchasedOn === m.day };
}

const rows: unknown[] = [];
const tally: Record<string, { asTaken: number; flat: number; n: number; found: number }> = {};
for (const m of meta) {
  const png = decodePng(`${DIR}/${m.file}`);
  const g = toGray(png.data.length === png.width * png.height * 4 ? png.data : (() => { const o = new Uint8Array(png.width * png.height * 4); for (let i = 0, j = 0; i < png.data.length; i += 3, j += 4) { o[j] = png.data[i]; o[j + 1] = png.data[i + 1]; o[j + 2] = png.data[i + 2]; o[j + 3] = 255; } return o; })(), png.width, png.height);
  // As taken: what scan.ts did before — the whole photo, stretched.
  const { flat, asTaken, paper } = readable(g);
  const asTakenPath = toPng(asTaken, 'a.png');
  const a = score(await read(asTakenPath), m);
  // Now: exactly what scan.ts does — flattened first, the photo as taken where that falls short.
  const found = Array.isArray(paper) ? { quad: paper } : { none: paper };
  const b = flat ? score(await readFlattenedOrAsTaken(readerOf(toPng(flat, 'b.png')), readerOf(asTakenPath), TODAY), m) : a;
  const n = (s: typeof a) => Number(s.store) + Number(s.total) + Number(s.day);
  const t = (tally[m.pose] ??= { asTaken: 0, flat: 0, n: 0, found: 0 });
  t.asTaken += n(a); t.flat += n(b); t.n += 3; t.found += 'quad' in found ? 1 : 0;
  rows.push({ file: m.file, found: 'quad' in found ? 'quad' : found.none, asTaken: a, flat: b });
  console.log(m.file.padEnd(48), 'quad' in found ? 'quad   ' : found.none.padEnd(7), n(a), '→', n(b));
}
await worker.terminate();
let A = 0, B = 0, N = 0;
for (const [pose, t] of Object.entries(tally)) { console.log(pose.padEnd(12), `${t.asTaken}/${t.n} → ${t.flat}/${t.n}`, `paper found ${t.found}`); A += t.asTaken; B += t.flat; N += t.n; }
console.log(`ALL ${A}/${N} → ${B}/${N}`);
writeFileSync(`${DIR}/results.json`, JSON.stringify(rows, null, 1));
