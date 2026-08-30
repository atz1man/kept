/**
 * Sign the published policy feed.
 *
 *   KEPT_FEED_KEY="<base64 pkcs8>" npm run feed:sign
 *
 * Writes public/policy-feed.sig next to public/policy-feed.json. The key comes
 * from the environment and is never read from a file in this repository, for
 * the same reason feed-keygen writes nothing.
 *
 * It signs the file's BYTES. Not a re-serialised copy — two different documents
 * could share a signature wherever JSON.stringify normalised a difference away,
 * and the app verifies exactly what it was served.
 */
import { webcrypto as crypto } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const key = process.env.KEPT_FEED_KEY;
if (!key) {
  console.error('✗ KEPT_FEED_KEY is not set. Generate one with `npm run feed:keygen`.');
  process.exit(1);
}

const FEED = new URL('../public/policy-feed.json', import.meta.url);
const SIG = new URL('../public/policy-feed.sig', import.meta.url);
const bytes = readFileSync(FEED);

// It has to be a feed this app would accept in the first place. Signing a
// malformed document would publish a correctly signed thing that every
// installation then refuses, which looks exactly like an attack.
try {
  const doc = JSON.parse(bytes.toString('utf8'));
  if (doc.feed !== 'kept-policy' || !Array.isArray(doc.updates)) {
    throw new Error('not a kept-policy document');
  }
} catch (e) {
  console.error(`✗ public/policy-feed.json is not a feed this app would accept: ${e.message}`);
  process.exit(1);
}

const priv = await crypto.subtle.importKey(
  'pkcs8',
  Buffer.from(key, 'base64'),
  { name: 'ECDSA', namedCurve: 'P-256' },
  false,
  ['sign'],
);
const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, bytes);
writeFileSync(SIG, Buffer.from(new Uint8Array(sig)).toString('base64'));
console.log(`✓ signed ${bytes.length} bytes → public/policy-feed.sig`);
