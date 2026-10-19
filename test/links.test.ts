import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * A link that stands on its own line is drawn as something to press.
 *
 * The app's way of saying "this goes somewhere" is the accent as text, with
 * an arrow — "See what to do →", the shop's host "↗" on Start your return.
 * Three standalone links did not follow it: "Privacy policy" and "Send
 * feedback" in Settings, and the source line under a policy change on
 * Watch, were bold ink with no underline — the same look as a label, so on
 * a phone "Privacy policy" read as the heading of nothing. A link INSIDE a
 * sentence is a different case, underlined by `.k-inline-links`; this is
 * about the anchors whose own style picks their colour.
 */
const SCREENS = join(__dirname, '..', 'src', 'app');
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : []);

/** Every `<a …>` opening tag, attributes and all, ending at a brace-depth-zero `>`. */
function anchors(src: string): string[] {
  const out: string[] = [];
  for (let i = src.indexOf('<a'); i !== -1; i = src.indexOf('<a', i + 2)) {
    if (!/[\s>]/.test(src[i + 2] ?? '')) continue;
    let depth = 0;
    let j = i + 2;
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    out.push(src.slice(i, j + 1));
  }
  return out;
}

describe('standalone links look like links', () => {
  const found = files(SCREENS).flatMap((f) => anchors(readFileSync(f, 'utf8')).map((tag) => ({ f, tag })));

  it('finds the anchors it is meant to be judging', () => {
    // A matcher over no anchors passes for ever. Four exist today: the
    // privacy policy, feedback, a policy change's source and Start your return.
    expect(found.length).toBeGreaterThanOrEqual(4);
  });

  it('none picks body ink for its own colour', () => {
    const ink = found.filter(({ tag }) => /color:\s*color\.ink\b/.test(tag));
    expect(ink.map(({ f, tag }) => `${f.split('/src/')[1]}: ${tag.slice(0, 80)}`)).toEqual([]);
  });
});
