import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  bestReading, bytesToBinary, emailAsText, fromPdfJs, htmlToText, kindOf, looksScanned, pdfLines, readEmail,
  type PdfJsItem,
} from '../src/lib/documents';
import { parseReceiptText } from '../src/lib/parse';
import { asEml, asHtml, slug } from './fixtures/documents';
import { ORDER_EMAILS, type OrderEmail } from './fixtures/order-emails';

/**
 * Receipts that arrive as files. The corpus in order-emails.ts is the
 * standard: every layout the parser reads as pasted text it must read the
 * same from the saved email, the HTML, and the PDF — so a reader that loses a
 * line, splits a label from its figure or mangles a £ is caught on the
 * layout where it does.
 */
const TODAY = new Date(2026, 8, 28);
const enc = (s: string) => new TextEncoder().encode(s);

function expectRead(text: string, e: OrderEmail) {
  const out = parseReceiptText(text, TODAY);
  if (!out.ok) throw new Error(`did not parse: ${out.reason}\n${text}`);
  const v = out.value;
  expect({ store: v.store, pence: v.amount, purchasedOn: v.purchasedOn, item: v.item }).toEqual({
    store: e.expect.store, pence: e.expect.pence, purchasedOn: e.expect.purchasedOn, item: e.expect.item,
  });
  if (e.expect.orderRef !== undefined) expect(v.orderRef).toBe(e.expect.orderRef);
  if (e.expect.arrivedOn !== undefined) expect(v.arrivedOn).toBe(e.expect.arrivedOn);
}

const PDFS = join(__dirname, 'fixtures', 'documents');

async function pdfText(bytes: Uint8Array): Promise<string> {
  const task = getDocument({ data: bytes, disableFontFace: true, useSystemFonts: false });
  const doc = await task.promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) pages.push(fromPdfJs((await (await doc.getPage(n)).getTextContent()).items as PdfJsItem[]));
  await task.destroy();
  return pdfLines(pages);
}

describe('what a file is', () => {
  it('goes by its bytes before its name', () => {
    expect(kindOf('receipt.txt', 'text/plain', enc('%PDF-1.7\n'))).toBe('pdf');
    expect(kindOf('attachment.bin', '', new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image');
    expect(kindOf('x', '', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe('image');
    expect(kindOf('IMG_0001', '', new Uint8Array([0, 0, 0, 0x18, ...enc('ftypheic')]))).toBe('image');
    expect(kindOf('order', '', enc('Return-Path: <a@b>\r\nFrom: ASOS <x@asos.com>\r\nSubject: Thanks\r\n\r\nbody'))).toBe('email');
    expect(kindOf('order.txt', 'text/plain', enc('<!DOCTYPE html><html>'))).toBe('html');
  });

  it('falls back to the name and type when the bytes say nothing', () => {
    expect(kindOf('invoice.PDF', '', new Uint8Array())).toBe('pdf');
    expect(kindOf('order.eml', '', enc('hello'))).toBe('email');
    expect(kindOf('page.htm', '', enc('hello'))).toBe('html');
    expect(kindOf('notes', '', enc('Total £12.00\n'))).toBe('text');
    expect(kindOf('blob', '', new Uint8Array([0, 1, 2, 3, 0, 0, 0, 0]))).toBe('unknown');
  });

  it('does not take a line of prose with a colon for an email', () => {
    expect(kindOf('n.txt', 'text/plain', enc('Note: bought at the market\nTotal £5.00'))).toBe('text');
    // One header-shaped line is a note that starts with a date; a message has a block of them.
    expect(kindOf('n.txt', 'text/plain', enc('Date: 3 October 2026\nTotal £5.00\n'))).toBe('text');
  });
});

describe('HTML into lines', () => {
  it('keeps a label and the figure in the next cell on one line', () => {
    expect(htmlToText('<table><tr><td>Order total</td><td align="right">&pound;89.00</td></tr></table>')).toBe('Order total £89.00');
  });

  it('drops what is never read — scripts, styles, comments, the head', () => {
    const t = htmlToText('<html><head><title>T</title><style>p{}</style></head><body><!-- x --><p>Hi</p><script>alert(1)</script></body></html>');
    expect(t).toBe('Hi');
  });

  it('decodes the entities an order email uses, named and numbered', () => {
    expect(htmlToText('<p>M&amp;S&nbsp;&#8211; &#x00A3;5 &rsquo;s &bogus;</p>')).toBe('M&S – £5 ’s &bogus;');
  });
});

describe('a saved email', () => {
  it('reads its sender, subject and the day it was sent', () => {
    const e = readEmail(asEml(ORDER_EMAILS[0]));
    expect(e.from).toBe(ORDER_EMAILS[0].expect.store);
    expect(e.subject).toBe('Your order — thank you');
    expect(e.sent?.toISOString()).toBe('2026-09-28T08:00:00.000Z');
    expect(e.bodies).toHaveLength(2);
  });

  it('decodes base64 and quoted-printable bodies back to the same text, £ intact', () => {
    const e = readEmail(asEml(ORDER_EMAILS[1]));
    expect(e.bodies[0]).toBe(ORDER_EMAILS[1].text.trim());
    expect(e.bodies[1]).toContain('£');
    expect(e.bodies[1]).not.toMatch(/=[0-9A-F]{2}|&pound;|<td/);
  });

  it('reads a body that declares no charset and is not UTF-8 as Windows-1252', () => {
    const raw = 'From: Shop <a@b>\r\nContent-Type: text/plain\r\nContent-Transfer-Encoding: 8bit\r\n\r\nTotal \xa389.00\r\n';
    expect(readEmail(raw).bodies[0]).toBe('Total £89.00');
    // And real UTF-8 stays UTF-8.
    expect(readEmail(bytesToBinary(enc('Content-Type: text/plain\r\n\r\nTotal £89.00 – thanks'))).bodies[0]).toBe('Total £89.00 – thanks');
  });

  it('decodes a Latin-1 body as Latin-1', () => {
    const raw = 'From: Shop <a@b>\r\nContent-Type: text/plain; charset=iso-8859-1\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nTotal =A389.00\r\n';
    expect(readEmail(raw).bodies[0]).toBe('Total £89.00');
  });

  it('names the shop from the sender when the body never does', () => {
    const raw = [
      'From: "Currys" <orders@mail.example>',
      'Subject: Thanks for your order',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<table><tr><td>Thanks for your order - 21/09/2026</td></tr><tr><td>Total</td><td>&pound;29.99</td></tr></table>',
    ].join('\r\n');
    const mail = readEmail(raw);
    const out = parseReceiptText(emailAsText(mail, mail.bodies[0]), TODAY);
    expect(out.ok && out.value.store).toBe('Currys');
    expect(out.ok && out.value.amount).toBe(2999);
  });

  it('reads no body out of what follows the closing boundary', () => {
    const raw = [
      'From: Shop <a@b>',
      'Content-Type: multipart/alternative; boundary="b1"',
      '',
      '--b1',
      'Content-Type: text/plain',
      '',
      'Total £12.00',
      '--b1--',
      '',
      'This epilogue is not part of any body. Total £999.00',
    ].join('\r\n');
    expect(readEmail(raw).bodies).toEqual(['Total £12.00']);
  });

  it('does not read a text file attached to the email as the order', () => {
    const raw = [
      'From: Shop <a@b>',
      'Content-Type: multipart/mixed; boundary="b1"',
      '',
      '--b1',
      'Content-Type: text/html',
      '',
      '<p>Total &pound;12.00</p>',
      '--b1',
      'Content-Type: text/plain; name="terms.txt"',
      'Content-Disposition: attachment; filename="terms.txt"',
      '',
      'Restocking fee up to £999.00',
      '--b1--',
    ].join('\r\n');
    expect(readEmail(raw).bodies).toEqual(['Total £12.00']);
  });

  it('carries a PDF attachment out, bytes intact', () => {
    const pdf = new Uint8Array(readFileSync(join(PDFS, `${slug(ORDER_EMAILS[2])}.pdf`)));
    const e = readEmail(asEml(ORDER_EMAILS[2], { pdf }));
    expect(e.attachments).toHaveLength(1);
    expect(e.attachments[0].name).toBe('invoice.pdf');
    expect(e.attachments[0].bytes).toEqual(pdf);
  });

  it('reads a file\'s bytes as the message, not as UTF-8 first', () => {
    // A base64 part survives a binary round trip only if no byte is reinterpreted.
    const e = readEmail(bytesToBinary(enc(asEml(ORDER_EMAILS[3]))));
    expect(e.bodies[0]).toBe(ORDER_EMAILS[3].text.trim());
  });
});

describe('the corpus, as each kind of file', () => {
  it.each(ORDER_EMAILS.map((e) => [e.name, e] as const))('as a saved email: %s', (_n, e) => {
    const mail = readEmail(asEml(e));
    expectRead(emailAsText(mail, bestReading(mail.bodies, TODAY)!), e);
  });

  it.each(ORDER_EMAILS.map((e) => [e.name, e] as const))('as an HTML-only email: %s', (_n, e) => {
    const mail = readEmail(asEml(e, { plain: false }));
    expect(mail.bodies).toHaveLength(1);
    expectRead(emailAsText(mail, mail.bodies[0]), e);
  });

  it.each(ORDER_EMAILS.map((e) => [e.name, e] as const))('as a saved web page: %s', (_n, e) => {
    expectRead(htmlToText(asHtml(e)), e);
  });

  it('has a PDF for every entry — run scripts/make-document-fixtures.mjs if not', () => {
    for (const e of ORDER_EMAILS) expect(() => readFileSync(join(PDFS, `${slug(e)}.pdf`)), e.name).not.toThrow();
  });

  it.each(ORDER_EMAILS.map((e) => [e.name, e] as const))('as a PDF: %s', async (_n, e) => {
    const text = await pdfText(new Uint8Array(readFileSync(join(PDFS, `${slug(e)}.pdf`))));
    expect(looksScanned(text)).toBe(false);
    expectRead(text, e);
  });
});

describe('PDF lines', () => {
  it('puts runs drawn in column order back on the lines they sit on', () => {
    // Labels drawn first, then figures — the order an invoice draws them.
    const items = [
      { str: 'Subtotal', x: 50, y: 700, width: 50, height: 10 },
      { str: 'Total', x: 50, y: 680, width: 30, height: 10 },
      { str: '£80.00', x: 400, y: 700.6, width: 40, height: 10 },
      { str: '£89.00', x: 400, y: 680, width: 40, height: 10 },
    ];
    expect(pdfLines([items])).toBe('Subtotal £80.00\nTotal £89.00');
  });

  it('joins a word split across runs without a space, and spaces a gap', () => {
    const items = [
      { str: 'Tot', x: 50, y: 700, width: 15, height: 10 },
      { str: 'al', x: 65, y: 700, width: 10, height: 10 },
      { str: '£5.00', x: 120, y: 700, width: 30, height: 10 },
    ];
    expect(pdfLines([items])).toBe('Total £5.00');
  });

  it('calls a page with no text a picture of one', () => {
    expect(looksScanned('')).toBe(true);
    expect(looksScanned(' \n 1 ')).toBe(true);
    // A scanned PDF often carries a printed page number and nothing else as text.
    expect(looksScanned('Page 1 of 1')).toBe(true);
    expect(looksScanned('Total £89.00 Order 1234')).toBe(false);
  });
});

describe('choosing between readings', () => {
  it('takes the reading the parser gets most from, and the first on a tie', () => {
    const thin = 'Thanks for shopping with us';
    const full = ORDER_EMAILS[0].text;
    expect(bestReading([thin, full], TODAY)).toBe(full);
    expect(bestReading([full, `${full}\n`], TODAY)).toBe(full);
    expect(bestReading([], TODAY)).toBeNull();
  });
});
