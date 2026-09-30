import { readAmount } from './draft';
import type { Receipt } from './types';

/**
 * One receipt, several things: splitting it so each can end its own way.
 *
 * A receipt holds one item and one amount, and a till receipt or an order
 * email is often a basket. The first item line was read and the total kept,
 * so returning one thing from three meant marking the whole receipt returned
 * — and with it went the guarantee reminder and the fault letter of the two
 * that stayed. The partial refund (`refunded`) records the money, but it
 * still settles the whole receipt.
 *
 * A split takes a named part and its price out of the receipt as a receipt of
 * its own: same shop, same dates, same order number, same way it was bought —
 * the part was on the same receipt, so every clock is the same clock — and
 * the original keeps the rest of the money. The part inherits nothing that
 * belonged to how the original was ending: no fault letter, no notice of
 * cancellation, no tracking number.
 */

/** As long as the backup allows an item name to be. */
export const MAX_PART_NAME = 200;

export type SplitRead =
  | { ok: true; item: string; pence: number }
  | { ok: false; error: string };

/** The part as typed: a name, and a price below the whole, so something is left. */
export function readSplit(r: Receipt, itemText: string, amountText: string): SplitRead {
  const item = itemText.trim().replace(/\s+/g, ' ');
  if (!item) return { ok: false, error: 'Say what the part is' };
  if (item.length > MAX_PART_NAME) return { ok: false, error: 'That name is too long' };
  const amount = readAmount(amountText);
  if (!amount.ok) return { ok: false, error: amount.error };
  if (amount.pence >= r.amount) return { ok: false, error: 'It has to be less than the whole receipt' };
  return { ok: true, item, pence: amount.pence };
}

/** The same rule on values already read: what the reducer holds a dispatched split to. */
export function validSplit(r: Receipt, item: string, pence: number): boolean {
  const name = item.trim();
  return name.length > 0 && name.length <= MAX_PART_NAME && Number.isInteger(pence) && pence > 0 && pence < r.amount;
}

/** Whether this receipt can be split: still with its owner, and worth more than a penny. */
export function canSplit(r: Receipt): boolean {
  return (r.status === 'active' || r.status === 'kept') && r.amount > 1;
}

export function splitReceipt(r: Receipt, item: string, pence: number, newId: string): { rest: Receipt; part: Receipt } {
  const {
    faultClaim: _f, returnRef: _t, sentOn: _s, returnedOn: _r, refunded: _p, credit: _c,
    ...shared
  } = r as Receipt & { cancelledOn?: string; exchanged?: true; swappedFrom?: string };
  const { cancelledOn: _n, exchanged: _x, swappedFrom: _w, ...clean } = shared as typeof shared & { cancelledOn?: string; exchanged?: true; swappedFrom?: string };
  return {
    rest: { ...r, amount: r.amount - pence },
    part: { ...(clean as Receipt), id: newId, item, amount: pence, splitFrom: r.id },
  };
}
