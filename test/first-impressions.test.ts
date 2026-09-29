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
