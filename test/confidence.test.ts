import { describe, expect, it } from 'vitest';
import { parseReceiptText, type ParsedReceipt } from '../src/lib/parse';
import { fromScan } from '../src/lib/receipt-scan';
import { checkCount, checkWords, DATE_UNSURE_BELOW, TOTAL_UNSURE_BELOW, toCheck } from '../src/lib/confidence';
import { ORDER_EMAILS } from './fixtures/order-emails';

const TODAY = new Date(2026, 8, 30);

function parse(text: string): ParsedReceipt {
  const out = parseReceiptText(text, TODAY);
  if (!out.ok) throw new Error(`did not parse: ${out.reason}`);
  return out.value;
}

describe('how the parser found each figure', () => {
  it('a total read off a total line', () => {
    expect(parse('Argos\nOrder total: £49.99').how.amount).toBe('label');
  });

  it('a total that is only the largest figure, with no total line', () => {
    expect(parse('Argos\nKettle £29.00\nToaster £19.00').how.amount).toBe('largest');
  });

  it('a "total" with a product name in front of it', () => {
    expect(parse('Boots\nCOLGATE TOTAL £4.97').how.amount).toBe('named');
  });

  it('is not fooled by a count before the balance line', () => {
    // Sainsbury's prints the number of items there: "3 BALANCE DUE 14.20".
    expect(parse(fromScan("Sainsbury's\nBREAD 1.10\n3 BALANCE DUE 14.20")).how.amount).toBe('label');
  });

  it('is not fooled by a stray mark before the total line', () => {
    expect(parse(fromScan('CURRYS\nTV 1,448.00\nJ TOTAL 1,448.00')).how.amount).toBe('label');
  });

  it('a date read off an order-date label, the only date, or the latest of several', () => {
    expect(parse('Argos\nOrder date: 21 September 2026\nTotal £5.00').how.purchasedOn).toBe('label');
    expect(parse('BOOTS\nTOTAL 19.99\n29/09/2026 12:04').how.purchasedOn).toBe('only');
    expect(parse('Argos\n12 September 2026\n20 September 2026\nTotal £5.00').how.purchasedOn).toBe('latest');
  });

  it('counts a date announced as the delivery as not a candidate', () => {
    // An unlabelled date, but the one date there that is not a delivery, so
    // nothing was chosen between. (This used "Ordered:", which was no label
    // the parser knew; it is one now — Apple writes its order date that way —
    // so the date is unlabelled here to keep asking the same question.)
    const p = parse('Apple Store\nSep 19, 2026\nDelivered: Sep 23, 2026\nTotal £229.00');
    expect(p.purchasedOn).toBe('2026-09-19');
    expect(p.how.purchasedOn).toBe('only');
    expect(parse('Apple Store\nOrdered: Sep 19, 2026\nDelivered: Sep 23, 2026\nTotal £229.00').how.purchasedOn).toBe('label');
  });
});

describe('what the card asks to be checked', () => {
  it('marks a total that is only the largest figure', () => {
    expect(toCheck(parse('Argos\nKettle £29.00\nToaster £19.00')).amount).toBe('largest-figure');
  });

  it('marks a total with a name in front of it', () => {
    expect(toCheck(parse('Boots\nCOLGATE TOTAL £4.97')).amount).toBe('named-total');
  });

  it('leaves a largest figure alone when the lines add up to it exactly', () => {
    const p = parse('Argos\nKettle £29.00\nToaster £19.00\nBalance £48.00');
    expect(p.lines.reduce((s, l) => s + l.pence, 0)).toBe(p.amount);
    expect(toCheck(p).amount).toBeUndefined();
  });

  it('marks a labelled total read off a word the reader was unsure of, at the line it was measured at', () => {
    const p = parse(fromScan('BOOTS\nTOTAL 19.99\n29/09/2026'));
    expect(toCheck(p, [{ text: '19.99', confidence: TOTAL_UNSURE_BELOW - 1 }]).amount).toBe('unclear-print');
    expect(toCheck(p, [{ text: '19.99', confidence: TOTAL_UNSURE_BELOW }]).amount).toBeUndefined();
  });

  it('marks a total only for a doubt on the line it was read from, not on another copy of the figure', () => {
    // A till prints the paid figure three times. Found on a crisp rendered
    // receipt in the smoke sweep: the VISA line's copy scored low, and the
    // total, read cleanly off its own TOTAL line, was marked.
    const p = parse(fromScan('ARGOS\nKENWOOD MIXER 199.99\nTOTAL 199.99\nVISA 199.99\n26/09/2026 14:32'));
    expect(toCheck(p, [{ text: '199.99', confidence: 70, line: 'VISA 199.99' }]).amount).toBeUndefined();
    expect(toCheck(p, [{ text: '199.99', confidence: 70, line: 'KENWOOD MIXER 199.99' }]).amount).toBeUndefined();
    expect(toCheck(p, [{ text: '199.99', confidence: 70, line: 'TOTAL 199.99' }]).amount).toBe('unclear-print');
    // What a blur leaves of the label still names the line.
    expect(toCheck(p, [{ text: '199.99', confidence: 70, line: 'TOT 199.99' }]).amount).toBe('unclear-print');
  });

  it('does not mark a total because some OTHER word was unclear', () => {
    const p = parse(fromScan('BOOTS\nTOTAL 19.99\n29/09/2026'));
    expect(toCheck(p, [{ text: 'BOOTS', confidence: 10 }, { text: '4.99', confidence: 10 }]).amount).toBeUndefined();
  });

  it('marks the latest of several dates, and a date read off unclear print', () => {
    expect(toCheck(parse('Argos\n12 September 2026\n20 September 2026\nTotal £5.00')).purchasedOn).toBe('several-dates');
    const p = parse(fromScan('BOOTS\nTOTAL 19.99\n29/09/2026'));
    expect(toCheck(p, [{ text: '29/09/2026', confidence: DATE_UNSURE_BELOW - 1 }]).purchasedOn).toBe('unclear-print');
    expect(toCheck(p, [{ text: '29/09/2026', confidence: DATE_UNSURE_BELOW }]).purchasedOn).toBeUndefined();
  });

  it('marks nothing on a date it did not find — the card asks for that one outright', () => {
    expect(toCheck(parse('Argos\nTotal £5.00')).purchasedOn).toBeUndefined();
  });

  it('marks nothing in any email in the corpus, every one of which reads right', () => {
    const marked = ORDER_EMAILS.map((e) => [e.name, toCheck(parse(e.text))] as const).filter(([, c]) => checkCount(c) > 0);
    expect(marked).toEqual([]);
  });

  it('says why in words, for every reason', () => {
    for (const why of ['largest-figure', 'named-total', 'unclear-print', 'several-dates'] as const) {
      expect(checkWords('amount', why).length).toBeGreaterThan(10);
    }
    expect(checkWords('purchasedOn', 'unclear-print')).toMatch(/date/);
    for (const why of ['several-totals', 'part-total', 'notice-date', 'month-first', 'several-shops', 'shop-in-passing'] as const) {
      expect(checkWords(why.includes('shop') ? 'store' : 'amount', why).length).toBeGreaterThan(10);
    }
    // A camera's misread says what was misread, field by field.
    expect(checkWords('amount', 'misread-print')).toMatch(/£/);
    expect(checkWords('purchasedOn', 'misread-print')).toMatch(/date/);
    expect(checkWords('store', 'misread-print')).toMatch(/shop/);
  });
});

describe('a total chosen from several', () => {
  it('marks totals that disagree when nothing ranks one above the other', () => {
    expect(toCheck(parse('Argos\nTotal £20.00\nTotal £30.00')).amount).toBe('several-totals');
    // A lesser total printed AFTER the one taken is a disagreement too.
    expect(toCheck(parse('Argos\nTotal paid £30.00\nTotal £20.00')).amount).toBe('several-totals');
  });

  it('does not mark a basket total followed by the total to pay', () => {
    const p = parse('Argos\nBasket total £50.00\nDelivery £3.95\nTotal to pay £53.95');
    expect(p.amount).toBe(5395);
    expect(toCheck(p).amount).toBeUndefined();
  });

  it('marks a total that is only of the items, which may leave out delivery', () => {
    expect(toCheck(parse('Argos\nBasket total £50.00')).amount).toBe('part-total');
  });
});

describe('the shop', () => {
  it('marks a shop named only in passing, and two named as surely as each other', () => {
    expect(toCheck(parse('eBay\nYou paid for your item\nNEW Decathlon tent\nOrder total £50.00')).store).toBe('shop-in-passing');
    expect(toCheck(parse('Order confirmation from Argos and Currys · Total £20.00')).store).toBe('several-shops');
  });

  it('does not mark the heading, the sender, or a shop named as the shop', () => {
    expect(toCheck(parse('Argos\nTotal £20.00')).store).toBeUndefined();
    expect(toCheck(parse('From: ASOS <orders@asos.com>\nSubject: Thanks\n\nTotal £20.00')).store).toBeUndefined();
    expect(toCheck(parse('Thanks for shopping at Tesco\nTotal £20.00')).store).toBeUndefined();
  });

  it('counts a marked shop among the figures to check', () => {
    expect(checkCount({ store: 'several-shops' })).toBe(1);
    expect(checkCount({ amount: 'part-total', purchasedOn: 'several-dates', store: 'shop-in-passing' })).toBe(3);
  });
});

describe('a purchase date that may be something else', () => {
  it('marks the only date on a dispatch or delivery notice that never names the order date', () => {
    expect(toCheck(parse('Argos\nYour order has been dispatched\n28 September 2026\nTotal £29.99')).purchasedOn).toBe('notice-date');
  });

  it('does not mark an order date beside a promise to say when it is dispatched', () => {
    const p = parse("Argos\nThanks for your order - 21/09/2026\nTotal £20.00\nWe'll email you when it's dispatched.");
    expect(p.purchasedOn).toBe('2026-09-21');
    expect(toCheck(p).purchasedOn).toBeUndefined();
  });

  it('marks figures that also read month first when that reading is the recent one', () => {
    const p = parse('Brooklinen\nOrder date: 09/01/2026\nTotal £36.50');
    expect(p.purchasedOn).toBe('2026-01-09');
    expect(toCheck(p).purchasedOn).toBe('month-first');
    // The other way round reads only one way that has happened.
    expect(toCheck(parse('Argos\nOrder date: 01/09/2026\nTotal £5.00')).purchasedOn).toBeUndefined();
  });
});

/*
 * Real reads, kept from the bench (scripts/scan-bench/confidence.ts): the text
 * tesseract returned and the words it scored under 90. Two came out wrong and
 * must be marked; one came out right and must not be.
 */
describe('reads the bench got wrong are marked, and one it got right is not', () => {
  it('a faded, blurred TK Maxx slip: £50.98 read for £59.98, off a word scored 78', () => {
    const p = parse(fromScan('TK MAXX\n\noxford Street\n\nLADIES COAT 39.99\nSCARF 19.99)\nSUBTOTAL 59.98\nTOTAL 50.98\nCARD 50.98\nCHANGE 0.60\n27-69-2026 13:13\n'));
    expect(p.amount).toBe(5098);
    const c = toCheck(p, [{ text: 'TK', confidence: 82 }, { text: '19.99)', confidence: 62 }, { text: '59.98', confidence: 86 }, { text: '50.98', confidence: 78 }, { text: '0.60', confidence: 47 }]);
    expect(c.amount).toBe('unclear-print');
  });

  it('a blurred Tesco slip: the total line half lost, and £23.45 taken for £20.45 as the largest figure', () => {
    const p = parse(fromScan('1 TESCO\nTesco Stores Ltd i\nKensington Superstore\nrh ” EE\niE : So\n£ CHIPS 1506 2.25\nPHILIPS HAIR CLIPPER 15.07\nAL 23.45\naqebiang EEE\nANCE DUE 20.45\nVISA 20.45\n28/09/26 12:04 5T:2044 OP:118\n'));
    expect(p.amount).toBe(2345);
    expect(toCheck(p).amount).toBe('largest-figure');
  });

  it('a Sainsbury’s slip read right is not marked at all', () => {
    const p = parse(fromScan("Sainsbury's\n\nSupermarkets Ltd\n\nHolborn Circus\n\nJS BREAD WHITE 1.10\nTU KIDS T-SHIRT 2PK 12.00\nROBINSONS SQUASH 1.10\n3 BALANCE DUE 14.20\nMASTERCARD 14.20\nNECTAR POINTS EARNED 14\nPOINTS BALANCE 312\n26/09/2026 17:41\n"));
    expect(p.amount).toBe(1420);
    expect(checkCount(toCheck(p, [{ text: '1.10', confidence: 87 }]))).toBe(0);
  });
});

/*
 * What the camera printed with a letter in it, and `readScan` read as the £,
 * the 0 or the O it most likely was. Given here as `readScan` hands them on,
 * so each rule of the mark is tested on its own; the corrections themselves
 * are tested in test/receipt-scan.test.ts.
 */
describe('a figure the camera misread', () => {
  const slip = parse('Receipt from Boots\nNO7 SERUM £38.00\nTOTAL £38.00\n26/09/2026');

  it('marks the total, the date and the shop each read through a correction', () => {
    const c = toCheck(slip, [], [
      { field: 'amount', read: 'E38.00', as: '38.00', proved: false },
      { field: 'purchasedOn', read: '26/O9/2O26', as: '26/09/2026', proved: false },
      { field: 'store', read: 'B00TS', as: 'Boots', proved: false },
    ]);
    expect(c).toEqual({ amount: 'misread-print', purchasedOn: 'misread-print', store: 'misread-print' });
  });

  it('does not mark one the slip’s own arithmetic proved', () => {
    expect(toCheck(slip, [], [{ field: 'amount', read: 'f38.00', as: '38.00', proved: true }]).amount).toBeUndefined();
  });

  it('marks only the figure that was corrected, not another of the same field', () => {
    // An item's "E4.99" is no doubt about a £38.00 total read clean.
    const c = toCheck(slip, [], [
      { field: 'amount', read: 'E4.99', as: '4.99', proved: false },
      { field: 'purchasedOn', read: '27/O9/2O26', as: '27/09/2026', proved: false },
      { field: 'store', read: 'L1DL', as: 'Lidl', proved: false },
    ]);
    expect(checkCount(c)).toBe(0);
  });

  it('takes a misread of one field as no doubt about another', () => {
    // A price "E26.09" has the date's day and month in its figures.
    expect(toCheck(slip, [], [{ field: 'amount', read: 'E26.09', as: '26.09', proved: false }]).purchasedOn).toBeUndefined();
  });

  it('reads a date corrected without its leading zeros as the same day', () => {
    expect(toCheck(slip, [], [{ field: 'purchasedOn', read: '26/9/2O26', as: '26/9/2026', proved: false }]).purchasedOn).toBe('misread-print');
  });

  it('marks a misread total even where the lines add up to it: they settle the figure, not the currency', () => {
    const p = parse('Receipt from Tesco\nBANANAS £1.20\nBREAD £1.45\nTOTAL £2.65\n26/09/2026');
    expect(toCheck(p).amount).toBeUndefined();
    expect(toCheck(p, [], [{ field: 'amount', read: 'E2.65', as: '2.65', proved: false }]).amount).toBe('misread-print');
  });
});

describe('a refund pasted as if it were a purchase', () => {
  /*
   * Saved as it stands, a refund email becomes a purchase of the refunded
   * sum with a fresh return window — money that has already come back,
   * counted down as if it could still be lost. The card marked the figure
   * before this, but for a reason that was not true: "follows a product
   * name" for "Refund total £25.00", "no total line" for a till's REFUND
   * slip. Both now say what the paste is.
   */
  const email = 'ASOS\nYour refund is on its way\nOrder No. 123456789\nOrder date: 20 September 2026\nRefund date: 3 October 2026\nRefund total £25.00';
  const slip = fromScan('NEXT\nREFUND\nCHINOS -30.00\nTOTAL -30.00\nREFUND TO VISA 30.00\n03/10/2026');

  it('reads a refund email and a till refund slip as refunds, and marks the figure as one', () => {
    for (const text of [email, slip]) {
      const p = parse(text);
      expect(p.refund).toBe(true);
      expect(toCheck(p).amount).toBe('refund');
    }
    expect(checkWords('amount', 'refund')).toMatch(/refund/);
  });

  it('is said even where the figure is labelled cleanly', () => {
    // "Refunded: £25.00" is a label the parser trusts; what it labels is still money back.
    const p = parse('Zara\nWe have refunded your order\nOrder date: 12 September 2026\nTotal paid £25.00');
    expect(toCheck(p).amount).toBe('refund');
  });

  it('is not a purchase whose email explains refunds further down, or sells its returns at the top', () => {
    const footer = parse('Argos\nThank you for your order\nOrder date: 2 October 2026\nKettle £29.99\nTotal £29.99\nRefunds go back to the card you paid with, within 14 days of us receiving your return.');
    const banner = parse('Free returns and refunds on every order\nJohn Lewis\nThank you for your order\nOrder date: 2 October 2026\nTotal £49.00');
    for (const p of [footer, banner]) {
      expect(p.refund).toBe(false);
      expect(toCheck(p).amount).toBeUndefined();
    }
  });

  it('is not anything in the order-email corpus', () => {
    expect(ORDER_EMAILS.filter((e) => parse(e.text).refund).map((e) => e.name)).toEqual([]);
  });
});

describe('a total in another currency', () => {
  /*
   * A Zara order placed in euros, with "Free delivery on orders over £50 in
   * the UK" in its footer: the £50 was taken as the total and marked "No
   * total line was found" — untrue, the total line was right there, in
   * euros. The card now says what happened.
   */
  it('marks a £ figure taken from a page whose total is in euros or dollars, and says why', () => {
    const euro = parse('Zara\nOrder date 29/09/2026\nTotal 45,95 €\nFree delivery on orders over £50 in the UK');
    expect(euro.foreignTotal).toBe(true);
    expect(toCheck(euro).amount).toBe('other-currency');
    const dollar = parse('Argos\nOrder date 29/09/2026\nTotal: $59.99 USD\nUK customers: free returns on orders over £20');
    expect(toCheck(dollar).amount).toBe('other-currency');
    expect(checkWords('amount', 'other-currency')).toMatch(/not in pounds/);
  });

  it('is not a UK till that prints its pound total as "TOTAL EUR/GBP", nor a total in pounds with a euro price beside it', () => {
    expect(parse(fromScan('DECATHLON\nKIPRUN RUNNING SHOE 30.00\nTOTAL EUR/GBP 20.00\n19/09/2026')).foreignTotal).toBe(false);
    expect(parse('John Lewis\nOrder date 2 October 2026\nTotal £49.00 (approx. €56)').foreignTotal).toBe(false);
  });

  it('is not anything in the order-email corpus', () => {
    expect(ORDER_EMAILS.filter((e) => parse(e.text).foreignTotal).map((e) => e.name)).toEqual([]);
  });
});
