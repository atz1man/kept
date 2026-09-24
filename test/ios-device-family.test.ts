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
