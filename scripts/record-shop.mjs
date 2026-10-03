/**
 * Record a shop's returns window, read by a person off the shop's own page.
 *
 *   npm run record:shop                         what is left to read, and where
 *   npm run record:shop -- "<shop>" "<page address>" "<sentence>" ["<sentence>"…]
 *
 * For the shops that refuse an automated browser. Open the shop's returns
 * page in an ordinary browser, copy the sentence that states the window word
 * for word, and pass it here with the page's address. This checks the page is
 * the shop's own and the sentence names the table's number, then writes the
 * quote into today's report under store/retailer-check/ and dates the shop in
 * CHECKED_ON — the evidence `test/verified.test.ts` requires, in its format.
 *
 * It never changes a window. If the sentence names a different number, it
 * says so and stops: the table changes by hand, from the quote, in a commit a
 * reviewer can read.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkedNames, manualRecord, readSources, readTable, withCheckedOn } from './retailer-check-lib.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const STORES = join(ROOT, 'src/lib/stores.ts');
const source = readFileSync(STORES, 'utf8');
const table = readTable(source);
const own = readSources(join(ROOT, 'store/retailer-sources.json'));
const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const [name, url, ...quotes] = process.argv.slice(2);

if (!name) {
  const left = table.filter((r) => !checkedNames(source).includes(r.name));
  if (!left.length) {
    console.log('Every shop in the table is checked against its own page.');
    process.exit(0);
  }
  console.log(`${left.length} shop${left.length === 1 ? '' : 's'} not yet checked against ${left.length === 1 ? 'its' : 'their'} own returns page:\n`);
  for (const r of left) {
    const windows = r.onlineWindowDays ? `${r.windowDays} days in store, ${r.onlineWindowDays} online` : `${r.windowDays} days`;
    console.log(`${r.name} — the table says ${windows}, counted from ${r.clockStart}`);
    for (const u of own[r.name] ?? []) console.log(`  ${u}`);
    console.log('');
  }
  console.log('For each: open a page above in an ordinary browser, find the sentence that states the window, and run');
  console.log('  npm run record:shop -- "<shop>" "<the page’s address>" "<the sentence, word for word>"');
  console.log('Then `npm test`, and commit what it wrote.');
  process.exit(0);
}

const row = table.find((r) => r.name.toLowerCase() === name.toLowerCase());
if (!row) {
  console.error(`✗ ${name} is not in the table. Shops are added to stores.ts by hand.`);
  process.exit(1);
}
const result = manualRecord({ row, url, quotes, own: own[row.name] });
if (!result.ok) {
  console.error(`✗ Nothing written for ${row.name}:`);
  for (const p of result.problems) console.error(`  - ${p}`);
  process.exit(1);
}

const report = join(ROOT, 'store/retailer-check', `${today}-by-hand.md`);
const header = `# Retailer windows read by hand — ${today}\n\nWritten by \`npm run record:shop\`. Each quote was copied by a person, in an ordinary browser, from the shop's own returns page on this date. The script checked that the page is on the shop's own site and that the quote names the table's window; it changes no window.\n\n`;
writeFileSync(report, (existsSync(report) ? readFileSync(report, 'utf8') : header) + result.section + '\n');
writeFileSync(STORES, withCheckedOn(source, row.name, today));
console.log(`✓ ${row.name}: quote written to ${report.replace(ROOT, '')}, and dated ${today} in CHECKED_ON.`);
console.log('  Run `npm test` — test/verified.test.ts reads the quote back — then commit both files.');
