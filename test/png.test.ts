import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error - a small JS helper shared with scripts/make-icons.mjs
import { decodePng, pixelAt, writeOpaquePng } from '../scripts/png.mjs';

/**
 * The decoder underneath the icon guard.
 *
 * `ios-assets.test.ts` decides whether the app icon is kept's by reading pixels
 * out of it, so a decoder that unfilters wrongly does not make that guard fail —
 * it makes it answer a different question, quietly, and a guard that reports
 * the wrong colour is worse than no guard at all.
 *
 * The important case is the CHROMIUM-encoded file. My writer emits filter 0 on
 * every row, so a round trip through my own code exercises none of the four
 * filters a real encoder chooses between; decoding a PNG this repository did
 * not write is what puts Sub, Up, Average and Paeth through their paces. The
 * facts asserted about it come from the SVG it was rendered from, not from the
 * decoder's own output.
 */
const WEB_ICON = join(__dirname, '..', 'public', 'icons', 'icon-512.png');
const INK = [23, 20, 16];
const YELLOW = [242, 185, 13];
const near = (got: number[], want: number[]) => want.every((v, i) => Math.abs(got[i] - v) <= 2);

describe('reading a PNG somebody else encoded', () => {
  const icon = decodePng(WEB_ICON);

  it('reads its shape', () => {
    expect([icon.width, icon.height, icon.channels]).toEqual([512, 512, 4]);
  });

  it('finds the rounded-rectangle the source SVG describes', () => {
    /*
     * icon.svg is `<rect width=512 height=512 rx=112 fill=#171410>` on a
     * transparent ground. So every CORNER is outside the curve and must be
     * transparent, and every EDGE MIDPOINT is inside it and must be opaque ink.
     * Garbage from a mis-unfiltered scanline satisfies neither, and — unlike a
     * single spot check — it cannot satisfy them by luck either, because the
     * two sets have to come out opposite.
     */
    for (const [x, y] of [[0, 0], [511, 0], [0, 511], [511, 511]]) {
      expect(pixelAt(icon, x, y)[3], `corner ${x},${y}`).toBe(0);
    }
    for (const [x, y] of [[256, 0], [256, 511], [0, 256], [511, 256]]) {
      const px = pixelAt(icon, x, y);
      expect(px[3], `edge ${x},${y} alpha`).toBe(255);
      expect(near(px, INK), `edge ${x},${y} was ${px}`).toBe(true);
    }
  });

  it('reads the mark inside it', () => {
    // The receipt shape is #F2B90D and sits in the middle third.
    let found = false;
    for (let y = 170; y < 340 && !found; y += 3) {
      for (let x = 170; x < 340; x += 3) if (near(pixelAt(icon, x, y), YELLOW)) { found = true; break; }
    }
    expect(found).toBe(true);
  });
});

describe('writing one Apple will accept', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kept-png-'));

  it('round-trips exact pixel values', () => {
    /*
     * Synthetic, and deliberately not flat: a gradient in every channel means a
     * row that repeated the one above it, or an off-by-one in the stride, shows
     * up as a wrong number rather than as the same number twice.
     *
     * This pairs the writer with the reader, so it cannot catch two errors that
     * happen to cancel. The Chromium file above is what covers that.
     */
    const w = 37, h = 19;
    const data = Buffer.alloc(w * h * 3);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 3;
        data[i] = (x * 7) & 0xff;
        data[i + 1] = (y * 13) & 0xff;
        data[i + 2] = (x * y) & 0xff;
      }
    }
    const path = join(dir, 'roundtrip.png');
    writeOpaquePng(path, { width: w, height: h, channels: 3, data });
    const back = decodePng(path);
    expect([back.width, back.height, back.channels]).toEqual([w, h, 3]);
    expect(Buffer.compare(back.data, data)).toBe(0);
  });

  it('drops the alpha channel rather than leaving it opaque', () => {
    // Apple rejects an icon that HAS one, not just one that is used. So the
    // written file must be truecolour, and that is a fact about the file.
    const path = join(dir, 'noalpha.png');
    writeOpaquePng(path, { width: 2, height: 2, channels: 4, data: Buffer.from([
      255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 255, 255, 0, 255,
    ]) });
    expect(decodePng(path).channels).toBe(3);
    expect(readFileSync(path)[25]).toBe(2); // IHDR colour type, truecolour
  });

  it('composites transparency onto the ground rather than discarding it', () => {
    /*
     * The half-transparent pixel is the one that matters. Dropping the channel
     * without compositing would leave the icon's antialiased edges bright
     * against ink — a halo round the mark, on every home screen.
     */
    const path = join(dir, 'composite.png');
    writeOpaquePng(
      path,
      { width: 1, height: 1, channels: 4, data: Buffer.from([255, 255, 255, 128]) },
      [0, 0, 0],
    );
    const [r, g, b] = pixelAt(decodePng(path), 0, 0);
    expect([r, g, b]).toEqual([128, 128, 128]);
  });
});

describe('when it cannot read a file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kept-png-'));

  it('refuses a format it does not handle instead of returning wrong pixels', () => {
    /*
     * A decoder that guesses is the failure mode this whole file exists to
     * prevent: the icon guard would then be asserting colours out of noise. The
     * IHDR is edited to claim 16-bit, which the unfilter loop cannot do.
     */
    const buf = readFileSync(WEB_ICON);
    buf[24] = 16; // IHDR bit depth
    const path = join(dir, 'sixteen-bit.png');
    writeFileSync(path, buf);
    expect(() => decodePng(path)).toThrow(/8-bit/);
  });

  it('refuses something that is not a PNG at all', () => {
    const path = join(dir, 'not-a-png.png');
    writeFileSync(path, Buffer.from('this is not a png'));
    expect(() => decodePng(path)).toThrow(/not a PNG/);
  });
});
