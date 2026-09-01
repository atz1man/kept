import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { webcrypto as wc } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyFeed } from '../src/lib/feed-signature';

/**
 * The signer and the verifier are two halves of one fact.
 *
 * `feed-signature.test.ts` signs with WebCrypto in the test itself, so it
 * proves the verifier is a verifier and nothing about the tool that will
 * actually publish. If `feed-sign.mjs` ever emitted a different encoding — DER
 * instead of raw r‖s is the obvious way — every installation with a key
 * configured would refuse every genuine feed, and nothing here would have said
 * so. That failure arrives on the day signing is switched on, in production,
 * looking exactly like an attack.
 *
 * So this runs the REAL script as a subprocess and hands its output to the REAL
 * verifier. A reimplementation of either would be the same two surfaces
 * agreeing only with themselves.
 */
const FEED = `${JSON.stringify({
  feed: 'kept-policy',
  updatedAt: '2026-08-29',
  updates: [{ id: 'u_roundtrip', store: 'Zara', changedOn: '2026-08-29', text: 'A change.', affectsStores: ['Zara'] }],
}, null, 2)}\n`;

const b64 = (buf: ArrayBuffer) => Buffer.from(new Uint8Array(buf)).toString('base64');

async function signWithTheRealScript(body: string) {
  const pair = await wc.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const dir = mkdtempSync(join(tmpdir(), 'kept-sign-'));
  const feedPath = join(dir, 'feed.json');
  const sigPath = join(dir, 'feed.sig');
  writeFileSync(feedPath, body);
  execFileSync('node', ['scripts/feed-sign.mjs', feedPath, sigPath], {
    stdio: 'pipe',
    env: { ...process.env, KEPT_FEED_KEY: b64(await wc.subtle.exportKey('pkcs8', pair.privateKey)) },
  });
  return {
    signature: readFileSync(sigPath, 'utf8').trim(),
    publicKey: b64(await wc.subtle.exportKey('spki', pair.publicKey)),
  };
}

describe('the tool that signs and the code that checks', () => {
  it('agree — a feed signed by the real script verifies', async () => {
    const { signature, publicKey } = await signWithTheRealScript(FEED);
    expect(await verifyFeed(FEED, signature, publicKey)).toBe(true);
  });

  it('agree on the BYTES, not on a re-serialised copy', async () => {
    /*
     * The feed above is pretty-printed with a trailing newline, the way
     * `public/policy-feed.json` is. Signing `JSON.stringify(JSON.parse(body))`
     * at either end would still verify against itself and fail against the
     * other, so this asserts the canonical form does NOT verify — which is
     * only a real assertion because the two forms differ.
     */
    const canonical = JSON.stringify(JSON.parse(FEED));
    expect(canonical).not.toBe(FEED);
    const { signature, publicKey } = await signWithTheRealScript(FEED);
    expect(await verifyFeed(canonical, signature, publicKey)).toBe(false);
  });

  it('refuses to sign a document this app would not accept', async () => {
    // A correctly signed malformed feed is worse than an unsigned one: every
    // installation refuses it, and the refusal looks exactly like an attack.
    const pair = await wc.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const key = b64(await wc.subtle.exportKey('pkcs8', pair.privateKey));
    const dir = mkdtempSync(join(tmpdir(), 'kept-sign-'));
    const feedPath = join(dir, 'feed.json');
    writeFileSync(feedPath, JSON.stringify({ feed: 'something-else', updates: [] }));
    expect(() =>
      execFileSync('node', ['scripts/feed-sign.mjs', feedPath, join(dir, 'feed.sig')], {
        stdio: 'pipe',
        env: { ...process.env, KEPT_FEED_KEY: key },
      }),
    ).toThrow();
  });

  it('says WHICH variable is missing, rather than failing inside WebCrypto', () => {
    /*
     * Asserting only that it fails would pass with the guard deleted, because
     * importKey throws on an undefined key anyway — the mutation survives, and
     * the test reads as coverage it does not have. What the guard actually buys
     * is the diagnosis, so that is what is checked: someone publishing a feed
     * gets the name of the variable to set, not a stack trace from a curve
     * implementation.
     */
    const dir = mkdtempSync(join(tmpdir(), 'kept-sign-'));
    const feedPath = join(dir, 'feed.json');
    writeFileSync(feedPath, FEED);
    const env = { ...process.env };
    delete env.KEPT_FEED_KEY;
    let stderr = '';
    expect(() => {
      try {
        execFileSync('node', ['scripts/feed-sign.mjs', feedPath, join(dir, 'feed.sig')], { stdio: 'pipe', env });
      } catch (e) {
        stderr = String((e as { stderr?: Buffer }).stderr ?? '');
        throw e;
      }
    }).toThrow();
    expect(stderr).toContain('KEPT_FEED_KEY');
    expect(stderr).toContain('feed:keygen');
  });
});
