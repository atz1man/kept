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

const allBundleIds = (): string[] =>
  [...readFileSync(PBXPROJ, 'utf8').matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)]
    .map((m) => m[1].trim().replace(/^"|"$/g, ''));

/** The app's own, Debug and Release; the widget extension's are checked separately below. */
const bundleIds = (): string[] => allBundleIds().filter((id) => !id.endsWith('.widget'));

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
    const found = [...new Set(bundleIds())];
    expect(found, `project.pbxproj has more than one bundle identifier: ${found.join(', ')}`)
      .toHaveLength(1);
  });

  it('and it is the one Capacitor was told to use', () => {
    // Capacitor writes the native project from this value; if they part
    // company, `npx cap sync` and Xcode are building two different apps.
    expect(
      bundleIds()[0],
      `project.pbxproj says ${bundleIds()[0]} and capacitor.config.ts says ${configValue('appId')} — `
        + 'both need changing; `npx cap sync ios` does not do it for you',
    ).toBe(configValue('appId'));
  });

  it('names the widget after the app, and shares one App Group between them', () => {
    // An extension whose identifier does not start with its app's is refused
    // on upload; a group the two name differently is a widget that never
    // sees what the app wrote.
    const widget = allBundleIds().filter((id) => id.endsWith('.widget'));
    expect(widget).toEqual([`${configValue('appId')}.widget`, `${configValue('appId')}.widget`]);
    const groups = [...readFileSync(PBXPROJ, 'utf8').matchAll(/KEPT_APP_GROUP = ([^;]+);/g)].map((m) => m[1]);
    expect(groups).toEqual([`group.${configValue('appId')}`, `group.${configValue('appId')}`]);
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
    expect(
      plistValue('CFBundleDisplayName'),
      `Info.plist says ${plistValue('CFBundleDisplayName')} and capacitor.config.ts says ${configValue('appName')}`,
    ).toBe(configValue('appName'));
  });
});

describe('the team that signs it', () => {
  /*
   * Automatic signing with no team set fails on the first build with "Signing
   * for App requires a development team", and Xcode's fix is to pick one in
   * the Signing pane — which writes it into the configuration being edited.
   * Release is the one that goes to App Store Connect, and the one least
   * likely to be open. So the team is written down here, for both, and held
   * to one value.
   */
  const teams = (): string[] =>
    [...readFileSync(PBXPROJ, 'utf8').matchAll(/DEVELOPMENT_TEAM = ([^;]+);/g)].map((m) => m[1].trim());
  const automatic = (): number =>
    [...readFileSync(PBXPROJ, 'utf8').matchAll(/CODE_SIGN_STYLE = Automatic;/g)].length;

  it('sets a team on every configuration that signs automatically', () => {
    expect(automatic()).toBeGreaterThanOrEqual(2);
    expect(teams()).toHaveLength(automatic());
  });

  it('uses one team, in the form Apple issues', () => {
    // A Team ID is ten uppercase letters and digits; anything else is a name
    // or a typo, and Xcode reports it only as "no account for team".
    const found = [...new Set(teams())];
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/^[A-Z0-9]{10}$/);
  });
});
