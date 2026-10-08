/**
 * Receiving an order email shared from another app.
 *
 * The Add screen teaches this in three steps — open the order, tap share,
 * pick kept — and until now nothing behind it was listening. The share target
 * was first a GET, which delivered the email as query parameters with no
 * service worker in the path — and so delivered it to the SERVER too, in the
 * request line, before this code ran. It is a POST answered by the service
 * worker now (public/sw.js), which hands the parts to `receiveShare` below;
 * this function folds them, from there or from an address that still carries
 * them (an app installed under the old manifest, with no worker in front of
 * it).
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
 * The mark the service worker sends a share's page to — `/app/#shared` — and
 * the message that collects it. A fragment, because it is never sent to a
 * server: the address says a share is waiting and carries none of it.
 */
export const SHARED_MARK = '#shared';
export const CLAIM_SHARE = 'kept-claim-share';

/**
 * What the worker handed over, as the text the Add screen reads — through
 * `sharedTextFrom`, so a POSTed share and an addressed one are folded by the
 * one rule. Anything that is not an object of strings is nothing.
 */
export function handedOverText(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const parts = data as Record<string, unknown>;
  const params = new URLSearchParams();
  for (const k of SHARE_PARAMS) if (typeof parts[k] === 'string') params.set(k, parts[k] as string);
  return sharedTextFrom(params);
}

/** Enough of `navigator.serviceWorker` to ask it something; a parameter so it can be tested. */
export interface ShareSource {
  controller: { postMessage(message: unknown, transfer: Transferable[]): void } | null;
}

/**
 * Collect a shared email from the service worker that received it.
 *
 * Over a MessageChannel of its own, so the answer cannot be confused with any
 * other message. Nothing is retried: the worker gives a share to the first ask
 * and keeps no copy, and a null here is the honest "nothing waiting". Bounded,
 * because this runs before the app mounts and a worker that never answers must
 * not keep the app off the screen; the worker answers in milliseconds.
 */
export function receiveShare(source: ShareSource | undefined, waitMs = 2000): Promise<string | null> {
  const worker = source?.controller;
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      resolve(null);
    }, waitMs);
    channel.port1.onmessage = (e) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(handedOverText(e.data));
    };
    worker.postMessage({ type: CLAIM_SHARE }, [channel.port2]);
  });
}

/*
 * The text collected before the app mounted, for its first state to read.
 *
 * Read, not taken: React's StrictMode runs a reducer's initialiser twice in
 * development, and a value consumed by the first run would be gone for the
 * one that is kept. It is set once per document, so a reload starts at null.
 */
let collected: string | null = null;

export async function collectShare(source: ShareSource | undefined): Promise<void> {
  collected = await receiveShare(source);
}

export function collectedShare(): string | null {
  return collected;
}

/**
 * The address to leave behind once a shared payload is in hand.
 *
 * A reload must not silently re-add the same receipt, and an order email — a
 * shop, a total, sometimes an address — has no business sitting in browser
 * history. Returns null when there is nothing to strip, so the caller can skip
 * a `replaceState` that would otherwise run on every launch.
 *
 * It strips the three share keys and NOTHING else, which is the part worth
 * stating: `?embed` rides on the same URL in the landing page's demo iframe,
 * and taking it out would turn that frame into the real app — reading and
 * writing the visitor's own receipts, which is the exact defect `embedded`
 * exists to prevent. Path and fragment are preserved for the same reason:
 * this is meant to remove a payload, not to navigate.
 */
export function strippedShareUrl(href: string): string | null {
  const url = new URL(href);
  const marked = url.hash === SHARED_MARK;
  if (!marked && !SHARE_PARAMS.some((k) => url.searchParams.has(k))) return null;
  for (const k of SHARE_PARAMS) url.searchParams.delete(k);
  // The worker's mark goes too: a reload of `#shared` would ask for a share
  // already handed over, and the address would go on saying one arrived.
  return url.pathname + url.search + (marked ? '' : url.hash);
}

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
      heading: 'Coming from your email app?',
      // Named as missing rather than described as impossible: it is a target
      // this app does not ship yet, not a thing iOS refuses.
      body: 'Copy the order email and paste it above. Sharing straight from Mail into Quids In needs a share extension this build does not have yet.',
    };
  }
  return {
    steps: true,
    heading: 'Coming from your email app?',
    body: 'On Android, add Quids In to your home screen and it appears in the share sheet — the order lands here already read. On iPhone, paste it above instead.',
  };
}
