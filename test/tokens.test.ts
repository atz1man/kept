import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { categoryPalette, color, font, palette } from '../src/tokens';
import { AA_LARGE, AA_TEXT, contrast } from '../src/lib/contrast';

/**
 * One place decides what the app is set in.
 *
 * `font` existed and nothing used it: forty-eight font-family literals were
 * spelled out across fourteen files instead, in three different stacks for
 * Space Grotesk alone. The typefaces are self-hosted so the app renders
 * offline, which makes the FALLBACK the state a phone with a cold cache
 * actually paints — and in it the same face fell back to a monospace in one
 * element and a proportional sans in the next, on one screen. Nobody had
 * looked at that state, because nothing named it.
 *
 * `styles.css` is exempt: `@font-face` is where the family is declared, and
 * the body rule is the one place the token cannot reach.
 */
const SRC = join(__dirname, '..', 'src');
const EXEMPT = ['tokens.ts', 'styles.css'];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(ts|tsx|css)$/.test(name) && !EXEMPT.includes(name)) out.push(p);
  }
  return out;
}

describe('type is set from the tokens', () => {
  const files = sourceFiles(SRC);

  it('is reading the files it means to read', () => {
    expect(files.length).toBeGreaterThan(15);
  });

  /*
   * Every family the stylesheet declares, and the ones it used to. Matched
   * quoted or not: the first version of this looked only for the quoted
   * form, and two SVGs named the face as `fontFamily="Instrument Sans,
   * sans-serif"` — so when the typeface changed, those two kept asking for
   * a font the app no longer shipped, and fell back to whatever the phone had.
   */
  const declared = [...readFileSync(join(SRC, 'styles.css'), 'utf8').matchAll(/font-family:\s*'([^']+)'/g)].map((m) => m[1]);
  const families = [...new Set([...declared, 'Space Grotesk', 'Instrument Sans'])];

  it('knows the family the stylesheet declares', () => {
    expect(declared.length).toBeGreaterThan(0);
  });

  it('names no typeface outside the tokens', () => {
    const name = new RegExp(`\\b(?:${families.join('|')})\\b`, 'g');
    const offenders = files
      .map((f) => ({ f: f.slice(SRC.length + 1), hits: [...readFileSync(f, 'utf8').matchAll(name)] }))
      .filter((x) => x.hits.length > 0)
      .map((x) => `${x.f} (${x.hits.length})`);
    expect(offenders).toEqual([]);
  });

  it('ends every stack in a generic family', () => {
    // The fallback is not a formality here: the faces are self-hosted so the
    // app renders offline, which makes this the state a phone with a cold
    // cache paints. A token naming a family and stopping there leaves the
    // browser to pick, and it picks differently on every platform.
    for (const [role, stack] of Object.entries(font)) {
      expect(stack, role).toMatch(/(?:sans-serif|serif|monospace)$/);
      expect(stack.split(',').length, role).toBeGreaterThan(1);
    }
  });
});

/**
 * Every colour in the app is one of the tokens.
 *
 * The header of `tokens.ts` says so — "no raw hex literals live in a
 * component file" — and two had escaped it. The stylesheet's `a:hover` was
 * still `#B98A00`, which is the exact value `color.accentInk` was darkened away
 * from for measuring 3.00:1 on cream: below AA, on a state the contrast sweep
 * cannot see because it only exists under the pointer. And a `#EDE8D8` sat in
 * the hero gradient beside a token, and again in a hover rule, belonging to
 * nothing.
 *
 * The stylesheet is included deliberately. It cannot import the tokens, which
 * is exactly why it drifts, and comparing the two files is the only thing
 * that holds it.
 */
describe('colour is set from the tokens', () => {
  const expand = (c: string) =>
    /^#[0-9a-f]{3}$/.test(c) ? `#${c.slice(1).split('').map((d) => d + d).join('')}` : c;

  /** The RGB triple behind a token or a literal, ignoring any alpha. */
  const rgbOf = (value: string): string | null => {
    const v = expand(value.toLowerCase().replace(/\s+/g, ''));
    const hex = /^#([0-9a-f]{6})/.exec(v);
    if (hex) return hex[1];
    const fn = /^rgba?\((\d+),(\d+),(\d+)/.exec(v);
    if (fn) return [1, 2, 3].map((i) => Number(fn[i]).toString(16).padStart(2, '0')).join('');
    return null;
  };

  /*
   * Both palettes, and the category tints. `color` itself is no use here any
   * more: its values are `var(--k-…)`, which name a colour rather than being
   * one. A literal is allowed if it is SOME scheme's token — the stylesheet
   * declares both palettes' values, and test/scheme.test.ts holds each of
   * those declarations to the right name.
   */
  const RAW = [
    ...Object.values(palette.light),
    ...Object.values(palette.dark),
    ...Object.values(categoryPalette.light).flatMap((c) => [c.tint, c.ink]),
    ...Object.values(categoryPalette.dark).flatMap((c) => [c.tint, c.ink]),
  ];
  const PALETTE = new Set(RAW.map(rgbOf).filter(Boolean) as string[]);

  it('is not reading the custom properties as if they were colours', () => {
    // Every component-facing value is a reference, so none of them may be
    // mistaken for a palette entry — the check above would then pass on
    // nothing. And every palette entry IS a colour.
    for (const v of Object.values(color)) expect(v).toMatch(/^var\(--k-[a-z-]+\)$/);
    for (const v of RAW) expect(rgbOf(v), v).not.toBeNull();
  });

  // Comments first: the rule below is explained by naming the colours it
  // rejected, and a guard that cannot survive its own explanation is a guard
  // nobody will write the explanation for.
  const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const coloursIn = (text: string) =>
    [...stripComments(text).matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)].map((m) => m[0]);

  const files = sourceFiles(SRC).concat(join(SRC, 'styles.css'));

  it('finds colours to check', () => {
    expect(files.flatMap((f) => coloursIn(readFileSync(f, 'utf8'))).length).toBeGreaterThan(5);
    expect(PALETTE.size).toBeGreaterThan(10);
  });

  it('mixes no colour the palette does not already contain', () => {
    /*
     * The RGB must be a token's; only the ALPHA may vary at the call site.
     *
     * Twelve rgba() literals are one-off opacities of ink, danger, yellow,
     * cream and white — a scrim at 0.55, a hairline at 0.06 — and naming each
     * step in the palette would be a token per shadow. What must not appear
     * is a colour nobody chose: a hand-mixed grey, or the #B98A00 that
     * `color.accentInk` was darkened away from for measuring 3.00:1 on cream and
     * which the stylesheet went on using for `a:hover`, a state the contrast
     * sweep cannot see because it only exists under the pointer.
     */
    const strays = files
      .flatMap((f) =>
        coloursIn(readFileSync(f, 'utf8')).map((c) => ({ where: f.slice(SRC.length + 1), c, rgb: rgbOf(c) })),
      )
      .filter((x) => !x.rgb || !PALETTE.has(x.rgb))
      .map((x) => `${x.where} ${x.c}`);
    expect([...new Set(strays)]).toEqual([]);
  });
});

describe('the focus ring is visible on every ground', () => {
  /*
   * WCAG 2.1 SC 1.4.11 asks 3:1 of a focus indicator against what is next to
   * it, and axe does not check it — so nothing here could have said that the
   * ring was yellow alone at 1.72:1 on the cream paper this app is mostly
   * made of. On a keyboard that ring is the only thing telling you where you
   * are.
   *
   * Two colours, because one cannot work everywhere: ink carries the light
   * grounds and yellow carries the ink surfaces. The rule is that at least
   * one part clears 3:1 on every surface the app paints on.
   */
  /*
   * Per scheme, because the ring is. In daylight it is the accent with a white
   * halo, as it always was: the accent carries the light grounds and the halo
   * the ink surfaces and the accent fills. On a dark device a 5px white halo
   * round every focused control is a glare, so the halo is the page and the
   * outline the lifted accent ink — the halo now carries the accent fill, and
   * the outline everything else.
   */
  describe.each(Object.keys(palette) as (keyof typeof palette)[])('%s', (scheme) => {
    const c = palette[scheme];
    const RING = [c.focus, c.focusHalo];
    const GROUNDS: Record<string, string> = {
      canvas: c.canvas,
      surface: c.surface,
      surfaceAlt: c.surfaceAlt,
      surfaceDeep: c.surfaceDeep,
      inkSurface: c.inkSurface,
      accent: c.accent,
      accentSoft: c.accentSoft,
    };

    it('checks every ground the app paints on', () => {
      expect(Object.keys(GROUNDS).length).toBeGreaterThan(4);
      // Every ground named here is a real token, so this cannot drift into
      // checking colours the app does not use.
      for (const [name, value] of Object.entries(GROUNDS)) {
        expect(Object.values(c), name).toContain(value);
      }
    });

    it.each(Object.entries(GROUNDS))('is seen against %s', (_name, ground) => {
      expect(Math.max(...RING.map((part) => contrast(part, ground)))).toBeGreaterThanOrEqual(AA_LARGE);
    });

    it('needs both parts — neither alone would do', () => {
      // Stated as a property rather than a comment: if one colour were enough,
      // the ring should be that colour and this file should say so.
      for (const part of RING) {
        const worst = Math.min(...Object.values(GROUNDS).map((g) => contrast(part, g)));
        expect(worst).toBeLessThan(AA_LARGE);
      }
    });
  });
});

describe('the current tab is visible as a state, not just a tint', () => {
  /*
   * Which tab you are on was once a pale fill alone: it measured 1.28:1 against
   * the bar, where WCAG 2.1 SC 1.4.11 asks 3:1 of a state indicator — and this
   * is the app's only navigation. It is the accent now, twice: the icon and
   * label, and a 2px bar over the tab, drawn as a border so it survives
   * forced colours.
   */
  /*
   * The bar is translucent — the page's own ground at 0.94, frosted — so it is
   * measured as the browser composites it, over the page, in each scheme. The
   * indicator is the accent INK now rather than the accent fill: on a dark bar
   * the fill measures under 3:1, and the ink is what the label beside it is
   * already set in.
   */
  const over = (glass: string, ground: string) => {
    const [r, g, b, a] = glass.match(/[\d.]+/g)!.map(Number);
    const base = [1, 3, 5].map((i) => parseInt(ground.slice(i, i + 2), 16));
    return `#${[r, g, b].map((v, i) => Math.round(v * a + base[i] * (1 - a)).toString(16).padStart(2, '0')).join('')}`;
  };

  describe.each(Object.keys(palette) as (keyof typeof palette)[])('%s', (scheme) => {
    const c = palette[scheme];
    const BAR = over(c.bar, c.canvas);

    it('is not carried by a pale tint, which never clears the bar', () => {
      // Why the indicator is the accent itself and not the soft accent behind it.
      expect(contrast(c.accentSoft, BAR)).toBeLessThan(AA_LARGE);
    });

    it('is carried by the accent bar and the accent label', () => {
      expect(contrast(c.accentInk, BAR)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('shows the watch alert in something that clears the bar too', () => {
      expect(contrast(c.danger, BAR)).toBeGreaterThanOrEqual(AA_LARGE);
    });
  });
});
