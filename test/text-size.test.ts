import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_TEXT_SCALE, MIN_TEXT_SCALE, textScale, textSizeAdjust } from '../src/lib/text-size';

/*
 * The iPhone's text size, followed by the app (src/lib/text-size.ts and
 * src/app/text-size-native.ts). What can drift without a Mac is checked
 * here: the rule, and the plugin the app calls being the one the Podfile
 * installs, under the name and method its Swift declares. The layout at the
 * cap is scripts/layout.mjs's.
 */
const ROOT = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('the scale applied', () => {
  it('is what the phone asked for, between the bounds', () => {
    expect(textScale(1)).toBe(1);
    expect(textScale(1.35)).toBe(1.35);
    expect(textScale(0.88)).toBe(0.88);
  });

  it('stops at twice the default, the size the layout is measured at', () => {
    expect(MAX_TEXT_SCALE).toBe(2);
    // The largest accessibility size: 53pt body text over the default 17.
    expect(textScale(53 / 17)).toBe(2);
    expect(textScale(MIN_TEXT_SCALE / 2)).toBe(MIN_TEXT_SCALE);
  });

  it('leaves the text alone when the phone says nothing usable', () => {
    for (const v of [undefined, null, NaN, Infinity, -1, 0, '1.5', {}]) expect(textScale(v)).toBe(1);
  });

  it('is written as the percentage the property takes', () => {
    expect(textSizeAdjust(1)).toBe('100%');
    expect(textSizeAdjust(1.35)).toBe('135%');
    expect(textSizeAdjust(textScale(53 / 17))).toBe('200%');
  });
});

describe('the native half', () => {
  const pkg = 'node_modules/@capacitor/text-zoom';
  const swiftDir = join(ROOT, pkg, 'ios', 'Sources');
  const swift = readdirSync(swiftDir).flatMap((d) => readdirSync(join(swiftDir, d)).map((f) => read(join(pkg, 'ios', 'Sources', d, f)))).join('\n');
  const native = read('src/app/text-size-native.ts');

  it('is the plugin the app calls, by the name and method its Swift declares', () => {
    const jsName = /jsName = "(\w+)"/.exec(swift)?.[1];
    expect(jsName).toBeTruthy();
    expect(native).toContain(`registerPlugin<TextZoomPlugin>('${jsName}')`);
    expect(swift).toContain('CAPPluginMethod(name: "getPreferred"');
    expect(native).toMatch(/TextZoom\.getPreferred\(\)/);
  });

  it('is installed in the app, and started when it opens', () => {
    expect(read('ios/App/Podfile')).toContain("pod 'CapacitorTextZoom', :path => '../../node_modules/@capacitor/text-zoom'");
    expect(JSON.parse(read('package.json')).dependencies['@capacitor/text-zoom']).toMatch(/^\^6\./);
    expect(read('src/app/main.tsx')).toMatch(/\nfollowTextSize\(\);/);
  });

  it('and lets the lines of a row wrap once the text is larger, rather than end in an ellipsis', () => {
    expect(read('src/app/text-size-native.ts')).toMatch(/toggleAttribute\('data-text-scaled', scale > 1\)/);
    expect(read('src/styles.css')).toMatch(/:root\[data-text-scaled\] \.k-row-line \{ white-space: normal !important;/);
    // ...with the price and days left on a line of their own, so the name has the row's width.
    expect(read('src/styles.css')).toMatch(/:root\[data-text-scaled\] \.k-row \{ flex-wrap: wrap; \}/);
    for (const f of ['src/app/screens/Home.tsx', 'src/app/components/ReceiptRow.tsx']) {
      const src = read(f);
      expect((src.match(/k-row-end/g) ?? []).length, f).toBe((src.match(/className=[^\n]*\bk-row\b(?!-)/g) ?? []).length);
    }
    for (const f of ['src/app/screens/Home.tsx', 'src/app/components/ReceiptRow.tsx']) {
      const src = read(f);
      // Every one-line, ellipsised name or line on a row carries the class.
      const oneLine = [...src.matchAll(/<(?:span|div)([^>]*?)style=\{\{[^}]*whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'/g)];
      for (const m of oneLine) expect(m[1], f).toContain('k-row-line');
    }
  });

  it('and keeps a display figure at its own size', () => {
    expect(read('src/styles.css')).toMatch(/\.k-display \{ -webkit-text-size-adjust: 100%; text-size-adjust: 100%; \}/);
  });
});
