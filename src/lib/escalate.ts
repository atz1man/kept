import { money } from './money';
import type { Receipt } from './types';

/**
 * When the shop will not put it right: the two doors that do not go through
 * the shop.
 *
 * The refund chase and the fault letter both ended at the shop — and, once a
 * reply was overdue, at "Citizens Advice can tell you what to do next". The
 * two routes that most often get the money back are the card's, and nothing
 * said so:
 *
 * - Section 75 of the Consumer Credit Act 1974. Paid, even in part, by CREDIT
 *   card, for a single item with a cash price over £100 and not over £30,000,
 *   and the card company is equally liable with the shop for a breach of
 *   contract. That is law, and so it is only named where the price fits.
 * - Chargeback. Not law: the card schemes' own rules, which a bank uses to
 *   reverse a payment, for debit cards too. Banks set their own time limits,
 *   and the line says so rather than naming one.
 *
 * kept does not know how anything was paid for, and does not ask: both are
 * set out, each with its condition, for the person to recognise their own.
 */

/** Consumer Credit Act 1974, s.75(3)(b): the cash price must be over £100 and not over £30,000. Parliament's numbers. */
export const S75_MIN_PENCE = 100_00;
export const S75_MAX_PENCE = 30_000_00;

export function s75Fits(r: Receipt): boolean {
  return r.amount > S75_MIN_PENCE && r.amount <= S75_MAX_PENCE;
}

export interface Escalation {
  /** One line per door, each saying when it applies. */
  lines: string[];
}

export function escalation(r: Receipt): Escalation {
  return {
    lines: [
      ...(s75Fits(r)
        ? [
            `Paid by credit card? At ${money(r.amount)}, Section 75 of the Consumer Credit Act makes the card company equally responsible with the shop — for a single item costing over £100 — so you can claim from them instead.`,
          ]
        : []),
      'Paid by debit card, or credit card below that? Ask your bank for a chargeback. It is the card scheme’s rule rather than the law, and banks set time limits, so ask soon.',
    ],
  };
}
