import { describe, expect, it } from 'vitest';
import { addDays, addMonths, toISODate } from '../src/lib/dates';
import { CLAIM_YEARS, REPLY_DAYS, faultAdvice, faultLetter } from '../src/lib/fault-letter';
import { PRESUMED_FAULT_MONTHS, REJECT_DAYS } from '../src/lib/legal';
import { toPence } from '../src/lib/money';
import type { Receipt } from '../src/lib/types';

const TODAY = new Date(2026, 7, 28);

/** Bought over a counter, so it was handed over the day it was paid for. */
const counter = (purchasedOn: Date, over: Partial<Receipt> = {}): Receipt => ({
  id: 'r', store: 'Currys', item: 'Bosch dishwasher', cat: 'kitchen', amount: toPence(429),
  purchasedOn: toISODate(purchasedOn), windowDays: 30, policy: 'p', distance: false, status: 'kept',
  ...over,
});
const remedyOn = (bought: Date, over: Partial<Receipt> = {}) => faultAdvice(counter(bought, over), TODAY).remedy;

describe('which remedy today falls in', () => {
  it('is the right to reject, up to and including its last day', () => {
    expect(remedyOn(addDays(TODAY, -REJECT_DAYS))).toBe('reject');
    expect(remedyOn(addDays(TODAY, -(REJECT_DAYS + 1)))).toBe('repair-presumed');
  });

  it('is a repair with the fault presumed, up to the last day of the presumption', () => {
    // Section 19(14): "the period of six months beginning with the day on
    // which the goods were delivered". Beginning WITH it, so delivered on 15
    // January, the last day is 14 July. This test had a 28 February delivery
    // still presumed on 28 August: the first day after the six months.
    const delivered = new Date(2026, 0, 15);
    expect(faultAdvice(counter(delivered), new Date(2026, 6, 14)).remedy).toBe('repair-presumed');
    expect(faultAdvice(counter(delivered), new Date(2026, 6, 15)).remedy).toBe('repair');
    expect(remedyOn(addMonths(TODAY, -PRESUMED_FAULT_MONTHS))).toBe('repair');
    expect(remedyOn(addDays(addMonths(TODAY, -PRESUMED_FAULT_MONTHS), 1))).toBe('repair-presumed');
    expect(remedyOn(addDays(addMonths(TODAY, -PRESUMED_FAULT_MONTHS), -1))).toBe('repair');
  });

  it('counts the six months as whole calendar months, at either end of one', () => {
    // From 1 March: March to August, so 31 August is presumed and 1 September
    // is not. (Stepping back a day and on six months says 28 August.)
    const march = counter(new Date(2026, 2, 1));
    expect(faultAdvice(march, new Date(2026, 7, 31)).remedy).toBe('repair-presumed');
    expect(faultAdvice(march, new Date(2026, 8, 1)).remedy).toBe('repair');
    // From 31 August there is no 31 February, and the six months run to the
    // end of it. (The same date six months on, less a day, says the 27th.)
    const august = counter(new Date(2026, 7, 31));
    expect(faultAdvice(august, new Date(2027, 1, 28)).remedy).toBe('repair-presumed');
    expect(faultAdvice(august, new Date(2027, 2, 1)).remedy).toBe('repair');
  });

  it('is a repair the buyer has to prove, up to the limitation period, and then nothing', () => {
    expect(remedyOn(addMonths(TODAY, -CLAIM_YEARS * 12))).toBe('repair');
    expect(remedyOn(addDays(addMonths(TODAY, -CLAIM_YEARS * 12), -1))).toBe('too-late');
  });

  it('counts from the day it arrived, where that is known', () => {
    const ordered = addDays(TODAY, -45);
    expect(remedyOn(ordered, { distance: true })).toBe('repair-presumed');
    expect(remedyOn(ordered, { distance: true, arrivedOn: toISODate(addDays(TODAY, -20)) })).toBe('reject');
  });

  it('says a date counted from the order is a floor, and how to move it', () => {
    const a = faultAdvice(counter(addDays(TODAY, -10), { distance: true }), TODAY);
    expect(a.hedged).toBe(true);
    expect(a.headline).toMatch(/until at least/);
    expect(a.explain).toMatch(/add that date with Edit/);
    const exact = faultAdvice(counter(addDays(TODAY, -10)), TODAY);
    expect(exact.hedged).toBe(false);
    expect(exact.headline).not.toMatch(/at least/);
    // Delivered, and the day it arrived is known: plain dates, no pointer to Edit.
    const arrived = faultAdvice(counter(addDays(TODAY, -10), { distance: true, arrivedOn: toISODate(addDays(TODAY, -8)) }), TODAY);
    expect(arrived.hedged).toBe(false);
    expect(arrived.headline).not.toMatch(/at least/);
    expect(arrived.explain).not.toMatch(/Edit/);
  });

  it('is the statute’s numbers', () => {
    expect(CLAIM_YEARS).toBe(6);
    // Ours, and deliberately not presented as the law's.
    expect(REPLY_DAYS).toBe(14);
  });
});

describe('the letter', () => {
  it('rejects for a full refund inside the thirty days, and does not offer a repair', () => {
    const letter = faultLetter(counter(addDays(TODAY, -5)), TODAY, 'It leaks from the door seal')!;
    expect(letter).toMatch(/^Dear Currys,/);
    expect(letter).toContain('I bought “Bosch dishwasher” from you for £429.00');
    expect(letter).toContain('The problem: It leaks from the door seal.');
    expect(letter).toContain('short-term right to reject (section 22)');
    expect(letter).toContain('full refund');
    expect(letter).not.toContain('section 23');
  });

  it('asks for a repair, and cites the presumption, inside the six months', () => {
    const letter = faultLetter(counter(addMonths(TODAY, -3)), TODAY, '')!;
    expect(letter).toContain('It has developed a fault.');
    expect(letter).toContain('(section 23)');
    expect(letter).toContain('(section 19(14))');
    expect(letter).toContain('(section 24)');
    expect(letter).not.toContain('section 22');
  });

  it('cites the presumption on its last day, and not the day after', () => {
    // Delivered 15 January: six months beginning with that day end on 14 July.
    // Written on 15 July, the letter told the shop the fault was presumed.
    const kettle = counter(new Date(2026, 0, 15));
    expect(faultLetter(kettle, new Date(2026, 6, 14), 'It stopped heating')).toContain('(section 19(14))');
    const after = faultLetter(kettle, new Date(2026, 6, 15), 'It stopped heating')!;
    expect(after).toContain('(section 23)');
    expect(after).not.toContain('19(14)');
  });

  it('does not claim the presumption once it has gone', () => {
    const letter = faultLetter(counter(addMonths(TODAY, -20)), TODAY, 'The pump failed')!;
    expect(letter).toContain('(section 23)');
    expect(letter).not.toContain('19(14)');
  });

  it('is not written for a claim that is out of time', () => {
    expect(faultLetter(counter(addMonths(TODAY, -CLAIM_YEARS * 12 - 1)), TODAY, 'x')).toBeNull();
  });

  it('names the delivery date when it differs from the order', () => {
    const r = counter(addDays(TODAY, -12), { distance: true, arrivedOn: toISODate(addDays(TODAY, -8)) });
    expect(faultLetter(r, TODAY, '')!).toMatch(/, and it was delivered on \d+ \w+ \d{4}\./);
    expect(faultLetter(counter(addDays(TODAY, -12)), TODAY, '')!).not.toContain('delivered on');
  });

  it('takes the fault as the person wrote it, tidied to one line and one full stop', () => {
    const letter = faultLetter(counter(addDays(TODAY, -5)), TODAY, '  Screen went black\n after a week!  ')!;
    expect(letter).toContain('The problem: Screen went black after a week!\n');
  });

  it('asks for a reply in the days it says', () => {
    expect(faultLetter(counter(addDays(TODAY, -5)), TODAY, '')!).toContain(`Please reply within ${REPLY_DAYS} days`);
  });
});

describe('the order number, in the letter', () => {
  it('is quoted under the heading when known, and absent when not', () => {
    const withRef = faultLetter(counter(addDays(TODAY, -5), { orderRef: '204-1234567-7654321' }), TODAY, '')!;
    expect(withRef.split('\n').slice(0, 5)).toEqual(['Dear Currys,', '', 'Faulty goods: Bosch dishwasher', 'Order number: 204-1234567-7654321', '']);
    expect(faultLetter(counter(addDays(TODAY, -5)), TODAY, '')!).not.toContain('Order number');
  });
});
