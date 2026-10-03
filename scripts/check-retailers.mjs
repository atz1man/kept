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
import { channelIn, clockIn, looksBlocked, proposal, readSources, readTable, returnsLinks, verdict, windowSentences } from './retailer-check-lib.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const EXEC = process.env.CHROMIUM_PATH;
const today = new Date().toISOString().slice(0, 10);

const args = process.argv.slice(2);
const candidatesMode = args.includes('--candidates');
const only = args.filter((a) => !a.startsWith('--'));
// Where the report goes, and which candidates are read: overridable so the
// mode can be run against a local fixture site without touching store/.
const OUT_DIR = process.env.CHECK_OUT_DIR ?? join(ROOT, 'store/retailer-check');
const CANDIDATES = process.env.CANDIDATES_FILE ?? join(ROOT, 'store/retailer-candidates.json');

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const ctx = await browser.newContext({
  locale: 'en-GB',
  timezoneId: 'Europe/London',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  viewport: { width: 1280, height: 900 },
});

/*
 * Several shops at once: one page at a time is two hours for the candidates,
 * most of it waiting on slow help pages. Results keep the input order.
 */
// Enough for a long help page's every period; a cut quote cannot be evidence.
const QUOTES_PER_PAGE = 25;
const PARALLEL = Number(process.env.CHECK_PARALLEL ?? 4);
async function eachInParallel(items, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

async function read(url) {
  const page = await ctx.newPage();
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    /*
     * The page's whole text, not only what is on screen: help pages keep the
     * terms inside collapsed FAQ answers ("What is your returns policy?"), and
     * reading only visible text found nothing on M&S's page while the 28 days
     * sat one click away. Scripts and styles are dropped, and each block ends a
     * line so an answer is never run into the next question.
     */
    const text = await page.evaluate(() => {
      if (!document.body) return '';
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('script,style,noscript,template,svg').forEach((n) => n.remove());
      clone.querySelectorAll('p,li,div,h1,h2,h3,h4,h5,h6,dt,dd,br,td,th,summary,details,section,article').forEach((n) => n.append('\n'));
      return clone.textContent ?? '';
    });
    const status = res?.status() ?? 0;
    const title = await page.title().catch(() => '');
    if (looksBlocked(status, text)) return { url, status, title, unreadable: 'blocked by the site', sentences: [], links: [] };
    if (status >= 400) return { url, status, title, unreadable: `HTTP ${status}`, sentences: [], links: [] };
    const links = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')].map((a) => ({ text: (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 120), href: a.href })),
    );
    return { url, status, title, finalUrl: page.url(), sentences: windowSentences(text), links };
  } catch (e) {
    return { url, status: 0, title: '', unreadable: e.message.split('\n')[0], sentences: [], links: [] };
  } finally {
    await page.close();
  }
}

/*
 * --candidates: shops NOT in the table. There is no number to compare with,
 * so nothing passes or fails; the report proposes, with the quotes, and a
 * person writes the row. Each homepage is opened and the shop's own Returns or
 * Refunds links are followed, one hop further if the first pages state no
 * period, because a candidate's returns page is found rather than guessed.
 */
if (candidatesMode) {
  const all = JSON.parse(readFileSync(CANDIDATES, 'utf8')).candidates;
  const names = only.length ? Object.keys(all).filter((n) => only.includes(n)) : Object.keys(all);
  const found = await eachInParallel(names, async (name) => {
    const home = await read(all[name].home);
    const pages = [home];
    if (!home.unreadable) {
      let next = returnsLinks(home.links, home.finalUrl ?? home.url);
      for (let hop = 0; hop < 2 && next.length; hop++) {
        const read1 = [];
        for (const u of next) read1.push(await read(u));
        pages.push(...read1);
        if (read1.some((p) => p.sentences.length)) break;
        next = read1.flatMap((p) => (p.unreadable ? [] : returnsLinks(p.links, p.finalUrl ?? p.url))).filter((u) => !pages.some((p) => (p.finalUrl ?? p.url) === u)).slice(0, 3);
      }
    }
    const sentencesFound = [...new Set(pages.flatMap((p) => p.sentences))];
    const sum = proposal(sentencesFound);
    const status = home.unreadable ? `unreadable: ${home.unreadable}` : pages.length === 1 ? 'no returns link found' : sentencesFound.length ? 'read' : 'no window found';
    console.log(`${sentencesFound.length ? '•' : '✗'} ${name.padEnd(20)} ${status}${sum.periods.length ? ` — ${sum.periods.map((p) => `${p.days}d×${p.times}`).join(', ')}` : ''}`);
    return { name, home: all[name].home, pages, sentencesFound, sum, status };
  });
  await browser.close();
  const md = [
    `# Candidate retailers, read from their own sites — ${today}`,
    '',
    'Written by `npm run check:retailers -- --candidates`. Each homepage was opened and the shop\'s own Returns/Refunds links followed. ' +
      'The periods column counts how often each number appears in a sentence about returns: a summary to read the quotes against, never a value to copy. ' +
      'A shop goes into `stores.ts` by hand, from the quotes, with its returns page added to `retailer-sources.json` in the same change.',
    '',
    '| Shop | Status | Periods named | Clock named |',
    '|---|---|---|---|',
    ...found.map((f) => `| ${f.name} | ${f.status} | ${f.sum.periods.map((p) => `${p.days} days ×${p.times}`).join(', ') || '—'} | ${f.sum.clocks.join(', ') || '—'} |`),
    '',
    ...found.flatMap((f) => [
      `## ${f.name}`,
      '',
      ...f.pages.flatMap((p) => [
        `- ${p.finalUrl ?? p.url}${p.title ? ` — “${p.title}”` : ''} — ${p.unreadable ? `**unreadable: ${p.unreadable}**` : `HTTP ${p.status}`}`,
        ...p.sentences.slice(0, QUOTES_PER_PAGE).map((s) => {
          const tags = [channelIn(s), clockIn(s) && `counts from ${clockIn(s)}`].filter(Boolean);
          return `  - > ${s}${tags.length ? ` _(${tags.join(', ')})_` : ''}`;
        }),
      ]),
      '',
    ]),
  ];
  mkdirSync(OUT_DIR, { recursive: true });
  const out = join(OUT_DIR, `${today}-candidates.md`);
  writeFileSync(out, md.join('\n'));
  const withWindow = found.filter((f) => f.sentencesFound.length).length;
  console.log(`\nwrote ${out.replace(ROOT, '')}\n${withWindow} of ${found.length} shops named a period on their own pages — now read the quotes`);
  process.exit(0);
}

const table = readTable(readFileSync(join(ROOT, 'src/lib/stores.ts'), 'utf8'));
const sources = readSources(join(ROOT, 'store/retailer-sources.json'));
const rows = only.length ? table.filter((r) => only.includes(r.name)) : table;

const results = await eachInParallel(rows, async (row) => {
  const pages = [];
  for (const url of sources[row.name] ?? []) pages.push(await read(url));
  const readable = pages.filter((p) => !p.unreadable);
  const found = readable.length
    ? { sentences: readable.flatMap((p) => p.sentences) }
    : { unreadable: pages.map((p) => p.unreadable).join('; ') || 'no source listed', sentences: [] };
  const result = { row, pages, verdict: verdict(row.windowDays, found) };
  console.log(`${result.verdict === 'mentioned' ? '✓' : '✗'} ${row.name.padEnd(14)} table ${String(row.windowDays).padStart(3)} from ${row.clockStart.padEnd(8)} → ${result.verdict}`);
  return result;
});
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
      ...p.sentences.slice(0, QUOTES_PER_PAGE).map((s) => {
        const tags = [channelIn(s), clockIn(s) && `counts from ${clockIn(s)}`].filter(Boolean);
        return `  - > ${s}${tags.length ? ` _(${tags.join(', ')})_` : ''}`;
      }),
      ...(p.sentences.length > QUOTES_PER_PAGE ? [`  - …and ${p.sentences.length - QUOTES_PER_PAGE} more`] : []),
    ]),
    '',
  ]),
];
mkdirSync(OUT_DIR, { recursive: true });
const out = join(OUT_DIR, `${today}.md`);
writeFileSync(out, md.join('\n'));
console.log(`\nwrote ${out.replace(ROOT, '')}`);
const bad = results.filter((r) => r.verdict !== 'mentioned').length;
console.log(bad ? `✗ ${bad} of ${results.length} need a person` : `✓ every page mentions the table's window — now read the quotes`);
process.exit(bad ? 1 : 0);
