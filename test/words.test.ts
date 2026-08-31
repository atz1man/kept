import { describe, expect, it } from 'vitest';
import { midSentence, winSentence } from '../src/lib/words';
import { seedReceipts } from '../src/lib/seed';

describe('fitting an item name into the middle of a sentence', () => {
  it.each([
    ['Wool-blend overcoat', 'Wool-blend overcoat'],
    ['No7 skincare set', 'No7 skincare set'],
    ['JBL Tune 770NC headphones', 'JBL Tune 770NC headphones'],
    ['iPhone 18 Pro', 'iPhone 18 Pro'],
    ['MALM chest of 6 drawers', 'MALM chest of 6 drawers'],
    ['  Wool-blend overcoat  ', 'Wool-blend overcoat'],
    ['', ''],
  ])('renders %j as %j', (given, expected) => {
    expect(midSentence(given)).toBe(expected);
  });

  it('does not lower-case a brand', () => {
    // The rule that used to run here lower-cased the first word when it
    // looked ordinary, which "Kenwood" does — so the hero read "9 days left
    // to return your kenwood kMix stand mixer": a proper noun misspelled, on
    // the one word the reader has to recognise.
    expect(midSentence('Kenwood kMix stand mixer')).toBe('Kenwood kMix stand mixer');
    expect(midSentence('Sony headphones')).toBe('Sony headphones');
  });

  it('leaves every seeded item exactly as it was written', () => {
    // The seed is the copy every first-run screenshot shows.
    for (const r of seedReceipts(new Date(2026, 7, 28))) {
      expect(midSentence(r.item)).toBe(r.item);
    }
  });
});

describe('the sentence somebody sends their friends', () => {
  /*
   * The only thing this app writes for an audience other than its owner, and
   * the second half is a claim about the PRODUCT rather than about the
   * receipt. "kept. reminded me before the window shut" was said whether or
   * not kept had done any such thing — a receipt marked returned on the day it
   * was added, or with deadline alerts switched off, produced it just the
   * same. Made conditional and then left as a nested ternary in App.tsx, which
   * nothing here can render.
   */
  const win = (warned: boolean, inTime: boolean) =>
    winSentence({ amount: '£61.00', store: 'Zara', warned, inTime });

  it('says kept reminded them only when kept did, and in time', () => {
    expect(win(true, true)).toContain('reminded me before the window shut');
  });

  it('needs both halves, not either', () => {
    // Warned but too late is not a reminder that worked; in time without a
    // warning is the person's own doing.
    expect(win(true, false)).not.toContain('reminded me');
    expect(win(false, true)).not.toContain('reminded me');
    expect(win(false, false)).not.toContain('reminded me');
  });

  it('still says something true when it did not', () => {
    // A share button that produces half a sentence is worse than one that
    // makes the smaller claim: kept does keep them in one place, always.
    for (const [w, t] of [[true, false], [false, true], [false, false]] as const) {
      expect(win(w, t)).toContain('keeps every return deadline in one place');
    }
  });

  it('carries the money and the shop either way', () => {
    // The first half is about the receipt and is true regardless.
    for (const [w, t] of [[true, true], [false, false]] as const) {
      expect(win(w, t)).toContain('£61.00');
      expect(win(w, t)).toContain('Zara');
    }
  });
})
