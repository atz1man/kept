import type { Receipt } from './types';

/**
 * Finding a receipt once there are more than a screenful.
 *
 * The free tier caps at ten, so this is for the paid one, where the list is
 * unbounded and grouped by urgency rather than by shop — which is right for
 * "what must go back this week" and useless for "where did I put the
 * headphones".
 *
 * Deliberately plain: substring matching over what a person remembers —
 * the shop, the thing, what else was in the basket — and an exact price. No
 * fuzzy matching and no ranking — a search that returns near-misses in a list
 * about money and deadlines invites acting on the wrong row.
 */

/*
 * What people actually type, found by trying it on a forty-receipt library:
 * "sainsburys" for Sainsbury's, "toothbrush" for one line of a basket, and
 * "29.99" for the kettle that cost that. None was found.
 *
 * An apostrophe is dropped on both sides, nothing more: hyphens and
 * ampersands carry meaning ("M&S", "204-1234567") and dropping them would
 * turn a precise query into a loose one. A price is matched EXACTLY against
 * the receipt's own figures, never as a substring — "29.99" must not find a
 * £129.99 receipt, which is the near-miss this file refuses everywhere else.
 */
const normal = (s: string) => s.toLowerCase().replace(/['’‘`]/g, '');
const PRICE = /^£?(\d+)(?:\.(\d{1,2}))?$/;

/** The receipt's figures in pence: its total and each line it lists. */
function figures(receipt: Receipt): number[] {
  return [receipt.amount, ...(receipt.lines ?? []).map((l) => l.pence)];
}

function priceMatches(term: string, receipt: Receipt): boolean {
  const m = PRICE.exec(term);
  if (!m) return false;
  // "29" is a price only when written as one: a bare number is as likely
  // part of an order number, and is left to the text below.
  if (m[2] === undefined && !term.startsWith('£')) return false;
  const pence = Number(m[1]) * 100 + Number((m[2] ?? '0').padEnd(2, '0'));
  return figures(receipt).includes(pence);
}

/** Every whitespace-separated term must appear somewhere. */
export function matches(receipt: Receipt, query: string): boolean {
  const terms = normal(query.trim()).split(/\s+/).filter(Boolean);
  // Deleting this line changes no answer — `.every` on an empty list is
  // already true — and it survived being deleted for exactly that reason.
  // Kept as the sentence rather than the implication: an empty query matches
  // everything, which is a decision, not an accident of the array method
  // underneath it. No test pins it, because there is nothing to pin.
  if (terms.length === 0) return true;
  // The order number too: "which one was 204-1234567" is a question people
  // arrive with, from an email or a returns label, holding nothing else. And
  // a return's tracking number, which is what the courier's email quotes.
  // And each line of a basket: what was in it is as much the thing bought.
  const lines = (receipt.lines ?? []).map((l) => l.item).join(' ');
  const haystack = normal(`${receipt.store} ${receipt.item} ${lines} ${receipt.orderRef ?? ''} ${receipt.returnRef ?? ''}`);
  return terms.every((t) => haystack.includes(t) || priceMatches(t, receipt));
}

export function search(receipts: readonly Receipt[], query: string): Receipt[] {
  // Equivalent to falling through, for the same reason as above: with no
  // terms every receipt matches, so the filter returns the same list. This
  // one earns its place on cost rather than meaning — it is the common case
  // on a library the paid tier does not cap, and it skips a predicate call
  // per row to reach an answer already known.
  if (!query.trim()) return [...receipts];
  return receipts.filter((r) => matches(r, query));
}

/**
 * Below this the list fits on a screen or two and a search box is just
 * furniture in the way of the thing it would search.
 */
// A judgement, and no test pins the number: what is asserted in seed.test.ts
// is the relationship that matters — the demo library is short enough that a
// first launch is not cluttered with a box searching five rows. Six or seven
// both satisfy that, so neither is pinned.
export const SEARCH_APPEARS_ABOVE = 6;

export function shouldOfferSearch(receipts: readonly Receipt[]): boolean {
  return receipts.length > SEARCH_APPEARS_ABOVE;
}

/**
 * What the filter just did, for someone who cannot see the list change.
 *
 * Typing rewrote the list under the cursor and said nothing: a sighted person
 * watches thirty rows become three, and a screen-reader user hears the
 * keystroke and no more. WCAG 2.1 SC 4.1.3 asks that a result like this be
 * conveyed without moving focus — which is what a live region is for, and
 * axe cannot tell that one is missing.
 *
 * The empty case repeats the words already on the screen rather than
 * inventing its own, so the two are one message reaching two people.
 */
export function searchStatus(count: number, query: string): string {
  const q = query.trim();
  if (!q) return '';
  if (count === 0) return `Nothing matches ${q}`;
  return `${count} ${count === 1 ? 'receipt' : 'receipts'} match${count === 1 ? 'es' : ''} ${q}`;
}
