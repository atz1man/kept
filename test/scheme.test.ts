import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { categoryPalette, color, cssVarName, palette } from '../src/tokens';

/**
 * The stylesheet says what the tokens say, in both schemes.
 *
 * Every `color.*` a component paints with is `var(--k-…)`, and the VALUES live
 * in styles.css — once under `:root` for a light device and once under
 * `prefers-color-scheme: dark`. The stylesheet cannot import tokens.ts, which
 * is exactly how the two drift apart: a dark value tuned by eye in the
 * stylesheet and never told to the palette, so test/contrast.test.ts goes on
 * measuring a colour nobody paints. Or a token added to the palette and never
 * declared, which renders as no colour at all — `var()` of nothing is
 * transparent, and a transparent danger chip is a deadline nobody sees.
 *
 * So the declarations are read back out of the file and held to the palettes
 * name for name and value for value, in both directions.
 */
const ROOT = join(__dirname, '..');
const css = readFileSync(join(ROOT, 'src', 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The `--k-*` declarations directly inside the block that opens with `opener`. */
function declarationsIn(opener: string): Map<string, string> {
  const at = css.indexOf(opener);
  expect(at, `styles.css has no block opening "${opener}"`).toBeGreaterThan(-1);
  const body = css.slice(at + opener.length, css.indexOf('}', at));
  return new Map([...body.matchAll(/(--k-[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const declared = {
  light: declarationsIn(':root {'),
  dark: declarationsIn(':root:not([data-scheme="light"]) {'),
};

/** What the palettes say each declaration should be. */
const expected = (scheme: keyof typeof palette) =>
  new Map([
    ...Object.entries(palette[scheme]).map(([name, value]) => [cssVarName(name), value] as const),
    ...Object.entries(categoryPalette[scheme]).flatMap(([name, { tint, ink }]) => [
      [cssVarName(`cat-${name}-tint`), tint] as const,
      [cssVarName(`cat-${name}-ink`), ink] as const,
    ]),
  ]);

const norm = (v: string) => v.toLowerCase().replace(/\s+/g, '');

describe.each(['light', 'dark'] as const)('the %s declarations', (scheme) => {
  const want = expected(scheme);
  const got = declared[scheme];

  it('found a palette to compare', () => {
    // A block the parser could not find would compare nothing and pass.
    expect(got.size).toBeGreaterThan(40);
  });

  it('declare every token, and nothing that is not one', () => {
    expect([...got.keys()].sort()).toEqual([...want.keys()].sort());
  });

  it('give each token the palette\'s own value', () => {
    const wrong = [...want].filter(([name, value]) => norm(got.get(name) ?? '') !== norm(value)).map(([name, value]) => `${name}: styles.css has ${got.get(name)}, the palette ${value}`);
    expect(wrong).toEqual([]);
  });
});

describe('the dark scheme is switched by the phone, and only where it may be', () => {
  it('is gated on the media query', () => {
    expect(css).toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-scheme="light"\]\)\s*\{/);
  });

  it('declares both schemes, so native controls follow the palette', () => {
    // The date pickers and scrollbars are drawn by the browser, not by us: a
    // white picker on a black screen is what `light dark` exists to prevent.
    expect(css).toMatch(/:root\s*\{\s*color-scheme:\s*light dark;/);
    expect(css).toMatch(/:root\[data-scheme="light"\]\s*\{\s*color-scheme:\s*light;\s*\}/);
  });

  it('paints the canvas from the palette, under the root as well as the body', () => {
    // The area a rubber-band scroll reveals is the root's, not the app's.
    expect(css).toMatch(/html\s*\{\s*background:\s*var\(--k-canvas\);/);
    expect(css).toMatch(/body\s*\{[^}]*background:\s*var\(--k-canvas\);/);
    expect(css).toMatch(/body\s*\{[^}]*color:\s*var\(--k-ink\);/);
  });

  it('keeps the landing page light, and lets the app and its legal pages follow the phone', () => {
    const html = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
    expect(html('index.html')).toMatch(/<html[^>]*data-scheme="light"/);
    for (const page of [['app', 'index.html'], ['privacy', 'index.html'], ['rights', 'index.html']]) {
      const src = html(...page);
      expect(src, page.join('/')).not.toMatch(/data-scheme=/);
      // The browser's own chrome — the status bar in a standalone PWA, the
      // address bar on Android — in each scheme's own canvas.
      expect(src, page.join('/')).toContain(`<meta name="theme-color" media="(prefers-color-scheme: light)" content="${palette.light.canvas}" />`);
      expect(src, page.join('/')).toContain(`<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${palette.dark.canvas}" />`);
    }
  });
});

describe('every reference resolves', () => {
  /*
   * The other half of "declare every token": a `var(--k-…)` written by hand —
   * in the stylesheet, or in a component that spelled one out — naming a
   * property nobody declares. It resolves to the property's initial value,
   * which for a colour is transparent or black: on a dark device, black text
   * on a black page.
   */
  const SRC = join(ROOT, 'src');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css)$/.test(n) ? [p] : [];
    });

  it('names only declared properties', () => {
    const known = new Set(declared.light.keys());
    const refs = files(SRC).flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/var\((--k-[a-z0-9-]+)\)/g)].map((m) => ({ f: f.slice(SRC.length + 1), name: m[1] })),
    );
    expect(refs.length).toBeGreaterThan(10);
    expect(refs.filter((r) => !known.has(r.name)).map((r) => `${r.f} ${r.name}`)).toEqual([]);
  });

  it('gives components a reference for every token, never a value', () => {
    for (const [name, value] of Object.entries(color)) expect(value).toBe(`var(${cssVarName(name)})`);
    expect(declared.light.has(cssVarName('accentSoftHover'))).toBe(true);
  });
});
