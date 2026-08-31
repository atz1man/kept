import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The webview's scroll view and the page's own scrolling have to agree.
 *
 * `ios.scrollEnabled` governs WKWebView's own UIScrollView. This app gives
 * that scroll view nothing to do — the column in `main.tsx` is fixed at one
 * viewport with `overflow: hidden`, and every screen that can outgrow the
 * phone carries its own `overflow: auto` pane — so the only thing enabling it
 * contributes is the rubber-band, dragging the whole app off its own ground.
 * The config said `true` under a comment arguing for the opposite, and `true`
 * is the default, so the line had no effect at all.
 *
 * Both halves are checked, because turning it off is only right WHILE the
 * root is fixed. If someone later lets the document scroll, a disabled scroll
 * view is a page that cannot be reached — the opposite defect, silent in the
 * same way. This fails then, naming which half moved.
 */
const read = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

describe('scrolling in the native shell', () => {
  it('leaves the webview scroll view nothing to do', () => {
    const main = read('src/app/main.tsx');
    // The app column: one viewport tall, and clipped rather than scrolled.
    expect(main).toMatch(/height: '100dvh'/);
    expect(main).toMatch(/overflow: 'hidden'/);
  });

  it('gives every screen that can outgrow the phone its own scroller', () => {
    /*
     * The claim above is only true while this holds. Onboarding is the one
     * screen deliberately without a scroller: it is built to fit, and a step
     * that scrolls is a step that is too long.
     */
    const screens = ['Home', 'Add', 'Detail', 'Edit', 'Settings', 'Watch'];
    for (const name of screens) {
      expect(read(`src/app/screens/${name}.tsx`), name).toMatch(/overflow: 'auto'/);
    }
  });

  it('turns the webview scroll view off, so nothing rubber-bands', () => {
    expect(read('capacitor.config.ts')).toMatch(/scrollEnabled:\s*false/);
  });
});
