import { describe, expect, it } from 'vitest';
import { toCheck } from '../src/lib/confidence';
import { bestReading, emailAsText, htmlToText, readEmail } from '../src/lib/documents';
import { parseReceiptText } from '../src/lib/parse';
import { fromScan } from '../src/lib/receipt-scan';
import { CASES, type Case } from './fixtures/parse-audit';

/**
 * The audit's sixty-five cases, held to the rule the Add card depends on: a
 * figure is either right, or the card says to check it, or it is left for the
 * person to fill in. Never wrong and stated as plainly as a right one.
 *
 * Measured on main before this file existed: 17 cases read wholly right, 16
 * with a figure missed or marked, and 32 with a figure WRONG AND UNMARKED —
 * the first of several totals taken, a maker on an item line taken for the
 * shop, the footer's "your next order" taken for Next, a dispatch notice's
 * only date stated as the day of purchase, an estimated delivery prefilled as
 * the day it came, £54<sup>98</sup> read as £5,498.
 *
 * Each field is classified, and the classification is pinned, so a case that
 * gets better shows up here as well as one that gets worse:
 *
 *   right          the true answer, unmarked
 *   right, marked  the true answer, with a mark it did not need (a false alarm)
 *   marked         not the true answer, and the card says to check it
 *   blank          not found: the card asks for it
 *   WRONG          not the true answer, and nothing says so
 *
 * The arrival and dispatch dates are never marked on the card — the arrival is
 * prefilled, the dispatch starts a shop's clock — so for those anything but the
 * true answer or a blank is WRONG.
 */
const TODAY = new Date(2026, 9, 5);

type Outcome = 'right' | 'right, marked' | 'marked' | 'blank' | 'WRONG';
type Field = 'store' | 'total' | 'bought' | 'arrived' | 'dispatched' | 'ref';

function textFor(c: Case): string {
  switch (c.kind) {
    case 'paste':
      return c.text;
    case 'ocr':
      return fromScan(c.text);
    case 'html':
      return htmlToText(c.text);
    case 'eml': {
      const mail = readEmail(c.text);
      return emailAsText(mail, bestReading(mail.bodies, TODAY) ?? '');
    }
  }
}

function judge<T>(read: T | null, truth: T | null, marked: boolean): Outcome {
  if (read === truth) return marked ? 'right, marked' : 'right';
  if (read === null) return 'blank';
  return marked ? 'marked' : 'WRONG';
}

function read(c: Case): Partial<Record<Field, Outcome>> | 'nothing found' {
  const out = parseReceiptText(textFor(c), TODAY);
  if (!out.ok) return 'nothing found';
  const v = out.value;
  const ck = toCheck(v);
  const e = c.expect;
  const got: Partial<Record<Field, Outcome>> = {
    store: judge(v.store, e.store, ck.store !== undefined),
    total: judge(v.amount, e.pence, ck.amount !== undefined),
    bought: judge(v.dateFound ? v.purchasedOn : null, e.on, ck.purchasedOn !== undefined),
  };
  if (e.arrived !== undefined) got.arrived = judge(v.arrivedOn, e.arrived, false);
  if (e.dispatched !== undefined) got.dispatched = judge(v.dispatchedOn, e.dispatched, false);
  if (e.ref !== undefined) got.ref = judge(v.orderRef, e.ref, false);
  return got;
}

/*
 * The fields that are not simply right, and why each is left as it is. Every
 * other field of every case must read right and unmarked.
 */
const NOT_RIGHT: Record<string, Partial<Record<Field, Outcome>> | 'nothing found'> = {
  // 10/01/2026 from an American shop: read the UK way, and marked because
  // the other reading is the recent one.
  D6: { bought: 'marked' },
  // Delivery and dispatch notices that never state the order date: their only
  // date is offered as the best evidence there is, and marked as a notice's.
  M4: { bought: 'marked' },
  M5: { bought: 'marked' },
  M6: { bought: 'marked' },
  M7: { bought: 'marked' },
  // Forwarded: the order date is only in the original's mail header, and a
  // header's Date: is never read as the purchase. Asked for instead.
  M12: { bought: 'blank' },
  // "Prices correct as of 4 October" in the footer, newer than the order
  // date: two unlabelled dates, the later taken and marked.
  M13: { bought: 'marked' },
  // Refunds: the refund's figure is not the price paid, and is marked.
  R1: { total: 'marked' },
  R2: { total: 'marked' },
  // An eBay order whose item title starts with a shop's name: the only shop
  // named, so offered, but marked as named only in passing.
  S10: { store: 'marked' },
  // Camera misreads — "E" and "f" for £, O for 0, a dropped decimal point,
  // "B00TS": the scanner's to fix, not the parser's; each is blank or marked.
  O1: { total: 'blank' },
  O2: { total: 'marked' },
  O4: { bought: 'blank' },
  O5: { total: 'marked' },
  O8: { store: 'blank' },
  // A euro total with a £50 promotion in the footer: no £ total, so the
  // largest £ figure, marked.
  C1: { total: 'marked' },
  // Dollars only and no shop Kept knows: nothing a receipt can be built from.
  C2: 'nothing found',
  // "Dunelm" as the email's last line, after the total: the shop, but only
  // as a sign-off, so marked although right.
  H1: { store: 'right, marked' },
};

function expected(c: Case): Partial<Record<Field, Outcome>> | 'nothing found' {
  const over = NOT_RIGHT[c.id];
  if (over === 'nothing found') return over;
  const e = c.expect;
  const all: Partial<Record<Field, Outcome>> = { store: 'right', total: 'right', bought: 'right' };
  if (e.arrived !== undefined) all.arrived = 'right';
  if (e.dispatched !== undefined) all.dispatched = 'right';
  if (e.ref !== undefined) all.ref = 'right';
  return { ...all, ...over };
}

describe('the audit cases: right, marked, or left blank — never confidently wrong', () => {
  it('is reading the whole set', () => {
    expect(CASES.length).toBe(65);
    expect(new Set(CASES.map((c) => c.id)).size).toBe(65);
    // Every exception names a case that exists.
    for (const id of Object.keys(NOT_RIGHT)) expect(CASES.some((c) => c.id === id), id).toBe(true);
  });

  it('states no figure wrong without marking it, in any case', () => {
    const wrong = CASES.flatMap((c) => {
      const got = read(c);
      return got === 'nothing found' ? [] : Object.entries(got).filter(([, o]) => o === 'WRONG').map(([f]) => `${c.id} ${f}`);
    });
    expect(wrong).toEqual([]);
  });

  it.each(CASES.map((c) => [`${c.id} ${c.stress}`, c] as const))('%s', (_name, c) => {
    expect(read(c)).toEqual(expected(c));
  });
});
