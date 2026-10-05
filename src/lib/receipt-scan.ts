import { pdfLines } from './documents';
import { parseReceiptText } from './parse';
import { ALIASES_BY_LENGTH } from './stores';

/**
 * A till receipt, read by the camera, made readable by the paste parser.
 *
 * The parser was written for order emails, and a photographed till receipt
 * breaks nearly every assumption it makes: the total has no £ ("TOTAL 12.99"),
 * the shop is a heading in capitals with no "your order" beside it, dates are
 * written 29.09.26, and the OCR itself confuses O with 0 and a comma with a
 * point. Rather than teach the parser a second language, this translates —
 * one pure function, tested on text shaped like what the camera actually
 * returns — and the parser reads the result as it reads everything else.
 *
 * What it will not do is guess. A heading is taken as the shop only when it IS
 * a shop kept knows, word for word; an amount gains a £ only when it sits at
 * the end of a line or beside a money word; nothing is invented to fill a gap.
 */

/** Characters OCR puts where a digit was, and the digit it was. */
const LOOKALIKE: Record<string, string> = { O: '0', o: '0', D: '0', I: '1', l: '1', '|': '1', S: '5', B: '8' };

/**
 * Fix a money token the OCR half-read: "1O.99" → "10.99", "12,50" → "12.50".
 * Only a token shaped like pounds-and-pence with at least one real digit, so a
 * word is never turned into a number.
 */
function fixMoneyTokens(line: string): string {
  return line.replace(/(?<![\w.])([\dOoDIl|SB]{1,5})[.,]([\dOoDIl|SB]{2})(?![\w.]|[.,]\d)/g, (whole, a: string, b: string) => {
    if (!/\d/.test(a + b)) return whole;
    const fix = (s: string) => s.replace(/[OoDIl|SB]/g, (c) => LOOKALIKE[c]);
    return `${fix(a)}.${fix(b)}`;
  });
}

/*
 * A line whose money is the bill rather than a thing on it. Till receipts say
 * BALANCE DUE or AMOUNT DUE where an email says Total; the parser looks for
 * "total", so these are named as one.
 */
const DUE = /\b(balance\s+due|amount\s+due|total\s+due|to\s+pay)\b/i;

/** A money word that marks the figure on its line as money. */
const MONEY_WORD = /\b(total|sub\s?total|balance|due|to\s+pay|cash|change|card|visa|mastercard|amex|contactless|vat|paid)\b/i;

/*
 * A till's figure: 7.45, or 1,448.00 with its thousands grouped. The grouped
 * form had no £ added, so on a £1,448 receipt for a television and its care
 * plan the TOTAL line was not money at all and the care plan's £149.00 was
 * read as the price — on exactly the purchases where a return matters most.
 */
const TILL_FIGURE = '(?:\\d{1,3}(?:,\\d{3})+|\\d{1,5})\\.\\d{2}';

/** Add the £ a till receipt leaves off: to a figure ending a line, or beside a money word. */
function poundSigns(line: string): string {
  if (/£/.test(line)) return line;
  const end = new RegExp(`(^|\\s)(-?${TILL_FIGURE})\\s*$`);
  if (end.test(line)) return line.replace(end, (_, sp: string, n: string) => `${sp}£${n}`);
  if (MONEY_WORD.test(line)) return line.replace(new RegExp(`(^|\\s)(${TILL_FIGURE})\\b`), (_, sp: string, n: string) => `${sp}£${n}`);
  return line;
}

/*
 * A £ the camera read as a letter: "E2.65", "TOTAL f5.45". Thermal print's £
 * is a looped stroke that OCR returns as an E or an f, and the figure after it
 * was then not money at all — a slip whose every price read "E" had no total.
 *
 * Read as a £ only where a £ would be: the letter alone before a till figure,
 * nothing else attached, and that figure placed where `poundSigns` would have
 * given a bare one its £ — ending the line, or beside a money word. So a bulb's
 * "E10" or "E27" is never touched (no pence), and nor is a letter inside a
 * word. An "E" is never taken for a £ on a slip that names euros anywhere,
 * because a € reads as an E at least as readily as a £ does; and even where it
 * names none, an E-read total is marked (see `toCheck`).
 */
const POUND_AS_LETTER = new RegExp(`(^|\\s)([Ef])(-?${TILL_FIGURE})(?=\\s|$)`, 'g');
const EUROS = /€|\bEUR\b|\beuros?\b/i;

/** A line's £ read as a letter, given back as a £ — and each one noted. */
function poundAsLetter(line: string, euros: boolean, noted: { read: string; as: string; letter: string }[]): string {
  const moneyWord = MONEY_WORD.test(line);
  return line.replace(POUND_AS_LETTER, (whole, sp: string, letter: string, n: string, at: number) => {
    if (letter === 'E' && euros) return whole;
    if (!moneyWord && line.slice(at + whole.length).trim() !== '') return whole;
    noted.push({ read: `${letter}${n}`, as: n, letter });
    return `${sp}£${n}`;
  });
}

/*
 * An O for a 0 in a date: "O3/1O/2O26". The parser reads dates in figures, so
 * the slip's one date was not found at all. Read as 0s only inside something
 * that is otherwise a date — day, month and year, all figures or O, the same
 * separator twice, standing apart from any other word — and only when the
 * day and month it makes are a real day and month, the way the date reads
 * here. "1O/2O/2O26" is not a date with O in it, it is something else.
 */
const DATE_WITH_O = /(?<![\w/.:-])([\dOo]{1,2})([/.-])([\dOo]{1,2})\2([\dOo]{4}|[\dOo]{2})(?![\w/.:-])/g;

function dateWithO(line: string, noted: { read: string; as: string }[]): string {
  return line.replace(DATE_WITH_O, (whole, d: string, _sep: string, m: string) => {
    if (!/[Oo]/.test(whole)) return whole;
    const zero = (s: string) => Number(s.replace(/[Oo]/g, '0'));
    if (zero(d) < 1 || zero(d) > 31 || zero(m) < 1 || zero(m) > 12) return whole;
    const as = whole.replace(/[Oo]/g, '0');
    noted.push({ read: whole, as });
    return as;
  });
}

/*
 * The slip's own arithmetic: what its items come to, less its discounts. A
 * till prints each thing on a line ending in its price, and money off on one
 * ending in a minus figure ("STAFF DISC -0.50", "PROMO 20.00-"); a line with a
 * money word on it (the total, the card, the change, the VAT) is not a thing
 * bought, and a line with a date on it ends in the time. When these add up to
 * a total the camera half-read, the total is proved — by a dozen other numbers
 * that would all have had to be misread to agree with it.
 *
 * Anything this does not understand makes the sum wrong, never right by
 * accident: an item with no price, a saving printed without its minus. A
 * wrong sum proves nothing, and the correction stays marked.
 */
const LINE_PRICE = new RegExp(`(?:^|\\s)(-?)£?(-?)(${TILL_FIGURE})(-?)$`);
const DATED = /\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/;

function itemsLessDiscounts(lines: readonly string[]): number | null {
  let sum = 0;
  let items = 0;
  for (const line of lines) {
    if (MONEY_WORD.test(line) || DATED.test(line)) continue;
    const m = LINE_PRICE.exec(line);
    if (!m) continue;
    const pence = Number(m[3].replace(/[,.]/g, ''));
    sum += m[1] || m[2] || m[4] ? -pence : pence;
    items += 1;
  }
  return items > 0 ? sum : null;
}

/** "1,448.00" → 144800. */
const penceOf = (figure: string) => Number(figure.replace(/[-,.]/g, ''));

/**
 * The shop, when a heading names one kept knows. A receipt prints the shop at
 * the top and nowhere else, with none of the "your order" or ".co.uk" that
 * lets the parser tell "Boots" the shop from walking boots. A heading in the
 * first few lines that IS a shop's name — the whole of it, or its first words —
 * is the shop, and saying "Receipt from" gives the parser the cue it needs.
 */
function shopHeading(lines: string[]): string | null {
  const top = lines.filter((l) => l.trim()).slice(0, 4);
  for (const line of top) {
    const words = line.toLowerCase().replace(/[^a-z0-9&'’ ]/g, ' ').replace(/\s+/g, ' ').trim();
    for (const { alias, store } of ALIASES_BY_LENGTH) {
      if (words === alias || words.startsWith(`${alias} `)) return store.name;
    }
  }
  return null;
}

/**
 * Something the camera printed that was read as something else: a letter
 * where a £ sign, a 0 or an O was. The text the parser reads carries the
 * correction; this travels beside it, so the Add card can say which figure
 * was corrected rather than present the correction as the slip's own print
 * (see `misread-print` in lib/confidence.ts).
 */
export interface Misread {
  field: 'amount' | 'purchasedOn' | 'store';
  /** What the camera printed, e.g. "f5.45". */
  read: string;
  /** What it was taken for, e.g. "5.45". */
  as: string;
  /**
   * The slip's own arithmetic agrees with it — its items, less its discounts,
   * come to exactly this figure — so there is nothing left to check.
   */
  proved: boolean;
  /**
   * The line it was read on, as corrected. A till prints the paid figure on
   * the item line and the card line too; a misread item is no doubt about a
   * total printed cleanly on its own line.
   */
  line?: string;
}

/** A camera's read of a till receipt: the text the paste parser reads, and what was corrected on the way. */
export interface ScanText {
  text: string;
  misread: Misread[];
}

/**
 * OCR text of a till receipt, as text the paste parser reads — with the
 * corrections that took a letter for something it was not.
 *
 * Only camera text comes through here. An email, a saved page or an .eml file
 * goes to the parser as it is, because there "E1" and "f5" are real text: a
 * voucher code, a key to press.
 */
export function readScan(ocr: string): ScanText {
  const lines = ocr
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim());
  const misread: Misread[] = [];
  const shop = shopHeading(lines);
  const euros = EUROS.test(ocr);
  const pounds: { line: number; read: string; as: string; letter: string }[] = [];
  const dates: { read: string; as: string }[] = [];
  const body = lines
    .filter((l) => l.length > 0)
    .map((l, i) => {
      const noted: { read: string; as: string; letter: string }[] = [];
      const line = poundSigns(poundAsLetter(fixMoneyTokens(dateWithO(l, dates)), euros, noted)).replace(DUE, 'Total $1');
      for (const n of noted) pounds.push({ ...n, line: i });
      return line;
    });
  // Nothing on a slip adds up to a date, so a corrected one is always marked.
  for (const d of dates) misread.push({ field: 'purchasedOn', read: d.read, as: d.as, proved: false });
  const sum = itemsLessDiscounts(body);
  for (const p of pounds) {
    const line = body[p.line];
    // Only a total's own figure can be proved by the items: an item's is one of them.
    const proved = p.letter === 'f' && MONEY_WORD.test(line) && sum === penceOf(p.as);
    misread.push({ field: 'amount', read: p.read, as: p.as, proved, line });
  }
  return { text: [...(shop ? [`Receipt from ${shop}`] : []), ...body].join('\n'), misread };
}

/** OCR text of a till receipt, as text the paste parser reads. */
export function fromScan(ocr: string): string {
  return readScan(ocr).text;
}

/**
 * How the photo is turned into black text on white before it is read.
 *
 * `global` picks one brightness for the whole photo (tesseract's default,
 * Otsu). `local` picks one per neighbourhood (Sauvola). Measured on three till
 * receipts under six kinds of damage — 33 photos, 99 fields: `global` read
 * NOTHING from any photo with a shadow across it (0 of 36 fields), because a
 * single threshold puts the whole shaded half below it, and a phone held over
 * a receipt casts exactly that shadow. `local` read the shadows, but alone it
 * got four fields confidently wrong where `global` got none, on faint thermal
 * print. Neither is the answer on its own, so both are used, in that order.
 */
export type Thresholding = 'global' | 'local';

/** How many of the three things a receipt is read for this text yields: shop, total, date. */
export function fieldsFound(ocr: string, today: Date): number {
  const out = parseReceiptText(fromScan(ocr), today);
  if (!out.ok) return 0;
  return [out.value.store !== null, out.value.amount !== null, out.value.dateFound].filter(Boolean).length;
}

/**
 * The better of up to two reads of one photo.
 *
 * `global` first, and it is kept when it found the shop, the total and the
 * date, so a well-lit receipt is read once, exactly as before. Otherwise the
 * photo is read again with `local`, which is kept only when it found MORE: on
 * a tie the first read stands, because `local` is the one that was measured
 * being confidently wrong. Over the same 33 photos this reads 95 of 99 fields
 * against 63, with a second read on 12 of them. One field of those 95 was
 * wrong, £349.04 for £349.00, on the photo with shadow, tilt and blur at
 * once, where the single read had found nothing, which is why nothing is saved
 * before the person has checked what was read.
 */
export async function readBestOf(read: Reader, today: Date): Promise<Reading> {
  const first = await read('global');
  const firstFound = fieldsFound(first.text, today);
  if (firstFound === 3) return first;
  const second = await read('local');
  return fieldsFound(second.text, today) > firstFound ? second : first;
}

/**
 * What one read of a picture produced: the text, and every word the reader
 * scored under `UNSURE_BELOW`, with its score. Those travel with the text so
 * the Add card can mark a figure read off them for checking (see
 * lib/confidence.ts) — the reader knew it was guessing, and the card used to
 * present its guess exactly as it presented a clear print.
 */
export interface Reading {
  text: string;
  unsure: readonly UnsureWord[];
}

export interface UnsureWord {
  text: string;
  /** The reader's own score, 0–100. */
  confidence: number;
  /**
   * The line the word was read on, as the reader read it. A till prints the
   * paid figure three times — the item, the TOTAL, the card — and a doubt
   * about the card line's copy is no doubt about the total.
   */
  line?: string;
}

/** Words scored at or above this are not carried: no rule in lib/confidence.ts looks that high. */
export const UNSURE_BELOW = 90;

/** One way of reading one picture — global or local thresholding — as `readBestOf` asks for it. */
export type Reader = (how: Thresholding) => Promise<Reading>;

/**
 * The receipt laid flat, read first; the photo as it was taken, read too only
 * where that missed the shop, the total or the date — and kept only where it
 * found MORE.
 *
 * Finding the paper (`lib/flatten.ts`) is a judgement about light, and light
 * can mislead it. A shadow across the slip makes the shaded half as dark as
 * the table: the "paper" found was the lit half alone, and laying THAT flat
 * cropped the total away — a receipt the old reader got right came back with
 * no total (the smoke sweep's shadowed Boots slip). So flattening is a first
 * attempt, never the only one: the photo as taken is still read when the
 * flattened read falls short, and the old reading is what came before, so
 * this can only ever find more than it did. On a tie the flattened read
 * stands, since it was the one with the receipt straight.
 */
export async function readFlattenedOrAsTaken(flat: Reader | null, asTaken: Reader, today: Date): Promise<Reading> {
  if (!flat) return readBestOf(asTaken, today);
  const first = await readBestOf(flat, today);
  const firstFound = fieldsFound(first.text, today);
  if (firstFound === 3) return first;
  const second = await readBestOf(asTaken, today);
  return fieldsFound(second.text, today) > firstFound ? second : first;
}

/**
 * Why a scan that never produced any text failed, as far as the app can tell.
 *
 * The one message there was blamed the photo ("flat, straight and in good
 * light"). Measured in a browser: a scan made offline can fail, and not
 * because of the photo. The worker fetches its engine from this site when a
 * scan starts, and in a browser that does not route a dedicated worker's
 * requests through the service worker, nothing is kept for later. Someone
 * offline was told to take the same picture again, and it could never have
 * worked. The iPhone app has the reader inside it, so there, offline is never
 * the reason.
 */
export function scanFailure(readerReachable: boolean, native: boolean): 'offline' | 'unreadable' {
  return !native && !readerReachable ? 'offline' : 'unreadable';
}

/** One line Vision read on the iPhone, and where: fractions of the page, y up from the bottom. */
export interface VisionLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A page the iPhone's document camera took: its size in points and the lines read off it. */
export interface VisionPage {
  width: number;
  height: number;
  lines: VisionLine[];
}

/**
 * The document camera's pages as the text a till receipt would be pasted as.
 *
 * Vision reads a slip's labels and its figures as separate pieces — "TOTAL"
 * on the left, "19.99" thirty characters to the right — and in no promised
 * order. They are put back on the lines they share by the rule a PDF's runs
 * are (`pdfLines`), once the fractions are scaled back to the page's own
 * proportions. That rule tells a space between words from a break inside one
 * by comparing a horizontal gap with the text's height; on a slip three times
 * taller than wide, a fraction of the width is a third of the distance the
 * same fraction of the height is, and left unscaled a hairline between two
 * halves of one word reads as a space.
 */
export function fromVision(pages: readonly VisionPage[]): string {
  return pdfLines(
    pages.map((p) =>
      p.lines.map((l) => ({ str: l.text, x: l.x * p.width, y: l.y * p.height, width: l.width * p.width, height: l.height * p.height })),
    ),
  );
}
