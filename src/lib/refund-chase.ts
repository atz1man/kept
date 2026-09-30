import { REFUND_CHASE_DAYS } from './alerts';
import { addDays, daysBetween, fmtDateLong, fromISODate } from './dates';
import { REPLY_DAYS } from './fault-letter';
import { COOLING_OFF_DAYS } from './legal';
import { money } from './money';
import type { Receipt } from './types';

/**
 * "Has the refund come through?" — and what to do when it has not.
 *
 * The app followed a return as far as the post box and then stopped. On the
 * fourteenth day it asked whether the money had come, and when it had not, it
 * said "chase it" and left the person to work out how, with nothing kept of
 * the one thing a chase rests on: proof the parcel went.
 *
 * Two halves. The proof-of-postage reference, which the person can add the
 * day it goes; and, once the refund is late, the letter.
 *
 * The letter names the law only where the law applies. The Consumer Contracts
 * Regulations 2013 (reg. 34) give a trader fourteen days to refund a CANCELLED
 * distance order, counted from getting the goods back or from the consumer's
 * evidence of sending them, whichever is earlier. That is a distance order
 * sent back within the cancellation period, and nothing else: a return under a
 * shop's own longer policy is a promise the shop made, not a regulation, and a
 * letter citing reg. 34 for it would be wrong. Every other chase is a plain
 * request with the dates in it.
 */

/** The longest reference kept. Royal Mail's are 13 characters, couriers' up to about 30. */
export const MAX_RETURN_REF = 40;

export type RefRead = { ok: true; ref: string | null } | { ok: false; error: string };

/**
 * A tracking or proof-of-postage reference, as typed. Spacing collapsed, case
 * kept — it is read back to a courier's website exactly as the receipt printed
 * it. Empty means none.
 */
export function readReturnRef(text: string): RefRead {
  const ref = text.trim().replace(/\s+/g, ' ');
  if (ref === '') return { ok: true, ref: null };
  if (ref.length > MAX_RETURN_REF) return { ok: false, error: 'Longer than any tracking number' };
  return { ok: true, ref };
}

export interface RefundChase {
  /** The day a refund is worth chasing from: fourteen days after it went. */
  due: Date;
  /** On or after `due`, and still no refund. */
  late: boolean;
  /**
   * Whether reg. 34 applies: a distance order sent back inside the
   * cancellation period. Counted from delivery where that is known, and from
   * the order where it is not — which can only make the period look SHORTER
   * than it was, so a return that falls inside it counted that way is inside
   * it for certain.
   */
  statutory: boolean;
}

/** Null unless it has gone back and the money has not come. */
export function refundChase(r: Receipt, today: Date): RefundChase | null {
  if (r.status !== 'sent' || !r.sentOn) return null;
  const sent = fromISODate(r.sentOn);
  const due = addDays(sent, REFUND_CHASE_DAYS);
  const handover = fromISODate(r.arrivedOn ?? r.purchasedOn);
  return {
    due,
    late: daysBetween(due, today) >= 0,
    statutory: r.distance && daysBetween(handover, sent) <= COOLING_OFF_DAYS,
  };
}

/** What the late panel says above the letter. */
export function refundChaseLine(c: RefundChase): string {
  return c.statutory
    ? `It went back inside the ${COOLING_OFF_DAYS}-day cancellation period, so the shop had ${REFUND_CHASE_DAYS} days to refund you — counted from getting it back, or from your proof of postage if that came first.`
    : 'Ask the shop to refund you, or to say why it has not.';
}

/** The letter, or null until the refund is late. */
export function refundLetter(r: Receipt, today: Date): string | null {
  const c = refundChase(r, today);
  if (!c || !c.late || !r.sentOn) return null;
  const bought = fmtDateLong(fromISODate(r.purchasedOn));
  const sent = fmtDateLong(fromISODate(r.sentOn));
  const arrived = r.arrivedOn && r.arrivedOn !== r.purchasedOn ? `, delivered on ${fmtDateLong(fromISODate(r.arrivedOn))}` : '';
  const proof = r.returnRef ? ` The tracking reference is ${r.returnRef}.` : '';

  const body = c.statutory
    ? [
        `On ${bought} I ordered “${r.item}” from you for ${money(r.amount)}${arrived}. I cancelled the order and sent it back to you on ${sent}.${proof}`,
        '',
        `Under the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013, regulation 34, you must refund a cancelled order within ${REFUND_CHASE_DAYS} days of the day you receive the goods back, or of the day I supply evidence of having sent them back, if that is earlier. The refund must include the standard delivery charge, if I paid one.`,
        '',
        'I have not received the refund. Please make it now.',
      ]
    : [
        `On ${bought} I bought “${r.item}” from you for ${money(r.amount)}${arrived}. I sent it back to you on ${sent}.${proof}`,
        '',
        'I have not received the refund. Please make it now, or tell me why it has not been made.',
      ];

  return [
    `Dear ${r.store},`,
    '',
    `Refund not received: ${r.item}`,
    '',
    ...body,
    '',
    `Please reply within ${REPLY_DAYS} days to confirm when the money will reach me.`,
    '',
    'Yours faithfully,',
  ].join('\n');
}
