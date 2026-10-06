import type { ParsedReceipt } from './parse';
import type { Misread, UnsureWord } from './receipt-scan';

/**
 * Which of the figures a read found should be checked before saving, and why.
 *
 * The Add card presented every figure the same way: a total read off a
 * "TOTAL" line on a crisp email and a total that was merely the largest
 * number on a blurred photo sat in the same row, in the same weight, with the
 * same nothing beside them. The person had no way to tell which to look at,
 * so in practice they looked at neither.
 *
 * Each rule here was chosen from a measurement, not by eye: 132 photos of
 * twelve till slips (72 as a hand takes them, 60 under shadow, blur and fading
 * — scripts/scan-bench/confidence.ts, which calls this module) and the
 * order-email corpus. On the damaged photos 9 totals came out wrong; these
 * rules mark all 9, and mark 9 of the 51 right ones. On the photos as a hand
 * takes them they mark nothing — none of 72 right totals, none of 68 right
 * dates — and on the email corpus nothing.
 *
 * Two ideas were measured and dropped, and are recorded so nobody adds them
 * back on intuition. A figure printed twice — the TOTAL line and the card
 * line — is NOT a second opinion: a blur that misreads one misreads both
 * alike, and three of the wrong totals appeared twice. And the reader's
 * score alone, without the parser's own doubt, misses the totals that were
 * read cleanly off the wrong line.
 */
export type CheckWhy =
  | 'largest-figure'
  | 'named-total'
  | 'unclear-print'
  | 'several-dates'
  | 'several-totals'
  | 'part-total'
  | 'notice-date'
  | 'month-first'
  | 'several-shops'
  | 'shop-in-passing'
  | 'misread-print';

/*
 * The shop is marked too. It never was, and of the audit's 65 order emails
 * and till slips, 13 named the wrong one — the maker of the thing bought, a
 * marketplace seller, a sister brand in the footer — every one stated as
 * plainly as a shop read off the email's own heading. The shop decides the
 * window and the policy wording quoted at the counter, so a guess at it is
 * the guess that most needs saying.
 */
export interface Checks {
  amount?: CheckWhy;
  purchasedOn?: CheckWhy;
  store?: CheckWhy;
}

/** A total read off words the reader scored under this is marked. 85: every wrong total in the bench, at 9 of 51 right ones. */
export const TOTAL_UNSURE_BELOW = 85;
/** A date read off words scored under this is marked. Higher marked right dates on clear photos for no wrong one caught. */
export const DATE_UNSURE_BELOW = 60;

const digits = (s: string) => s.replace(/\D/g, '');

/**
 * Whether a word the reader was unsure of, under `below`, carries this run of
 * digits — and, where `onLine` is given, was read on a line it matches.
 */
function readOffUnsure(unsure: readonly UnsureWord[], run: string, below: number, onLine?: RegExp): boolean {
  return run.length >= 3 && unsure.some((w) => w.confidence < below && digits(w.text).includes(run) && (!onLine || w.line === undefined || onLine.test(w.line)));
}

/*
 * The line a total is read off, as a camera reads it: "TOTAL", "BALANCE DUE",
 * or what is left of them through a blur ("TOT", "ANCE DUE"). A till prints
 * the paid figure on the item line and the card line too, and the reader can
 * doubt one copy and not another — a crisp receipt's "VISA 199.99" scored
 * low marked a total read cleanly off its own line, which is the false alarm
 * that found this rule.
 */
const TOTAL_LINE = /tot|due|bal/i;

/*
 * A figure the camera printed with a letter in it — "E2.65", "O3/1O/2O26",
 * "B00TS" — that was read as the £, the 0 or the O it most likely was
 * (`readScan`). The correction is a reading, not the slip's print, so it is
 * marked unless the slip's own arithmetic proved it. An "E" is never proved:
 * the arithmetic settles the figure, not whether the sign was a £ or a €.
 */
function misreadAs(misread: readonly Misread[], field: Misread['field'], matches: (m: Misread) => boolean): boolean {
  return misread.some((m) => !m.proved && m.field === field && matches(m));
}

/** "3/10/2026" → "0310": the day and the month, as `readOffUnsure` compares them. */
function dayMonth(date: string): string {
  const [d = '', m = ''] = date.split(/[/.-]/);
  return `${d.padStart(2, '0')}${m.padStart(2, '0')}`;
}

export function toCheck(p: ParsedReceipt, unsure: readonly UnsureWord[] = [], misread: readonly Misread[] = []): Checks {
  const out: Checks = {};
  if (p.amount !== null) {
    // The lines adding up to the figure exactly is a second reading of it
    // that a blur does not reproduce: each line is a different number.
    const addsUp = p.lines.length > 0 && p.lines.reduce((sum, l) => sum + l.pence, 0) === p.amount;
    if (!addsUp) {
      if (p.how.amount === 'largest') out.amount = 'largest-figure';
      else if (p.how.amount === 'named') out.amount = 'named-total';
      else if (p.how.amount === 'several') out.amount = 'several-totals';
      else if (p.how.amount === 'part') out.amount = 'part-total';
      else if (readOffUnsure(unsure, digits((p.amount / 100).toFixed(2)), TOTAL_UNSURE_BELOW, TOTAL_LINE)) out.amount = 'unclear-print';
    }
    // Outside the lines' agreement: they settle the figure, not the currency.
    const figure = digits((p.amount / 100).toFixed(2));
    if (out.amount === undefined && misreadAs(misread, 'amount', (m) => digits(m.as) === figure && (m.line === undefined || TOTAL_LINE.test(m.line)))) {
      out.amount = 'misread-print';
    }
  }
  if (p.dateFound) {
    const [, month, day] = p.purchasedOn.split('-');
    if (p.how.purchasedOn === 'latest') out.purchasedOn = 'several-dates';
    else if (p.how.purchasedOn === 'other') out.purchasedOn = 'notice-date';
    else if (p.how.purchasedOn === 'month-first') out.purchasedOn = 'month-first';
    else if (misreadAs(misread, 'purchasedOn', (m) => dayMonth(m.as) === `${day}${month}`)) out.purchasedOn = 'misread-print';
    else if (readOffUnsure(unsure, `${day}${month}`, DATE_UNSURE_BELOW)) out.purchasedOn = 'unclear-print';
  }
  if (p.store !== null) {
    if (p.how.store === 'several') out.store = 'several-shops';
    else if (p.how.store === 'mention') out.store = 'shop-in-passing';
    else if (misreadAs(misread, 'store', (m) => m.as === p.store)) out.store = 'misread-print';
  }
  return out;
}

/** What the card says beside a marked figure. */
export function checkWords(field: keyof Checks, why: CheckWhy): string {
  switch (why) {
    case 'largest-figure':
      return 'No total line was found, so this is the largest figure on it.';
    case 'named-total':
      return 'The only “total” on it follows a product name — it may be part of one.';
    case 'several-dates':
      return 'It has several dates and none says “order date”, so this is the latest.';
    case 'unclear-print':
      return field === 'amount' ? 'The print was unclear where this was read.' : 'The print was unclear where this date was read.';
    case 'several-totals':
      return 'It has more than one total and they disagree, so this is the last one.';
    case 'part-total':
      return 'This total is of the items alone — it may leave out delivery.';
    case 'notice-date':
      return 'Nothing on it says “order date”, and it reads as a dispatch or delivery notice — this may be when it was sent or arrived.';
    case 'month-first':
      return 'Written in figures that also read month first — check the day and the month.';
    case 'several-shops':
      return 'It names more than one shop, so this is the likeliest.';
    case 'shop-in-passing':
      return 'The shop is only named in passing, not as who the email is from.';
    case 'misread-print':
      if (field === 'store') return 'The camera read figures in the shop’s name, so this is the shop it spells with them read as letters.';
      if (field === 'purchasedOn') return 'The camera read letters among this date’s figures, so it was read with them as figures.';
      return 'The camera read a letter where the £ sign would be, so this figure is taken to be in pounds.';
  }
}

/** How many figures are marked, for the line at the top of the card. */
export function checkCount(c: Checks): number {
  return Number(c.amount !== undefined) + Number(c.purchasedOn !== undefined) + Number(c.store !== undefined);
}
