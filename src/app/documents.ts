/**
 * A receipt that arrives as a file, read on this device: a PDF e-receipt or
 * invoice, a saved order email, a saved order page, or a photo.
 *
 * The rules live in lib/documents.ts and are tested there on real files; this
 * is the part that needs a browser. pdf.js is loaded only when a PDF is
 * opened, and its worker is one of this app's own files (Vite emits it beside
 * the bundle), so nothing is fetched from anyone else — the same footing the
 * OCR reader is on.
 */
import {
  bestReading, bytesToBinary, emailAsText, fromPdfJs, htmlToText, kindOf, looksScanned, pdfLines, readEmail, yieldOf,
  type PdfJsItem,
} from '../lib/documents';

/** Read as text, ready for the parser; or a picture, for the photo reader. */
export type DocumentRead =
  | { kind: 'text'; text: string; from: 'pdf' | 'email' | 'page' | 'text' }
  | { kind: 'image'; image: Blob; from: 'photo' | 'scanned-pdf' };

export class UnreadableDocument extends Error {
  constructor(readonly why: 'too-big' | 'not-a-receipt' | 'unreadable') {
    super(why);
  }
}

/** Far above any receipt; a file this size is a video or a book. */
const MAX_BYTES = 25 * 1024 * 1024;
/** A receipt is a page or two; an invoice bundle that runs on is read from its start. */
const MAX_PAGES = 4;

async function pdfjs() {
  const [lib, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  lib.GlobalWorkerOptions.workerSrc = worker.default;
  return lib;
}

/**
 * A PDF's text, or — when it has none, because it is a scan or a photo saved
 * as a PDF — its first page drawn as a picture for the photo reader.
 */
async function readPdf(bytes: Uint8Array): Promise<DocumentRead> {
  const lib = await pdfjs();
  // Fonts are not needed to read text, and none are fetched.
  const task = lib.getDocument({ data: bytes, disableFontFace: true, useSystemFonts: true });
  try {
    const doc = await task.promise;
    const pages: ReturnType<typeof fromPdfJs>[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      pages.push(fromPdfJs(content.items as PdfJsItem[]));
    }
    const text = pdfLines(pages);
    if (!looksScanned(text)) return { kind: 'text', text, from: 'pdf' };

    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    // The size the photo reader reads best at, as `prepare` in scan.ts scales to.
    const viewport = page.getViewport({ scale: Math.min(4, 2000 / Math.max(base.width, base.height)) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new UnreadableDocument('unreadable');
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const image = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'));
    if (!image) throw new UnreadableDocument('unreadable');
    return { kind: 'image', image, from: 'scanned-pdf' };
  } finally {
    await task.destroy();
  }
}

/** Whatever was chosen, as text the parser reads or a picture the photo reader does. */
export async function readDocument(file: File, today: Date): Promise<DocumentRead> {
  if (file.size > MAX_BYTES) throw new UnreadableDocument('too-big');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = kindOf(file.name, file.type, bytes.subarray(0, 512));
  try {
    switch (kind) {
      case 'image':
        return { kind: 'image', image: file, from: 'photo' };
      case 'pdf':
        return await readPdf(bytes);
      case 'email': {
        const mail = readEmail(bytesToBinary(bytes));
        const body = bestReading(mail.bodies, today) ?? '';
        const text = emailAsText(mail, body);
        // An invoice is often the attachment and the body a thank-you note:
        // read the PDF too, and keep whichever says more.
        const pdf = mail.attachments[0];
        if (pdf && yieldOf(text, today) < 4) {
          const attached = await readPdf(pdf.bytes).catch(() => null);
          if (attached?.kind === 'text' && yieldOf(attached.text, today) > yieldOf(text, today)) {
            return { kind: 'text', text: emailAsText(mail, attached.text), from: 'email' };
          }
        }
        if (!body && !pdf) throw new UnreadableDocument('not-a-receipt');
        return { kind: 'text', text, from: 'email' };
      }
      case 'html':
        return { kind: 'text', text: htmlToText(new TextDecoder().decode(bytes)), from: 'page' };
      case 'text':
        return { kind: 'text', text: new TextDecoder().decode(bytes), from: 'text' };
      default:
        throw new UnreadableDocument('not-a-receipt');
    }
  } catch (e) {
    throw e instanceof UnreadableDocument ? e : new UnreadableDocument('unreadable');
  }
}
