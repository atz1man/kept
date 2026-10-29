import { readFileSync } from 'node:fs';

/**
 * A light-palette colour, read out of src/tokens.ts, as the rgb() string a
 * browser's computed style reports.
 *
 * The browser checks compare what the page painted against what the tokens
 * define. They used to carry the hex typed in again (the focus outline's
 * #4636E8, the danger red's #C2261C), so the day the palette changed, both
 * checks reported a correctly painted page as broken. Reading the token keeps
 * them asking the question they mean: did the page paint the token?
 */
export function lightToken(name) {
  const src = readFileSync(new URL('../src/tokens.ts', import.meta.url), 'utf8');
  const light = src.slice(src.indexOf('const light = {'), src.indexOf('const dark = {'));
  const hex = (light.match(new RegExp(`\\n  ${name}: '(#[0-9A-Fa-f]{6})'`)) ?? [])[1];
  if (!hex) throw new Error(`no light token named ${name} in src/tokens.ts`);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}
