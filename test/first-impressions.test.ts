import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The first screen a new install shows says how a receipt gets in.
 *
 * It said "Paste an order email" and nothing else, beside a comment that
 * scanning was not built, for as long as scanning was not built. That was
 * right, and it went on saying it after the scan button on the Add screen
 * began to work. The landing page, the store listing and the review notes
 * were all updated in the same change; the first screen of the app itself was
 * missed, and it is the one App Review reads first.
 *
 * Held to the code the same way the review notes are: while anything in the
 * app loads the OCR engine, the first step names the camera as well as the
 * paste, and nothing on that screen says scanning does not exist.
 */
const ROOT = join(__dirname, '..');
const ONBOARDING = readFileSync(join(ROOT, 'src', 'app', 'screens', 'Onboarding.tsx'), 'utf8');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.tsx?$/.test(name) ? [p] : [];
  });
}

const readsPhotos = sourceFiles(join(ROOT, 'src')).some((f) =>
  /from ['"]tesseract\.js['"]|import\(['"]tesseract\.js['"]\)/.test(readFileSync(f, 'utf8')),
);

/** The body of each onboarding step, in order. */
const bodies = [...ONBOARDING.matchAll(/body:\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);

describe('the first screen of a new install', () => {
  it('finds what it is meant to be checking', () => {
    expect(readsPhotos).toBe(true);
    expect(bodies.length).toBeGreaterThanOrEqual(3);
  });

  it('names both ways in while the app can read a photo', () => {
    if (!readsPhotos) return;
    expect(bodies[0]).toMatch(/paste/i);
    expect(bodies[0]).toMatch(/photograph|scan|camera/i);
  });

  it('does not say scanning is not built once it is', () => {
    if (!readsPhotos) return;
    expect(ONBOARDING).not.toMatch(/scanning is not built|lands in a later release/i);
  });
});

describe('what the first screens say about reminders', () => {
  /*
   * The iPhone app lodges reminders with iOS, so they arrive with Kept shut;
   * the web cannot wake itself. Each build's onboarding says its own truth:
   * the web copy must not promise a reminder while closed, and the iPhone
   * copy must not undersell the one thing the native app is for.
   */
  const nativeBodies = [...ONBOARDING.matchAll(/native:\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);

  it('has an iPhone line, and it names the moment, the mechanism and that iOS asks', () => {
    expect(nativeBodies.length).toBe(1);
    expect(nativeBodies[0]).toMatch(/lodges? .* with iOS/i);
    expect(nativeBodies[0]).toMatch(/9am/);
    expect(nativeBodies[0]).toMatch(/if you allow/i);
  });

  it('never promises the web a reminder while Kept is closed', () => {
    for (const body of bodies) expect(body).not.toMatch(/remind|even with Kept (shut|closed)/i);
  });
});
