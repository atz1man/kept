import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The webview's scroll view and the page's own scrolling have to agree.
 *
 * `ios.scrollEnabled` governs WKWebView's own UIScrollView, and the config
 * set `true` under a comment arguing for the opposite — that nothing in this
 * app wants a scroll bouncing past its own background. `true` is also the
 * default, so the line read as a decision and was not one.
 *
 * What is asserted here is the premise underneath that argument, which is the
 * part this repository can actually settle: the app scrolls itself. The column
 * in `main.tsx` is fixed at one viewport and clipped, and every screen that
 * can outgrow the phone carries its own `overflow: auto` pane. While that
 * holds, the webview's scroll view has no content to move and enabling it
 * contributes only the rubber-band.
 *
 * The value itself is deliberately NOT asserted. Turning the scroll view off
 * is the standard shape for a page that scrolls itself, but without
 * @capacitor/keyboard — not installed — it is also the only thing lifting a
 * focused field clear of the iOS keyboard, which does not shrink 100dvh. That
 * is the Add screen's paste box against a bounce, and it wants a device rather
 * than a guess; capacitor.config.ts records the open question. If the root
 * ever starts scrolling, the premise is gone and this fails, which is when
 * the question needs asking again anyway.
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

  it('says which way it went, and why, rather than restating a default', () => {
    // Not the value — see above. That the reasoning is written down where the
    // next person meets the setting, and names the keyboard as what is unsettled.
    const config = read('capacitor.config.ts');
    expect(config).toMatch(/scrollEnabled/);
    expect(config).toMatch(/keyboard/i);
  });
});
