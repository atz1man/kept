import { describe, expect, it } from 'vitest';
import { AA_LARGE, AA_TEXT, contrast, luminance } from '../src/lib/contrast';
import { color } from '../src/tokens';

/**
 * The palette's intended pairings, held to WCAG AA.
 *
 * These are not hypothetical combinations — each one is a pairing the app
 * actually renders, and the handoff's original values failed several of them.
 * scripts/contrast.mjs proves the real screens still match this table.
 */
const LIGHT = [
  ['cream', color.canvas],
  ['white', color.white],
  ['creamAlt', color.surfaceAlt],
] as const;

describe('text on the light grounds', () => {
  for (const [name, ground] of LIGHT) {
    it(`ink reads on ${name}`, () => {
      expect(contrast(color.ink, ground)).toBeGreaterThanOrEqual(AA_TEXT);
    });
    it(`body text reads on ${name}`, () => {
      expect(contrast(color.body, ground)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrast(color.bodyStrong, ground)).toBeGreaterThanOrEqual(AA_TEXT);
    });
    it(`muted text reads on ${name}`, () => {
      // The handoff's #7A7261 fell to 4.14:1 here; every footnote uses it.
      expect(contrast(color.muted, ground)).toBeGreaterThanOrEqual(AA_TEXT);
    });
    it(`accent labels read on ${name}`, () => {
      // The handoff's #B98A00 measured 3.0:1 on cream and 2.7:1 on creamAlt.
      expect(contrast(color.accentInk, ground)).toBeGreaterThanOrEqual(AA_TEXT);
    });
    it(`danger text reads on ${name}`, () => {
      expect(contrast(color.danger, ground)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  }
});

describe('text on ink', () => {
  it.each([
    ['cream', color.canvas],
    ['on-ink body', color.onInkBody],
    ['faint', color.faint],
    ['fainter', color.fainter],
    ['on-ink danger', color.onInkDanger],
    ['on-ink faint', color.onInkFaint],
  ])('%s reads on ink', (_name, fg) => {
    expect(contrast(fg, color.ink)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('text on the accent fills', () => {
  it('white reads on the accent — every primary button', () => {
    expect(contrast(color.white, color.accent)).toBeGreaterThanOrEqual(AA_TEXT);
  });
  it('the soft accent reads on the accent — the host on "Start your return"', () => {
    expect(contrast(color.accentSoft, color.accent)).toBeGreaterThanOrEqual(AA_TEXT);
  });
  it('ink reads on the soft accent — chips, the current tab, the swipe backing', () => {
    expect(contrast(color.ink, color.accentSoft)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(color.accentInk, color.accentSoft)).toBeGreaterThanOrEqual(AA_TEXT);
  });
  it('is a fill on ink, never text: it measures under the bar there', () => {
    // Stated so that the day someone sets green text on a toast, the reason
    // it fails the sweep is already written down.
    expect(contrast(color.accent, color.ink)).toBeLessThan(AA_TEXT);
  });
});

describe('the mark on a figure to check', () => {
  it('reads on its own ground and on the card', () => {
    expect(contrast(color.cautionInk, color.caution)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(color.cautionInk, color.white)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('the destructive action', () => {
  it('white reads on the danger fill — the erase-everything confirm', () => {
    expect(contrast(color.white, color.danger)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('the large-text pairings', () => {
  it('the accent statistics clear the large-text bar on surfaceAlt', () => {
    expect(contrast(color.accentInk, color.surfaceAlt)).toBeGreaterThanOrEqual(AA_LARGE);
  });
});

describe('what the faint token is and is not for', () => {
  it('reads on ink', () => {
    expect(contrast(color.faint, color.ink)).toBeGreaterThanOrEqual(AA_TEXT);
  });
  it('does not read on the canvas — which is why on-light footnotes use muted', () => {
    // Pinned deliberately: if someone lightens the cream or darkens this token
    // enough to pass, the comment above stops being true and should be revisited.
    expect(contrast(color.faint, color.canvas)).toBeLessThan(AA_TEXT);
  });
});

describe('the arithmetic underneath, against WCAG\'s own numbers', () => {
  /*
   * Thirteen of this file's thirty-five mutations survived, including the three
   * sRGB coefficients and the whole linearisation curve. The reason is that
   * every assertion above is one-sided — `>= AA_TEXT` on pairings that clear it
   * comfortably — so a corrupted constant leaves them all passing while every
   * contrast verdict in the app quietly changes. `scripts/contrast.mjs` walks
   * the real screens through this same function, so it would move with it.
   *
   * These are not judgements to be left unpinned like a cap or a threshold we
   * chose. They are defined in the specification, and the specification gives
   * exact answers to check against.
   */
  it('puts black on white at exactly 21:1, the maximum there is', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 10);
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 10);
  });

  it('puts a colour against itself at exactly 1:1', () => {
    expect(contrast('#4a4a4a', '#4a4a4a')).toBeCloseTo(1, 10);
  });

  it('gives pure white a luminance of 1 and pure black 0', () => {
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 10);
    expect(luminance([0, 0, 0])).toBe(0);
  });

  it('weights the channels the way the specification says', () => {
    /*
     * The luminance of a fully saturated primary IS its coefficient, because
     * the other two channels contribute nothing — so this pins 0.2126, 0.7152
     * and 0.0722 exactly, each against the number the standard names.
     */
    expect(luminance([255, 0, 0])).toBeCloseTo(0.2126, 10);
    expect(luminance([0, 255, 0])).toBeCloseTo(0.7152, 10);
    expect(luminance([0, 0, 255])).toBeCloseTo(0.0722, 10);
  });

  it('uses the linear segment for the darkest channels and the curve above it', () => {
    // Below the 0.03928 knee the channel is divided by 12.92; above it, the
    // ((s + 0.055) / 1.055) ** 2.4 curve. A grey of 5 is under the knee.
    expect(luminance([5, 5, 5])).toBeCloseTo((5 / 255) / 12.92, 12);
    // And 128 is well over it.
    expect(luminance([128, 128, 128])).toBeCloseTo(((128 / 255 + 0.055) / 1.055) ** 2.4, 12);
  });

  it('reads a three-character hex as the six it stands for', () => {
    expect(contrast('#fff', '#000')).toBeCloseTo(contrast('#ffffff', '#000000'), 10);
    expect(contrast('#123', '#fff')).toBeCloseTo(contrast('#112233', '#ffffff'), 10);
  });

  it('holds the two thresholds to the ones the standard sets', () => {
    // WCAG AA, not our choice: 4.5:1 for body text and 3:1 once it is large.
    expect(AA_TEXT).toBe(4.5);
    expect(AA_LARGE).toBe(3);
  });

  it('agrees with the reference value for mid grey on white', () => {
    // #767676 on white is the canonical "just passes AA" pair, at 4.54:1.
    expect(contrast('#767676', '#ffffff')).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast('#777777', '#ffffff')).toBeLessThan(AA_TEXT);
  });
});
