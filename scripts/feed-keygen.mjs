/**
 * Generate the key pair that signs the policy feed.
 *
 *   npm run feed:keygen
 *
 * Prints both halves and writes NEITHER to disk, on purpose. The private half
 * is the only thing standing between this app and anyone who can answer its
 * feed URL, and a file written into the working tree is a file that gets
 * committed. Put it wherever secrets belong for you; the public half goes into
 * FEED_PUBLIC_KEY in src/lib/feed-signature.ts.
 *
 * ECDSA P-256 / SHA-256 — the curve every browser's WebCrypto has had for
 * years. See feed-signature.ts for why not Ed25519.
 */
import { webcrypto as crypto } from 'node:crypto';

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
]);
const b64 = async (fmt, key) =>
  Buffer.from(new Uint8Array(await crypto.subtle.exportKey(fmt, key))).toString('base64');

console.log('\nPUBLIC  (into CHECKED_IN_KEY in src/lib/feed-signature.ts, or VITE_FEED_PUBLIC_KEY at build time)\n');
console.log(await b64('spki', pair.publicKey));
console.log('\nPRIVATE (keep off this machine and out of this repository)\n');
console.log(await b64('pkcs8', pair.privateKey));
console.log(
  '\nUntil FEED_PUBLIC_KEY is set the app accepts an unsigned feed, exactly as it\n' +
    'does today. The moment it is set, an unsigned or wrongly signed feed is refused\n' +
    'and the app keeps the one it already holds — so set the key and publish a signed\n' +
    'feed together, or the policy watch goes quiet.\n',
);
