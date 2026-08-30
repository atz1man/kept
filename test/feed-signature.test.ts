import { describe, expect, it } from 'vitest';
import { feedIsAcceptable, verifyFeed } from '../src/lib/feed-signature';

/*
 * A real key pair, generated here, used to sign real bytes.
 *
 * Not a fixture: a hardcoded signature proves the verifier accepts one
 * particular string, which is the shape of a test that passes while the
 * verifier does nothing at all. Signing here means every case below is checked
 * against cryptography that actually ran.
 */
const b64 = (buf: ArrayBuffer) => Buffer.from(new Uint8Array(buf)).toString('base64');

async function keypair() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  return {
    publicKey: b64(await crypto.subtle.exportKey('spki', pair.publicKey)),
    sign: async (body: string) =>
      b64(
        await crypto.subtle.sign(
          { name: 'ECDSA', hash: 'SHA-256' },
          pair.privateKey,
          new TextEncoder().encode(body),
        ),
      ),
  };
}

const FEED = '{"feed":"kept-policy","updates":[{"id":"u1","newWindowDays":7}]}';

describe('proving a feed came from the right place', () => {
  it('accepts bytes that were actually signed', async () => {
    const k = await keypair();
    expect(await verifyFeed(FEED, await k.sign(FEED), k.publicKey)).toBe(true);
  });

  it('refuses a feed altered after signing, even by one character', async () => {
    /*
     * The attack this exists for: a shortened window. `windowInForceFor` hands
     * a new purchase whatever the feed says was in force, so seven days instead
     * of thirty is money, delivered to every installation at once.
     */
    const k = await keypair();
    const signature = await k.sign(FEED);
    const tampered = FEED.replace('"newWindowDays":7', '"newWindowDays":1');
    expect(await verifyFeed(tampered, signature, k.publicKey)).toBe(false);
  });

  it('refuses a valid signature made by the wrong key', async () => {
    // Anyone can sign. Only one key is this app's.
    const mine = await keypair();
    const theirs = await keypair();
    expect(await verifyFeed(FEED, await theirs.sign(FEED), mine.publicKey)).toBe(false);
  });

  it.each([['', 'no signature'], ['bm90LWEtc2ln', 'a signature that is not one']])(
    'refuses %j (%s)',
    async (signature) => {
      const k = await keypair();
      expect(await verifyFeed(FEED, signature, k.publicKey)).toBe(false);
    },
  );

  it('refuses when the key itself is rubbish, rather than throwing', async () => {
    const k = await keypair();
    expect(await verifyFeed(FEED, await k.sign(FEED), 'not-a-key')).toBe(false);
  });

  it('refuses an empty body, so a blank response cannot pass', async () => {
    /*
     * Not a trivial case. A signature over nothing verifies against nothing, so
     * a server answering with a blank page and a signature it made over a blank
     * page would otherwise be believed — and a feed the app reads as empty is a
     * feed with every published correction removed from it.
     */
    const k = await keypair();
    expect(await verifyFeed('', await k.sign(''), k.publicKey)).toBe(false);
  });

  it.each([
    ['crypto.subtle missing', { subtle: undefined }],
    ['no crypto at all', undefined],
  ])('refuses when the engine is absent (%s) — cannot check is not checked', async (_label, stub) => {
    /*
     * The branch that decides what happens on a browser too old, or a context
     * WebCrypto is withheld from (an insecure origin, a stripped embedded view).
     * The inputs here are GENUINE — a real key over the real bytes — so a false
     * can only have come from the missing engine, and the assertion after the
     * stub is removed proves exactly that: the same three arguments verify.
     */
    const k = await keypair();
    const signature = await k.sign(FEED);
    const real = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: stub, configurable: true });
    try {
      expect(await verifyFeed(FEED, signature, k.publicKey)).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: real, configurable: true });
    }
    expect(await verifyFeed(FEED, signature, k.publicKey)).toBe(true);
  });
});

describe('what the app does with the answer', () => {
  it('accepts an unsigned feed while there is no key — the state it ships in', () => {
    // Deliberate and documented, not an oversight: a fake key would make every
    // real feed fail and switch the policy watch off.
    expect(feedIsAcceptable(null, null)).toEqual({ accept: true, reason: 'unsigned-by-design' });
  });

  it('accepts a verified feed once a key exists', () => {
    expect(feedIsAcceptable('key', true)).toEqual({ accept: true, reason: 'verified' });
  });

  it('refuses an UNSIGNED feed once a key exists', () => {
    /*
     * The half that makes signing worth having. If a missing signature fell
     * back to "well, it parsed", a server that simply stopped signing would
     * silently undo the whole thing.
     */
    expect(feedIsAcceptable('key', null)).toEqual({ accept: false, reason: 'refused' });
  });

  it('refuses one whose signature did not check out', () => {
    expect(feedIsAcceptable('key', false)).toEqual({ accept: false, reason: 'refused' });
  });
});
