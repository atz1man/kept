import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The native shell.
 *
 * `webDir` is `dist-ios`, not `dist`, and the difference is not tidiness. The
 * web build puts the LANDING PAGE at the root and the app under `/app/`,
 * because on the web those are two things a visitor moves between. A Capacitor
 * shell loads the root of `webDir`, so pointing it at `dist` would ship an iOS
 * app that opens on the marketing page — with a "Download on the App Store"
 * button, inside the App Store app. `npm run build:ios` builds to `dist-ios`
 * and makes the app itself the entry; see scripts/ios-entry.mjs.
 */
const config: CapacitorConfig = {
  // PLACEHOLDER. This must match the bundle identifier registered to the Apple
  // developer account before anything can be signed or submitted — it cannot
  // be guessed from here, and it is deliberately obvious rather than
  // plausible-looking, in the same spirit as SOCIAL_PROOF_IS_PLACEHOLDER and
  // TABLE_CHECKED_ON.
  appId: 'uk.co.kept.REPLACE_ME',
  appName: 'Quids In',
  webDir: 'dist-ios',
  ios: {
    /*
     * NO backgroundColor, on purpose. It used to be '#FFFFFF' to close the
     * seam between the launch screen and the first paint — right for a white
     * app, and wrong once the app followed the phone into dark mode: this
     * setting takes one hex, so a dark phone got a white launch screen, a
     * white webview, and then a dark app. Left unset, Capacitor paints the
     * webview `UIColor.systemBackground` (CAPBridgeViewController), which is
     * exactly #FFFFFF in light mode and follows the phone in dark. The launch
     * image carries a dark appearance in the asset catalogue for the same
     * reason. test/ios-assets.test.ts holds all of it together.
     */
    /*
     * Left ON, which is Capacitor's default — but as a decision now, because
     * the comment that used to sit here argued for the opposite of what the
     * line set. It said nothing about this app wants a scroll that bounces
     * past its own background, which is an argument for `false`.
     *
     * What `scrollEnabled` governs is the WEBVIEW's own scroll view, and this
     * app gives that scroll view no content to move: `main.tsx` fixes the
     * column at `100dvh` with `overflow: hidden`, and every screen that can
     * outgrow the phone carries its own `overflow: auto` pane. So the only
     * thing enabling it contributes is the rubber-band — and turning it off is
     * the standard shape for a webview whose page scrolls itself.
     *
     * It stays on anyway, for a reason nothing in this repository can settle.
     * Without `@capacitor/keyboard` — which is not installed, and installing
     * it means a pod nobody here can run `pod install` for — the only thing
     * lifting a focused field clear of the iOS keyboard is WKWebView's own
     * scroll view: iOS insets it and scrolls the field into view. The keyboard
     * does not shrink `100dvh`. So disabling it risks the paste box on the Add
     * screen sitting under the keyboard with nothing able to move it, and that
     * is the app's primary input path traded for a bounce. A device settles it
     * in about thirty seconds; a guess from here does not.
     *
     * The pairing the argument rests on IS checked, in test/ios-scroll.test.ts:
     * if the root ever starts scrolling, the reasoning above stops holding and
     * that test says so.
     */
    scrollEnabled: true,
  },
};

export default config;
