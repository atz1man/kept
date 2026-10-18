import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addDays, toISODate } from '../src/lib/dates';
import { faultLetter } from '../src/lib/fault-letter';
import { toPence } from '../src/lib/money';
import { refundLetter } from '../src/lib/refund-chase';
import { hasBlanks, signOff } from '../src/lib/sign-off';
import type { Receipt } from '../src/lib/types';

/**
 * Every letter to a shop says who it is from. Each one stopped at "Yours
 * faithfully," — found by walking the app and pasting one into an email,
 * which then went to a returns team from nobody.
 */
const TODAY = new Date(2026, 7, 28);
const iso = (n: number) => toISODate(addDays(TODAY, n));
const receipt = (over: Partial<Receipt>): Receipt => ({
  id: 'r', store: 'Currys', item: 'Kettle', cat: 'kitchen', amount: toPence(40),
  purchasedOn: iso(-5), windowDays: 30, policy: 'p', distance: false, status: 'kept',
  ...over,
});

describe('how a letter ends', () => {
  it('closes with a name to fill in, and an address where the model form asks for one', () => {
    expect(signOff()).toEqual(['Yours faithfully,', '', '[Your name]']);
    expect(signOff({ address: true })).toEqual(['Yours faithfully,', '', '[Your name]', '[Your address]']);
  });

  it('is how the fault letter and the refund chase end', () => {
    const fault = faultLetter(receipt({}), TODAY, 'It leaks')!;
    const chase = refundLetter(receipt({ status: 'sent', sentOn: iso(-20), purchasedOn: iso(-25), distance: true }), TODAY)!;
    for (const letter of [fault, chase]) {
      expect(letter.endsWith('Yours faithfully,\n\n[Your name]')).toBe(true);
      expect(hasBlanks(letter)).toBe(true);
    }
  });

  it('is written in one place, so no letter can be added that ends at the close', () => {
    const lib = join(__dirname, '..', 'src', 'lib');
    const closes = readdirSync(lib)
      .filter((f) => f.endsWith('.ts') && f !== 'sign-off.ts')
      .filter((f) => readFileSync(join(lib, f), 'utf8').includes("'Yours faithfully,'"));
    expect(closes).toEqual([]);
  });

  it('says nothing about blanks once they are filled in', () => {
    expect(hasBlanks('Yours faithfully,\n\nJane Smith')).toBe(false);
  });
});
