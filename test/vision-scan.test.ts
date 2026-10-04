import { describe, expect, it } from 'vitest';
import { fromScan, fromVision, type VisionLine } from '../src/lib/receipt-scan';
import { parseReceiptText } from '../src/lib/parse';

/**
 * What the iPhone's document camera and Vision hand back, made into text.
 *
 * Vision reads a till slip in pieces — each label and each figure its own
 * observation, in no promised order — with boxes as fractions of the page,
 * y up from the bottom. These are shaped like that, on a slip three times
 * taller than it is wide, which is the shape a till receipt is.
 */
const PAGE = { width: 300, height: 900 };
/** A piece of text on row `row` (0 at the top), starting `x` of the way across. */
const at = (text: string, row: number, x: number, jitter = 0): VisionLine => ({
  text, x, width: Math.min(0.9 - x, text.length * 0.025), height: 0.012,
  y: 1 - 0.06 - row * 0.016 + jitter,
});

const SLIP: VisionLine[] = [
  at('19.99', 6, 0.7, 0.001), at('TOTAL', 6, 0.08),
  at('BOOTS', 0, 0.4), at('Victoria Station', 1, 0.25),
  at('NO7 LIFT & LUMINATE', 3, 0.08), at('24.99', 3, 0.7, -0.0008),
  at('3 FOR 2 SAVING', 4, 0.08), at('-5.00', 4, 0.7),
  at('VISA DEBIT', 7, 0.08), at('19.99', 7, 0.7),
  at('29/09/2026 08:55', 9, 0.08),
];

describe('the document camera\'s reading, as text', () => {
  it('puts each label back on the line with its figure, top to bottom', () => {
    expect(fromVision([{ ...PAGE, lines: SLIP }])).toBe(
      ['BOOTS', 'Victoria Station', 'NO7 LIFT & LUMINATE 24.99', '3 FOR 2 SAVING -5.00', 'TOTAL 19.99', 'VISA DEBIT 19.99', '29/09/2026 08:55'].join('\n'),
    );
  });

  it('reads as a till receipt the parser understands', () => {
    const out = parseReceiptText(fromScan(fromVision([{ ...PAGE, lines: SLIP }])), new Date(2026, 8, 30));
    expect(out.ok && { store: out.value.store, pence: out.value.amount, on: out.value.purchasedOn }).toEqual({ store: 'Boots', pence: 1999, on: '2026-09-29' });
  });

  it('judges a gap in the page\'s own proportions — a hairline inside a word is no space', () => {
    // Vision split one word in two, a point apart on a 300-point-wide slip:
    // against text 10.8 points tall that is a break inside a word. Measured as
    // a fraction of the width against a fraction of the height it is not.
    const lumin = at('LUMIN', 3, 0.08);
    const ate = { ...at('ATE', 3, 0), x: lumin.x + lumin.width + 1 / PAGE.width };
    expect(fromVision([{ ...PAGE, lines: [lumin, ate] }])).toBe('LUMINATE');
  });

  it('keeps rows apart, and a figure on its own label\'s row', () => {
    const text = fromVision([{ ...PAGE, lines: [at('TOTAL', 0, 0.08), at('VISA', 1, 0.08), at('19.99', 1, 0.7, 0.002)] }]);
    expect(text).toBe('TOTAL\nVISA 19.99');
  });

  it('reads the pages in order, a long slip in parts', () => {
    const text = fromVision([{ ...PAGE, lines: [at('BOOTS', 0, 0.4)] }, { ...PAGE, lines: [at('TOTAL', 0, 0.08), at('19.99', 0, 0.7)] }]);
    expect(text).toBe('BOOTS\nTOTAL 19.99');
  });

  it('is empty for a page with nothing read on it', () => {
    expect(fromVision([{ ...PAGE, lines: [] }])).toBe('');
  });
});
