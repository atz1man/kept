import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { palette } from '../src/tokens';

const color = palette.light;
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
const SPLASH_SET = join(ASSETS, 'Splash.imageset');
const splashFiles = (stem: string) => [`${stem}.png`, `${stem}-1.png`, `${stem}-2.png`]
  .map((n) => join(SPLASH_SET, n));
const SPLASHES = splashFiles('splash-2732x2732');
const DARK_SPLASHES = splashFiles('splash-dark-2732x2732');

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
// Read from the tokens rather than repeated: the launch screen is the app's
// own ground in each scheme, and the scheme the app paints is these two.
const CANVAS = rgb(palette.light.canvas);
const DARK_CANVAS = rgb(palette.dark.canvas);
// The gold coin, read from the token the logo draws with, so icon.svg and the
// in-app mark cannot quietly pick two different golds.
const MARK = [1, 3, 5].map((i) => parseInt(color.gold.slice(i, i + 2), 16));

const near = (got: number[], want: number[]) =>
  want.every((v, i) => Math.abs(got[i] - v) <= 2);

/*
 * The tile is a gradient from #5B4CF5 to #3626CF with a soft light at the
 * top, so no one pixel of it is the accent #4636E8. What every pixel of it IS
 * is the brand indigo: blue well above red and green, and neither white nor
 * ink.
 */
const tileIndigo = (px: number[]) => px[2] - px[1] > 100 && px[2] - px[0] > 60 && px[2] > 150;

/*
 * Looked for across a region rather than at one guessed pixel. A hardcoded
 * coordinate is a test that breaks when the mark moves a little and passes when
 * it is replaced by something else the same colour; "the mark's white appears
 * somewhere inside the artwork" is the claim actually worth making.
 */
const hasMark = (image: { width: number; height: number }, box: [number, number, number, number], ink: number[] | 'tile' = MARK) => {
  const [x0, y0, x1, y1] = box;
  const is = (px: number[]) => (ink === 'tile' ? tileIndigo(px) : near(px, ink));
  for (let y = y0; y < y1; y += 4) {
    for (let x = x0; x < x1; x += 4) if (is(pixelAt(image, x, y))) return true;
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

  it('has square corners, in the brand indigo — not rounded, and not a vendor logo', () => {
    /*
     * One assertion doing two jobs, and both matter. iOS masks the icon itself,
     * so a corner that is transparent or white means the artwork was rounded
     * first and will be rounded twice. And the placeholder this replaced had
     * WHITE corners, so an indigo corner is also the check that it is gone.
     */
    for (const [x, y] of [[0, 0], [1023, 0], [0, 1023], [1023, 1023]]) {
      const px = pixelAt(icon, x, y);
      expect(tileIndigo(px), `corner ${x},${y} was ${px}`).toBe(true);
    }
  });

  it('actually has the mark on it, rather than being a blank square', () => {
    // Without this, every check above passes on a solid indigo rectangle.
    expect(hasMark(icon, [200, 100, 850, 900])).toBe(true);
  });
});

describe('the launch screen', () => {
  it('is the size the imageset declares, with no alpha, in both schemes', () => {
    for (const path of [...SPLASHES, ...DARK_SPLASHES]) {
      const s = decodePng(path);
      expect([s.width, s.height, s.channels]).toEqual([2732, 2732, 3]);
    }
  });

  it("is painted the app's own canvas, in each scheme", () => {
    /*
     * A launch image in any other ground puts a flash between it and the
     * first paint. The app follows the phone into dark mode, so there are two
     * grounds to match, and the white-only launch screen this replaced was a
     * full-white flash in front of an app that then opened dark.
     */
    for (const [paths, want] of [[SPLASHES, CANVAS], [DARK_SPLASHES, DARK_CANVAS]] as const) {
      for (const path of paths) {
        const s = decodePng(path);
        for (const [x, y] of [[0, 0], [2731, 2731]]) {
          expect(near(pixelAt(s, x, y), [...want]), `${path} at ${x},${y} was ${pixelAt(s, x, y)}`).toBe(true);
        }
      }
    }
  });

  it('declares the dark artwork as the dark appearance of every scale, and the light as the default', () => {
    /*
     * The files above are inert unless the catalogue names them, and the shape
     * is easy to get subtly wrong: a dark entry with no `appearances` is a
     * second image for the same slot, which Xcode warns about and then picks
     * one of — not necessarily the one matching the phone.
     */
    const { images } = JSON.parse(readFileSync(join(SPLASH_SET, 'Contents.json'), 'utf8')) as {
      images: { filename: string; scale: string; appearances?: { appearance: string; value: string }[] }[];
    };
    const isDark = (i: (typeof images)[number]) =>
      i.appearances?.some((a) => a.appearance === 'luminosity' && a.value === 'dark') ?? false;
    for (const scale of ['1x', '2x', '3x']) {
      const at = images.filter((i) => i.scale === scale);
      expect(at.length, `scale ${scale}`).toBe(2);
      const dark = at.filter(isDark);
      const light = at.filter((i) => !isDark(i) && !i.appearances);
      expect(dark.map((i) => join(SPLASH_SET, i.filename)).every((f) => DARK_SPLASHES.includes(f)), `dark ${scale}`).toBe(true);
      expect(light.map((i) => join(SPLASH_SET, i.filename)).every((f) => SPLASHES.includes(f)), `light ${scale}`).toBe(true);
      expect([dark.length, light.length], `scale ${scale}`).toEqual([1, 1]);
    }
  });

  it('hands over to a shell background that follows the phone, not a fixed white', () => {
    /*
     * After the launch image comes the webview, painted before the page has
     * drawn anything. `ios.backgroundColor` takes ONE hex, so setting it — as
     * this config did, to #FFFFFF — put a white frame between a dark launch
     * screen and a dark app. Unset, Capacitor paints UIColor.systemBackground,
     * which is the light canvas exactly in light mode and dark in dark. It
     * reads `ios.backgroundColor ?? backgroundColor`, so neither may be set.
     */
    const code = readFileSync(join(__dirname, '..', 'capacitor.config.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/backgroundColor\s*:/);
    // systemBackground is the light canvas exactly — the other half of why
    // leaving it unset is safe for the scheme the app always had.
    expect(CANVAS).toEqual([255, 255, 255]);
    // And the launch screen's own view, behind the aspect-filled image, is the
    // adaptive system colour rather than a fixed one.
    const board = readFileSync(join(__dirname, '..', 'ios', 'App', 'App', 'Base.lproj', 'LaunchScreen.storyboard'), 'utf8');
    expect(board).toMatch(/<color key="backgroundColor" systemColor="systemBackgroundColor"\/>/);
    expect(board).not.toMatch(/<color key="backgroundColor"[^>]*\b(red|white)=/);
  });

  it('has the mark on it, centred, rather than a plain empty field, in both schemes', () => {
    // Looked for by the tile's indigo AND the coin's gold: neither ground is
    // either colour, so neither could come from the ground.
    for (const ground of [CANVAS, DARK_CANVAS]) {
      expect(ground).not.toEqual(MARK);
      expect(tileIndigo(ground)).toBe(false);
    }
    for (const path of [SPLASHES[0], DARK_SPLASHES[0]]) {
      const s = decodePng(path);
      expect(hasMark(s, [1110, 1110, 1622, 1622], 'tile'), path).toBe(true);
      expect(hasMark(s, [1110, 1110, 1622, 1622]), path).toBe(true);
      // And nothing outside where the mark belongs — the first attempt at this
      // artwork rendered it several times too large and running off the canvas,
      // which the generator reported as a success because it had drawn something.
      expect(hasMark(s, [0, 0, 1000, 2732], 'tile'), path).toBe(false);
      expect(hasMark(s, [1732, 0, 2732, 2732], 'tile'), path).toBe(false);
    }
  });
});
