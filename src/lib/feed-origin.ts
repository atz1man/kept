/**
 * Where the policy feed comes from, and whether it comes at all.
 *
 * On the web the feed is `/policy-feed.json` on the app's own origin, fetched
 * on every launch, and that is what the screens have always said. Inside the
 * iPhone app the same relative path resolves to `capacitor://localhost` — the
 * BUNDLE — so the "update" was always the copy that shipped, while onboarding
 * said "Policy updates download to your phone", the Watch tab "fetched each
 * time you open the app", Settings "Every launch · on" and the review notes
 * "may download an updated list". None of it was true of the phone.
 *
 * The iPhone app can only fetch a feed from a real host, and there is none
 * yet. So the host is a BUILD-time setting, `VITE_FEED_ORIGIN`, unset by
 * default: set, the iPhone app fetches from it and the content security
 * policy allows exactly it (csp.ts); unset, the iPhone app fetches nothing and
 * every screen says the list comes with app updates. See store/SUBMISSION.md.
 *
 * Build time, never run time, for the reason the feed key is: an origin a
 * running page could set would be a way to point the app at anyone's feed.
 */

/** The feed, relative to whichever origin serves it. */
export const FEED_PATH = '/policy-feed.json';

/**
 * The signature, detached, beside the feed.
 *
 * Detached rather than a field inside the document, because a signature over a
 * document that contains it is a knot: the field has to be excluded, which
 * means agreeing exactly how to remove it, and any disagreement between signer
 * and verifier is a hole. A separate file signs the whole thing as served.
 *
 * Only requested when there is a public key to check it against, so the state
 * this ships in makes no extra request.
 */
export const FEED_SIG_PATH = '/policy-feed.sig';

/**
 * A configured feed origin, normalised, or null when none is configured.
 *
 * Refuses anything that is not exactly an https origin — no path, query,
 * fragment or credentials — because the value is written into the content
 * security policy as a source, and a source with a path in it means something
 * different from what it reads as. A trailing slash is the one thing allowed,
 * since that is how an origin is often typed. Throws rather than ignoring a
 * bad value: the build reads it through here, and a typo that quietly left
 * the app fetching nothing would be the very gap this exists to close.
 */
export function feedOrigin(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const bad = () => new Error(`kept: VITE_FEED_ORIGIN must be an https origin such as https://example.com, not ${JSON.stringify(raw)}`);
  if (typeof raw !== 'string') throw bad();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw bad();
  }
  if (url.protocol !== 'https:' || url.username || url.password) throw bad();
  // A plain DNS name. The URL parser accepts `*` in a host, and in a policy
  // source that is a wildcard: `https://*.example` would allow every host
  // under it while reading as one.
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(url.hostname)) throw bad();
  // Compared as typed, so a path, a query, a fragment or a host the parser
  // rewrote (case, an IDN) is refused rather than silently reshaped.
  if (raw.replace(/\/$/, '') !== url.origin) throw bad();
  return url.origin;
}

/**
 * Does this app fetch a newer list of policy changes than the one it shipped
 * with?
 *
 * The one answer every surface reads — the fetch in App.tsx, onboarding, the
 * Watch tab, Settings and the privacy page — so none of them can claim a
 * download the others know is not happening. The web always does; the iPhone
 * app only once the build names a host to fetch from.
 */
export function feedRefreshes(native: boolean, origin: string | null): boolean {
  return !native || origin !== null;
}

/** Where to fetch the feed and its signature, or null when nothing is fetched. */
export function feedLocation(native: boolean, origin: string | null): { feed: string; sig: string } | null {
  if (!feedRefreshes(native, origin)) return null;
  // The web keeps its relative path: its own origin is where the feed is.
  const base = native && origin !== null ? origin : '';
  return { feed: `${base}${FEED_PATH}`, sig: `${base}${FEED_SIG_PATH}` };
}

/**
 * The origin this build was given. A value the build would have refused never
 * gets this far — vite.config.ts reads it through `feedOrigin` and fails —
 * so the catch is for a test run, where nothing validated it first.
 */
const configured: unknown = import.meta.env?.VITE_FEED_ORIGIN;
export const FEED_ORIGIN: string | null = (() => {
  try {
    return feedOrigin(configured);
  } catch {
    return null;
  }
})();
