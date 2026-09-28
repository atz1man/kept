import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COOLING_OFF_DAYS, REJECT_DAYS, RETURN_AFTER_CANCEL_DAYS } from '../src/lib/legal';
import { STORE_COUNT, STORE_POLICIES, TABLE_CHECKED_ON } from '../src/lib/stores';

/**
 * The App Store listing, held to the app it describes.
 *
 * The landing page's social proof was "illustrative" copy from the design
 * handoff — figures nothing measured, sitting in the repository behind a flag
 * until someone noticed. The listing is the same kind of text in a place with
 * far less forgiveness: Apple reviews it, and a UK consumer reads it as a
 * promise. So every figure in it is checked against the constant it restates,
 * the privacy answers against the manifest that ships in the binary, and the
 * privacy sentence against the one the app itself shows — APN-26 asked for
 * them to match "word for word", and a request is not a guard.
 */
const ROOT = join(__dirname, '..');
const listing = JSON.parse(readFileSync(join(ROOT, 'store', 'listing.json'), 'utf8')) as {
  name: string; subtitle: string; promotionalText: string; description: string; keywords: string;
  privacy: { tracking: boolean; dataCollected: boolean; statement: string };
  urls: Record<string, string>;
};

describe('Apple’s field limits', () => {
  it.each([
    ['name', 30], ['subtitle', 30], ['promotionalText', 170], ['description', 4000], ['keywords', 100],
  ] as const)('%s fits in %i characters', (field, max) => {
    expect(listing[field].length).toBeGreaterThan(0);
    expect([...listing[field]].length).toBeLessThanOrEqual(max);
  });

  it('keywords are comma-separated with no wasted spaces', () => {
    // App Store Connect counts the spaces against the hundred.
    expect(listing.keywords).not.toMatch(/,\s|\s,/);
  });
});

describe('what the listing claims', () => {
  /** Every number in the prose, with the word after it. */
  const figures = (text: string) =>
    [...text.matchAll(/\b(\d+)\s+(?:more\s+)?(days?|UK)\b/g)].map((m) => ({ n: Number(m[1]), unit: m[2] }));

  it('finds the figures it is meant to be checking', () => {
    // A check over no figures passes silently.
    expect(figures(listing.description).length).toBeGreaterThanOrEqual(4);
  });

  it('states no period or count the app does not hold', () => {
    /*
     * Negative on purpose: a sixth sentence quoting a seventh number is covered
     * the day it is written. Thirty days appears twice for two reasons — the
     * short-term right to reject, and the app's own "next 30 days" horizon —
     * and both are the same constant only by coincidence, so each is named.
     */
    const known = new Set([REJECT_DAYS, COOLING_OFF_DAYS, RETURN_AFTER_CANCEL_DAYS, 30]);
    const strays = figures(listing.description)
      .filter((f) => (f.unit === 'UK' ? f.n !== STORE_COUNT : !known.has(f.n)));
    expect(strays).toEqual([]);
  });

  it('counts the shops the table actually has', () => {
    expect(listing.description).toContain(`${STORE_COUNT} UK retailers`);
  });

  it('does not call the windows verified until someone has verified them', () => {
    // The Settings screen was cured of "20 verified today" for the same reason.
    if (TABLE_CHECKED_ON === null) {
      for (const text of [listing.name, listing.subtitle, listing.promotionalText, listing.description]) {
        expect(text).not.toMatch(/verif|accurate|up.to.date|always right/i);
      }
    }
  });
});

describe('what it says a paste does', () => {
  it('claims no more than the add screen does', () => {
    /*
     * The parser reads the shop, the total and the date — never the item, which
     * the person types. The first draft of this listing said "the shop, the
     * item, the total and the date", and it was the screenshot of an empty
     * "What is it?" field that caught it. The add screen states what it reads,
     * so the listing is held to that sentence rather than to anyone's memory.
     */
    const add = readFileSync(join(ROOT, 'src', 'app', 'screens', 'Add.tsx'), 'utf8');
    expect(add).toContain('kept reads the store, total and date');
    const claim = listing.description.match(/kept reads ([^—\n]+)/)?.[1] ?? '';
    expect(claim.length).toBeGreaterThan(0);
    expect(claim).not.toMatch(/\bitem|name|product|what (?:it|you)/i);
  });
});

describe('the privacy answers', () => {
  it('match the manifest that ships in the binary', () => {
    const manifest = readFileSync(join(ROOT, 'ios', 'App', 'App', 'PrivacyInfo.xcprivacy'), 'utf8');
    const trackingDeclared = /<key>NSPrivacyTracking<\/key>\s*<true\/>/.test(manifest);
    const collected = /<key>NSPrivacyCollectedDataTypes<\/key>\s*<array>\s*<dict>/.test(manifest);
    expect(listing.privacy.tracking).toBe(trackingDeclared);
    expect(listing.privacy.dataCollected).toBe(collected);
  });

  it('say, word for word, what the app says about itself', () => {
    const settings = readFileSync(join(ROOT, 'src', 'app', 'screens', 'Settings.tsx'), 'utf8');
    expect(settings.replace(/\s+/g, ' ')).toContain(listing.privacy.statement);
    expect(listing.description).toContain(listing.privacy.statement);
  });
});

describe('the keywords', () => {
  it('name no retailer', () => {
    /*
     * Guideline 2.3.7: other companies' names do not belong in keywords. The
     * table is walked rather than listed so a twenty-first shop is covered.
     */
    const words = listing.keywords.toLowerCase().split(',');
    const brands = STORE_POLICIES.flatMap((s) => [s.name.toLowerCase(), ...s.aliases]);
    expect(words.filter((w) => brands.some((b) => w.includes(b)))).toEqual([]);
  });

  it('do not spend characters on the app’s own name, which is indexed already', () => {
    expect(listing.keywords.toLowerCase().split(',')).not.toContain('kept');
  });
});

describe('the addresses', () => {
  it('point at pages this build serves', () => {
    // A privacy policy URL is mandatory in App Store Connect. The domain is
    // yours to fill in; the PATH has to be one the build actually produces.
    expect(new URL(listing.urls.privacyPolicy).pathname).toBe('/privacy/');
    expect(new URL(listing.urls.support).pathname).toBe('/privacy/');
    expect(new URL(listing.urls.support).hash).toBe('#contact');
  });
});
