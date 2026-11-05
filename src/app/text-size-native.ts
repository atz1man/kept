import { registerPlugin } from '@capacitor/core';
import { isNative } from '../lib/mirror';
import { textScale, textSizeAdjust } from '../lib/text-size';

/**
 * Following the iPhone's text size (src/lib/text-size.ts).
 *
 * Only the native half of @capacitor/text-zoom is used: its `getPreferred`
 * reads the size from iOS, and the scale is set here so it can be capped.
 * Read at launch and again whenever the app comes back to the front, which is
 * when someone who has just changed the setting in Settings returns to it.
 * A display figure keeps its own size (`.k-display` in styles.css).
 */
interface TextZoomPlugin {
  getPreferred(): Promise<{ value: number }>;
}

const TextZoom = registerPlugin<TextZoomPlugin>('TextZoom');

async function apply(): Promise<void> {
  try {
    const { value } = await TextZoom.getPreferred();
    const scale = textScale(value);
    document.body.style.setProperty('-webkit-text-size-adjust', textSizeAdjust(scale));
    // Rows wrap rather than end in "…" once the text is larger (styles.css).
    document.documentElement.toggleAttribute('data-text-scaled', scale > 1);
  } catch (e) {
    console.warn('text size not read', e);
  }
}

export function followTextSize(): void {
  if (!isNative()) return;
  void apply();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void apply();
  });
}
