import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * iPhone only, in both build configurations.
 *
 * The Capacitor template ships `TARGETED_DEVICE_FAMILY = "1,2"` — iPhone AND
 * iPad — and this project carried it without anyone deciding to. Claiming iPad
 * is not free: App Store Connect then requires iPad screenshots before it will
 * take a submission, and App Review opens the app on an iPad, where every
 * screen here — laid out for a phone and swept at 390 and 402 pixels wide — is
 * stretched across a tablet. That is a rejection waiting to happen for a
 * device nobody has designed for or tested on.
 *
 * Read as a DECISION, not a fact about the world: supporting iPad is a fine
 * thing to want, and the day someone designs for it this test is the one line
 * to change. What it prevents is the template's default quietly coming back,
 * or Debug and Release disagreeing — a build that behaves as an iPad app on a
 * developer's desk and as an iPhone app in review.
 */
const PBXPROJ = join(__dirname, '..', 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');

const PLIST = join(__dirname, '..', 'ios', 'App', 'App', 'Info.plist');

/** The strings in a top-level array under `key`, or null when the key is absent. */
const plistArray = (key: string): string[] | null => {
  const m = readFileSync(PLIST, 'utf8')
    // Comments out first: one quoting a key would otherwise be read as it.
    .replace(/<!--[\s\S]*?-->/g, '')
    .match(new RegExp(`<key>${key}</key>\\s*<array>([\\s\\S]*?)</array>`));
  return m ? [...m[1].matchAll(/<string>([^<]*)<\/string>/g)].map((x) => x[1]) : null;
};

const families = (): string[] =>
  [...readFileSync(PBXPROJ, 'utf8').matchAll(/TARGETED_DEVICE_FAMILY = ([^;]+);/g)]
    .map((m) => m[1].trim().replace(/^"|"$/g, ''));

describe('the devices this app claims', () => {
  it('finds both build configurations', () => {
    // Debug and Release each carry one; fewer means the regex read nothing.
    expect(families().length).toBe(2);
  });

  it('is iPhone only, the same in Debug and Release', () => {
    expect(families()).toEqual(['1', '1']);
  });
});

/**
 * And the two claims Info.plist makes about the device, which the Capacitor
 * template also filled in for us.
 *
 * `armv7` names a 32-bit architecture this binary is not built for — the
 * deployment target is iOS 13 and every iPhone that runs it is arm64. And the
 * template allowed both landscape orientations on an iPhone, where every
 * screen is laid out for a phone held upright and swept only at phone widths.
 * The `~ipad` list goes with the iPad: the app is iPhone only (above), so an
 * iPad runs it as an iPhone app and never reads that key; keeping a list
 * nothing reads is how it comes back with four orientations in it.
 */
describe('what Info.plist claims about the device', () => {
  it('requires arm64, and nothing else', () => {
    expect(plistArray('UIRequiredDeviceCapabilities')).toEqual(['arm64']);
  });

  it('is portrait only on the iPhone', () => {
    expect(plistArray('UISupportedInterfaceOrientations')).toEqual(['UIInterfaceOrientationPortrait']);
  });

  it('keeps no iPad orientations for an app that does not run as one', () => {
    expect(families().every((f) => f === '1')).toBe(true);
    expect(plistArray('UISupportedInterfaceOrientations~ipad')).toBeNull();
  });

  it('reads the keys it is meant to be checking', () => {
    // A key the regex cannot find reads as null, which would pass the iPad
    // check above for the wrong reason.
    expect(plistArray('UIRequiredDeviceCapabilities')).not.toBeNull();
    expect(plistArray('UISupportedInterfaceOrientations')).not.toBeNull();
  });
});
