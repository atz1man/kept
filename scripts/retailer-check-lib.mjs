/**
 * The judgement half of `npm run check:retailers`, kept apart from the browser
 * so it can be tested without one.
 *
 * Nothing here decides a retailer's window. It finds the sentences on a
 * retailer's own page that state one, and says whether the table's number is
 * among them. A person — or a reviewer reading the report — decides from the
 * quotes. That is the line this repository holds everywhere else about retailer
 * policy: never change a window on anything but the retailer's own words, and
 * never let a tool's summary stand in for them.
 */
import { readFileSync } from 'node:fs';

/** Name, window and clock start of every row, read from stores.ts as text. */
export function readTable(storesSource) {
  const rows = [];
  // A name may carry an escaped quote — Levi\'s, Lands\' End — so the name
  // runs to the first UNescaped quote, and the escapes come off after.
  const re = /name: '((?:[^'\\]|\\.)+)'[^\n]*?windowDays: (\d+), clockStart: '(\w+)'/g;
  let m;
  while ((m = re.exec(storesSource))) {
    const row = { name: m[1].replace(/\\(.)/g, '$1'), windowDays: Number(m[2]), clockStart: m[3] };
    // An online window of its own, on the same line, is checked too.
    const line = storesSource.slice(m.index, storesSource.indexOf('\n', m.index));
    const online = /onlineWindowDays: (\d+)/.exec(line);
    rows.push(online ? { ...row, onlineWindowDays: Number(online[1]) } : row);
  }
  return rows;
}

export function readSources(path) {
  return JSON.parse(readFileSync(path, 'utf8')).sources;
}

/** Page text into sentences, keeping line breaks as boundaries: help pages are lists. */
export function sentences(text) {
  return text
    .split(/\n+|(?<=[.!])\s+(?=[A-Z0-9“"(])/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 0 && s.length <= 600);
}

const ABOUT_RETURNS = /\b(return|returns|returned|refund|refunds|refunded|exchange|exchanges|cancel|cancellation|change of mind|changed your mind)\b/i;
const A_PERIOD = /\b\d{1,3}(?:\s*|-)(?:calendar\s+|working\s+)?days?\b|\b(?:\d{1,2}|one|two|three|six|twelve)\s+months?\b|\b(?:one|a|1)\s+year\b|\b365\b/i;

/** Sentences that state a period AND are about returning something. */
export function windowSentences(text) {
  const seen = new Set();
  return sentences(text).filter((s) => {
    if (!ABOUT_RETURNS.test(s) || !A_PERIOD.test(s)) return false;
    const key = s.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Every number of days a sentence names — "28 days", "28-day", "365 days". */
export function daysIn(sentence) {
  const days = [...sentence.matchAll(/\b(\d{1,3})(?:\s*|-)(?:calendar\s+|working\s+)?days?\b/gi)].map((m) => Number(m[1]));
  // "one year" and "12 months" are how IKEA-length windows are usually
  // written; the table stores them as 365.
  if (/\b(?:one|a|1)\s+year\b|\b12\s+months\b/i.test(sentence)) days.push(365);
  return days;
}

/** What a sentence says the clock counts from, if it says. */
export function clockIn(sentence) {
  const s = sentence.toLowerCase();
  if (/\bdispatch(ed)?\b|\bshipping confirmation\b|\bshipped\b/.test(s)) return 'dispatch';
  if (/\bdeliver(y|ed)\b|\breceiv(e|ed|ing)\b|\breceipt of\b|\bcollect(ed|ion)\b/.test(s)) return 'delivery';
  if (/\bpurchase(d)?\b|\bdate of (your )?order\b|\bbought\b/.test(s)) return 'purchase';
  return null;
}

/**
 * Which kind of purchase a sentence is about, if it says: an online order, a
 * purchase in store, or neither. The table can hold a separate clock for
 * online orders (`onlineClockStart`), and this is the evidence it is set from.
 */
export function channelIn(sentence) {
  const s = sentence.toLowerCase();
  const online = /\bonline\b|\bordered\b.*\b(?:website|app)\b|\bhome delivery\b|\bdelivered to you\b|\bby post\b/.test(s);
  const store = /\bin[- ]store\b|\bin (?:one of )?our stores?\b|\bat (?:the|a) (?:till|store)\b|\bbought in\b/.test(s);
  if (online && !store) return 'online';
  if (store && !online) return 'in store';
  return null;
}

/** A page that answered with a wall rather than the terms. */
export function looksBlocked(status, text) {
  if (status === 403 || status === 429 || status === 503) return true;
  return /access denied|are you a robot|verify you are (a )?human|captcha|request unsuccessful|pardon our interruption/i.test(text.slice(0, 4000));
}

/**
 * What the report says about one shop. Deliberately four words, none of which
 * is "verified": `mentioned` means the table's number appears in a sentence
 * about returns on the retailer's page, which a person still has to read.
 */
export function verdict(tableDays, found) {
  if (found.unreadable) return 'unreadable';
  if (found.sentences.length === 0) return 'no window found';
  const all = found.sentences.flatMap(daysIn);
  // A shop with an online window has two numbers, and the page has to name
  // both: finding the in-store 30 says nothing about the online 14.
  if ([tableDays].flat().every((d) => all.includes(d))) return 'mentioned';
  return 'differs';
}

/**
 * The shop's own site, from a host: "www.next.co.uk" and "help.next.co.uk" are
 * one site, "next.co.uk" vs "nextdoor.com" are not. Two labels, or three under
 * a UK second level (co.uk, org.uk) — a returns link that leaves the shop's
 * own site is not the shop's own words.
 */
export function siteOf(host) {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.');
  const ukSecond = labels.length >= 3 && labels.at(-1) === 'uk' && /^(co|org|ltd|plc|me)$/.test(labels.at(-2));
  return labels.slice(ukSecond ? -3 : -2).join('.');
}

/**
 * The host a page ended up on when a redirect took it off the shop's own
 * site, or null when it stayed. Only the shop's own pages are evidence of its
 * window: Joules' returns URL now redirects to a help centre on zendesk.com,
 * and its 28 days were quoted from there into the table before anything
 * looked at where the page had actually landed.
 */
export function leftTheSite(requested, landed) {
  const host = new URL(landed).hostname;
  return siteOf(host) === siteOf(new URL(requested).hostname) ? null : host;
}

const RETURNS_LINK = /\breturns?\b|\brefunds?\b/i;

/**
 * Which links on a shop's page lead to its returns terms: on the shop's own
 * site, saying "return" or "refund" in the text or the path, at most `max`.
 * Text matches first, because a footer link reading "Returns & refunds" is the
 * page a person would click; a path match alone is the fallback.
 */
export function returnsLinks(anchors, pageUrl, max = 3) {
  const home = siteOf(new URL(pageUrl).hostname);
  const seen = new Set();
  const scored = [];
  for (const { text, href } of anchors) {
    let u;
    try {
      u = new URL(href, pageUrl);
    } catch {
      continue;
    }
    // Same scheme as the page it is on: a shop's https page linking to http
    // is not followed, and the candidates file holds every homepage to https.
    if (u.protocol !== new URL(pageUrl).protocol || siteOf(u.hostname) !== home) continue;
    u.hash = '';
    const key = u.href;
    if (seen.has(key) || key === new URL(pageUrl).href) continue;
    const byText = RETURNS_LINK.test(text ?? '');
    const byPath = RETURNS_LINK.test(u.pathname.replace(/[-_/]/g, ' '));
    if (!byText && !byPath) continue;
    seen.add(key);
    scored.push({ href: key, score: byText ? 0 : 1 });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, max).map((s) => s.href);
}

/**
 * What a candidate's reading came to, for the report's status column.
 *
 * `home` is the homepage read, or null when the shop's own returns page was
 * listed and said something, so the homepage was not needed. `pages` is every
 * page read, the homepage included. A listed returns page that states a period
 * makes the shop read even when its homepage refuses an automated browser:
 * the policy is on the policy page, and reading the page that holds it is not
 * working round the one that does not.
 */
export function candidateStatus(home, pages) {
  const readable = pages.filter((p) => !p.unreadable);
  if (readable.some((p) => p.sentences.length)) return 'read';
  if (!readable.length) return `unreadable: ${[...new Set(pages.map((p) => p.unreadable))].join('; ')}`;
  const policyPages = readable.filter((p) => p !== home);
  return policyPages.length ? 'no window found' : 'no returns link found';
}

/**
 * What a candidate's pages appear to say, for a person to check against the
 * quotes: every period named, most often first, and the clock starts named.
 * A SUMMARY, never a value for stores.ts — "30 days" beside "for Members" is
 * not the window a person gets, and only reading the sentence says so.
 */
export function proposal(sentencesFound) {
  const counts = new Map();
  for (const s of sentencesFound) for (const d of new Set(daysIn(s))) counts.set(d, (counts.get(d) ?? 0) + 1);
  const periods = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([days, times]) => ({ days, times }));
  const clocks = [...new Set(sentencesFound.map(clockIn).filter(Boolean))];
  return { periods, clocks };
}

/*
 * --- Reading a shop by hand: `npm run record:shop` ---------------------------
 *
 * Eight shops refuse an automated browser outright — Amazon, Argos, ASOS,
 * Boots, Currys, H&M, John Lewis and Zara — and they are the eight most people
 * buy from. Nothing in this repository works round a bot wall, so those eight
 * stay "not yet checked" until a person reads the page. These two functions
 * are what makes that a two-minute job rather than an afternoon of learning
 * the report format: the person pastes the page's address and its sentence,
 * and the evidence is written in the exact shape `test/verified.test.ts`
 * accepts — or refused, saying why, before anything is written.
 */

/** The same rule `test/verified.test.ts` holds a quote to. */
export const namesDays = (days) => new RegExp(`\\b${days}(?:[- ](?:calendar|working))?[- ]days?\\b`, 'i');

/**
 * The report section for one shop read by hand, or the reasons it is not
 * evidence. `own` is the shop's pages from retailer-sources.json.
 */
export function manualRecord({ row, url, quotes, own }) {
  const problems = [];
  let host = null;
  try {
    host = new URL(url).hostname;
  } catch {
    problems.push(`${url || '(nothing)'} is not a web address — paste the page's address from the browser`);
  }
  const sites = new Set((own ?? []).map((u) => siteOf(new URL(u).hostname)));
  if (!sites.size) {
    problems.push(`${row.name} has no returns page in store/retailer-sources.json — list its own page there first`);
  } else if (host && !sites.has(siteOf(host))) {
    problems.push(`${url} is not on ${row.name}’s own site (${[...sites].join(', ')}) — only the shop’s own page is evidence`);
  }
  const windows = row.onlineWindowDays ? [row.windowDays, row.onlineWindowDays] : [row.windowDays];
  const said = quotes.map((q) => q.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!said.length) {
    problems.push('no quote — paste the sentence from the page that states the window, word for word');
  } else {
    for (const days of windows) {
      if (said.some((q) => namesDays(days).test(q))) continue;
      const named = [...new Set(said.flatMap(daysIn))];
      problems.push(
        named.length
          ? `the table says ${days} days and the quote says ${named.join(', ')} — if the shop has changed its window, change stores.ts by hand from this quote first, then record it`
          : `no quote names ${days} days — paste the sentence that states the window, with its number`,
      );
    }
  }
  if (problems.length) return { ok: false, problems };
  const section = [
    `## ${row.name} — read by hand; table says ${windows.join(' / ')} days from ${row.clockStart}`,
    '',
    `- ${url}`,
    ...said.map((q) => `  - > ${q}`),
    '',
  ].join('\n');
  return { ok: true, section };
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** stores.ts with `name` dated `on` in CHECKED_ON — added, or its date moved. */
export function withCheckedOn(source, name, on) {
  const start = source.indexOf('export const CHECKED_ON');
  const end = source.indexOf('\n};', start);
  if (start === -1 || end === -1) throw new Error('CHECKED_ON was not found in stores.ts');
  const block = source.slice(start, end);
  // Written the way the table already writes them: Levi's in double quotes.
  const key = name.includes("'") ? `"${name}"` : `'${name}'`;
  const line = new RegExp(`^  (?:'${esc(name)}'|"${esc(name)}"|${esc(name)}): '\\d{4}-\\d{2}-\\d{2}',$`, 'm');
  const next = line.test(block) ? block.replace(line, `  ${key}: '${on}',`) : `${block}\n  ${key}: '${on}',`;
  return source.slice(0, start) + next + source.slice(end);
}

/** The names CHECKED_ON dates, read from stores.ts as text. */
export function checkedNames(source) {
  const start = source.indexOf('export const CHECKED_ON');
  const block = source.slice(start, source.indexOf('\n};', start));
  return [...block.matchAll(/^  (?:'([^']+)'|"([^"]+)"|([^\s'":]+)): '\d{4}-\d{2}-\d{2}',$/gm)].map((m) => m[1] ?? m[2] ?? m[3]);
}
