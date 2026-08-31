/**
 * Proving the policy feed came from whoever owns this app.
 *
 * The feed can move a computed deadline. That is the point of the feature —
 * `windowInForceFor` gives a new purchase the window in force on the day it was
 * bought — and it is also the widest thing anything outside this device is
 * allowed to do. Everything else the feed carries is words on a screen; this is
 * a number the app counts down from, and the direction that costs money is
 * shortening it.
 *
 * The limits already placed on it bound the DAMAGE: a window must be a positive
 * integer no longer than ten years, a note is capped at a sentence, the feed at
 * MAX_UPDATES. None of them ask the question that actually matters, which is
 * whether the thing that answered was the right thing at all. Anything that can
 * respond to that URL — a proxy, a hostile network, a compromised host — can
 * tell every installation that Currys now gives seven days.
 *
 * ECDSA P-256 over SHA-256, because it is the curve every browser's WebCrypto
 * has had for years; Ed25519 is better and its support is still patchy, and a
 * signature scheme that fails to verify on somebody's phone is worse than the
 * one that verifies everywhere.
 *
 * THE SIGNATURE COVERS THE BYTES THAT WERE SERVED, not the parsed object.
 * Signing a re-serialised copy would let two different documents share a
 * signature whenever JSON.stringify happened to normalise a difference away —
 * key order, whitespace, a number written as 1.0. What is verified is exactly
 * what arrived.
 */

/**
 * The key that says a feed is genuine, or null while there is not one.
 *
 * Null on purpose, and not a placeholder that looks real. While it is null the
 * app behaves exactly as it always has: a downloaded feed is accepted on the
 * strength of being well-formed, and the README and Settings say the feed is
 * not yet signed. Shipping a fake key instead would make every real feed fail
 * to verify and quietly switch the policy watch off — a security feature that
 * breaks the product is a security feature nobody keeps.
 *
 * To turn it on: generate a key pair with `npm run feed:keygen`, put the public
 * half here, keep the private half OFF this machine and out of this repository,
 * and sign each published feed with `npm run feed:sign`. The moment this is a
 * key, an unsigned or wrongly signed feed is refused and the app keeps the one
 * it already holds.
 *
 * Base64 of the SubjectPublicKeyInfo (spki) export.
 *
 * `VITE_FEED_PUBLIC_KEY` overrides it at BUILD time — which is what
 * `npm run feed:wiring` uses to check the wiring against a key it generates,
 * without editing this file to do it. Build time, never run time: a key a
 * running page could set would be no key at all.
 */
const CHECKED_IN_KEY: string | null = null;

const configured: unknown = import.meta.env?.VITE_FEED_PUBLIC_KEY;
export const FEED_PUBLIC_KEY: string | null =
  // Any non-empty string is taken as a key; a one-character one is a
  // configuration mistake that fails verification either way, so the exact
  // bound here is not worth a test.
  typeof configured === 'string' && configured.length > 0 ? configured : CHECKED_IN_KEY;

/*
 * Backed by a concrete ArrayBuffer, not just any ArrayBufferLike: WebCrypto's
 * BufferSource will not take a view that might sit on a SharedArrayBuffer, and
 * the compiler is right to insist.
 */
function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  // `<=` reads one past the end and writes out of bounds on a fixed-length
  // Uint8Array, which is a no-op — so the bound cannot be told apart by a test.
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function utf8(text: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(text);
  const out = new Uint8Array(new ArrayBuffer(encoded.byteLength));
  out.set(encoded);
  return out;
}

/**
 * Does this signature belong to these exact bytes?
 *
 * @param body      The feed document as it was served, byte for byte.
 * @param signature Base64 of the raw ECDSA signature (r‖s).
 * @param publicKey Base64 spki. Pass FEED_PUBLIC_KEY.
 */
export async function verifyFeed(body: string, signature: string, publicKey: string): Promise<boolean> {
  /*
   * The empty BODY is the one that has to be caught here, and it is the only
   * one: a signature over nothing verifies perfectly well against nothing, so
   * without this line a server that answered with a blank page — and a
   * signature it had made over a blank page — would be believed. The other two
   * clauses are a short-circuit and nothing more; WebCrypto refuses an empty
   * signature and an unparseable key on its own, which is why deleting either
   * breaks no test below. Do not read them as the protection.
   */
  if (!body || !signature || !publicKey) return false;
  try {
    const subtle = globalThis.crypto?.subtle;
    // A context with no WebCrypto cannot check anything, and "cannot check"
    // must never read as "checked and fine".
    if (!subtle) return false;
    const key = await subtle.importKey(
      'spki',
      fromBase64(publicKey),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    return await subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      fromBase64(signature),
      utf8(body),
    );
  } catch {
    // A malformed key or signature is a failed verification, not an error to
    // report upward: either way this feed is not to be trusted.
    return false;
  }
}

/**
 * Whether a downloaded feed may be used, given what the app knows.
 *
 * Separated from the crypto so the POLICY is testable on its own, because the
 * policy is where the mistake would be. Two rules, and the second is the one
 * worth stating out loud: with no key configured the app accepts an unsigned
 * feed, exactly as it always has — that is a deliberate, documented state, not
 * an oversight — and with a key configured an unsigned feed is refused, so
 * turning signing on cannot be silently undone by a server that stops signing.
 */
export function feedIsAcceptable(
  key: string | null,
  verified: boolean | null,
): { accept: boolean; reason: 'unsigned-by-design' | 'verified' | 'refused' } {
  if (key === null) return { accept: true, reason: 'unsigned-by-design' };
  if (verified === true) return { accept: true, reason: 'verified' };
  return { accept: false, reason: 'refused' };
}
