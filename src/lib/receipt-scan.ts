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

/** OCR text of a till receipt, as text the paste parser reads. */
export function fromScan(ocr: string): string {
  const lines = ocr
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim());
  const shop = shopHeading(lines);
  const body = lines
    .filter((l) => l.length > 0)
    .map((l) => poundSigns(fixMoneyTokens(l)).replace(DUE, 'Total $1'));
  return [...(shop ? [`Receipt from ${shop}`] : []), ...body].join('\n');
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
export async function readBestOf(read: (how: Thresholding) => Promise<string>, today: Date): Promise<string> {
  const first = await read('global');
  const firstFound = fieldsFound(first, today);
  if (firstFound === 3) return first;
  const second = await read('local');
  return fieldsFound(second, today) > firstFound ? second : first;
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
