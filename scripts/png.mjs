/**
 * Just enough PNG to read a pixel and to write an icon Apple will accept.
 *
 * Two things need this and neither wants a dependency. The generator has to
 * write the app icon WITHOUT an alpha channel — Apple rejects an icon that has
 * one, opaque or not, and Playwright screenshots are always RGBA. The guard has
 * to read corner pixels back, to check the icon is kept's mark on kept's ink
 * rather than a vendor placeholder, and that the corners are square, because
 * iOS applies its own mask and a pre-rounded icon shows dark wedges inside it.
 *
 * Handles 8-bit non-interlaced RGB and RGBA, which is what both sides produce.
 * Anything else throws rather than guessing — a decoder that quietly returns
 * the wrong pixel would make the guard worse than nothing.
 */
import { deflateSync, inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Decode to { width, height, channels, data } with one byte per channel. */
export function decodePng(path) {
  const buf = readFileSync(path);
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error(`${path} is not a PNG`);
  let off = 8;
  let ihdr = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') ihdr = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (!ihdr) throw new Error(`${path} has no IHDR`);
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const interlace = ihdr[12];
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`${path}: only 8-bit non-interlaced RGB/RGBA is handled (got depth ${bitDepth}, colour ${colorType}, interlace ${interlace})`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      const v = line[x];
      out[y * stride + x] =
        (filter === 0 ? v
          : filter === 1 ? v + a
          : filter === 2 ? v + b
          : filter === 3 ? v + ((a + b) >> 1)
          : filter === 4 ? v + paeth(a, b, c)
          : (() => { throw new Error(`${path}: unknown filter ${filter}`); })()) & 0xff;
    }
  }
  return { width, height, channels, data: out };
}

/** The pixel at (x, y) as [r, g, b, a]; a is 255 when the file has no alpha. */
export function pixelAt(image, x, y) {
  const i = (y * image.width + x) * image.channels;
  return [image.data[i], image.data[i + 1], image.data[i + 2], image.channels === 4 ? image.data[i + 3] : 255];
}

/**
 * Write RGB with NO alpha channel, compositing any transparency onto `over`.
 * Apple rejects an app icon carrying an alpha channel at all, so dropping it is
 * the point rather than a size saving.
 */
export function writeOpaquePng(path, image, over = [0, 0, 0]) {
  const { width, height, channels, data } = image;
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none. The image is tiny and this is exact.
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      const a = channels === 4 ? data[i + 3] / 255 : 1;
      for (let c = 0; c < 3; c += 1) {
        raw[y * (stride + 1) + 1 + x * 3 + c] = Math.round(data[i + c] * a + over[c] * (1 - a));
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // truecolour, no alpha
  writeFileSync(path, Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}
