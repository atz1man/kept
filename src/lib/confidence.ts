import type { ParsedReceipt } from './parse';
import type { UnsureWord } from './receipt-scan';

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
  | 'part-total';

export interface Checks {
  amount?: CheckWhy;
  purchasedOn?: CheckWhy;
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

export function toCheck(p: ParsedReceipt, unsure: readonly UnsureWord[] = []): Checks {
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
  }
  if (p.dateFound) {
    const [, month, day] = p.purchasedOn.split('-');
    if (p.how.purchasedOn === 'latest') out.purchasedOn = 'several-dates';
    else if (readOffUnsure(unsure, `${day}${month}`, DATE_UNSURE_BELOW)) out.purchasedOn = 'unclear-print';
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
  }
}

/** How many figures are marked, for the line at the top of the card. */
export function checkCount(c: Checks): number {
  return Number(c.amount !== undefined) + Number(c.purchasedOn !== undefined);
}
