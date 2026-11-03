import { registerPlugin } from '@capacitor/core';
import { isNative } from '../lib/mirror';
import type { WidgetSnapshot } from '../lib/widget-snapshot';

/**
 * Handing the widget its snapshot (packages/widget-bridge).
 *
 * Fire and forget, and never in the way: the widget is a convenience on the
 * Home Screen and the app is the record, so a failure here is logged and
 * nothing else happens. Writes are queued so two quick saves cannot land out
 * of order and leave the widget showing the older one; and a write identical
 * to the last is skipped, because each one asks iOS to redraw the widget and
 * iOS budgets those.
 */
interface WidgetBridgePlugin {
  write(options: { json: string }): Promise<void>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

let queue: Promise<unknown> = Promise.resolve();
let last: string | null = null;

export function writeWidget(snapshot: WidgetSnapshot): Promise<void> {
  if (!isNative()) return Promise.resolve();
  const json = JSON.stringify(snapshot);
  if (json === last) return Promise.resolve();
  const run = queue.then(async () => {
    try {
      await WidgetBridge.write({ json });
      last = json;
    } catch (e) {
      console.warn('widget not updated', e);
    }
  });
  queue = run;
  return run;
}
