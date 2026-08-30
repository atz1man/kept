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
    // The receipts are the product. Nothing about this app wants a scroll
    // that bounces past its own background.
    scrollEnabled: true,
  },
};

export default config;
