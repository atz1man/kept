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
  appName: 'kept',
  webDir: 'dist-ios',
  ios: {
    // The app draws its own cream ground; a white flash between the launch
    // screen and the first paint is the kind of seam the design has no
    // patience for elsewhere.
    backgroundColor: '#FDFAF1',
    /*
     * The comment here used to argue for exactly what the value did not do.
     *
     * `true` is Capacitor's default, so the line said nothing, and the reason
     * written beside it — that nothing in this app wants a scroll bouncing
     * past its own background — is an argument for the other value. What
     * `scrollEnabled` governs is the WEBVIEW's own scroll view, and this app
     * gives that scroll view nothing to do: `main.tsx` fixes the column at
     * `100dvh` with `overflow: hidden`, and every screen that can outgrow the
     * phone carries its own `overflow: auto` pane inside it. So the document
     * never scrolls either way; all `true` adds is the rubber-band, dragging
     * the whole app off its own ground and back.
     *
     * Turning it off is the standard shape for a webview whose page scrolls
     * itself, and it cannot take scrolling away from anything: what scrolls
     * here are inner panes, which WebKit handles inside the page. The pairing
     * is checked in test/ios-scroll.test.ts, so a root that later starts
     * scrolling cannot leave this silently wrong in the other direction.
     */
    scrollEnabled: false,
  },
};

export default config;
