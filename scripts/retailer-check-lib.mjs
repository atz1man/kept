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
  const re = /name: '([^']+)'[^\n]*?windowDays: (\d+), clockStart: '(\w+)'/g;
  let m;
  while ((m = re.exec(storesSource))) rows.push({ name: m[1], windowDays: Number(m[2]), clockStart: m[3] });
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
  if (all.includes(tableDays)) return 'mentioned';
  return 'differs';
}
