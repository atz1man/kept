/**
 * How much larger (or smaller) to set the app's text, from the size the
 * person chose for every app in iOS Settings → Display & Brightness → Text
 * Size (and Accessibility → Larger Text).
 *
 * A web view ignores that setting on its own: every app on the phone grew
 * with it and Quids In stayed at its designed size. The native side reports
 * the body text size the person picked as a multiple of the default 17pt
 * (@capacitor/text-zoom), and src/app/text-size-native.ts applies it.
 *
 * Capped at twice the default. The accessibility sizes go to just over three
 * times, and the layout is measured at two (scripts/layout.mjs, 320px and
 * 402px phones) — the size Apple's "Larger Text" accessibility label asks an
 * app to support. Past that, a promise the layout has not been checked
 * against would be worse than the cap. The smaller sizes are honoured down
 * to iOS's smallest, which is about 0.82.
 */
export const MAX_TEXT_SCALE = 2;
export const MIN_TEXT_SCALE = 0.8;

/** The scale to apply, from what the phone reported; 1 for anything unreadable. */
export function textScale(preferred: unknown): number {
  if (typeof preferred !== 'number' || !Number.isFinite(preferred) || preferred <= 0) return 1;
  return Math.round(Math.min(MAX_TEXT_SCALE, Math.max(MIN_TEXT_SCALE, preferred)) * 100) / 100;
}

/** As the CSS property takes it: 1.5 → "150%". */
export function textSizeAdjust(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}
