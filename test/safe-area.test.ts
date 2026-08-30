import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Nothing the app anchors to the bottom edge may ignore the home indicator.
 *
 * On an iPhone the indicator owns roughly the bottom 34px, and a control under
 * it is hard to hit and easy to dismiss the app with. This codebase has already
 * had one covered control — Celebrate's "Back to receipts", underneath the
 * floating tab bar, visible and unclickable — and the layout sweep gained a
 * check because of it. That check cannot see this one: it runs in a browser
 * where `env(safe-area-inset-bottom)` is 0, so the offending layout looks
 * perfect right up until it is on a phone.
 *
 * Which is how the defect this exists for survived. `UpgradeNotice` sat at
 * `84px + inset` — a sum that only clears the tab bar if the BAR also moves up
 * by the inset. It did not. One of three bottom-anchored elements accounted for
 * the indicator, and it was the one whose arithmetic depended on the other two.
 *
 * Source-level on purpose, because the failure is invisible at runtime here.
 */

const ROOT = new URL('../src/app', import.meta.url).pathname;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return name.endsWith('.tsx') ? [full] : [];
  });
}

interface Anchored {
  file: string;
  value: string;
}

function bottomAnchors(): Anchored[] {
  const out: Anchored[] = [];
  for (const file of tsxFiles(ROOT)) {
    const src = readFileSync(file, 'utf8');
    for (const line of src.split('\n')) {
      // Only a style declaration, and only one giving `bottom` a value. A
      // comment mentioning the word is not a layout decision.
      const m = /(?:^|[{,\s])bottom:\s*([^,\n]+)/.exec(line);
      if (!m) continue;
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
      out.push({ file: file.slice(ROOT.length + 1), value: m[1].trim() });
    }
  }
  return out;
}

describe('the bottom edge of an iPhone', () => {
  const anchors = bottomAnchors();

  it('finds the bottom-anchored elements it is meant to be sweeping', () => {
    /*
     * A sweep over an empty list passes silently, reporting success for a
     * question it never asked — the vacuity this codebase has been caught by
     * more than once. Two is the floor: the tab bar and the undo bar.
     */
    expect(anchors.length).toBeGreaterThanOrEqual(2);
    expect(anchors.map((a) => a.file)).toContain('components/TabBar.tsx');
  });

  it.each(bottomAnchors().map((a) => [a.file, a.value] as const))(
    '%s anchors at %s, which accounts for the home indicator',
    (_file, value) => {
      expect(value).toMatch(/env\(safe-area-inset-bottom/);
    },
  );
});
