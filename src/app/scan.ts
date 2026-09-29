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

/** Where the reader's files live: `ocr/` beside the app, whatever the app's path. */
function ocrBase(): string {
  // /app/ on the web, / in the iOS bundle: `..` from either is the root.
  return new URL('../ocr/', window.location.href).href;
}

/**
 * The photo, made readable: scaled so the text is the size tesseract reads
 * best (receipt photos arrive at 12 megapixels, which is slow and no more
 * accurate), greyed, and its contrast stretched, because a till receipt is
 * grey print on off-white paper under whatever light the kitchen has.
 */
async function prepare(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, 2000 / longest);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let lo = 255;
  let hi = 0;
  for (let i = 0; i < d.length; i += 4) {
    const y = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = y;
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const y = Math.round(((d[i] - lo) / span) * 255);
    d[i] = d[i + 1] = d[i + 2] = y;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export type ScanProgress = (fraction: number) => void;

/** The text on the receipt in the photo, read on this device. */
export async function readReceiptPhoto(file: Blob, onProgress?: ScanProgress): Promise<string> {
  const [{ createWorker, OEM }, canvas] = await Promise.all([import('tesseract.js'), prepare(file)]);
  const base = ocrBase();
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: base.replace(/\/$/, ''),
    // A worker script from this origin rather than a blob wrapping one: the
    // blob route exists for loading the worker from a CDN, which this never does.
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(canvas);
    return data.text;
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
export async function takeReceiptPhoto(): Promise<Blob | null> {
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
    return new Blob([bytes], { type: `image/${shot.format || 'jpeg'}` });
  } catch (e) {
    if (isCameraCancellation(e)) return null;
    throw e;
  }
}
