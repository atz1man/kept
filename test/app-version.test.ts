import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * The version a person quotes to support is the version the App Store shows.
 *
 * Settings prints package.json's version ("Quids In 0.1.0 · iPhone app")
 * while the build in the store was MARKETING_VERSION 1.0 — so every support
 * report from the app would name a version that was never released, and the
 * two numbers lived in files nobody edits together. They are held together
 * here: the iOS project's marketing version must be package.json's, read as
 * the store reads it ("1.0" is 1.0.0).
 */
const root = join(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };
const pbx = readFileSync(join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'), 'utf8');

describe('the app’s version', () => {
  const marketing = [...pbx.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((m) => m[1].trim());

  it('is declared for every iOS build configuration', () => {
    expect(marketing.length).toBeGreaterThan(0);
  });

  it('is the same in package.json and the iOS project', () => {
    // "1.0" and "1.0.0" are one version: compare as major.minor.patch.
    const norm = (v: string) => [...v.split('.'), '0', '0'].slice(0, 3).join('.');
    for (const v of marketing) expect(norm(v)).toBe(norm(pkg.version));
  });
});
