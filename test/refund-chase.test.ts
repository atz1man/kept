import { describe, expect, it } from 'vitest';
import { REFUND_CHASE_DAYS } from '../src/lib/alerts';
import { addDays, toISODate } from '../src/lib/dates';
import { REPLY_DAYS } from '../src/lib/fault-letter';
import { COOLING_OFF_DAYS } from '../src/lib/legal';
import { toPence } from '../src/lib/money';
import { MAX_RETURN_REF, readReturnRef, refundChase, refundChaseLine, refundLetter } from '../src/lib/refund-chase';
import type { Receipt } from '../src/lib/types';

const TODAY = new Date(2026, 7, 28);
const iso = (n: number) => toISODate(addDays(TODAY, n));

/** Ordered online, sent back `sentAgo` days ago, `boughtAgo` days after it was ordered. */
const posted = (sentAgo: number, boughtAgo: number, over: Partial<Receipt> = {}): Receipt => ({
  id: 'r', store: 'ASOS', item: 'Wool coat', cat: 'clothing', amount: toPence(120),
  purchasedOn: iso(-boughtAgo), windowDays: 28, policy: 'p', distance: true,
  status: 'sent', sentOn: iso(-sentAgo),
  ...over,
});

describe('when a refund is late', () => {
  it('is not before the fourteenth day after it went, and is on it', () => {
    expect(refundChase(posted(REFUND_CHASE_DAYS - 1, 20), TODAY)?.late).toBe(false);
    expect(refundLetter(posted(REFUND_CHASE_DAYS - 1, 20), TODAY)).toBeNull();
    expect(refundChase(posted(REFUND_CHASE_DAYS, 20), TODAY)?.late).toBe(true);
    expect(refundLetter(posted(REFUND_CHASE_DAYS, 20), TODAY)).not.toBeNull();
  });

  it('is never, for a receipt that has not gone back or whose refund has come', () => {
    expect(refundChase(posted(30, 40, { status: 'active', sentOn: undefined }), TODAY)).toBeNull();
    expect(refundChase(posted(30, 40, { status: 'returned', returnedOn: iso(-1) }), TODAY)).toBeNull();
    expect(refundChase(posted(30, 40, { sentOn: undefined }), TODAY)).toBeNull();
  });
});

describe('whether the regulations apply', () => {
  it('is an online order sent back inside the cancellation period, up to and including its last day', () => {
    expect(refundChase(posted(20, 20 + COOLING_OFF_DAYS), TODAY)?.statutory).toBe(true);
    expect(refundChase(posted(20, 20 + COOLING_OFF_DAYS + 1), TODAY)?.statutory).toBe(false);
  });

  it('counts from the day it arrived, where that is known', () => {
    const late = posted(20, 40);
    expect(refundChase(late, TODAY)?.statutory).toBe(false);
    expect(refundChase({ ...late, arrivedOn: iso(-30) }, TODAY)?.statutory).toBe(true);
  });

  it('is never a counter purchase, however soon it went back', () => {
    expect(refundChase(posted(20, 21, { distance: false }), TODAY)?.statutory).toBe(false);
  });
});

describe('the letter', () => {
  it('cites regulation 34 for a cancelled online order, with the dates and the price', () => {
    const letter = refundLetter(posted(20, 25), TODAY)!;
    expect(letter).toContain('regulation 34');
    expect(letter).toContain('I cancelled the order');
    expect(letter).toContain('£120.00');
    expect(letter).toContain(`within ${REFUND_CHASE_DAYS} days`);
    expect(letter).toContain(`Please reply within ${REPLY_DAYS} days`);
  });

  it('names no law for a return the regulations do not cover, and does not claim a cancellation', () => {
    for (const r of [posted(20, 60), posted(20, 21, { distance: false })]) {
      const letter = refundLetter(r, TODAY)!;
      expect(letter).not.toMatch(/regulation|Regulations|cancel/i);
      expect(letter).toContain('Please make it now, or tell me why it has not been made.');
    }
  });

  it('carries the tracking number where one was kept, and says nothing of one where not', () => {
    expect(refundLetter(posted(20, 25, { returnRef: 'JD0002 1234' }), TODAY)).toContain('The tracking reference is JD0002 1234.');
    expect(refundLetter(posted(20, 25), TODAY)).not.toContain('tracking');
  });

  it('quotes the order number under the subject, where one was kept', () => {
    expect(refundLetter(posted(20, 25, { orderRef: 'W1234567' }), TODAY)).toContain('Refund not received: Wool coat\nOrder number: W1234567\n');
    expect(refundLetter(posted(20, 25), TODAY)).not.toContain('Order number');
  });

  it('says what the panel above it says about the law', () => {
    expect(refundChaseLine(refundChase(posted(20, 25), TODAY)!)).toContain('cancellation period');
    expect(refundChaseLine(refundChase(posted(20, 60), TODAY)!)).not.toContain('cancellation');
  });
});

describe('reading a tracking number', () => {
  it('tidies spacing, keeps case, and reads nothing as none', () => {
    expect(readReturnRef('  vg 1234  5678 GB ')).toEqual({ ok: true, ref: 'vg 1234 5678 GB' });
    expect(readReturnRef('   ')).toEqual({ ok: true, ref: null });
  });

  it('takes the longest a courier prints, and refuses longer', () => {
    expect(readReturnRef('X'.repeat(MAX_RETURN_REF)).ok).toBe(true);
    expect(readReturnRef('X'.repeat(MAX_RETURN_REF + 1)).ok).toBe(false);
  });
});
