import { describe, expect, it } from 'vitest';
import { toCheck } from '../src/lib/confidence';
import { bestReading, emailAsText, htmlToText, readEmail } from '../src/lib/documents';
import { parseReceiptText } from '../src/lib/parse';
import { readScan, type Misread } from '../src/lib/receipt-scan';
import { CASES, MISREAD_GUARDS, type Case } from './fixtures/parse-audit';

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

/** The audit's cases and the guards written against the camera-misread corrections, held to one rule. */
const ALL: readonly Case[] = [...CASES, ...MISREAD_GUARDS];

type Outcome = 'right' | 'right, marked' | 'marked' | 'blank' | 'WRONG';
type Field = 'store' | 'total' | 'bought' | 'arrived' | 'dispatched' | 'ref';

/** The text the parser is given, and — for a camera's read only — what was corrected on the way, as the Add card is given both. */
function textFor(c: Case): { text: string; misread: Misread[] } {
  switch (c.kind) {
    case 'paste':
      return { text: c.text, misread: [] };
    case 'ocr':
      return readScan(c.text);
    case 'html':
      return { text: htmlToText(c.text), misread: [] };
    case 'eml': {
      const mail = readEmail(c.text);
      return { text: emailAsText(mail, bestReading(mail.bodies, TODAY) ?? ''), misread: [] };
    }
  }
}

function judge<T>(read: T | null, truth: T | null, marked: boolean): Outcome {
  if (read === truth) return marked ? 'right, marked' : 'right';
  if (read === null) return 'blank';
  return marked ? 'marked' : 'WRONG';
}

function read(c: Case): Partial<Record<Field, Outcome>> | 'nothing found' {
  const { text, misread } = textFor(c);
  const out = parseReceiptText(text, TODAY);
  if (!out.ok) return 'nothing found';
  const v = out.value;
  const ck = toCheck(v, [], misread);
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
  // Camera misreads, read through by `readScan` where that can be done safely.
  // "E2.65" is read as £2.65 and marked: the items add up to it, which settles
  // the figure but not whether the E was a £ or a €. "f5.45" (O2) is read as
  // £5.45 and not marked, because the items less the discount come to exactly
  // that. "O3/1O/2O26" is read as 3 October and marked, since nothing on a
  // slip can prove a date. "TOTAL 6900" (O5) is read as £69.00, unmarked,
  // because the coat less the promotion is exactly that. "B00TS" is still the
  // scanner's to fix, and is left blank.
  O1: { total: 'right, marked' },
  O4: { bought: 'right, marked' },
  O8: { store: 'blank' },
  // A euro total with a £50 promotion in the footer: no £ total, so the
  // largest £ figure, marked.
  C1: { total: 'marked' },
  // Dollars only and no shop Kept knows: nothing a receipt can be built from.
  C2: 'nothing found',
  // "Dunelm" as the email's last line, after the total: the shop, but only
  // as a sign-off, so marked although right.
  H1: { store: 'right, marked' },
  // A bulb's "E27" is no £: no total line, so the largest figure, marked.
  X1: { total: 'right, marked' },
  // The pasted email's "E27", "code E1" and "f5" stay text; no total line.
  X3: { total: 'right, marked' },
  // "TOTAL 120" for a £120 voucher: nothing priced adds up to it, so it is
  // never read as £1.20 — no £ figure at all, so the card asks.
  X4: { total: 'blank' },
  // "TOTAL 9900" with items that come to £104.00: not proved, so left as
  // printed, and the largest figure is offered, marked.
  X5: { total: 'marked' },
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
    for (const id of Object.keys(NOT_RIGHT)) expect(ALL.some((c) => c.id === id), id).toBe(true);
    expect(new Set(ALL.map((c) => c.id)).size).toBe(ALL.length);
  });

  it('states no figure wrong without marking it, in any case', () => {
    const wrong = ALL.flatMap((c) => {
      const got = read(c);
      return got === 'nothing found' ? [] : Object.entries(got).filter(([, o]) => o === 'WRONG').map(([f]) => `${c.id} ${f}`);
    });
    expect(wrong).toEqual([]);
  });

  it.each(ALL.map((c) => [`${c.id} ${c.stress}`, c] as const))('%s', (_name, c) => {
    expect(read(c)).toEqual(expected(c));
  });
});
