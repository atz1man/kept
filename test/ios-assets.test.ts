import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error - a small JS helper shared with scripts/make-icons.mjs
import { decodePng, pixelAt } from '../scripts/png.mjs';

/**
 * The home screen is the most visible thing about an iOS app, and `cap add ios`
 * fills it with CAPACITOR'S OWN LOGO — a blue cross on white — with no warning
 * that it has done so. It sat there for eight commits. The launch screen was
 * the same logo again.
 *
 * Nothing else here could see it. Every browser sweep runs against the web
 * build, which has its own icons and never loads these files at all.
 *
 * Two of the checks below are Apple's rules rather than taste, and both fail
 * silently — an icon carrying an alpha channel is rejected at submission, and a
 * pre-rounded one is masked twice, showing dark wedges inside the system's
 * curve on every home screen.
 */
const ASSETS = join(__dirname, '..', 'ios', 'App', 'App', 'Assets.xcassets');
const ICON = join(ASSETS, 'AppIcon.appiconset', 'AppIcon-512@2x.png');
const SPLASHES = ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']
  .map((n) => join(ASSETS, 'Splash.imageset', n));

const INK = [23, 20, 16];      // #171410, the icon's ground
const CREAM = [253, 250, 241]; // #FDFAF1, what the shell is told to paint
const YELLOW = [242, 185, 13]; // #F2B90D, the mark itself

const near = (got: number[], want: number[]) =>
  want.every((v, i) => Math.abs(got[i] - v) <= 2);

/*
 * Looked for across a region rather than at one guessed pixel. A hardcoded
 * coordinate is a test that breaks when the mark moves a little and passes when
 * it is replaced by something else the same colour; "the brand yellow appears
 * somewhere inside the artwork" is the claim actually worth making.
 */
const hasMark = (image: { width: number; height: number }, box: [number, number, number, number]) => {
  const [x0, y0, x1, y1] = box;
  for (let y = y0; y < y1; y += 4) {
    for (let x = x0; x < x1; x += 4) if (near(pixelAt(image, x, y), YELLOW)) return true;
  }
  return false;
};

describe('the app icon', () => {
  const icon = decodePng(ICON);

  it('is the 1024 square Apple asks for', () => {
    expect([icon.width, icon.height]).toEqual([1024, 1024]);
  });

  it('carries NO alpha channel', () => {
    // Apple rejects an icon that has one, opaque or not. Playwright screenshots
    // are always RGBA, so this only holds because the generator strips it.
    expect(icon.channels).toBe(3);
  });

  it('has square corners, in kept ink — not rounded, and not a vendor logo', () => {
    /*
     * One assertion doing two jobs, and both matter. iOS masks the icon itself,
     * so a corner that is transparent or white means the artwork was rounded
     * first and will be rounded twice. And the placeholder this replaced had
     * WHITE corners, so an ink corner is also the check that it is gone.
     */
    for (const [x, y] of [[0, 0], [1023, 0], [0, 1023], [1023, 1023]]) {
      const px = pixelAt(icon, x, y);
      expect(near(px, INK), `corner ${x},${y} was ${px}`).toBe(true);
    }
  });

  it('actually has the mark on it, rather than being a blank square', () => {
    // Without this, every check above passes on a solid ink rectangle.
    expect(hasMark(icon, [200, 100, 850, 900])).toBe(true);
  });
});

describe('the launch screen', () => {
  it('is the size the imageset declares, with no alpha', () => {
    for (const path of SPLASHES) {
      const s = decodePng(path);
      expect([s.width, s.height, s.channels]).toEqual([2732, 2732, 3]);
    }
  });

  it('is painted the same colour the shell is told to paint', () => {
    /*
     * `capacitor.config.ts` sets ios.backgroundColor so there is no white flash
     * before the first paint. A launch image in any other ground puts the flash
     * back, one layer up — the same fact in two files, quietly disagreeing,
     * which is the defect this codebase keeps finding. So the config is read
     * rather than the colour repeated.
     */
    const config = readFileSync(join(__dirname, '..', 'capacitor.config.ts'), 'utf8');
    const hex = config.match(/backgroundColor:\s*'#([0-9A-Fa-f]{6})'/)?.[1];
    expect(hex, 'ios.backgroundColor is no longer set in capacitor.config.ts').toBeTruthy();
    const want = [0, 2, 4].map((i) => parseInt(hex!.slice(i, i + 2), 16));
    expect(want).toEqual(CREAM);
    for (const path of SPLASHES) {
      const s = decodePng(path);
      expect(near(pixelAt(s, 0, 0), want), `${path} corner was ${pixelAt(s, 0, 0)}`).toBe(true);
    }
  });

  it('has the mark on it, centred, rather than a plain cream field', () => {
    const s = decodePng(SPLASHES[0]);
    expect(hasMark(s, [1110, 1110, 1622, 1622])).toBe(true);
    // And nothing outside where the mark belongs — the first attempt at this
    // artwork rendered it several times too large and running off the canvas,
    // which the generator reported as a success because it had drawn something.
    expect(hasMark(s, [0, 0, 1000, 2732])).toBe(false);
    expect(hasMark(s, [1732, 0, 2732, 2732])).toBe(false);
  });
});
