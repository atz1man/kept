/**
 * Read every retailer's own returns page and write down what it says.
 *
 *   npm run check:retailers
 *
 * The table in src/lib/stores.ts is the fact the whole product rests on, and
 * APN-16 is the job of checking it against each retailer before launch. This
 * does the reading: a real browser (help pages are rendered by script, and
 * several refuse a bare HTTP client), UK locale, one page per source in
 * store/retailer-sources.json. It pulls out every sentence about returning
 * something that states a period, and writes them — quoted, with the URL and
 * the date — to store/retailer-check/<date>.md.
 *
 * It does NOT change stores.ts. A sentence has to be read to be understood:
 * "30 days" beside "for unopened items" or "for Members" is not the window a
 * person gets. The report is the evidence; the table changes by hand, from it,
 * and only then does TABLE_CHECKED_ON get a date.
 *
 * Exit 0 only when every shop's page was read AND mentions the table's number.
 * Anything unreadable, blocked, silent or different is named, and exits 1.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { channelIn, clockIn, looksBlocked, readSources, readTable, verdict, windowSentences } from './retailer-check-lib.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const EXEC = process.env.CHROMIUM_PATH;
const today = new Date().toISOString().slice(0, 10);

const table = readTable(readFileSync(join(ROOT, 'src/lib/stores.ts'), 'utf8'));
const sources = readSources(join(ROOT, 'store/retailer-sources.json'));
const only = process.argv.slice(2);
const rows = only.length ? table.filter((r) => only.includes(r.name)) : table;

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const ctx = await browser.newContext({
  locale: 'en-GB',
  timezoneId: 'Europe/London',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  viewport: { width: 1280, height: 900 },
});

async function read(url) {
  const page = await ctx.newPage();
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    const text = await page.evaluate(() => document.body?.innerText ?? '');
    const status = res?.status() ?? 0;
    const title = await page.title().catch(() => '');
    if (looksBlocked(status, text)) return { url, status, title, unreadable: 'blocked by the site', sentences: [] };
    if (status >= 400) return { url, status, title, unreadable: `HTTP ${status}`, sentences: [] };
    return { url, status, title, finalUrl: page.url(), sentences: windowSentences(text) };
  } catch (e) {
    return { url, status: 0, title: '', unreadable: e.message.split('\n')[0], sentences: [] };
  } finally {
    await page.close();
  }
}

const results = [];
for (const row of rows) {
  const pages = [];
  for (const url of sources[row.name] ?? []) pages.push(await read(url));
  const readable = pages.filter((p) => !p.unreadable);
  const found = readable.length
    ? { sentences: readable.flatMap((p) => p.sentences) }
    : { unreadable: pages.map((p) => p.unreadable).join('; ') || 'no source listed', sentences: [] };
  results.push({ row, pages, verdict: verdict(row.windowDays, found) });
  console.log(`${results.at(-1).verdict === 'mentioned' ? '✓' : '✗'} ${row.name.padEnd(14)} table ${String(row.windowDays).padStart(3)} from ${row.clockStart.padEnd(8)} → ${results.at(-1).verdict}`);
}
await browser.close();

const md = [
  `# Retailer windows against the retailers' own pages — ${today}`,
  '',
  'Written by `npm run check:retailers`. Quotes are what each page said on this date, read in a browser with a UK locale. ' +
    '"mentioned" means the table\'s number appears in a sentence about returns — a person still has to read the sentence. ' +
    'Nothing here changes `stores.ts`.',
  '',
  '| Shop | Table | Clock | Verdict |',
  '|---|---|---|---|',
  ...results.map((r) => `| ${r.row.name} | ${r.row.windowDays} | ${r.row.clockStart} | ${r.verdict} |`),
  '',
  ...results.flatMap((r) => [
    `## ${r.row.name} — table says ${r.row.windowDays} days from ${r.row.clockStart}`,
    '',
    ...r.pages.flatMap((p) => [
      `- ${p.finalUrl ?? p.url}${p.title ? ` — “${p.title}”` : ''} — ${p.unreadable ? `**unreadable: ${p.unreadable}**` : `HTTP ${p.status}`}`,
      ...p.sentences.slice(0, 12).map((s) => {
        const tags = [channelIn(s), clockIn(s) && `counts from ${clockIn(s)}`].filter(Boolean);
        return `  - > ${s}${tags.length ? ` _(${tags.join(', ')})_` : ''}`;
      }),
      ...(p.sentences.length > 12 ? [`  - …and ${p.sentences.length - 12} more`] : []),
    ]),
    '',
  ]),
];
mkdirSync(join(ROOT, 'store/retailer-check'), { recursive: true });
const out = join(ROOT, 'store/retailer-check', `${today}.md`);
writeFileSync(out, md.join('\n'));
console.log(`\nwrote ${out.replace(ROOT, '')}`);
const bad = results.filter((r) => r.verdict !== 'mentioned').length;
console.log(bad ? `✗ ${bad} of ${results.length} need a person` : `✓ every page mentions the table's window — now read the quotes`);
process.exit(bad ? 1 : 0);
