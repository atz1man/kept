/**
 * Whether a field the Add card marks "check" is the field that came out
 * wrong. Reads every photo shoot.mjs took exactly as scan.ts does, then for
 * the total and the purchase date records: right or wrong, how the parser
 * found it, the lowest confidence tesseract gave the words it was read from,
 * and whether lib/confidence.ts — the app's own rule, called here rather than
 * copied — marks it. Prints the tables the marks were chosen from.
 *
 *   OUT=<dir with meta.json and the photos> npx vite-node scripts/scan-bench/confidence.ts
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createWorker, OEM } from 'tesseract.js';
// @ts-expect-error a JS helper
import { decodePng, writeOpaquePng } from '../png.mjs';
import { readable, toGray, type Gray } from '../../src/lib/flatten';
import { readFlattenedOrAsTaken, fromScan, UNSURE_BELOW, type Reader } from '../../src/lib/receipt-scan';
import { parseReceiptText } from '../../src/lib/parse';
import { toCheck } from '../../src/lib/confidence';

const DIR = process.env.OUT ?? new URL('./out', import.meta.url).pathname;
const TMP = `${DIR}/tmp`;
mkdirSync(TMP, { recursive: true });
const TODAY = new Date(2026, 8, 30);
const meta = JSON.parse(readFileSync(`${DIR}/meta.json`, 'utf8')) as { file: string; pose: string; store: string | null; total: string; day: string }[];

function toPng(g: Gray, name: string): string {
  const rgba = new Uint8Array(g.width * g.height * 4);
  for (let i = 0; i < g.data.length; i++) { rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = g.data[i]; rgba[i * 4 + 3] = 255; }
  const path = `${TMP}/${name}`;
  writeOpaquePng(path, { width: g.width, height: g.height, channels: 4, data: Buffer.from(rgba) });
  return path;
}

type Word = { text: string; confidence: number; line: string };
const words = new Map<string, Word[]>();
const worker = await createWorker('eng', OEM.LSTM_ONLY, { langPath: new URL('../../node_modules/@tesseract.js-data/eng/4.0.0_best_int', import.meta.url).pathname, cachePath: TMP });
const readerOf = (path: string): Reader => async (how) => {
  await worker.setParameters({ thresholding_method: how === 'global' ? '0' : '2' });
  const { data } = await worker.recognize(path, {}, { text: true, blocks: true });
  const ws: Word[] = [];
  for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) for (const w of l.words) ws.push({ text: w.text, confidence: w.confidence, line: l.text.trim() });
  words.set(data.text, ws);
  // The words the app would carry, exactly as scan.ts collects them.
  return { text: data.text, unsure: ws.filter((w) => w.confidence < UNSURE_BELOW) };
};
const digits = (s: string) => s.replace(/[^0-9]/g, '');
/** The lowest confidence among words carrying any of these digit runs. */
function lowest(ws: Word[], needles: string[]): number | null {
  const hit = ws.filter((w) => needles.some((n) => n.length >= 2 && digits(w.text).includes(n)));
  return hit.length ? Math.min(...hit.map((w) => w.confidence)) : null;
}

const rows: { file: string; field: string; right: boolean; how: string | null; conf: number | null; marked: boolean }[] = [];
const reads: { file: string; ocr: string; words: Word[]; total: number; day: string }[] = [];
for (const m of meta) {
  const png = decodePng(`${DIR}/${m.file}`);
  const rgba = png.data.length === png.width * png.height * 4 ? png.data : (() => { const o = new Uint8Array(png.width * png.height * 4); for (let i = 0, j = 0; i < png.data.length; i += 3, j += 4) { o[j] = png.data[i]; o[j + 1] = png.data[i + 1]; o[j + 2] = png.data[i + 2]; o[j + 3] = 255; } return o; })();
  const { flat, asTaken } = readable(toGray(rgba, png.width, png.height));
  const { text: ocr } = await readFlattenedOrAsTaken(flat ? readerOf(toPng(flat, 'b.png')) : null, readerOf(toPng(asTaken, 'a.png')), TODAY);
  const ws = words.get(ocr) ?? [];
  reads.push({ file: m.file, ocr, words: ws, total: Math.round(parseFloat(m.total.replace(/[£,]/g, '')) * 100), day: m.day });
  const out = parseReceiptText(fromScan(ocr), TODAY);
  const pence = Math.round(parseFloat(m.total.replace(/[£,]/g, '')) * 100);
  if (!out.ok) { rows.push({ file: m.file, field: 'total', right: false, how: null, conf: null, marked: false }, { file: m.file, field: 'day', right: false, how: null, conf: null, marked: false }); continue; }
  const v = out.value;
  const marks = toCheck(v, ws.filter((w) => w.confidence < UNSURE_BELOW));
  const amountDigits = v.amount === null ? [] : [digits((v.amount / 100).toFixed(2))];
  const [y, mo, d] = v.purchasedOn.split('-');
  rows.push({ file: m.file, field: 'total', right: v.amount === pence, how: v.how.amount, conf: lowest(ws, amountDigits), marked: marks.amount !== undefined });
  rows.push({ file: m.file, field: 'day', right: v.dateFound && v.purchasedOn === m.day, how: v.how.purchasedOn, conf: v.dateFound ? lowest(ws, [`${d}${mo}`, `${d}${mo}${y.slice(2)}`, d.padStart(2, '0')]) : null, marked: marks.purchasedOn !== undefined });
  const r = rows.slice(-2);
  console.log(m.file.padEnd(48), r.map((x) => `${x.field}:${x.right ? 'ok ' : 'BAD'} ${String(x.how).padEnd(7)} ${x.conf === null ? '  -' : x.conf.toFixed(0).padStart(3)}${x.marked ? ' CHECK' : '      '}`).join('   '));
}
await worker.terminate();
writeFileSync(`${DIR}/confidence.json`, JSON.stringify(rows, null, 1));
writeFileSync(`${DIR}/reads.json`, JSON.stringify(reads));

for (const field of ['total', 'day']) {
  // A field the parser never found is asked for outright, so it is not counted here.
  const found = rows.filter((r) => r.field === field && r.how !== null);
  console.log(`\n${field}: the app marks ${found.filter((r) => !r.right && r.marked).length} of ${found.filter((r) => !r.right).length} wrong, and ${found.filter((r) => r.right && r.marked).length} of ${found.filter((r) => r.right).length} right`);
  const fr = rows.filter((r) => r.field === field && r.how !== null);
  const byHow = new Map<string, { right: number; wrong: number }>();
  for (const r of fr) { const t = byHow.get(r.how!) ?? { right: 0, wrong: 0 }; t[r.right ? 'right' : 'wrong']++; byHow.set(r.how!, t); }
  console.log(`\n${field} by how it was found:`, Object.fromEntries(byHow));
  for (const cut of [50, 60, 70, 80, 85, 90]) {
    const low = fr.filter((r) => r.conf !== null && r.conf < cut);
    console.log(`  ${field} words under ${cut}%: ${low.filter((r) => !r.right).length} wrong, ${low.filter((r) => r.right).length} right   (of ${fr.filter((r) => !r.right).length} wrong, ${fr.filter((r) => r.right).length} right overall)`);
  }
}
