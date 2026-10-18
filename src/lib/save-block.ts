/**
 * What stops the Add card saving, and what its button says instead.
 *
 * Lifted out of `Add.tsx` because each branch is a promise about a receipt
 * and the component is the one place none of them could be exercised. Two
 * were missing, both found by walking the screen as a first-time user:
 *
 * - WHERE IT WAS BOUGHT. A receipt typed in by hand started as "Online or
 *   phone", so leaving the question alone saved a bike bought over a counter
 *   in Leeds with "14-day cooling-off — you can cancel for any reason" and a
 *   cancellation letter to send. A paste is an order email and a scan is a
 *   till receipt, so those two start answered; a blank card has no evidence
 *   either way and now asks (`distance: null`) rather than assuming the one
 *   answer that claims a legal right.
 * - THE SHOP, on a paste. Only the typed-in card required it, so a paste from
 *   a shop the app does not know saved as "Unknown store" and every letter
 *   it wrote opened "Dear Unknown store,".
 *
 * And a purchase date in the future greyed the button out while it still
 * read "Save receipt" — the one refusal with no word for itself.
 */
export type SaveBlock = 'quota' | 'arrival' | 'bought' | 'store' | 'how' | 'total' | 'window';

export function saveBlock(s: {
  quotaFull: boolean;
  arrivalError?: string;
  boughtError?: string;
  distance: boolean | null;
  needsStore: boolean;
  needsTotal: boolean;
  windowError?: string;
}): SaveBlock | null {
  if (s.quotaFull) return 'quota';
  if (s.arrivalError) return 'arrival';
  if (s.boughtError) return 'bought';
  if (s.needsStore) return 'store';
  if (s.distance === null) return 'how';
  if (s.needsTotal) return 'total';
  if (s.windowError) return 'window';
  return null;
}

export const SAVE_LABEL: Record<SaveBlock | 'none', string> = {
  quota: 'Unlock unlimited to save this',
  arrival: 'Fix the arrival date',
  bought: 'Fix the purchase date',
  how: 'Say where you bought it',
  store: 'Add the shop to save',
  total: 'Add the total to save',
  window: 'Fix the return window',
  none: 'Save receipt',
};
