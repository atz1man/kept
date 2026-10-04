/**
 * The iPhone's own receipt scanner: Apple's document camera, which finds the
 * slip's edges and flattens it as it is taken, read by Vision on the device.
 * The plugin is packages/receipt-scanner; this is how the app asks it.
 *
 * Where it is not there — an older build, a device without the document
 * camera, the web — the answer is `unavailable`, and the app falls back to
 * the camera and the reader it has always used, so nothing that worked stops.
 */
import { registerPlugin } from '@capacitor/core';
import { fromVision, type VisionPage } from '../lib/receipt-scan';

interface ReceiptScannerPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  scan(): Promise<{ pages: (VisionPage & { jpeg: string })[] }>;
}

const ReceiptScanner = registerPlugin<ReceiptScannerPlugin>('ReceiptScanner');

export type DocumentScan =
  | { kind: 'read'; text: string; base64: string }
  | { kind: 'cancelled' }
  | { kind: 'unavailable' };

/** Scan with the document camera, or say why not. */
export async function scanWithDocumentCamera(): Promise<DocumentScan> {
  try {
    if (!(await ReceiptScanner.isAvailable()).available) return { kind: 'unavailable' };
  } catch {
    // Not in this build: the plugin call itself is unimplemented.
    return { kind: 'unavailable' };
  }
  try {
    const { pages } = await ReceiptScanner.scan();
    return { kind: 'read', text: fromVision(pages), base64: pages[0]?.jpeg ?? '' };
  } catch (e) {
    if ((e as { code?: string })?.code === 'CANCELLED') return { kind: 'cancelled' };
    return { kind: 'unavailable' };
  }
}
