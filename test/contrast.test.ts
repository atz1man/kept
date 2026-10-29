import { describe, expect, it } from 'vitest';
import { AA_LARGE, AA_TEXT, contrast, luminance } from '../src/lib/contrast';
import { categoryPalette, palette } from '../src/tokens';

/**
 * The palette's intended pairings, held to WCAG AA — in BOTH schemes.
 *
 * These are not hypothetical combinations — each one is a pairing the app
 * actually renders, and the handoff's original values failed several of them.
 * scripts/contrast.mjs proves the real screens still match this table, on a
 * light device and on a dark one.
 *
 * Every pairing is asked of each palette by the same code, rather than a dark
 * copy of the table written beside the light one: a dark palette is exactly
 * where a pairing nobody thought to restate would go unmeasured. `color` is
 * not used here at all — its values are `var(--k-…)` strings, which have no
 * luminance; the palettes are the numbers behind them.
 */
const SCHEMES = Object.keys(palette) as (keyof typeof palette)[];

/** A translucent rgba() token laid over a solid hex ground, as the browser composites it. */
const over = (glass: string, ground: string) => {
  const [r, g, b, a] = glass.match(/[\d.]+/g)!.map(Number);
  const base = [1, 3, 5].map((i) => parseInt(ground.slice(i, i + 2), 16));
  return `#${[r, g, b].map((v, i) => Math.round(v * a + base[i] * (1 - a)).toString(16).padStart(2, '0')).join('')}`;
};

it('measures both schemes, not one', () => {
  expect(SCHEMES).toEqual(['light', 'dark']);
});

describe.each(SCHEMES)('%s', (scheme) => {
  const color = palette[scheme];

  describe('text on the page, the cards and the panels', () => {
    const GROUNDS = [
      ['canvas', color.canvas],
      ['surface', color.surface],
      ['surfaceAlt', color.surfaceAlt],
    ] as const;
    for (const [name, ground] of GROUNDS) {
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
      it(`a figure to check reads on ${name}`, () => {
        expect(contrast(color.cautionInk, ground)).toBeGreaterThanOrEqual(AA_TEXT);
      });
    }
    it('muted and ink still read on the deepest neutral — a pressed row', () => {
      expect(contrast(color.muted, color.surfaceDeep)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrast(color.ink, color.surfaceDeep)).toBeGreaterThanOrEqual(AA_TEXT);
    });
    it('danger reads on its own chip, laid over a card', () => {
      expect(contrast(color.danger, over(color.dangerChipBg, color.surface))).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrast(color.danger, over(color.dangerChipBg, color.surfaceAlt))).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });

  describe('text on the ink surfaces — the toasts and the photo viewer', () => {
    it.each([
      ['white', color.white],
      ['on-ink body', color.onInkBody],
      ['faint', color.faint],
      ['on-ink danger', color.onInkDanger],
      ['on-ink faint', color.onInkFaint],
    ])('%s reads on the ink surface', (_name, fg) => {
      expect(contrast(fg, color.inkSurface)).toBeGreaterThanOrEqual(AA_TEXT);
    });
    it('the inverse chip reads: the page colour on the ink', () => {
      // The claim pack's "Today" marker: canvas-coloured text on an ink chip.
      expect(contrast(color.canvas, color.ink)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });

  describe('text on the accent fills', () => {
    it('white reads on the accent — every primary button', () => {
      expect(contrast(color.white, color.accent)).toBeGreaterThanOrEqual(AA_TEXT);
    });
    it('white reads at both ends of the primary button\'s gradient', () => {
      expect(contrast(color.white, color.accentTile)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrast(color.white, color.accentHover)).toBeGreaterThanOrEqual(AA_TEXT);
    });
    it('the secondary text on the accent reads — the host on "Start your return"', () => {
      expect(contrast(color.onAccentSoft, color.accent)).toBeGreaterThanOrEqual(AA_TEXT);
    });
    it('ink reads on the soft accent — chips, the current tab, the swipe backing', () => {
      expect(contrast(color.ink, color.accentSoft)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrast(color.accentInk, color.accentSoft)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrast(color.ink, color.accentSoftHover)).toBeGreaterThanOrEqual(AA_TEXT);
    });
    it('is a fill on ink, never text: it measures under the bar there', () => {
      // Stated so that the day someone sets accent text on a toast, the reason
      // it fails the sweep is already written down.
      expect(contrast(color.accent, color.inkSurface)).toBeLessThan(AA_TEXT);
    });
    it('the accent as a figure reads on every card — the deadline ring and its count', () => {
      for (const g of [color.canvas, color.surface, color.surfaceAlt]) expect(contrast(color.accentFigure, g)).toBeGreaterThanOrEqual(AA_TEXT);
    });
    it('the accent fill stands off the page and the panels as a control (SC 1.4.11)', () => {
      expect(contrast(color.accent, color.canvas)).toBeGreaterThanOrEqual(AA_LARGE);
      expect(contrast(color.accent, color.surfaceAlt)).toBeGreaterThanOrEqual(AA_LARGE);
    });
  });

  describe('the hero', () => {
    it('white and the soft text read on its lightest stop', () => {
      expect(contrast(color.white, color.heroEnd)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrast(color.onHeroSoft, color.heroEnd)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('a chip on it keeps white text above AA where the gradient is lightest', () => {
      expect(contrast(color.white, over(color.onHeroChip, color.heroEnd))).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('the light glass is decoration only: under white text it would not pass', () => {
      // Stated so that the day someone puts a chip back on it, the reason it
      // fails is already written down.
      expect(contrast(color.white, over(color.onHeroGlass, color.heroEnd))).toBeLessThan(AA_TEXT);
    });
  });

  describe('the mark on a figure to check', () => {
    it('reads on its own ground', () => {
      expect(contrast(color.cautionInk, color.caution)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });

  describe('the destructive action', () => {
    it('white reads on the danger fill — the erase-everything confirm', () => {
      expect(contrast(color.white, color.dangerFill)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });

  describe('the large-text pairings', () => {
    it('the accent statistics clear the large-text bar on surfaceAlt', () => {
      expect(contrast(color.accentInk, color.surfaceAlt)).toBeGreaterThanOrEqual(AA_LARGE);
    });
  });

  describe('the category tiles', () => {
    it.each(Object.entries(categoryPalette[scheme]))('%s: its ink reads on its own tint', (_name, { tint, ink }) => {
      expect(contrast(ink, tint)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });

  describe('the receipt in the mark', () => {
    /*
     * Not text, so WCAG asks 3:1 of it (SC 1.4.11). The receipt is the whole
     * mark and has to hold its edge against the tile at 29px on a settings row;
     * its eyes have to read on the paper, and so does the smile, which is the
     * tile's own tomato cut back onto the receipt.
     */
    it('the cream receipt stands off the tomato tile', () => {
      expect(contrast(color.logoPaper, color.logoTile)).toBeGreaterThanOrEqual(AA_LARGE);
    });
    it('the eyes and the smile read on the receipt', () => {
      expect(contrast(color.logoInk, color.logoPaper)).toBeGreaterThanOrEqual(AA_LARGE);
      expect(contrast(color.logoTile, color.logoPaper)).toBeGreaterThanOrEqual(AA_LARGE);
    });
  });

});

describe('what the faint tokens are and are not for', () => {
  it('faint reads on the ink surface, in both schemes', () => {
    for (const s of SCHEMES) expect(contrast(palette[s].faint, palette[s].inkSurface), s).toBeGreaterThanOrEqual(AA_TEXT);
  });
  it('fainter reads on ink too, in daylight', () => {
    expect(contrast(palette.light.fainter, palette.light.inkSurface)).toBeGreaterThanOrEqual(AA_TEXT);
  });
  it('faint does not read on the canvas — which is why on-light footnotes use muted', () => {
    // Pinned deliberately: if someone lightens the cream or darkens this token
    // enough to pass, the comment above stops being true and should be revisited.
    expect(contrast(palette.light.faint, palette.light.canvas)).toBeLessThan(AA_TEXT);
  });
  it('fainter is a glyph colour in the dark, never text: it does not read on the page', () => {
    // The disabled coin, the arrows between steps, the dot of a relaxed
    // deadline — shapes, which recede on purpose. Pinned so that the day
    // someone sets words in it on a dark device, the reason is written down.
    expect(contrast(palette.dark.fainter, palette.dark.canvas)).toBeLessThan(AA_TEXT);
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
