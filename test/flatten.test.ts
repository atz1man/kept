import { describe, expect, it } from 'vitest';
import { apply, findPaper, flatten, homography, orderCorners, otsu, readable, shrink, toGray, type Gray, type Point, type Quad } from '../src/lib/flatten';

/**
 * Finding the paper and laying it flat, on pictures drawn here so that the
 * truth is known exactly: a sheet with lines of "print" on it, rotated and in
 * perspective, on a darker table. scripts/scan-bench measures the effect on
 * reading; this pins the geometry.
 */

const inside = (q: Point[], x: number, y: number) =>
  q.every((a, i) => {
    const b = q[(i + 1) % q.length];
    return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) >= 0;
  });

/** A table, and on it the quad `sheet` with dark stripes of "print" across its own width. */
function photo(w: number, h: number, sheet: Quad, opts: { table?: number; paper?: number; stripes?: boolean } = {}): Gray {
  const data = new Uint8Array(w * h).fill(opts.table ?? 60);
  // Stripes in the sheet's own coordinates: map each pixel back to the unit square.
  const unit: Quad = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  const back = homography(sheet, unit);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!inside(sheet, x + 0.5, y + 0.5)) continue;
      const u = apply(back, { x: x + 0.5, y: y + 0.5 });
      const row = Math.floor(u.y * 20);
      const printed = opts.stripes !== false && row % 2 === 1 && u.x > 0.1 && u.x < 0.9;
      data[y * w + x] = printed ? 40 : opts.paper ?? 235;
    }
  return { width: w, height: h, data };
}

const near = (a: Point, b: Point, tol: number) => Math.hypot(a.x - b.x, a.y - b.y) <= tol;

describe('the projective map', () => {
  it('takes each corner to its partner exactly', () => {
    const from: Quad = [{ x: 10, y: 20 }, { x: 300, y: 5 }, { x: 320, y: 400 }, { x: 0, y: 380 }];
    const to: Quad = [{ x: 0, y: 0 }, { x: 99, y: 0 }, { x: 99, y: 199 }, { x: 0, y: 199 }];
    const h = homography(from, to);
    from.forEach((p, i) => expect(near(apply(h, p), to[i], 1e-6)).toBe(true));
  });
});

describe('corners in reading order', () => {
  it('starts at the top-left and goes clockwise, whatever order they came in', () => {
    const tl = { x: 12, y: 10 }, tr = { x: 200, y: 30 }, br = { x: 190, y: 300 }, bl = { x: 5, y: 280 };
    expect(orderCorners([br, tl, bl, tr])).toEqual([tl, tr, br, bl]);
    expect(orderCorners([bl, br, tr, tl])).toEqual([tl, tr, br, bl]);
  });
});

describe('finding the paper', () => {
  const sheet: Quad = [{ x: 160, y: 140 }, { x: 470, y: 190 }, { x: 430, y: 690 }, { x: 110, y: 640 }];

  it('finds a tilted sheet in perspective, to within a few pixels of each corner', () => {
    const found = findPaper(photo(600, 800, sheet));
    if (!('quad' in found)) throw new Error(`no paper: ${found.none}`);
    found.quad.forEach((p, i) => expect(near(p, sheet[i], 8), `corner ${i}: ${JSON.stringify(p)}`).toBe(true));
  });

  it('finds it the same in a photo eight times the size', () => {
    const big = sheet.map((p) => ({ x: p.x * 2, y: p.y * 2 })) as Quad;
    const found = findPaper(photo(1200, 1600, big));
    if (!('quad' in found)) throw new Error(`no paper: ${found.none}`);
    found.quad.forEach((p, i) => expect(near(p, big[i], 12)).toBe(true));
  });

  it('keeps a sheet whole when its print runs to the edge', () => {
    // Print splitting the white into strips must not make the paper a strip.
    const found = findPaper(photo(600, 800, sheet, { stripes: true }));
    expect('quad' in found).toBe(true);
  });

  it('declines a receipt that already fills the frame', () => {
    const full: Quad = [{ x: 2, y: 2 }, { x: 597, y: 2 }, { x: 597, y: 797 }, { x: 2, y: 797 }];
    expect(findPaper(photo(600, 800, full))).toEqual({ none: 'fills-frame' });
  });

  it('declines white paper on a white table — there is nothing to tell them apart', () => {
    expect(findPaper(photo(600, 800, sheet, { table: 225, stripes: false }))).toEqual({ none: 'no-contrast' });
  });

  it('declines a region that ran into a pale background — two corners on the photo\'s own', () => {
    // A lamp-lit table as bright as the slip across the top of the photo: the
    // brightness joins the two, and the four corners are the frame's top two
    // and the slip's bottom two.
    const sheetOnPale: Quad = [{ x: 120, y: 300 }, { x: 480, y: 300 }, { x: 480, y: 600 }, { x: 120, y: 600 }];
    const g = photo(600, 800, sheetOnPale);
    for (let y = 0; y < 300; y++) for (let x = 0; x < 600; x++) g.data[y * 600 + x] = 225 - Math.round((y / 300) * 15);
    expect(findPaper(g)).toEqual({ none: 'into-the-background' });
  });

  it('still takes a receipt running off the top of the frame, its corners at its own edges', () => {
    const offTop: Quad = [{ x: 180, y: 0 }, { x: 420, y: 0 }, { x: 430, y: 620 }, { x: 170, y: 640 }];
    const found = findPaper(photo(600, 800, offTop));
    if (!('quad' in found)) throw new Error(`no paper: ${found.none}`);
    found.quad.forEach((p, i) => expect(near(p, offTop[i], 10), `corner ${i}: ${JSON.stringify(p)}`).toBe(true));
  });

  it('finds a slip wider than the frame, the table only above and below it', () => {
    // Held close: the paper runs off both sides, so the table touches only the
    // top and bottom of the photo — and has to be found from there.
    const wide: Quad = [{ x: 0, y: 260 }, { x: 599, y: 260 }, { x: 599, y: 560 }, { x: 0, y: 560 }];
    const found = findPaper(photo(600, 800, wide));
    if (!('quad' in found)) throw new Error(`no paper: ${found.none}`);
    found.quad.forEach((p, i) => expect(near(p, wide[i], 8), `corner ${i}: ${JSON.stringify(p)}`).toBe(true));
  });

  it('declines a speck', () => {
    const speck: Quad = [{ x: 290, y: 390 }, { x: 330, y: 390 }, { x: 330, y: 430 }, { x: 290, y: 430 }];
    expect(findPaper(photo(600, 800, speck))).toEqual({ none: 'too-small' });
  });

  it('declines a bright region that is not four-cornered', () => {
    // An L of light — a window, a lamp's pool — is not a receipt.
    const g = photo(600, 800, [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 250 }, { x: 100, y: 250 }], { stripes: false });
    for (let y = 250; y < 700; y++) for (let x = 100; x < 250; x++) g.data[y * 600 + x] = 235;
    expect(findPaper(g)).toEqual({ none: 'not-a-quad' });
  });
});

describe('laying it flat', () => {
  it('turns print that ran at an angle into rows that run straight across', () => {
    const sheet: Quad = [{ x: 160, y: 140 }, { x: 470, y: 190 }, { x: 430, y: 690 }, { x: 110, y: 640 }];
    const flat = flatten(photo(600, 800, sheet), sheet);
    // Every row of the flattened sheet is one thing — paper or print — across
    // the middle of its width, so its spread of brightness is small.
    let ragged = 0;
    for (let y = 2; y < flat.height - 2; y++) {
      const row = Array.from(flat.data.subarray(y * flat.width + Math.round(flat.width * 0.2), y * flat.width + Math.round(flat.width * 0.8)));
      if (Math.max(...row) - Math.min(...row) > 120) ragged++;
    }
    // Only the anti-aliased boundary rows between stripes may straddle both.
    expect(ragged / flat.height).toBeLessThan(0.12);
    // And it is upright: taller than wide, like the sheet.
    expect(flat.height).toBeGreaterThan(flat.width);
  });

  it('is as wide as the sheet\'s longer edge, so the far end is not squeezed', () => {
    // In perspective the far edge is shorter; the near edge is the true width.
    const sheet: Quad = [{ x: 200, y: 100 }, { x: 400, y: 100 }, { x: 560, y: 700 }, { x: 40, y: 700 }];
    const flat = flatten(photo(600, 800, sheet), sheet);
    expect(flat.width).toBe(520);
  });

  it('keeps the long side within the limit it is given', () => {
    const sheet: Quad = [{ x: 0, y: 0 }, { x: 299, y: 0 }, { x: 299, y: 799 }, { x: 0, y: 799 }];
    const flat = flatten(photo(300, 800, sheet), sheet, 400);
    expect(Math.max(flat.width, flat.height)).toBe(400);
  });
});

describe('what the reader is given', () => {
  it('is the sheet laid flat, where there is one', () => {
    const sheet: Quad = [{ x: 160, y: 140 }, { x: 470, y: 190 }, { x: 430, y: 690 }, { x: 110, y: 640 }];
    const { flat, asTaken, paper } = readable(photo(600, 800, sheet));
    expect(Array.isArray(paper)).toBe(true);
    if (!flat) throw new Error('not flattened');
    expect(flat.width).toBeLessThan(400);
    expect(flat.height).toBeGreaterThan(flat.width);
    // And the photo as taken, for the read that falls back to it.
    expect([asTaken.width, asTaken.height]).toEqual([600, 800]);
  });

  it('is the photo as taken, at most the size asked, where there is none — and says why', () => {
    const { flat, asTaken, paper } = readable(photo(1200, 1600, [{ x: 4, y: 4 }, { x: 1195, y: 4 }, { x: 1195, y: 1595 }, { x: 4, y: 1595 }]), 800);
    expect(paper).toBe('fills-frame');
    expect(flat).toBeNull();
    expect([asTaken.width, asTaken.height]).toEqual([600, 800]);
  });

  it('is stretched to the full range of brightness', () => {
    const { flat, asTaken } = readable(photo(600, 800, [{ x: 160, y: 140 }, { x: 470, y: 190 }, { x: 430, y: 690 }, { x: 110, y: 640 }]));
    for (const image of [flat!, asTaken]) {
      expect(image.data.reduce((m, v) => Math.min(m, v), 255)).toBe(0);
      expect(image.data.reduce((m, v) => Math.max(m, v), 0)).toBe(255);
    }
  });
});

describe('the helpers', () => {
  it('turns RGBA into brightness with the usual weights', () => {
    expect(Array.from(toGray(new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]), 3, 1).data)).toEqual([76, 149, 29]);
  });

  it('averages when it shrinks, and leaves a small picture alone', () => {
    const g: Gray = { width: 4, height: 2, data: new Uint8Array([0, 100, 200, 200, 0, 100, 200, 200]) };
    expect(Array.from(shrink(g, 2).g.data)).toEqual([50, 200]);
    expect(shrink(g, 10).scale).toBe(1);
  });

  it('splits two groups of brightness between them', () => {
    // Two groups well off the middle, so a fixed 127 would put both on one side.
    const g: Gray = { width: 5, height: 1, data: new Uint8Array([170, 180, 190, 245, 250]) };
    const t = otsu(g);
    expect(t).toBeGreaterThanOrEqual(190);
    expect(t).toBeLessThan(245);
  });
});
