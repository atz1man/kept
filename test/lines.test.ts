import { describe, expect, it } from 'vitest';
import { reducer, type AppState } from '../src/app/state';
import { readReceipt } from '../src/lib/backup';
import { toPence } from '../src/lib/money';
import { parseReceiptText } from '../src/lib/parse';
import { fromScan } from '../src/lib/receipt-scan';
import { splitReceipt, splittableLines } from '../src/lib/split';
import { DEFAULT_SETTINGS } from '../src/lib/storage';
import type { Receipt } from '../src/lib/types';
import { ORDER_EMAILS } from './fixtures/order-emails';

/**
 * The things on a receipt. A basket read as its parts can be split into the
 * parts that go back and the parts that stay without the person typing what
 * the receipt already said — and a list that does not hold together is worse
 * than none, because its prices would end up on receipts someone returns.
 */
const TODAY = new Date(2026, 8, 30);
const linesOf = (text: string) => {
  const out = parseReceiptText(text, TODAY);
  if (!out.ok) throw new Error(out.reason);
  return out.value.lines;
};

describe('reading the things on a receipt', () => {
  it('reads a till slip\'s items and leaves out the deduction, the balance and the card', () => {
    const slip = fromScan([
      'TESCO', 'Kensington Superstore', 'WHOLE MILK 4PT        1.65', 'BANANAS LOOSE         0.98',
      'FAIRY LIQUID 820ML    3.50', 'KETTLE CHIPS 150G     2.25', 'PHILIPS HAIR CLIPPER 15.07',
      'SUBTOTAL             23.45', 'CLUBCARD PRICES      -3.00', 'BALANCE DUE          20.45',
      'VISA                 20.45', '28/09/26 12:04',
    ].join('\n'));
    expect(linesOf(slip)).toEqual([
      { item: 'WHOLE MILK 4PT', pence: 165 }, { item: 'BANANAS LOOSE', pence: 98 },
      { item: 'FAIRY LIQUID 820ML', pence: 350 }, { item: 'KETTLE CHIPS 150G', pence: 225 },
      { item: 'PHILIPS HAIR CLIPPER', pence: 1507 },
    ]);
  });

  it('reads an order\'s things, a quantity line by what the line cost', () => {
    const order = [
      'Currys', 'Thanks for your order', '1 x LG OLED55C4 TV £1,299.00', '2 x HDMI cable £10.00 £20.00',
      'Delivery £0.00', 'Order total £1,319.00',
    ].join('\n');
    expect(linesOf(order)).toEqual([{ item: 'LG OLED55C4 TV', pence: 129900 }, { item: 'HDMI cable', pence: 2000 }]);
  });

  it('offers nothing for one thing — there is nothing to split', () => {
    expect(linesOf(ORDER_EMAILS[0].text)).toEqual([]);
  });

  it('offers nothing when the list does not add up to the order', () => {
    // A promotion banner priced like a thing: £50 of "gift" on a £20 order.
    const order = ['ASOS', 'Free tote worth £50.00', 'Socks £8.00', 'Total £20.00'].join('\n');
    expect(linesOf(order)).toEqual([]);
    // Two things that come to a third of the total have missed most of it.
    expect(linesOf(['Next', 'Scarf £5.00', 'Gloves £5.00', 'Total £30.00'].join('\n'))).toEqual([]);
  });

  it('allows the savings and the delivery an order really carries', () => {
    const order = ['Boots', 'No7 serum £24.99', 'Toothbrush heads £12.98', '3 for 2 saving -£5.00', 'Delivery £3.95', 'Total £36.92'].join('\n');
    expect(linesOf(order).map((l) => l.pence)).toEqual([2499, 1298]);
  });

  it('takes a line of money off for what it is, whatever it is called', () => {
    // "Clubcard price -£0.50" names no saving and no discount; the minus sign does.
    const order = ['Tesco', 'Bread £1.40', 'Clubcard price -£0.50', 'Cheese £4.00', 'Total £4.90'].join('\n');
    expect(linesOf(order).map((l) => l.item)).toEqual(['Bread', 'Cheese']);
  });

  it('refuses a list with a thing dearer than the whole order — that line was misread', () => {
    // Within a third of the total overall, but the coat alone costs more than everything.
    const order = ['Next', 'Wool coat £110.00', 'Socks £5.00', 'Order total £100.00'].join('\n');
    expect(linesOf(order)).toEqual([]);
  });

  it('never lists money about the order as a thing, across the corpus', () => {
    for (const e of ORDER_EMAILS) {
      for (const l of linesOf(e.text)) {
        expect(l.item, e.name).not.toMatch(/\b(?:total|delivery|postage|vat|saving|payment|card)\b/i);
      }
    }
  });
});

const basket = (over: Partial<Receipt> = {}): Receipt => ({
  id: 'b', store: 'Boots', item: 'NO7 SERUM', cat: 'beauty', amount: toPence(54.96),
  purchasedOn: '2026-09-21', windowDays: 35, policy: 'p', distance: false, status: 'active',
  lines: [{ item: 'NO7 SERUM', pence: 2999 }, { item: 'TOOTHBRUSH HEADS', pence: 1298 }, { item: 'SPF 50', pence: 1199 }],
  ...over,
});

describe('splitting a listed thing out', () => {
  it('takes that line off what is left, and gives the part no list of its own', () => {
    const { rest, part } = splitReceipt(basket(), 'TOOTHBRUSH HEADS', 1298, 'p');
    expect(rest.lines).toEqual([{ item: 'NO7 SERUM', pence: 2999 }, { item: 'SPF 50', pence: 1199 }]);
    expect(part.lines).toBeUndefined();
    expect(rest.amount).toBe(5496 - 1298);
  });

  it('names what is left after the one thing left, when only one is', () => {
    const two = basket({ amount: 4297, lines: [{ item: 'NO7 SERUM', pence: 2999 }, { item: 'TOOTHBRUSH HEADS', pence: 1298 }] });
    const { rest } = splitReceipt(two, 'NO7 SERUM', 2999, 'p');
    expect(rest.item).toBe('TOOTHBRUSH HEADS');
    expect(rest.lines).toBeUndefined();
  });

  it('leaves the list alone for a part named by hand', () => {
    const { rest } = splitReceipt(basket(), 'Gift bag', 50, 'p');
    expect(rest.lines).toHaveLength(3);
    expect(rest.item).toBe('NO7 SERUM');
  });

  it('offers only lines a split would take', () => {
    expect(splittableLines(basket({ amount: 2000 })).map((l) => l.item)).toEqual(['TOOTHBRUSH HEADS', 'SPF 50']);
    expect(splittableLines(basket({ lines: undefined }))).toEqual([]);
  });

  it('puts the line back when the part goes back in', () => {
    const s: AppState = {
      version: 1, receipts: [basket()], updates: [], onboardingSeen: true, screen: 'detail', selId: 'b',
      settings: { ...DEFAULT_SETTINGS }, alertsSent: [], justDeleted: null, justKept: null, justReturned: null, justSent: null, justAdded: null, celebrating: null,
    } as unknown as AppState;
    const split = reducer(s, { type: 'split', id: 'b', item: 'SPF 50', pence: 1199, newId: 'p' }, TODAY);
    const back = reducer(split, { type: 'unsplit', id: 'p' }, TODAY);
    const b = back.receipts.find((r) => r.id === 'b')!;
    expect(b.amount).toBe(5496);
    expect(b.lines?.map((l) => l.item).sort()).toEqual(['NO7 SERUM', 'SPF 50', 'TOOTHBRUSH HEADS']);
  });
});

describe('a list in a backup', () => {
  it('keeps good lines and drops any no split could take', () => {
    const r = readReceipt({
      ...basket(),
      lines: [{ item: 'SERUM', pence: 2999 }, { item: '', pence: 100 }, { item: 'TOO DEAR', pence: 999999 }, { item: 'HALF', pence: 1.5 }, 'nonsense', null],
    }, true);
    expect(r?.lines).toEqual([{ item: 'SERUM', pence: 2999 }]);
  });

  it('drops a list that is not a list, and keeps the receipt', () => {
    const r = readReceipt({ ...basket(), lines: 'NO7, TOOTHBRUSH' }, true);
    expect(r).not.toBeNull();
    expect(r?.lines).toBeUndefined();
  });
});
