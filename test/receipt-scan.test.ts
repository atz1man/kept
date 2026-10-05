import { describe, expect, it } from 'vitest';
import { fieldsFound, fromScan, readBestOf, readScan, scanFailure, type Thresholding, readFlattenedOrAsTaken } from '../src/lib/receipt-scan';
import { toCheck } from '../src/lib/confidence';
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

  it('Boots: a toothpaste called Total is an item, not the total', () => {
    const v = read(`Boots
Oxford Street
DATE 27/09/2026 14:32
NO7 PROTECT&PERFECT SERUM 32.50
BaByliss HAIRDRYER 5736U 25.00
COLGATE TOTAL 125ML x2 4.97
TOTAL 62.47
VISA CONTACTLESS ****4021`);
    expect(v.store).toBe('Boots');
    expect(v.amount).toBe(6247);
  });

  it('Currys: a total in the thousands, with its comma', () => {
    // The TV and its care plan. "1,448.00" was given no £, so the TOTAL line
    // was not money and the care plan's £149.00 was saved as the price.
    const v = read(`Currys
Tottenham Court Rd
LG OLED55C4 TV 1,299.00
CARE & REPAIR 3YR 149.00
TOTAL 1,448.00
AMEX 1,448.00
24/09/2026 15:20`);
    expect(v.store).toBe('Currys');
    expect(v.amount).toBe(144800);
    // And beside the word, when something follows the figure on its line.
    expect(read('Currys\nLG OLED55C4 TV 1,299.00\nCARE & REPAIR 149.00\nTOTAL 1,448.00 GBP\n24/09/2026').amount).toBe(144800);
  });

  it('reads a date printed year first', () => {
    // 2026/09/21 and 2026.09.21 came through as no date at all.
    for (const printed of ['2026/09/21 18:22', '2026.09.21', '2026/9/21']) {
      const v = read(`UNIQLO
Regent Street
HEATTECH CREW NECK 14.95
Total(tax incl.) 14.95
${printed}`);
      expect(v.purchasedOn).toBe('2026-09-21');
    }
  });

  it('does not read a year-first number that is not a date as one', () => {
    // Month 13 is not a month: left alone, and the real date below is read.
    const v = read(`ARGOS
REF 2026/13/21
KETTLE 29.00
TOTAL 29.00
21/09/2026`);
    expect(v.purchasedOn).toBe('2026-09-21');
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
    // Read as the date it is: the parser reads dotted dates itself now.
    expect(read('ARGOS\nKETTLE 29.00\nTOTAL 29.00\n27.09.26').purchasedOn).toBe('2026-09-27');
    expect(fromScan('29.09.26')).not.toContain('£');
  });

  it('takes a shop from the heading only, not from the middle of the receipt', () => {
    expect(fromScan('THE CORNER SHOP\nline\nline\nline\nNext to the station 1.00')).not.toContain('Receipt from');
  });
});

/*
 * What the camera printed with a letter in it, read as what it most likely
 * was — and handed on as a misread, so the card can mark it unless the slip's
 * own arithmetic proves it.
 */
describe('a £ the camera read as a letter', () => {
  const checked = (ocr: string) => {
    const scan = readScan(ocr);
    const out = parseReceiptText(scan.text, TODAY);
    if (!out.ok) throw new Error(`did not parse: ${out.reason}`);
    return { v: out.value, ck: toCheck(out.value, [], scan.misread), scan };
  };

  it('reads "E" before every price as a £, and marks the total: an E may have been a €', () => {
    const { v, ck } = checked("SAINSBURY'S\nBANANAS E1.20\nBREAD E1.45\nBALANCE DUE E2.65\n26/09/2026 12:01");
    expect(v.amount).toBe(265);
    expect(ck.amount).toBe('misread-print');
  });

  it('reads "f" on the total as a £, unmarked where the items less the discount come to it', () => {
    const { v, ck, scan } = checked('TESCO\nCOFFEE 4.50\nMILK 1.45\nSTAFF DISC -0.50\nTOTAL f5.45\n26/09/26 09:12');
    expect(v.amount).toBe(545);
    expect(scan.misread).toEqual([{ field: 'amount', read: 'f5.45', as: '5.45', proved: true, line: 'TOTAL £5.45' }]);
    expect(ck.amount).toBeUndefined();
  });

  it('marks an "f" total the items do not add up to', () => {
    // 4.50 + 1.45 is 5.95: the discount line was lost, so nothing proves 5.45.
    const { v, ck } = checked('TESCO\nCOFFEE 4.50\nMILK 1.45\nTOTAL f5.45\n26/09/26');
    expect(v.amount).toBe(545);
    expect(ck.amount).toBe('misread-print');
  });

  it('takes a discount printed with its minus after the figure as money off', () => {
    const { ck } = checked('TESCO\nCOFFEE 4.50\nMILK 1.45\nSTAFF DISC 0.50-\nTOTAL f5.45\n26/09/26');
    expect(ck.amount).toBeUndefined();
  });

  it('does not count the time printed beside the date as a thing bought', () => {
    // "09.12" ends its line like a price; the date before it says it is the time.
    const { v, ck } = checked('TESCO\nCOFFEE 4.50\nMILK 1.45\nSTAFF DISC -0.50\nTOTAL f5.45\n26/09/26 09.12');
    expect(v.amount).toBe(545);
    expect(ck.amount).toBeUndefined();
  });

  it('does not take a misread item for doubt about a total printed cleanly', () => {
    const { v, ck } = checked('BOOTS\nNO7 SERUM f38.00\nTOTAL 38.00\n26/09/2026');
    expect(v.amount).toBe(3800);
    expect(ck.amount).toBeUndefined();
  });

  it('leaves a bulb code alone: an E with no pence after it is not a £', () => {
    expect(fromScan('WICKES\nE27 LED BULB 4.99\nE14 CANDLE 3.50\nTOTAL 8.49')).toBe('Receipt from Wickes\nWICKES\nE27 LED BULB £4.99\nE14 CANDLE £3.50\nTOTAL £8.49');
  });

  it('leaves an E inside a word, or a capital F, alone', () => {
    expect(fromScan('COFFEE1.20')).toBe('COFFEE1.20');
    expect(readScan('BEEF F5.00\nTOTAL 5.00').misread).toEqual([]);
  });

  it('reads an E or f as a £ only where a bare figure would have been given one', () => {
    // A unit price in the middle of a quantity line, with no money word: the
    // line's price is the figure at its end.
    expect(fromScan('2 X E1.50 3.00')).toBe('2 X E1.50 £3.00');
    expect(fromScan('VISA E2.65 CONTACTLESS')).toBe('VISA £2.65 CONTACTLESS');
  });

  it('never reads an E as a £ on a slip that names euros', () => {
    for (const euro of ['TOTAL EUR E8.00', 'TOTAL €8.00', 'PRICES IN EUROS']) {
      expect(readScan(`NEXT\nT-SHIRT E5.00\nSOCKS E3.00\n${euro}`).text).toContain('T-SHIRT E5.00');
    }
    // An f is no €, so it is still read as a £.
    expect(fromScan('NEXT\nTOTAL EUR f8.00')).toContain('£8.00');
  });
});

describe('an O the camera read for a 0 in a date', () => {
  const dated = (ocr: string) => {
    const scan = readScan(ocr);
    const out = parseReceiptText(scan.text, TODAY);
    if (!out.ok) throw new Error(`did not parse: ${out.reason}`);
    return { v: out.value, ck: toCheck(out.value, [], scan.misread), scan };
  };

  it('reads the date, and marks it: nothing on a slip can prove a date', () => {
    for (const printed of ['O3/O9/2O26 11:15', '3-O9-26', 'o3.o9.2o26']) {
      const { v, ck } = dated(`BOOTS\nNO7 SERUM 38.00\nTOTAL 38.00\n${printed}`);
      expect(v.dateFound, printed).toBe(true);
      expect(v.purchasedOn, printed).toBe('2026-09-03');
      expect(ck.purchasedOn, printed).toBe('misread-print');
    }
  });

  it('leaves alone what would not be a day and a month', () => {
    // Month 20, and day 0: not a date with an O in it, so not rewritten as one.
    expect(fromScan('TILL 1O/2O/3O')).toBe('TILL 1O/2O/3O');
    expect(fromScan('TILL OO/1O/26')).toBe('TILL OO/1O/26');
    expect(readScan('TILL 1O/2O/3O').misread).toEqual([]);
  });

  it('leaves alone an O-date run into another word or figure', () => {
    expect(fromScan('REF AB1O/1O/2O')).toBe('REF AB1O/1O/2O');
    expect(fromScan('REF 1O/1O/2O26/7')).toBe('REF 1O/1O/2O26/7');
  });

  it('needs the same separator twice', () => {
    expect(fromScan('O3/1O-2O26')).toBe('O3/1O-2O26');
  });

  it('records nothing for a date printed cleanly', () => {
    expect(readScan('BOOTS\nTOTAL 38.00\n03/09/2026').misread).toEqual([]);
  });
});

describe('two looks at one photo', () => {
  /*
   * What each thresholding "read" of the same photo returned, shaped like the
   * measured cases: a clean read, a shadow that hid the total and date from a
   * single threshold, and a local read of faint print that invented a date.
   */
  const COMPLETE = 'ARGOS\nKENWOOD MIXER 199.99\nTOTAL 199.99\n26/09/2026 14:32';
  const SHADOWED = 'ARGOS\nKENWOOD M';
  const NO_DATE = 'ARGOS\nTOTAL 199.99';
  const OTHER_NO_DATE = 'ARGOS\nTOTAL 199.90';

  const reader = (answers: Partial<Record<Thresholding, string>>) => {
    const asked: Thresholding[] = [];
    const read = async (how: Thresholding) => {
      asked.push(how);
      return { text: answers[how] ?? '', unsure: [] };
    };
    return { asked, read };
  };

  it('counts the shop, the total and the date', () => {
    expect(fieldsFound(COMPLETE, TODAY)).toBe(3);
    expect(fieldsFound(NO_DATE, TODAY)).toBe(2);
    expect(fieldsFound(SHADOWED, TODAY)).toBe(1);
    expect(fieldsFound('', TODAY)).toBe(0);
  });

  it('reads a good photo once, the way it always has', async () => {
    const r = reader({ global: COMPLETE, local: NO_DATE });
    expect((await readBestOf(r.read, TODAY)).text).toBe(COMPLETE);
    expect(r.asked).toEqual(['global']);
  });

  it('looks again, locally, when the first read missed something, and keeps the better', async () => {
    const r = reader({ global: SHADOWED, local: COMPLETE });
    expect((await readBestOf(r.read, TODAY)).text).toBe(COMPLETE);
    expect(r.asked).toEqual(['global', 'local']);
  });

  it('keeps the first read when the second finds no more', async () => {
    // A tie goes to the global read: the local one is the one measured being
    // confidently wrong on faint thermal print.
    expect((await readBestOf(reader({ global: NO_DATE, local: OTHER_NO_DATE }).read, TODAY)).text).toBe(NO_DATE);
    expect((await readBestOf(reader({ global: NO_DATE, local: SHADOWED }).read, TODAY)).text).toBe(NO_DATE);
  });
});

describe('why a scan failed', () => {
  it('is the connection when a browser cannot reach the reader', () => {
    expect(scanFailure(false, false)).toBe('offline');
  });

  it('is never the connection in the iPhone app, which carries the reader inside it', () => {
    expect(scanFailure(false, true)).toBe('unreadable');
  });

  it('is the photo when the reader could be reached', () => {
    expect(scanFailure(true, false)).toBe('unreadable');
    expect(scanFailure(true, true)).toBe('unreadable');
  });
});

describe('the flattened read, and the photo as taken behind it', () => {
  const TODAY_ = new Date(2026, 8, 30);
  const FULL = 'BOOTS\nTOTAL 19.99\n29/09/2026';
  const NO_TOTAL = 'BOOTS\n29/09/2026';
  /** A reader that always says `text`, and counts how often it was asked. */
  const reader = (text: string) => {
    const read = Object.assign(async () => {
      read.calls += 1;
      return { text, unsure: [] };
    }, { calls: 0 });
    return read;
  };

  it('reads only the photo as taken when no paper was found', async () => {
    const asTaken = reader(FULL);
    expect((await readFlattenedOrAsTaken(null, asTaken, TODAY_)).text).toBe(FULL);
    expect(asTaken.calls).toBe(1);
  });

  it('never reads the photo as taken when the flattened read found everything', async () => {
    const flat = reader(FULL);
    const asTaken = reader(NO_TOTAL);
    expect((await readFlattenedOrAsTaken(flat, asTaken, TODAY_)).text).toBe(FULL);
    expect(asTaken.calls).toBe(0);
  });

  it('falls back to the photo as taken where flattening lost something it has', async () => {
    // The shadow case: the "paper" was the lit half, and the total was cropped off.
    expect((await readFlattenedOrAsTaken(reader(NO_TOTAL), reader(FULL), TODAY_)).text).toBe(FULL);
  });

  it('keeps the flattened read on a tie — it is the one with the receipt straight', async () => {
    expect((await readFlattenedOrAsTaken(reader(NO_TOTAL), reader('BOOTS\n29/09/2026\nThanks'), TODAY_)).text).toBe(NO_TOTAL);
  });
});
