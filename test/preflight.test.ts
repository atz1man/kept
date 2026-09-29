import { describe, expect, it } from 'vitest';
// @ts-expect-error - a small JS helper, run as `npm run preflight`
import { preflight, readTree } from '../scripts/preflight.mjs';

/**
 * `npm run preflight` is red today by design — every line left is something
 * only the owner can supply. So CI cannot run it; this holds the checks
 * themselves, in both directions, because a gate that never goes green is as
 * useless as one that never goes red.
 */
type Result = { name: string; ok: boolean; blocking: boolean };
type Tree = ReturnType<typeof readTree>;

const today: Tree = readTree();

/** Today's tree with every placeholder filled in, the way the owner will. */
function ready(): Tree {
  return {
    capacitorConfig: today.capacitorConfig.replace(/appId: '[^']+'/, "appId: 'uk.co.example.kept'"),
    brand: today.brand.replace(/(export const CONTACT_EMAIL\b[^=]*=\s*)null;/, "$1'privacy@example.co.uk';"),
    listing: today.listing.replaceAll('https://REPLACE_ME', 'https://example.co.uk'),
    stores: today.stores.replace(/(export const TABLE_CHECKED_ON\b[^=]*=\s*)null;/, "$1'2026-10-01';"),
    feedSignature: today.feedSignature.replace(/(const CHECKED_IN_KEY\b[^=]*=\s*)null;/, "$1'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE';"),
  };
}

const failing = (results: Result[]) => results.filter((r) => !r.ok).map((r) => r.name);

describe('npm run preflight', () => {
  it('names every placeholder this repository ships with', () => {
    // If one of these goes quiet while the placeholder is still in the tree,
    // the gate has stopped reading the file it was written for.
    expect(failing(preflight(today))).toEqual([
      'the bundle identifier is yours',
      'the privacy policy has a contact address',
      'the listing’s URLs are real',
      'the retailer table has been checked against the shops',
      'policy updates are signed',
    ]);
  });

  it('passes a tree with everything filled in', () => {
    // The fixture really did change each file — otherwise "passes" would be
    // a claim about a tree nobody built.
    const r = ready();
    for (const k of Object.keys(r) as (keyof Tree)[]) expect(r[k], String(k)).not.toBe(today[k]);
    expect(failing(preflight(r))).toEqual([]);
  });

  it('fails on each placeholder alone', () => {
    const r = ready();
    const put = (k: keyof Tree) => failing(preflight({ ...r, [k]: today[k] }));
    expect(put('capacitorConfig')).toEqual(['the bundle identifier is yours']);
    expect(put('brand')).toEqual(['the privacy policy has a contact address']);
    expect(put('listing')).toEqual(['the listing’s URLs are real']);
    expect(put('stores')).toEqual(['the retailer table has been checked against the shops']);
    expect(put('feedSignature')).toEqual(['policy updates are signed']);
  });

  it('takes a feed key supplied at build time', () => {
    const r = { ...ready(), feedSignature: today.feedSignature };
    expect(failing(preflight(r, { VITE_FEED_PUBLIC_KEY: 'k' }))).toEqual([]);
  });

  it('does not let a missing feed key block review', () => {
    // The app works unsigned; APN-19 is a recommendation. Everything else is
    // a rejection or an untrue listing.
    const byName = new Map((preflight(today) as Result[]).map((r) => [r.name, r.blocking]));
    expect(byName.get('policy updates are signed')).toBe(false);
    expect([...byName.values()].filter(Boolean)).toHaveLength(4);
  });

  it('refuses a bundle identifier Apple would', () => {
    const r = { ...ready(), capacitorConfig: today.capacitorConfig.replace(/appId: '[^']+'/, "appId: 'uk_co_me'") };
    expect(failing(preflight(r))).toEqual(['the bundle identifier is yours']);
  });
});
