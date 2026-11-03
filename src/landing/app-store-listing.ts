/**
 * Where the iPhone app is on the App Store — nowhere yet, and the page says so.
 *
 * The landing page once carried an App Store badge with `href="#"`: it
 * promised an app that did not exist and went nowhere (see OpenAppButton).
 * This is the one place that changes when the listing goes live. Until then
 * `url` is null and the page shows "Coming to the App Store", pointing at the
 * answer that says how to use Quids In on an iPhone today. Once it is set the
 * page shows Apple's own "Download on the App Store" badge, which Apple only
 * permits for an app that is actually on the store — test/app-store-badge
 * holds the artwork to being present before a url can be.
 *
 * `appId` is App Store Connect's numeric Apple ID for the app. With it set,
 * every page carries the `apple-itunes-app` meta tag, so Safari on an iPhone
 * offers the app in a banner at the top of the page.
 */
export const APP_STORE: { url: string | null; appId: string | null } = {
  url: null,
  appId: null,
};

/** Apple's badge artwork, served from public/ once downloaded from Apple's marketing guidelines page. */
export const BADGE_PATH = '/badges/download-on-the-app-store.svg';

/** The FAQ answer the "coming soon" button points at. */
export const IPHONE_ANSWER_ID = 'iphone';
