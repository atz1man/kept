import { describe, expect, it } from 'vitest';
import { addDays, addMonths, fmtDateLong, toISODate } from '../src/lib/dates';
import { CLAIM_YEARS, finalRejectLetter } from '../src/lib/fault-letter';
import { PRESUMED_FAULT_MONTHS } from '../src/lib/legal';
import { toPence } from '../src/lib/money';
import type { Receipt } from '../src/lib/types';

/*
 * The first fault letter promises what comes next — "if a repair or
 * replacement does not put this right, I will be entitled to … reject the
 * goods for a refund (section 24)" — and nothing in the app followed it.
 */

const TODAY = new Date(2026, 7, 28);
/** Delivered `ago` days before TODAY, a fault letter sent a fortnight later. */
const faulty = (ago: number, over: Partial<Receipt> = {}): Receipt => ({
  id: 'a', store: 'Currys', item: 'Kettle', cat: 'kitchen', amount: toPence(40),
  purchasedOn: toISODate(addDays(TODAY, -ago)), windowDays: 30, policy: 'p', distance: false, status: 'kept',
  keptOn: toISODate(addDays(TODAY, -ago)), faultClaim: { sentOn: toISODate(addDays(TODAY, -ago + 14)) },
  ...over,
});

describe('the final right to reject, after a repair that did not work', () => {
  it('is written only once a fault letter has gone', () => {
    expect(finalRejectLetter(faulty(60, { faultClaim: undefined }), TODAY, '')).toBeNull();
    expect(finalRejectLetter(faulty(60), TODAY, '')).not.toBeNull();
  });

  it('names section 24(5), the day the fault was reported, and asks for a refund', () => {
    const letter = finalRejectLetter(faulty(60, { orderRef: 'CU-9' }), TODAY, 'It still trips the fuse')!;
    expect(letter.split('\n').slice(0, 4)).toEqual(['Dear Currys,', '', 'Final right to reject: Kettle', 'Order number: CU-9']);
    expect(letter).toContain(`I wrote to you about a fault on ${fmtDateLong(addDays(TODAY, -46))}, and the goods were repaired or replaced, but the fault has not been put right. The problem now: It still trips the fuse.`);
    expect(letter).toContain('section 24(5)');
    expect(letter).toContain('I am exercising my final right to reject them, and I am asking for a refund.');
  });

  it('says no deduction for use within six months of delivery, and says nothing about one after', () => {
    const inside = addMonths(TODAY, -PRESUMED_FAULT_MONTHS);
    const daysSince = (d: Date) => Math.round((TODAY.getTime() - d.getTime()) / 86_400_000);
    expect(finalRejectLetter(faulty(daysSince(inside)), TODAY, '')).toContain('section 24(10)');
    expect(finalRejectLetter(faulty(daysSince(inside) + 1), TODAY, '')).not.toContain('24(10)');
    expect(finalRejectLetter(faulty(daysSince(inside) + 1), TODAY, '')).not.toMatch(/deduct/i);
  });

  it('is not written once the claim is out of time', () => {
    const old = Math.round((TODAY.getTime() - addMonths(TODAY, -CLAIM_YEARS * 12 - 1).getTime()) / 86_400_000);
    expect(finalRejectLetter(faulty(old), TODAY, '')).toBeNull();
  });
});
