/**
 * Receiving an order email shared from another app.
 *
 * The Add screen teaches this in three steps — open the order, tap share,
 * pick kept — and until now nothing behind it was listening. A PWA share
 * target delivers the shared content as query parameters, which is all this
 * needs: no service worker in the path, so it survives a cold start.
 *
 * The sharing app decides how to split what it sends. Mail clients vary: some
 * put the subject in `title` and the body in `text`, some send everything as
 * `text`, some add a `url`. All three are folded together, because the parser
 * wants the whole thing and the subject line is often where the shop's name
 * actually appears.
 */
export function sharedTextFrom(params: URLSearchParams): string | null {
  const parts = ['title', 'text', 'url']
    .map((k) => params.get(k))
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  if (parts.length === 0) return null;
  // Deduplicated: Android often sends the same string as both text and url,
  // and a doubled total is exactly the kind of thing that confuses a parser
  // looking for the largest amount on the page.
  return [...new Set(parts.map((p) => p.trim()))].join('\n');
}

/** The query keys a share can arrive under, for stripping them afterwards. */
export const SHARE_PARAMS = ['title', 'text', 'url'] as const;

/**
 * Whether an order email can actually be SHARED into kept, on this build.
 *
 * The Add screen taught one route and taught it unconditionally: add kept to
 * your home screen and it appears in the share sheet, with a three-step
 * diagram under it. That is Web Share Target, and it is Chromium's. Safari
 * has never implemented it, on iOS or anywhere else, so an iPhone reading
 * that panel is being sent to add a home screen icon that will not appear in
 * any share sheet — and in the iOS app it is wrong a second way over, because
 * a Capacitor app appears in the share sheet only if it ships a share
 * extension target, and `ios/App` has none.
 *
 * There is no feature test for it. `share_target` is a manifest entry, read
 * by the browser at install time; nothing in the page can ask whether it was
 * honoured, and `navigator.share` is a different API answering a different
 * question — an iPhone has that and still cannot receive one. Sniffing the
 * user agent would be a guess about someone else's roadmap. So the copy names
 * the platform it is true on instead of guessing which one you are holding,
 * which cannot go stale in the wrong direction: the worst it does on a phone
 * that gains the feature is under-sell it.
 */
export interface ShareRoute {
  /** Whether to draw the three steps, which are a promise about this device. */
  steps: boolean;
  heading: string;
  body: string;
}

export function shareRoute(native: boolean): ShareRoute {
  if (native) {
    return {
      steps: false,
      heading: 'COMING FROM YOUR EMAIL APP?',
      // Named as missing rather than described as impossible: it is a target
      // this app does not ship yet, not a thing iOS refuses.
      body: 'Copy the order email and paste it above. Sharing straight from Mail into kept needs a share extension this build does not have yet.',
    };
  }
  return {
    steps: true,
    heading: 'COMING FROM YOUR EMAIL APP?',
    body: 'On Android, add kept to your home screen and it appears in the share sheet — the order lands here already read. On iPhone, paste it above instead.',
  };
}
