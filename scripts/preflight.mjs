/**
 * Is this tree fit to archive and send to App Store review?
 *
 *   npm run preflight
 *
 * Red today, on purpose, and it should stay red until each line is done.
 * Everything left before submission is something only the owner can supply —
 * an identifier Apple issues, an address that is read, a domain, a table
 * checked against each retailer's own page — and every one of them lives in
 * this repository as a deliberate placeholder. Each placeholder was already
 * safe on its own (the privacy page shows a red notice, `bundle-id` refuses
 * its own placeholder), but nothing said "all of them, at once, before
 * Archive". A build that reaches review with one left in is a rejection at
 * best and, for the table, a store listing claiming twenty checked retailers
 * that nobody checked.
 *
 * Not run in CI, because a check that is red by design teaches people to
 * ignore red. `test/preflight.test.ts` holds the checks themselves: that each
 * one fires on today's tree, and that a tree with everything filled in passes.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLACEHOLDER, bundleIdProblem } from './set-bundle-id.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

/** The four source files the placeholders live in, read as text. */
export function readTree(root = ROOT) {
  const read = (p) => readFileSync(join(root, p), 'utf8');
  return {
    capacitorConfig: read('capacitor.config.ts'),
    privacy: read('src/privacy/Privacy.tsx'),
    listing: read('store/listing.json'),
    stores: read('src/lib/stores.ts'),
    feedSignature: read('src/lib/feed-signature.ts'),
  };
}

/** `export const NAME: string | null = <value>;` — the value as written, or undefined. */
function constant(source, name) {
  const m = source.match(new RegExp(`export const ${name}\\b[^=]*=\\s*([^;]+);`));
  return m ? m[1].trim() : undefined;
}

/**
 * Every check, in the order SUBMISSION.md lists them. `blocking: false` is a
 * recommendation — the app works without it — and never fails the run.
 */
export function preflight(tree, env = {}) {
  const out = [];
  const add = (name, problem, fix, blocking = true) => out.push({ name, ok: !problem, problem, fix, blocking });

  const id = tree.capacitorConfig.match(/appId: '([^']+)'/)?.[1];
  add(
    'the bundle identifier is yours',
    id === undefined ? 'no appId found in capacitor.config.ts' : id === PLACEHOLDER ? `still ${PLACEHOLDER}` : bundleIdProblem(id),
    'register the App ID, then npm run bundle-id -- uk.co.you.kept (APN-21)',
  );

  const email = constant(tree.privacy, 'CONTACT_EMAIL');
  add(
    'the privacy policy has a contact address',
    email === undefined ? 'no CONTACT_EMAIL in src/privacy/Privacy.tsx' : email === 'null' ? 'CONTACT_EMAIL is null — the page shows a red notice' : null,
    'set CONTACT_EMAIL to an address someone reads',
  );

  let listingProblem = null;
  try {
    JSON.parse(tree.listing);
    if (tree.listing.includes('https://REPLACE_ME')) listingProblem = 'store/listing.json still points at REPLACE_ME';
  } catch {
    listingProblem = 'store/listing.json is not valid JSON';
  }
  add('the listing’s URLs are real', listingProblem, 'replace REPLACE_ME with your domain in store/listing.json');

  const checked = constant(tree.stores, 'TABLE_CHECKED_ON');
  add(
    'the retailer table has been checked against the shops',
    checked === undefined ? 'no TABLE_CHECKED_ON in src/lib/stores.ts' : checked === 'null' ? 'TABLE_CHECKED_ON is null — nobody has checked the windows' : null,
    'npm run check:retailers, correct stores.ts from the quotes, then set TABLE_CHECKED_ON (APN-16)',
  );

  // The key is `CHECKED_IN_KEY`, or VITE_FEED_PUBLIC_KEY at build time — NOT
  // `FEED_PUBLIC_KEY`, which is an expression choosing between them. Reading
  // that one answered "signed" on a tree with no key anywhere.
  const checkedIn = tree.feedSignature.match(/const CHECKED_IN_KEY\b[^=]*=\s*([^;]+);/)?.[1]?.trim();
  const hasKey = (checkedIn !== undefined && checkedIn !== 'null') || Boolean(env.VITE_FEED_PUBLIC_KEY);
  add(
    'policy updates are signed',
    hasKey ? null : 'no feed key — the app accepts the feed unsigned',
    'npm run feed:keygen, keep the private key off this machine (APN-19)',
    false,
  );

  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const results = preflight(readTree(), process.env);
  for (const r of results) {
    const mark = r.ok ? '✓' : r.blocking ? '✗' : '·';
    console.log(`${mark} ${r.name}${r.ok ? '' : ` — ${r.problem}\n    → ${r.fix}`}`);
  }
  const blocked = results.filter((r) => !r.ok && r.blocking).length;
  console.log(blocked ? `\n✗ ${blocked} left before this can go to review` : '\n✓ nothing in this repository stands between it and Archive');
  process.exit(blocked ? 1 : 0);
}
