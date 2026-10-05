import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '../src/lib/parse';

/**
 * More layouts, read for the two figures every deadline hangs on: the total
 * and the day of purchase. Written to the shapes order emails and tills use —
 * ordinals, weekdays, two-digit years, ISO dates, "Paid on", "Amount paid",
 * "Total to pay", everything on one line, the figure on the line below its
 * label — not copied from anyone's inbox.
 *
 * Measured before this file existed: 23 of 24 right. The one wrong was
 * "21 Sep 26", read as the 26th — see `datesIn`.
 */
const TODAY = new Date(2026, 8, 28);

const LAYOUTS: { name: string; text: string; pence: number | null; on: string }[] = [
  { name: 'Ordered: label', text: 'Thanks for your order\nOrdered: 19 September 2026\nDelivered: 23 September 2026\nTotal £45.00', pence: 4500, on: '2026-09-19' },
  { name: 'eBay paid on', text: 'eBay\nYou paid for your item\nPaid on 14 Sep 2026\nItem price £24.99\nPostage £3.50\nOrder total £28.49', pence: 2849, on: '2026-09-14' },
  { name: 'Very total to pay', text: 'Very\nOrder date 23/09/2026\nGoods £149.99\nDelivery £3.99\nTotal to pay £153.98', pence: 15398, on: '2026-09-23' },
  { name: 'Amazon order placed + grand total', text: 'Amazon.co.uk\nOrder Placed: 21 September 2026\nItems: £39.98\nPostage & Packing: £0.00\nGrand Total: £39.98', pence: 3998, on: '2026-09-21' },
  { name: 'ordinal day', text: 'Currys\nOrder date: 22nd September 2026\nTotal paid £299.00', pence: 29900, on: '2026-09-22' },
  { name: 'two-digit year', text: 'Halfords\nDate: 21 Sep 26\nTotal £59.99', pence: 5999, on: '2026-09-21' },
  { name: 'two-digit year on a till line, with the time', text: 'Halfords\nTOTAL £59.99\n21 SEP 26 14:32', pence: 5999, on: '2026-09-21' },
  { name: 'weekday prefix', text: 'AO.com\nOrder Date: Mon 21 Sep 2026\nOrder total £429.00', pence: 42900, on: '2026-09-21' },
  { name: 'weekday long', text: 'Order confirmation\nSunday, 20 September 2026\nArgos\nTotal £15.00', pence: 1500, on: '2026-09-20' },
  { name: 'total incl VAT', text: 'Wickes\nOrder date 18/09/2026\nTotal (incl. VAT) £45.00', pence: 4500, on: '2026-09-18' },
  { name: 'amount paid', text: 'Decathlon\nPurchase date: 17/09/2026\nAmount paid: £62.10', pence: 6210, on: '2026-09-17' },
  { name: 'thousands with comma', text: 'Sports Direct\nOrder date 16/09/2026\nOrder Total: £1,049.97', pence: 104997, on: '2026-09-16' },
  { name: 'GBP prefix', text: 'Uniqlo\nOrder date 15/09/2026\nTotal: GBP 59.99', pence: 5999, on: '2026-09-15' },
  { name: 'discount then grand total', text: 'Boots\nOrder date 14/09/2026\nSubtotal £14.99\nDiscount -£2.00\nGrand total £12.99', pence: 1299, on: '2026-09-14' },
  { name: 'dashes date', text: 'Argos\nOrder date: 21-09-2026\nTotal £20.00', pence: 2000, on: '2026-09-21' },
  { name: 'ISO date', text: 'Apple\nOrder date: 2026-09-21\nTotal £20.00', pence: 2000, on: '2026-09-21' },
  { name: 'dotted short year', text: 'H&M\nOrder date 21.09.26\nTotal £20.00', pence: 2000, on: '2026-09-21' },
  { name: 'Sept 21st', text: 'Next\nOrdered on Sept 21st, 2026\nTotal £20.00', pence: 2000, on: '2026-09-21' },
  { name: 'one line', text: 'M&S · Order number: C12345678 · Order date: 21/09/2026 · Total £65.00', pence: 6500, on: '2026-09-21' },
  { name: 'transaction date', text: 'Screwfix\nTransaction date 21/09/2026\nTotal £33.48', pence: 3348, on: '2026-09-21' },
  { name: 'order total on next line', text: 'John Lewis\nOrder date\n21 September 2026\nOrder total\n£129.00', pence: 12900, on: '2026-09-21' },
  { name: 'date before label line', text: 'Dispatched 25 September 2026\nOrder date: 21 September 2026\nArgos\nTotal £10.00', pence: 1000, on: '2026-09-21' },
  { name: 'Total due today', text: 'Currys\nOrder date 21/09/2026\nTotal due today: £79.00', pence: 7900, on: '2026-09-21' },
  { name: 'price with pence-less', text: 'IKEA\nOrder date 21/09/2026\nTotal £199', pence: 19900, on: '2026-09-21' },
  { name: 'order date US-style label with time', text: 'ASOS\nOrder date: 21 Sep 2026, 14:32\nTotal £40.00', pence: 4000, on: '2026-09-21' },
  // Three forms the parser audit found unread, each falling back to "not found".
  { name: 'ordinal with "of"', text: 'Halfords\nOrder placed on Monday 21st of September 2026\nTotal £89.99', pence: 8999, on: '2026-09-21' },
  { name: 'ISO timestamp', text: 'Uniqlo\nOrder placed: 2026-09-21T09:15:00\nTotal £29.90', pence: 2990, on: '2026-09-21' },
  { name: 'till date with nothing between', text: 'PRIMARK\nJUMPER £12.00\nTOTAL £12.00\n21SEP26 15:02', pence: 1200, on: '2026-09-21' },
]

describe('more order layouts: the total and the day of purchase', () => {
  it('is reading a real set', () => {
    expect(LAYOUTS.length).toBeGreaterThanOrEqual(20);
  });

  it('does not read a product word that starts like a month as a date', () => {
    // "2 MARMITE" was 2 March and "3 DECAF" 3 December: the first three
    // letters were all that was read, and a till slip's one date became a
    // choice between three.
    const out = parseReceiptText('TESCO\n2 MARMITE 250G £9.00\n3 DECAF COFFEE £12.00\nTOTAL £21.00\n20/09/2026 18:02', TODAY);
    if (!out.ok) throw new Error(out.reason);
    expect(out.value.purchasedOn).toBe('2026-09-20');
    expect(out.value.how.purchasedOn).toBe('only');
  });

  it.each(LAYOUTS.map((l) => [l.name, l] as const))('%s', (_name, l) => {
    const out = parseReceiptText(l.text, TODAY);
    if (!out.ok) throw new Error(`did not parse: ${out.reason}`);
    expect({ pence: out.value.amount, on: out.value.dateFound ? out.value.purchasedOn : 'none' }).toEqual({ pence: l.pence, on: l.on });
  });
});
