import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { seedUpdates } from '../src/lib/seed';
import { readFeed } from '../src/lib/policy-feed';
import { canonicalStoreName } from '../src/lib/stores';

/**
 * The samples and the served feed used to be held to each other.
 *
 * `seed.ts` carried the SAME ids as `public/policy-feed.json`, and this file
 * asserted they said the same thing, entry for entry. That made the samples a
 * copy of the published news, and the published news a copy of samples nobody
 * had checked. They are separate things now: the seed's changes are marked
 * samples, the served feed carries only changes someone has checked against
 * the retailer (none yet), and `sample-changes.test.ts` holds the line between
 * them. What survives from here is that the served feed parses.
 */
const TODAY = new Date(2026, 7, 28);

const served = readFeed(JSON.parse(readFileSync(new URL('../public/policy-feed.json', import.meta.url), 'utf8')));
const bundled = seedUpdates(TODAY);

describe('the served feed', () => {
  it('parses', () => {
    expect(served).not.toBeNull();
  });
});

/**
 * And both — the samples and whatever is served — name shops the way the app does.
 *
 * The table gives Currys the alias "pc world", M&S "marks and spencer", B&Q
 * "b and q" — and `readFeed` takes these names verbatim. `updateNames` now
 * canonicalises before comparing, so an alias still reaches the right
 * receipts; what it cannot fix is the WORDING. The Watch card prints
 * `update.store` beside a receipt that says "Currys", so a feed written the
 * way a person writes it puts two names for one shop on one screen.
 *
 * A name the table does not know is left alone, deliberately: the feed may
 * carry news about a shop this build has never heard of, and that is not an
 * error. What this refuses is a name the app knows by another name.
 */
describe('the shops a feed names', () => {
  const entries = [...served!, ...bundled];

  it('has some to check, so this is not passing over an empty list', () => {
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.flatMap((u) => u.affectsStores).length).toBeGreaterThan(0);
  });

  it.each(entries.flatMap((u) => [u.store, ...u.affectsStores]).map((n) => [n] as const))(
    'writes "%s" the way the retailer table does',
    (written) => {
      expect(canonicalStoreName(written)).toBe(written);
    },
  );
});
