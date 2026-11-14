import { describe, expect, it } from 'vitest';
import { MAX_REPORT_TEXT, misreadMailto, misreadReport, redactPersonal } from '../src/lib/misread-report';

/**
 * The one message that can carry a purchase off the phone, and only by the
 * person's own send. Two things are held here: what identifies the PERSON is
 * taken out, and what the reader needs to be fixed is left in.
 */
const PARSED = { store: 'Currys', amount: 8900, purchasedOn: '2026-11-02', dateFound: true, arrivedOn: null, item: 'Headphones', orderRef: 'CUR-99812', windowDays: 30 };

describe('what is taken out', () => {
  it('removes email addresses, postcodes and phone numbers', () => {
    const out = redactPersonal('Sent to sam.jones+shop@example.co.uk\nDeliver to 12 High St, Leeds LS1 4AP\nCall 07700 900123 or +44 20 7946 0958 or 0161 496 0123');
    expect(out).not.toMatch(/example\.co\.uk|LS1|4AP|07700|7946|0161/);
    expect(out).toContain('[email]');
    expect(out).toContain('[postcode]');
    expect(out.match(/\[phone\]/g)).toHaveLength(3);
  });

  it('removes the name in a greeting, and leaves a greeting with none', () => {
    expect(redactPersonal('Hi Samira,\nThanks for your order')).toBe('Hi [name],\nThanks for your order');
    expect(redactPersonal('Dear Mr Okafor,')).toBe('Dear [name],');
    expect(redactPersonal('Hello there,')).toBe('Hello there,');
    expect(redactPersonal('Dear customer,')).toBe('Dear customer,');
  });

  it('leaves what the reader is fixed from: order numbers, totals and dates', () => {
    const keep = 'Order #026-1234567-1234567\nOrder number: 0123456789012\nOrder ref 01234567890\nTracking: 0770 090 0123\nTotal £1,299.00\nPlaced 2 November 2026\nRef CUR-99812';
    expect(redactPersonal(keep)).toBe(keep);
  });

  it('does not mistake a price or a short number for a phone', () => {
    const keep = 'Qty 2 at 0800 each\nItem 0123 456';
    expect(redactPersonal(keep)).toBe(keep);
  });
});

describe('the message', () => {
  const text = 'Hi Sam,\nYour Currys order CUR-99812\nTotal £89.00\nsam@example.com';

  it('says what was read, and carries the text redacted', () => {
    const report = misreadReport({ version: '1.2.3', text, parsed: PARSED, from: 'paste' });
    expect(report).toContain('Quids In 1.2.3 read this order email wrong.');
    expect(report).toContain('Shop: Currys');
    expect(report).toContain('Total: £89.00');
    expect(report).toContain('Order number: CUR-99812');
    expect(report).toContain('Hi [name],');
    expect(report).not.toContain('sam@example.com');
    expect(report).not.toContain('Hi Sam');
  });

  it('says what it could not find, rather than leaving a blank', () => {
    const report = misreadReport({ version: '1', text: 'x', from: 'photo', parsed: { ...PARSED, store: null, amount: null, dateFound: false, item: null, orderRef: null } });
    expect(report).toContain('photographed receipt');
    expect(report).toContain('Shop: not recognised');
    expect(report).toContain('Total: none found');
    expect(report).toContain('Bought: no date found');
    expect(report).toContain('Order number: none found');
  });

  it('cuts a very long paste, and says it did', () => {
    const report = misreadReport({ version: '1', text: 'a'.repeat(MAX_REPORT_TEXT + 500), parsed: PARSED, from: 'paste' });
    expect(report).toContain(`the first ${MAX_REPORT_TEXT} characters`);
    expect(report).not.toContain('a'.repeat(MAX_REPORT_TEXT + 1));
  });

  it('redacts before it cuts, so a cut cannot leave half an address behind', () => {
    const tail = 'x'.repeat(MAX_REPORT_TEXT - 10) + ' sam@example.com';
    const report = misreadReport({ version: '1', text: tail, parsed: PARSED, from: 'paste' });
    expect(report).not.toMatch(/sam@|example\.com/);
  });

  it('the mail link decodes back to exactly the message shown', () => {
    const report = misreadReport({ version: '1.2.3', text, parsed: PARSED, from: 'paste' });
    const link = misreadMailto('hello@getquidsin.co.uk', report);
    expect(link.startsWith('mailto:hello@getquidsin.co.uk?subject=')).toBe(true);
    expect(decodeURIComponent(link.split('&body=')[1])).toBe(report);
  });
});
