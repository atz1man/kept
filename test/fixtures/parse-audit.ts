/**
 * Sixty-five order emails, till slips, saved pages and .eml files in the
 * shapes UK shops produce them, each with the answer a person reading it would
 * give — written for an audit of the paste parser, not copied from anyone's
 * inbox. What they stress is the parser's judgement rather than its reading:
 * which of several totals, dates and shop names on the page is THE one.
 *
 * Dated relative to 5 October 2026. `on: null` means the text does not state
 * the purchase date, so the right outcome is "not found" or a marked guess,
 * never a confident date. See test/parse-audit.test.ts.
 */
export type Kind = 'paste' | 'ocr' | 'html' | 'eml';
export interface Case {
  id: string;
  kind: Kind;
  stress: string;
  text: string;
  expect: {
    store: string | null;
    pence: number | null;
    on: string | null;
    arrived?: string | null;
    dispatched?: string | null;
    ref?: string | null;
  };
}

const eml = (from: string, subject: string, date: string, body: string) =>
  [`From: ${from}`, `To: sam@example.com`, `Subject: ${subject}`, `Date: ${date}`, `MIME-Version: 1.0`, `Content-Type: text/plain; charset=utf-8`, '', body].join('\r\n');

export const CASES: Case[] = [
  // ── dates in UK forms ────────────────────────────────────────────────
  { id: 'D1', kind: 'paste', stress: 'date "5 Oct 2026"', text: 'Argos\nOrder date: 5 Oct 2026\nTotal £20.00', expect: { store: 'Argos', pence: 2000, on: '2026-10-05' } },
  { id: 'D2', kind: 'paste', stress: 'date 05/10/2026', text: 'Argos\nOrder date: 05/10/2026\nTotal £20.00', expect: { store: 'Argos', pence: 2000, on: '2026-10-05' } },
  { id: 'D3', kind: 'paste', stress: 'date "Sunday 4th October" no year', text: 'Waterstones\nOrder date: Sunday 4th October\nTotal £12.99', expect: { store: null, pence: 1299, on: '2026-10-04' } },
  { id: 'D4', kind: 'paste', stress: 'date "1st of October 2026" + dispatch', text: 'Halfords\nOrder placed on Thursday 1st of October 2026\nDispatched 2 October 2026\nTotal £89.99', expect: { store: null, pence: 8999, on: '2026-10-01', dispatched: '2026-10-02' } },
  { id: 'D5', kind: 'ocr', stress: 'till date 4.10.26', text: 'TESCO\nMILK 1.45\nBREAD 1.10\nTOTAL 2.55\nVISA 2.55\n4.10.26 14:32', expect: { store: 'Tesco', pence: 255, on: '2026-10-04' } },
  { id: 'D6', kind: 'paste', stress: 'US date 10/01/2026 (= 1 Oct) from a US shop', text: 'Thanks for shopping with Brooklinen\nOrder date: 10/01/2026\nTotal charged: £36.50', expect: { store: null, pence: 3650, on: '2026-10-01' } },
  { id: 'D7', kind: 'paste', stress: 'ISO timestamp 2026-10-01T09:15', text: 'Uniqlo\nOrder placed: 2026-10-01T09:15:00\nTotal £29.90', expect: { store: 'Uniqlo', pence: 2990, on: '2026-10-01' } },
  { id: 'D8', kind: 'ocr', stress: 'till date 04OCT26 (no separator)', text: 'PRIMARK\nJUMPER 12.00\nTOTAL 12.00\n04OCT26 15:02', expect: { store: null, pence: 1200, on: '2026-10-04' } },

  // ── several dates together ───────────────────────────────────────────
  { id: 'M1', kind: 'paste', stress: 'unlabelled order date + dispatched + estimated delivery', text: 'ASOS\nYour order\'s on its way!\nOrder No. 123456789\nThursday 1 October 2026\nDispatched: Friday 2 October 2026\nEstimated delivery: Monday 5 October 2026\nTotal £45.00', expect: { store: 'ASOS', pence: 4500, on: '2026-10-01', dispatched: '2026-10-02', arrived: null } },
  { id: 'M2', kind: 'paste', stress: 'delivery date with "(estimated)" AFTER it', text: 'Apple Store\nOrder Number: W9876543210\nOrdered: 28 Sep 2026\nDelivery date: Sat 3 Oct 2026 (estimated)\nTotal £229.00', expect: { store: 'Apple', pence: 22900, on: '2026-09-28', arrived: null } },
  { id: 'M3', kind: 'paste', stress: 'delivery window range "2 Oct - 4 Oct"', text: 'Zara\nOrder date 29/09/2026\nDelivery: 2 Oct - 4 Oct 2026\nTotal £59.99', expect: { store: 'Zara', pence: 5999, on: '2026-09-29', arrived: null } },
  { id: 'M4', kind: 'paste', stress: 'status tracker: "Order placed" step label then delivered date', text: 'Next\nYour order has been delivered\nOrder No: A7654321\nOrder placed\nDispatched\nOut for delivery\nDelivered\nDelivered on Saturday 3 October 2026\nTotal £52.99', expect: { store: 'Next', pence: 5299, on: null, arrived: '2026-10-03' } },
  { id: 'M5', kind: 'paste', stress: 'delivery notification, "delivered ... on <date>" far from the word', text: 'Amazon.co.uk\nYour package was delivered to the front porch on Saturday 3 October 2026.\nOrder # 205-1234567-1234567\nOrder Total: £15.99', expect: { store: 'Amazon', pence: 1599, on: null, arrived: '2026-10-03' } },
  { id: 'M6', kind: 'paste', stress: 'dispatch email, date on the line under the heading', text: 'Argos\nYour order has been dispatched\n2 October 2026\nOrder number: 1122334455\nTotal £29.99', expect: { store: 'Argos', pence: 2999, on: null } },
  { id: 'M7', kind: 'paste', stress: 'dispatch email, "dispatched from our warehouse on <date>"', text: 'John Lewis\nGood news - your order was dispatched from our warehouse on Friday 2 October 2026.\nOrder number: 7654321\nOrder total £89.00', expect: { store: 'John Lewis', pence: 8900, on: null } },
  { id: 'M8', kind: 'paste', stress: 'table header "Order date | Delivery method | Total" then values', text: 'M&S\nThank you for your order\nOrder date Delivery method Order number\n01/10/2026 Standard delivery 12345678\nKnitted jumper £45.00\nOrder total £45.00', expect: { store: 'M&S', pence: 4500, on: '2026-10-01', arrived: null } },
  { id: 'M9', kind: 'paste', stress: '"Delivery £3.99" then a payment date within reach', text: 'Uniqlo\nOrder No. 1234567890123\nSubtotal £45.00\nDelivery £3.99\nTotal £48.99\nPayment date: 1 October 2026', expect: { store: 'Uniqlo', pence: 4899, on: '2026-10-01', arrived: null } },
  { id: 'M10', kind: 'paste', stress: 'pasted with Mail/Gmail header; dispatch email, no order date in it', text: 'From: ASOS <orders@asos.com>\nDate: Sat, 3 Oct 2026 08:14\nSubject: Your order\'s on its way!\nTo: sam@example.com\n\nOrder No. 123456789\nYour order has been dispatched and is on its way.\nWide leg trousers £32.00\nTotal £32.00', expect: { store: 'ASOS', pence: 3200, on: null } },
  { id: 'M11', kind: 'paste', stress: 'Outlook header "Sent:" on a Zara order confirmation', text: 'From: ZARA <noreply@zara.com>\nSent: Thursday, 1 October 2026 10:02\nTo: Sam\nSubject: Thank you for your purchase\n\nOrder date 1 October 2026\nWool coat £119.00\nTotal £119.00', expect: { store: 'Zara', pence: 11900, on: '2026-10-01', dispatched: null } },
  { id: 'M12', kind: 'paste', stress: 'forwarded email (forwarder header newer than original)', text: 'From: Sam <sam@example.com>\nDate: Sun, 4 Oct 2026 19:00\nSubject: Fwd: Your order confirmation\n\n---------- Forwarded message ---------\nFrom: Currys <noreply@currys.co.uk>\nDate: Thu, 1 Oct 2026 at 10:02\nSubject: Your order confirmation\n\nOrder number: 98765432\nThanks for your order\nBose QuietComfort Ultra £299.00\nTotal £299.00', expect: { store: 'Currys', pence: 29900, on: '2026-10-01' } },
  { id: 'M13', kind: 'paste', stress: 'footer date newer than unlabelled order date', text: 'Uniqlo\nThanks for your order\n1 October 2026\nTotal £29.90\nPrices correct as of 4 October 2026.\n© 2026 UNIQLO', expect: { store: 'Uniqlo', pence: 2990, on: '2026-10-01' } },

  // ── lines near the total ─────────────────────────────────────────────
  { id: 'T1', kind: 'paste', stress: '"Basket total" (pre-delivery) before "Total to pay"', text: 'Your order summary\nArgos\nOrder number: 1122334455\nOrder date: 1 October 2026\nBasket total £50.00\nDelivery £3.95\nTotal to pay £53.95', expect: { store: 'Argos', pence: 5395, on: '2026-10-01' } },
  { id: 'T2', kind: 'paste', stress: 'invoice: Total Goods / Total Delivery / Total VAT / Total', text: 'INVOICE\nScrewfix\nInvoice date: 30/09/2026\nTotal Goods £120.00\nTotal Delivery £5.00\nTotal VAT £20.83\nTotal £125.00', expect: { store: 'Screwfix', pence: 12500, on: '2026-09-30' } },
  { id: 'T3', kind: 'paste', stress: '"Total (2 items)" before delivery and order total', text: 'H&M\nOrder number 12345678901\nOrder date 01.10.2026\nTotal (2 items) £34.98\nDelivery £3.99\nOrder total £38.97', expect: { store: 'H&M', pence: 3897, on: '2026-10-01' } },
  { id: 'T4', kind: 'paste', stress: '"Order total" then promo then "Total paid"', text: 'Boots.com\nOrder date: 30/09/2026\nOrder total £60.00\nPromo code AUTUMN10 -£6.00\nTotal paid £54.00', expect: { store: 'Boots', pence: 5400, on: '2026-09-30' } },
  { id: 'T5', kind: 'paste', stress: 'gift card after the total', text: 'River Island\nOrder number: 55667788\nOrder date: 2 October 2026\nSubtotal £45.00\nDelivery £3.99\nTotal £48.99\nGift card -£20.00\nPaid by card £28.99', expect: { store: 'River Island', pence: 4899, on: '2026-10-02' } },
  { id: 'T6', kind: 'paste', stress: 'was/now + "You saved"', text: 'Currys\nOrder date 03/10/2026\nLG 55" OLED TV\nWas £799.00 Now £599.00\nYou saved £200.00\nDelivery FREE\nTotal £599.00', expect: { store: 'Currys', pence: 59900, on: '2026-10-03' } },
  { id: 'T7', kind: 'paste', stress: '"Total Delivery" line above the order total', text: 'Dunelm\nOrder date: 2 October 2026\nItems £85.00\nTotal Delivery: £4.95\nOrder Total: £89.95', expect: { store: 'Dunelm', pence: 8995, on: '2026-10-02' } },
  { id: 'T8', kind: 'paste', stress: 'figure two lines below label (blank line between), with a discount', text: 'Matalan\nOrder date: 1 October 2026\nSubtotal\n\n£120.00\n\nDiscount\n\n-£20.00\n\nTotal\n\n£100.00', expect: { store: 'Matalan', pence: 10000, on: '2026-10-01' } },
  { id: 'T9', kind: 'paste', stress: 'only "Amount paid", promo footer with bigger £ figures', text: 'JD Sports\nOrder number: 12345678\nOrder date: 02/10/2026\nNike Air Force 1 £110.00\nDelivery £4.99\nAmount paid £114.99\nSpend £150 and get £20 off your next order\nWin £1,000 of vouchers', expect: { store: null, pence: 11499, on: '2026-10-02' } },
  { id: 'T10', kind: 'paste', stress: 'Shopify "Total £28.99 GBP"', text: 'Thank you for your purchase!\nOrder #1042\nPlaced on 2 October 2026\nCeramic mug × 1 £25.00\nSubtotal £25.00\nShipping £3.99\nTotal £28.99 GBP', expect: { store: null, pence: 2899, on: '2026-10-02' } },
  { id: 'T11', kind: 'paste', stress: 'item named TOTAL... on its own line (till-like text)', text: 'Boots\nOrder date 03/10/2026\nTotal Care mouthwash 500ml £3.50\nNo7 serum £38.00\nTotal £41.50', expect: { store: 'Boots', pence: 4150, on: '2026-10-03' } },
  { id: 'T12', kind: 'paste', stress: 'Total appears twice: summary at top, final at bottom after voucher', text: 'Sports Direct\nOrder date 01/10/2026\nOrder summary: Total £80.00\nTrainers £80.00\nVoucher SAVE15 -£12.00\nTotal to pay £68.00', expect: { store: 'Sports Direct', pence: 6800, on: '2026-10-01' } },

  // ── refunds / credit notes ───────────────────────────────────────────
  { id: 'R1', kind: 'paste', stress: 'refund email (partial refund of an £80 order)', text: 'ASOS\nYour refund is on its way\nOrder No. 123456789\nOrder date: 20 September 2026\nRefund date: 3 October 2026\nRefund total £25.00', expect: { store: 'ASOS', pence: null, on: '2026-09-20' } },
  { id: 'R2', kind: 'ocr', stress: 'till refund slip', text: 'NEXT\nREFUND\nCHINOS -30.00\nTOTAL -30.00\nREFUND TO VISA 30.00\n03/10/2026', expect: { store: 'Next', pence: null, on: '2026-10-03' } },

  // ── marketplace / two shops ──────────────────────────────────────────
  { id: 'S1', kind: 'paste', stress: 'Amazon, sold by Mamas & Papas, fulfilled by Amazon', text: 'Amazon.co.uk\nYour order has been dispatched\nOrder #203-1112223-3334445\nOrdered on 30 September 2026\nMamas & Papas Baby Bug Seat\nSold by: Mamas & Papas Ltd\nFulfilled by Amazon\nOrder Total: £45.00', expect: { store: 'Amazon', pence: 4500, on: '2026-09-30' } },
  { id: 'S2', kind: 'paste', stress: 'Amazon order of a The Body Shop product', text: 'Amazon.co.uk\nOrdered on 2 October 2026\nThe Body Shop Shea Body Butter 200ml £18.00\nOrder Total: £18.00', expect: { store: 'Amazon', pence: 1800, on: '2026-10-02' } },
  { id: 'S3', kind: 'paste', stress: 'John Lewis order of a Mint Velvet item', text: 'John Lewis\nThank you for your order\nOrder number: 7654321\nOrder date: 29 September 2026\nMint Velvet Cable Knit Jumper, Navy £89.00\nDelivery £4.50\nOrder total £93.50', expect: { store: 'John Lewis', pence: 9350, on: '2026-09-29' } },
  { id: 'S4', kind: 'paste', stress: 'Next order of a Crew Clothing item', text: 'NEXT\nThank you for your order\nOrder No: A1234567\nOrder date: 02/10/2026\nCrew Clothing Classic Rugby Shirt £49.00\nDelivery £3.99\nOrder total £52.99', expect: { store: 'Next', pence: 5299, on: '2026-10-02' } },
  { id: 'S5', kind: 'paste', stress: 'Argos collection "Argos in Sainsbury\'s"', text: 'Argos\nYour order is ready to collect\nOrder number: 1234567890\nOrder date: 3 October 2026\nCollect from: Argos in Sainsbury\'s Hove\nTefal kettle £29.99\nTotal £29.99', expect: { store: 'Argos', pence: 2999, on: '2026-10-03' } },
  { id: 'S6', kind: 'paste', stress: 'unknown shop (Very) "Your Apple iPad"', text: 'Very\nThanks for your order, Sam\nOrder number: 98765432\nOrder date: 1 October 2026\nYour Apple iPad 11-inch Wi-Fi 128GB is on its way\nTotal £349.00', expect: { store: null, pence: 34900, on: '2026-10-01' } },
  { id: 'S7', kind: 'paste', stress: 'Currys "Your Samsung Galaxy"', text: 'Currys\nOrder number: 87654321\nOrder date: 2 October 2026\nYour Samsung Galaxy S25 is on its way\nTotal £799.00', expect: { store: 'Currys', pence: 79900, on: '2026-10-02' } },
  { id: 'S8', kind: 'paste', stress: 'sister-brand footer (Simply Be email)', text: 'Simply Be\nThank you for your order\nOrder number: 12345678\nOrder date: 1 October 2026\nWrap dress £35.00\nTotal £35.00\nShop our family of brands: JD Williams | Jacamo | Simply Be', expect: { store: null, pence: 3500, on: '2026-10-01' } },
  { id: 'S9', kind: 'paste', stress: 'long promo footer naming other shops (unknown shop)', text: 'Wayfair\nOrder number: 4455667788\nOrder date: 30/09/2026\nOak side table £129.00\nTotal £129.00\n' + 'Prefer to shop in person? Find us next to Dunelm, IKEA and B&Q at retail parks nationwide. '.repeat(1) + '\nFree delivery on orders over £40. Download our app. Follow us on Instagram.', expect: { store: null, pence: 12900, on: '2026-09-30' } },
  { id: 'S10', kind: 'paste', stress: 'eBay order, item title mentions a shop brand', text: 'eBay\nYou paid for your item\nPaid on 1 Oct 2026\nNEW Decathlon Quechua 2 Second tent\nItem price £45.00\nPostage £5.00\nOrder total £50.00', expect: { store: null, pence: 5000, on: '2026-10-01' } },

  // ── OCR noise (photographed till receipts) ───────────────────────────
  { id: 'O1', kind: 'ocr', stress: '£ read as "E" on every price', text: "SAINSBURY'S\nBANANAS E1.20\nBREAD E1.45\nBALANCE DUE E2.65\n03/10/2026 12:01", expect: { store: "Sainsbury’s", pence: 265, on: '2026-10-03' } },
  { id: 'O2', kind: 'ocr', stress: '£ read as "f" on TOTAL only, items read clean', text: 'TESCO\nCOFFEE 4.50\nMILK 1.45\nSTAFF DISC -0.50\nTOTAL f5.45\n03/10/26 09:12', expect: { store: 'Tesco', pence: 545, on: '2026-10-03' } },
  { id: 'O3', kind: 'ocr', stress: 'O/0 and l/1 in the total', text: 'ARGOS\nKETTLE 29.99\nTOASTER 24.99\nTOTAL 54.9B\nVISA 54.98\n03/10/2026', expect: { store: 'Argos', pence: 5498, on: '2026-10-03' } },
  { id: 'O4', kind: 'ocr', stress: 'O for 0 in the date', text: 'BOOTS\nNO7 SERUM 38.00\nTOTAL 38.00\nO3/1O/2O26 11:15', expect: { store: 'Boots', pence: 3800, on: '2026-10-03' } },
  { id: 'O5', kind: 'ocr', stress: 'missing decimal point on TOTAL; discount makes item dearer than total', text: 'NEXT\nCOAT 89.00\nPROMO -20.00\nTOTAL 6900\n02/10/2026', expect: { store: 'Next', pence: 6900, on: '2026-10-02' } },
  { id: 'O6', kind: 'ocr', stress: 'broken line: TOTAL and figure split', text: 'IKEA\nLACK TABLE 15.00\nBILLY 45.00\nTOTAL\n60.00\n01/10/2026', expect: { store: 'IKEA', pence: 6000, on: '2026-10-01' } },
  { id: 'O7', kind: 'ocr', stress: 'quantity + product word starting "Mar"/"Dec" (phantom dates)', text: 'TESCO\n2 MARMITE 250G 9.00\n3 DECAF COFFEE 12.00\nTOTAL 21.00\n20/09/2026 18:02', expect: { store: 'Tesco', pence: 2100, on: '2026-09-20' } },
  { id: 'O8', kind: 'ocr', stress: 'shop heading misread (B00TS)', text: 'B00TS\nNO7 SERUM 38.00\nTOTAL 38.00\n03/10/2026', expect: { store: 'Boots', pence: 3800, on: '2026-10-03' } },
  { id: 'O9', kind: 'ocr', stress: 'till with item count before TOTAL', text: 'H&M\nJEANS 24.99\nT-SHIRT 9.99\n2 ITEMS TOTAL 34.98\nCARD 34.98\n02.10.2026', expect: { store: 'H&M', pence: 3498, on: '2026-10-02' } },
  { id: 'O10', kind: 'ocr', stress: 'item "TOTAL..." product line at the top of a till slip', text: 'BOOTS\nTOTAL CARE M/WASH 3.50\nNO7 SERUM 38.00\nTOTAL 41.50\n03/10/2026', expect: { store: 'Boots', pence: 4150, on: '2026-10-03' } },
  { id: 'O11', kind: 'ocr', stress: 'VAT summary table after the total', text: 'SCREWFIX\nDRILL 99.99\nTOTAL 99.99\nVAT RATE NET VAT TOTAL\nA 20% 83.33 16.66 99.99\n01/10/2026', expect: { store: 'Screwfix', pence: 9999, on: '2026-10-01' } },

  // ── non-UK currencies ────────────────────────────────────────────────
  { id: 'C1', kind: 'paste', stress: 'euro total, UK promo footer with £', text: 'Zara\nOrder date 29/09/2026\nTotal 45,95 €\nFree delivery on orders over £50 in the UK', expect: { store: 'Zara', pence: null, on: '2026-09-29' } },
  { id: 'C2', kind: 'paste', stress: 'US$ total, no £ at all, unknown shop', text: 'Thanks for your order\nOrder date: Oct 1, 2026\nTotal: $59.99 USD', expect: { store: null, pence: null, on: '2026-10-01' } },

  // ── HTML / eml through documents.ts ─────────────────────────────────
  { id: 'H1', kind: 'html', stress: 'stacked labels cell / stacked values cell (<br>)', text: '<html><body><p>Thanks for your order</p><p>Order date: 1 October 2026</p><table><tr><td>Kettle</td><td>&pound;39.99</td></tr><tr><td>Toaster</td><td>&pound;29.99</td></tr></table><table><tr><td>Subtotal<br>Delivery<br>Total</td><td>&pound;69.98<br>&pound;4.99<br>&pound;74.97</td></tr></table><p>Dunelm</p></body></html>', expect: { store: 'Dunelm', pence: 7497, on: '2026-10-01' } },
  { id: 'H2', kind: 'html', stress: 'pence in <sup> without a dot', text: '<html><body><h1>Argos</h1><p>Order date: 2 October 2026</p><table><tr><td>Total</td><td>&pound;54<sup>98</sup></td></tr></table></body></html>', expect: { store: 'Argos', pence: 5498, on: '2026-10-02' } },
  { id: 'H3', kind: 'html', stress: 'table header row Item/Qty/Total, then rows, then order total', text: '<html><body><p>Currys</p><p>Order date 01/10/2026</p><table><tr><th>Item</th><th>Qty</th><th>Total</th></tr><tr><td>Kettle</td><td>1</td><td>&pound;39.99</td></tr><tr><td>Toaster</td><td>1</td><td>&pound;29.99</td></tr></table><p>Subtotal &pound;69.98</p><p>Delivery &pound;4.99</p><p>Order total &pound;74.97</p></body></html>', expect: { store: 'Currys', pence: 7497, on: '2026-10-01' } },
  { id: 'H4', kind: 'html', stress: 'hidden preheader with a promo figure, real total in table', text: '<html><body><div style="display:none">Up to 50% off - free delivery over &pound;50</div><p>NEXT</p><p>Order date: 2 October 2026</p><table><tr><td>Order total</td><td>&pound;33.99</td></tr></table></body></html>', expect: { store: 'Next', pence: 3399, on: '2026-10-02' } },
  { id: 'E1', kind: 'eml', stress: '.eml dispatch email with no order date (Date header only)', text: eml('ASOS <orders@asos.com>', "Your order's on its way!", 'Sat, 03 Oct 2026 08:14:00 +0100', 'Order No. 123456789\nYour order has been dispatched.\nWide leg trousers £32.00\nTotal £32.00'), expect: { store: 'ASOS', pence: 3200, on: null } },
  { id: 'E2', kind: 'eml', stress: '.eml from Very, body names "Your Apple Watch"', text: eml('Very <noreply@very.co.uk>', 'Thanks for your order', 'Thu, 01 Oct 2026 10:00:00 +0100', 'Order number: 98765432\nOrder date: 1 October 2026\nYour Apple Watch Series 10 is on its way\nTotal £399.00'), expect: { store: null, pence: 39900, on: '2026-10-01' } },
  { id: 'E3', kind: 'eml', stress: '.eml John Lewis, item Oliver Bonas', text: eml('John Lewis <noreply@johnlewis.co.uk>', 'Your order confirmation', 'Tue, 29 Sep 2026 10:00:00 +0100', 'Order number: 7654321\nOrder date: 29 September 2026\nOliver Bonas ceramic vase £35.00\nOrder total £35.00'), expect: { store: 'John Lewis', pence: 3500, on: '2026-09-29' } },
];

/**
 * Cases written against the camera-misread corrections in `readScan`, each a
 * place a looser correction would read wrong: a product code that starts with
 * an E, a slip in euros, a pasted email whose "E1" and "f5" are real text, a
 * till that prints whole pounds, a dot-less total nothing on the slip proves,
 * a heading that becomes a shop only with its figures read as letters, and a
 * misread shop name on a line that is not the heading.
 * Held to the same rule as the audit's cases, beside them rather than among
 * them, so the audit stays the sixty-five it was measured on.
 */
export const MISREAD_GUARDS: Case[] = [
  { id: 'X1', kind: 'ocr', stress: 'bulb codes E27 and E14 at the start of item lines, no pence after the E', text: 'WICKES\nE27 LED BULB 4.99\nCARD 4.99\n03/10/2026', expect: { store: 'Wickes', pence: 499, on: '2026-10-03' } },
  { id: 'X2', kind: 'ocr', stress: 'a slip in euros whose € read as E: not a £ total', text: 'NEXT\nDUNDRUM\nT-SHIRT E5.00\nSOCKS E3.00\nTOTAL EUR E8.00\n03/10/2026', expect: { store: 'Next', pence: null, on: '2026-10-03' } },
  { id: 'X3', kind: 'paste', stress: 'pasted email with "E27", "code E1" and "press f5" as real text', text: 'Your Screwfix order\nOrder date: 3 October 2026\nPhilips LED bulb E27 £4.99\nUse code E1 on your next order\nIf this email does not display, press f5', expect: { store: 'Screwfix', pence: 499, on: '2026-10-03' } },
  { id: 'X4', kind: 'ocr', stress: 'whole-pound total with no point, nothing priced to prove it pence', text: 'JOHN LEWIS\nGIFT VOUCHER 120\nTOTAL 120\nCARD 120\n02/10/2026', expect: { store: 'John Lewis', pence: 12000, on: '2026-10-02' } },
  { id: 'X5', kind: 'ocr', stress: 'dot-less total the items do not add up to', text: 'NEXT\nCOAT 89.00\nSCARF 15.00\nTOTAL 9900\n02/10/2026', expect: { store: 'Next', pence: 9900, on: '2026-10-02' } },
  { id: 'X6', kind: 'ocr', stress: 'heading "A505", a road, that reads ASOS with its figures as letters', text: 'A505 SERVICES\nFUEL 45.00\nTOTAL 45.00\n03/10/2026', expect: { store: null, pence: 4500, on: '2026-10-03' } },
  { id: 'X7', kind: 'ocr', stress: 'unknown shop\'s slip with "B00TS" (walking boots) on an item line', text: 'TK MAXX\nB00TS 45.00\nTOTAL 45.00\n03/10/2026', expect: { store: null, pence: 4500, on: '2026-10-03' } },
];
