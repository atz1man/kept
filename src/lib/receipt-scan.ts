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

/** 29.09.26 and 29-09-2026 as the parser reads them, day first: 29/09/26. */
function slashDates(line: string): string {
  return line.replace(/\b(\d{1,2})[.-](\d{1,2})[.-](\d{2}|\d{4})\b/g, (whole, d: string, m: string, y: string) => {
    const dd = Number(d);
    const mm = Number(m);
    return dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 ? `${d}/${m}/${y}` : whole;
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

/** Add the £ a till receipt leaves off: to a figure ending a line, or beside a money word. */
function poundSigns(line: string): string {
  if (/£/.test(line)) return line;
  const end = /(^|\s)(-?\d{1,5}\.\d{2})\s*$/;
  if (end.test(line)) return line.replace(end, (_, sp: string, n: string) => `${sp}£${n}`);
  if (MONEY_WORD.test(line)) return line.replace(/(^|\s)(\d{1,5}\.\d{2})\b/, (_, sp: string, n: string) => `${sp}£${n}`);
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
    .map((l) => poundSigns(slashDates(fixMoneyTokens(l))).replace(DUE, 'Total $1'));
  return [...(shop ? [`Receipt from ${shop}`] : []), ...body].join('\n');
}
