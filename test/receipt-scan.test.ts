import { describe, expect, it } from 'vitest';
import { fromScan } from '../src/lib/receipt-scan';
import { parseReceiptText } from '../src/lib/parse';

/**
 * Till receipts as the camera reads them — capitals, no £, dotted dates, an
 * O where a 0 was — through `fromScan` and then the same parser a pasted email
 * goes through. Written to the shape OCR returns, not copied from any
 * receipt. Today is 28 September 2026.
 */
const TODAY = new Date(2026, 8, 28);
const read = (ocr: string) => {
  const out = parseReceiptText(fromScan(ocr), TODAY);
  if (!out.ok) throw new Error(`did not parse: ${out.reason}\n${fromScan(ocr)}`);
  return out.value;
};

describe('a till receipt, read by the camera', () => {
  it('Argos: heading, item, total without £, dotted date', () => {
    const v = read(`ARGOS
Store 0123 Milton Keynes
KENWOOD KMIX MIXER 199.99
TOTAL 199.99
VISA CONTACTLESS 199.99
26.09.26 14:32`);
    expect(v.store).toBe('Argos');
    expect(v.amount).toBe(19999);
    expect(v.purchasedOn).toBe('2026-09-26');
    expect(v.item).toBe('KENWOOD KMIX MIXER');
  });

  it('Boots: an ambiguous name made the shop by being the heading', () => {
    // "Boots" alone is walking boots to the paste parser. At the top of a till
    // receipt it is the shop.
    const v = read(`Boots
Boots UK Ltd
NO7 SERUM 30ML 38.00
BALANCE DUE 38.00
CASH 40.00
CHANGE 2.00
20/09/2026`);
    expect(v.store).toBe('Boots');
    expect(v.amount).toBe(3800);
    expect(v.item).toBe('NO7 SERUM 30ML');
  });

  it('reads through the camera’s own mistakes', () => {
    // A lower-case o for a 0, a comma for the point, a date with dashes.
    const v = read(`JOHN LEWIS
SONY HEADPHONES 349,OO
TOTAL 349,0o
24-09-2026`);
    expect(v.store).toBe('John Lewis');
    expect(v.amount).toBe(34900);
    expect(v.purchasedOn).toBe('2026-09-24');
  });

  it('never takes the cash handed over, or the change, for the total or the item', () => {
    const v = read(`TESCO
MILK 1.45
TOTAL 1.45
CASH 20.00
CHANGE 18.55
25/09/26`);
    expect(v.amount).toBe(145);
    expect(v.item).toBe('MILK');
  });

  it('does not name a shop it does not know', () => {
    const v = read(`THE CORNER SHOP
Kettle 24.99
TOTAL 24.99
27/09/2026`);
    expect(v.store).toBeNull();
    expect(v.amount).toBe(2499);
  });

  it('does not make a word a number, or a date an amount', () => {
    expect(fromScan('SOLD 12.OO')).toContain('£12.00');
    expect(fromScan('SOLD BY')).toBe('SOLD BY');
    // Shaped like money and made only of letters OCR confuses with digits:
    // without a real digit in it, it is a code, not a price.
    expect(fromScan('REF DB.SO')).toBe('REF DB.SO');
    expect(fromScan('29.09.26')).toBe('29/09/26');
    expect(fromScan('29.09.26')).not.toContain('£');
  });

  it('takes a shop from the heading only, not from the middle of the receipt', () => {
    expect(fromScan('THE CORNER SHOP\nline\nline\nline\nNext to the station 1.00')).not.toContain('Receipt from');
  });
});
