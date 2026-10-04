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
 * — scripts/scan-bench/confidence.ts) and the order-email corpus. On the
 * damaged photos 9 totals came out wrong; these rules mark all 9, and mark 13
 * of the 51 right ones. On the photos as a hand takes them they mark 2 of 72
 * right totals and none of 68 right dates, and on the email corpus nothing.
 *
 * Two ideas were measured and dropped, and are recorded so nobody adds them
 * back on intuition. A figure printed twice — the TOTAL line and the card
 * line — is NOT a second opinion: a blur that misreads one misreads both
 * alike, and three of the wrong totals appeared twice. And the reader's
 * score alone, without the parser's own doubt, misses the totals that were
 * read cleanly off the wrong line.
 */
export type CheckWhy = 'largest-figure' | 'named-total' | 'unclear-print' | 'several-dates';

export interface Checks {
  amount?: CheckWhy;
  purchasedOn?: CheckWhy;
}

/** A total read off words the reader scored under this is marked. 85: every wrong total in the bench, at 13 of 51 right ones. */
export const TOTAL_UNSURE_BELOW = 85;
/** A date read off words scored under this is marked. Higher marked right dates on clear photos for no wrong one caught. */
export const DATE_UNSURE_BELOW = 60;

const digits = (s: string) => s.replace(/\D/g, '');

/** Whether any word the reader was unsure of, under `below`, carries this run of digits. */
function readOffUnsure(unsure: readonly UnsureWord[], run: string, below: number): boolean {
  return run.length >= 3 && unsure.some((w) => w.confidence < below && digits(w.text).includes(run));
}

export function toCheck(p: ParsedReceipt, unsure: readonly UnsureWord[] = []): Checks {
  const out: Checks = {};
  if (p.amount !== null) {
    // The lines adding up to the figure exactly is a second reading of it
    // that a blur does not reproduce: each line is a different number.
    const addsUp = p.lines.length > 0 && p.lines.reduce((sum, l) => sum + l.pence, 0) === p.amount;
    if (!addsUp) {
      if (p.how.amount === 'largest') out.amount = 'largest-figure';
      else if (p.how.amount === 'named') out.amount = 'named-total';
      else if (readOffUnsure(unsure, digits((p.amount / 100).toFixed(2)), TOTAL_UNSURE_BELOW)) out.amount = 'unclear-print';
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
  }
}

/** How many figures are marked, for the line at the top of the card. */
export function checkCount(c: Checks): number {
  return Number(c.amount !== undefined) + Number(c.purchasedOn !== undefined);
}
