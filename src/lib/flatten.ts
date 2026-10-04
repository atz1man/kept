/**
 * Finding the receipt in a photo and laying it flat.
 *
 * The reader was given the whole photo: the receipt, the table under it, the
 * corner of a phone, at whatever angle the hand held it. Tesseract reads lines
 * of text that run across the page; a slip photographed at an angle has none,
 * and the table's grain around it is read as text too. So before anything is
 * read, the paper is found and its four corners are mapped back to a
 * rectangle — the step every document-scanner app does first.
 *
 * Pure: one byte of brightness per pixel in, the same out, so the unit suite
 * runs exactly what the phone runs. And it declines rather than guesses. A
 * photo where no paper-shaped region stands out from its surroundings — a
 * receipt that already fills the frame, white paper on a white table — comes
 * back as no quad, and the photo is read as it was taken, as it always was.
 */

/** One byte of brightness per pixel, row by row. */
export interface Gray {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface Point {
  x: number;
  y: number;
}

/** Corners in reading order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point];

/** RGBA, as a canvas holds it, to brightness. */
export function toGray(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Gray {
  const data = new Uint8Array(width * height);
  for (let i = 0, j = 0; j < data.length; i += 4, j++) data[j] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
  return { width, height, data };
}

/** A smaller copy, averaged, for finding the paper — which needs shape, not detail. */
export function shrink(g: Gray, maxSide: number): { g: Gray; scale: number } {
  const scale = Math.min(1, maxSide / Math.max(g.width, g.height));
  if (scale === 1) return { g, scale };
  const width = Math.max(1, Math.round(g.width * scale));
  const height = Math.max(1, Math.round(g.height * scale));
  const data = new Uint8Array(width * height);
  const step = 1 / scale;
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * step);
    const y1 = Math.min(g.height, Math.max(y0 + 1, Math.floor((y + 1) * step)));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * step);
      const x1 = Math.min(g.width, Math.max(x0 + 1, Math.floor((x + 1) * step)));
      let sum = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) sum += g.data[yy * g.width + xx];
      data[y * width + x] = sum / ((y1 - y0) * (x1 - x0));
    }
  }
  return { g: { width, height, data }, scale };
}

/** Otsu's threshold: the brightness that best splits the picture into two groups. */
export function otsu(g: Gray): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of g.data) hist[v]++;
  const total = g.data.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let at = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const between = wB * wF * (sumB / wB - (sumAll - sumB) / wF) ** 2;
    if (between > best) {
      best = between;
      at = t;
    }
  }
  return at;
}

/**
 * The biggest bright region, with its print filled in.
 *
 * The table is whatever dark area reaches the edge of the photo; the paper is
 * everything else. That fills the print however heavy it is — a logo, a
 * barcode, a bold total — because print sits INSIDE the paper and never
 * reaches the photo's edge through it. (Closing small gaps instead was the
 * first version, and a heading in large type split one sheet into strips.)
 */
function largestBright(g: Gray, threshold: number): { mask: Uint8Array; area: number } {
  const { width: w, height: h } = g;
  const n = w * h;
  // 1: table, reached from the border through dark pixels.
  const table = new Uint8Array(n);
  const stack: number[] = [];
  const seed = (i: number) => {
    if (!table[i] && g.data[i] <= threshold) {
      table[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (i >= w) seed(i - w);
    if (i < n - w) seed(i + w);
  }
  // The largest connected piece of what is not table.
  const label = new Int32Array(n);
  let best = 0;
  let bestArea = 0;
  let next = 0;
  for (let s = 0; s < n; s++) {
    if (table[s] || label[s]) continue;
    next++;
    let area = 0;
    label[s] = next;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop()!;
      area++;
      const x = i % w;
      const visit = (j: number) => {
        if (!table[j] && !label[j]) {
          label[j] = next;
          stack.push(j);
        }
      };
      if (x > 0) visit(i - 1);
      if (x < w - 1) visit(i + 1);
      if (i >= w) visit(i - w);
      if (i < n - w) visit(i + w);
    }
    if (area > bestArea) {
      bestArea = area;
      best = next;
    }
  }
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = label[i] === best ? 1 : 0;
  return { mask, area: bestArea };
}

const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** The convex hull of a region's edge pixels, anticlockwise (monotone chain). */
function hullOf(mask: Uint8Array, w: number, h: number): Point[] {
  const pts: Point[] = [];
  for (let y = 0; y < h; y++) {
    let first = -1;
    let last = -1;
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        if (first < 0) first = x;
        last = x;
      }
    }
    if (first >= 0) {
      pts.push({ x: first, y });
      if (last !== first) pts.push({ x: last, y });
    }
  }
  pts.sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

const polyArea = (p: Point[]) => Math.abs(p.reduce((s, a, i) => s + cross({ x: 0, y: 0 }, a, p[(i + 1) % p.length]), 0)) / 2;

/** The four hull points enclosing the most area: the paper's corners. */
function biggestQuad(hull: Point[]): Point[] | null {
  if (hull.length < 4) return null;
  // Thin the hull to at most 24 points, evenly spaced along it, for a bounded search.
  const pts = hull.length <= 24 ? hull : Array.from({ length: 24 }, (_, i) => hull[Math.floor((i * hull.length) / 24)]);
  let best: Point[] | null = null;
  let bestArea = 0;
  const n = pts.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++) {
          const q = [pts[a], pts[b], pts[c], pts[d]];
          const area = polyArea(q);
          if (area > bestArea) {
            bestArea = area;
            best = q;
          }
        }
  return best;
}

/** Any four corners, in reading order: the one nearest the top-left first, then clockwise. */
export function orderCorners(q: Point[]): Quad {
  const c = { x: q.reduce((s, p) => s + p.x, 0) / 4, y: q.reduce((s, p) => s + p.y, 0) / 4 };
  const clockwise = [...q].sort((a, b) => Math.atan2(a.y - c.y, a.x - c.x) - Math.atan2(b.y - c.y, b.x - c.x));
  const start = clockwise.reduce((bi, p, i, arr) => (p.x + p.y < arr[bi].x + arr[bi].y ? i : bi), 0);
  return [0, 1, 2, 3].map((k) => clockwise[(start + k) % 4]) as Quad;
}

/** Why a photo was read as taken rather than flattened — said, for the measurements. */
export type NoPaper = 'fills-frame' | 'too-small' | 'not-a-quad' | 'no-contrast' | 'into-the-background';

/**
 * The receipt's corners in a photo, in that photo's pixels — or why there are
 * none worth trusting.
 */
export function findPaper(photo: Gray): { quad: Quad } | { none: NoPaper } {
  const { g, scale } = shrink(photo, 480);
  const total = g.width * g.height;
  const t = otsu(g);
  // Paper against a background needs two groups that are actually apart.
  let lo = 0, nLo = 0, hi = 0, nHi = 0;
  for (const v of g.data) if (v > t) { hi += v; nHi++; } else { lo += v; nLo++; }
  if (!nLo || !nHi || hi / nHi - lo / nLo < 40) return { none: 'no-contrast' };

  const { mask, area } = largestBright(g, t);
  if (area / total > 0.9) return { none: 'fills-frame' };
  if (area / total < 0.06) return { none: 'too-small' };
  const quad = biggestQuad(hullOf(mask, g.width, g.height));
  if (!quad) return { none: 'not-a-quad' };
  // A receipt is a quadrilateral; a region the best four corners cover badly is something else.
  const quadArea = polyArea(orderCorners(quad));
  if (area / quadArea < 0.8 || quadArea / total > 0.95) return { none: 'not-a-quad' };
  const ordered = orderCorners(quad);
  /*
   * Two corners ON the photo's own corners means the bright region ran into
   * the background: paper on a pale table under a lamp, where the top of the
   * table is as bright as the slip and the "receipt" became a trapezoid from
   * the photo's top corners to the slip's bottom ones — and laying THAT flat
   * stretched the print past reading (measured: a flat Boots slip read three
   * fields as taken and two "flattened"). A real receipt running off the top
   * of the frame has its corners at its own edges, not at the frame's.
   */
  const frame = [{ x: 0, y: 0 }, { x: g.width - 1, y: 0 }, { x: g.width - 1, y: g.height - 1 }, { x: 0, y: g.height - 1 }];
  const reach = Math.max(3, 0.02 * Math.max(g.width, g.height));
  if (frame.filter((f) => ordered.some((p) => Math.hypot(p.x - f.x, p.y - f.y) <= reach)).length >= 2) return { none: 'into-the-background' };
  return { quad: ordered.map((p) => ({ x: (p.x + 0.5) / scale, y: (p.y + 0.5) / scale })) as Quad };
}

/** Solve A·x = b by Gaussian elimination with partial pivoting. */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[piv][col])) piv = r;
    [m[col], m[piv]] = [m[piv], m[col]];
    for (let r = 0; r < n; r++) {
      if (r === col || m[col][col] === 0) continue;
      const f = m[r][col] / m[col][col];
      for (let k = col; k <= n; k++) m[r][k] -= f * m[col][k];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}

/** The 3×3 projective map (row-major, last entry 1) taking each `from` corner to its `to` corner. */
export function homography(from: Quad, to: Quad): number[] {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  return [...solve(a, b), 1];
}

export function apply(h: number[], p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * The paper, laid flat: the quad mapped onto an upright rectangle as wide as
 * its longer horizontal edge and as tall as its longer vertical one, so no
 * print is squeezed. Sampled bilinearly from the full photo.
 */
export function flatten(photo: Gray, quad: Quad, maxSide = 2400): Gray {
  const [tl, tr, br, bl] = quad;
  let width = Math.max(dist(tl, tr), dist(bl, br));
  let height = Math.max(dist(tl, bl), dist(tr, br));
  const fit = Math.min(1, maxSide / Math.max(width, height));
  width = Math.max(1, Math.round(width * fit));
  height = Math.max(1, Math.round(height * fit));
  const rect: Quad = [{ x: 0, y: 0 }, { x: width - 1, y: 0 }, { x: width - 1, y: height - 1 }, { x: 0, y: height - 1 }];
  // From each output pixel back to where it is in the photo.
  const back = homography(rect, quad);
  const data = new Uint8Array(width * height);
  const { width: pw, height: ph, data: src } = photo;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const w = back[6] * x + back[7] * y + back[8];
      const sx = (back[0] * x + back[1] * y + back[2]) / w;
      const sy = (back[3] * x + back[4] * y + back[5]) / w;
      const x0 = Math.max(0, Math.min(pw - 2, Math.floor(sx)));
      const y0 = Math.max(0, Math.min(ph - 2, Math.floor(sy)));
      const fx = Math.max(0, Math.min(1, sx - x0));
      const fy = Math.max(0, Math.min(1, sy - y0));
      const i = y0 * pw + x0;
      const top = src[i] * (1 - fx) + src[i + 1] * fx;
      const bottom = src[i + pw] * (1 - fx) + src[i + pw + 1] * fx;
      data[y * width + x] = top * (1 - fy) + bottom * fy;
    }
  }
  return { width, height, data };
}

/** Brightness stretched to the full range: grey print on off-white paper, made black on white. */
export function stretch(g: Gray): Gray {
  let lo = 255;
  let hi = 0;
  for (const v of g.data) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = Math.max(1, hi - lo);
  return { ...g, data: g.data.map((v) => Math.round(((v - lo) / span) * 255)) };
}

/**
 * A photo as the reader is given it: the receipt found and laid flat where
 * one stands out (`flat`, else null), and the whole photo as taken
 * (`asTaken`), each at most `maxSide` on its long side and contrast
 * stretched. The reader tries the first and falls back to the second
 * (`readFlattenedOrAsTaken`). What scan.ts does to every photo, here so the
 * benchmark measures exactly that and nothing like it.
 */
export function readable(photo: Gray, maxSide = 2000): { flat: Gray | null; asTaken: Gray; paper: Quad | NoPaper } {
  const found = findPaper(photo);
  return {
    flat: 'quad' in found ? stretch(flatten(photo, found.quad, maxSide)) : null,
    asTaken: stretch(shrink(photo, maxSide).g),
    paper: 'quad' in found ? found.quad : found.none,
  };
}
