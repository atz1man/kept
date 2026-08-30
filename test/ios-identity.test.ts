import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The app's identity is written down three times, and nothing made them agree.
 *
 * `capacitor.config.ts` holds `appId`. The Xcode project holds
 * `PRODUCT_BUNDLE_IDENTIFIER` — TWICE, once for Debug and once for Release,
 * which is the pairing that actually goes wrong: a build that installs
 * perfectly in development and carries the wrong identifier at submission, or
 * refuses to sign there and nowhere else. `Info.plist` is the one place that is
 * safe, because it interpolates `$(PRODUCT_BUNDLE_IDENTIFIER)` rather than
 * repeating the value.
 *
 * All three are the placeholder today. That is exactly when to write this: the
 * moment someone replaces it with a real identifier is the moment they can set
 * one of the three and not the others, and this is the only thing that would
 * say so. It deliberately does NOT assert the placeholder is still there —
 * that check would fail on the day the work is done correctly.
 */
const ROOT = join(__dirname, '..');
const PBXPROJ = join(ROOT, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');

const bundleIds = (): string[] =>
  [...readFileSync(PBXPROJ, 'utf8').matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)]
    .map((m) => m[1].trim().replace(/^"|"$/g, ''));

const configValue = (key: string): string | undefined =>
  readFileSync(join(ROOT, 'capacitor.config.ts'), 'utf8')
    .match(new RegExp(`${key}:\\s*'([^']+)'`))?.[1];

const plistValue = (key: string): string | undefined =>
  readFileSync(join(ROOT, 'ios', 'App', 'App', 'Info.plist'), 'utf8')
    .match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`))?.[1];

describe('what the app calls itself', () => {
  it('finds the identifiers it is meant to be comparing', () => {
    // Two configurations, at least. A sweep over an empty list passes silently.
    expect(bundleIds().length).toBeGreaterThanOrEqual(2);
    expect(configValue('appId')).toBeTruthy();
  });

  it('uses one bundle identifier for Debug and Release alike', () => {
    expect([...new Set(bundleIds())]).toHaveLength(1);
  });

  it('and it is the one Capacitor was told to use', () => {
    // Capacitor writes the native project from this value; if they part
    // company, `npx cap sync` and Xcode are building two different apps.
    expect(bundleIds()[0]).toBe(configValue('appId'));
  });

  it('lets Info.plist derive the identifier rather than repeat it', () => {
    /*
     * The one copy that cannot drift, and it should stay that way: a literal
     * here would be a fourth place to keep in step, invisible to the check
     * above because it is not in the pbxproj.
     */
    expect(plistValue('CFBundleIdentifier')).toBe('$(PRODUCT_BUNDLE_IDENTIFIER)');
  });

  it('shows the same name on the home screen that the config sets', () => {
    // CFBundleDisplayName is what a person reads under the icon. Capacitor
    // writes it once, from appName, and never looks again.
    expect(plistValue('CFBundleDisplayName')).toBe(configValue('appName'));
  });
});
