/**
 * Read a photographed receipt, on this device.
 *
 * The paste box made kept an app for online orders: a paper receipt from a
 * till had to be typed in by hand, and "Scanning a paper receipt lands in a
 * later release" said so. This reads the photo with tesseract — WebAssembly,
 * in a worker, in the web view — and hands back the text. Nothing is uploaded:
 * the worker, the engine and the English model are all served from this app
 * (see `serveOcrFiles` in vite.config.ts), which is also what lets it work
 * offline and inside the iOS app.
 *
 * Loaded lazily. tesseract.js and its ~7MB of engine only arrive the first
 * time someone chooses to scan; the service worker and tesseract's own cache
 * keep them after that.
 */
import { readable, toGray, type Gray } from '../lib/flatten';
import { readFlattenedOrAsTaken, UNSURE_BELOW, type Reader, type Reading } from '../lib/receipt-scan';

/** Where the reader's files live: `ocr/` beside the app, whatever the app's path. */
function ocrBase(): string {
  // /app/ on the web, / in the iOS bundle: `..` from either is the root.
  return new URL('../ocr/', window.location.href).href;
}

/**
 * The photo, made readable: the receipt found and laid flat (lib/flatten.ts),
 * scaled so the text is the size tesseract reads best (receipt photos arrive
 * at 12 megapixels, which is slow and no more accurate), greyed, and its
 * contrast stretched, because a till receipt is grey print on off-white paper
 * under whatever light the kitchen has.
 *
 * The receipt is looked for in a larger copy than is read, so a slip that
 * fills a third of the frame still comes out at a size tesseract can read.
 * Where no paper stands out — it already fills the frame, or there is
 * nothing to tell it from the table — the photo is read as it was taken.
 */
async function prepare(file: Blob): Promise<{ flat: HTMLCanvasElement | null; asTaken: HTMLCanvasElement }> {
  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, 3000 / longest);
  const source = document.createElement('canvas');
  source.width = Math.round(bitmap.width * scale);
  source.height = Math.round(bitmap.height * scale);
  const sctx = source.getContext('2d', { willReadFrequently: true });
  if (!sctx) return { flat: null, asTaken: source };
  sctx.drawImage(bitmap, 0, 0, source.width, source.height);
  bitmap.close?.();

  const { flat, asTaken } = readable(toGray(sctx.getImageData(0, 0, source.width, source.height).data, source.width, source.height));
  return { flat: flat ? toCanvas(flat) : null, asTaken: toCanvas(asTaken) };
}

/** Brightness back onto a canvas, which is what the reader takes. */
function toCanvas(g: Gray): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = g.width;
  canvas.height = g.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const img = ctx.createImageData(g.width, g.height);
  for (let i = 0, j = 0; i < g.data.length; i++, j += 4) {
    img.data[j] = img.data[j + 1] = img.data[j + 2] = g.data[i];
    img.data[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** How far through a read, and whether it is the second look (see `readBestOf`). */
/**
 * Can the reader's files be fetched right now?
 *
 * Asked after a scan fails, to tell a missing connection from a bad photo.
 * `navigator.onLine` was the first answer and it was wrong: measured on CI's
 * Chromium, it went on saying online while the network was cut, and the
 * photo got the blame again. It says only that some network exists, and wifi
 * with no internet, or a site that cannot be reached, are both "online". So
 * this asks the question that matters, for the file the next scan would need
 * first. A HEAD, because the service worker answers only GETs, so a cached
 * copy cannot make an unreachable site look reachable.
 */
export async function readerReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${ocrBase()}worker.min.js`, { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

export type ScanProgress = (fraction: number, again: boolean) => void;

/** The text on the receipt in the photo, read on this device, and the words the reader was unsure of. */
export async function readReceiptPhoto(file: Blob, today: Date, onProgress?: ScanProgress): Promise<Reading> {
  const [{ createWorker, OEM }, prepared] = await Promise.all([import('tesseract.js'), prepare(file)]);
  const base = ocrBase();
  let again = false;
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: base.replace(/\/$/, ''),
    // A worker script from this origin rather than a blob wrapping one: the
    // blob route exists for loading the worker from a CDN, which this never does.
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress, again);
    },
  });
  try {
    let reads = 0;
    const readerFor = (canvas: HTMLCanvasElement): Reader => async (how) => {
      // Every read after the first is "having another look".
      again = reads++ > 0;
      // tesseract's own names: 0 is Otsu, one threshold for the page; 2 is Sauvola, one per neighbourhood.
      await worker.setParameters({ thresholding_method: how === 'global' ? '0' : '2' });
      // `blocks` for the per-word scores; the text is the same either way.
      const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
      const unsure = (data.blocks ?? []).flatMap((b) =>
        b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words.filter((w) => w.confidence < UNSURE_BELOW).map((w) => ({ text: w.text, confidence: w.confidence })))),
      );
      return { text: data.text, unsure };
    };
    return await readFlattenedOrAsTaken(prepared.flat && readerFor(prepared.flat), readerFor(prepared.asTaken), today);
  } finally {
    await worker.terminate();
  }
}

/**
 * A new photograph from the camera, in the iOS app — never the library.
 *
 * On the web a file input does this job. In the iOS app the scan goes through
 * the same camera call as a kept receipt photo (`ReceiptPhoto`), so the promise
 * Info.plist makes — kept never opens your photo library — stays true of every
 * way the app uses the camera, and `ios-usage-strings.test.ts` holds both to it.
 * Null when the person cancels.
 */
export async function takeReceiptPhoto(): Promise<{ blob: Blob; base64: string } | null> {
  const [{ Camera, CameraResultType, CameraSource }, { isCameraCancellation }] = await Promise.all([
    import('@capacitor/camera'),
    import('../lib/photos'),
  ]);
  try {
    const shot = await Camera.getPhoto({
      quality: 85,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      correctOrientation: true,
    });
    if (!shot.base64String) return null;
    const bytes = Uint8Array.from(atob(shot.base64String), (c) => c.charCodeAt(0));
    // The base64 as well as the image: it is what `savePhoto` writes, so the
    // same picture can be kept with the receipt as proof of purchase.
    return { blob: new Blob([bytes], { type: `image/${shot.format || 'jpeg'}` }), base64: shot.base64String };
  } catch (e) {
    if (isCameraCancellation(e)) return null;
    throw e;
  }
}
