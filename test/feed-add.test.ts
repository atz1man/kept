import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error - a small JS helper, run as `npm run feed:add`
import { addEntry } from '../scripts/feed-add.mjs';
// @ts-expect-error - a small JS helper, run as `npm run check:retailers`
import { readSources, readTable } from '../scripts/retailer-check-lib.mjs';
import { readFeed } from '../src/lib/policy-feed';

/**
 * `npm run feed:add` is how a checked change reaches the feed. It exists
 * because nothing about publishing asked where a change came from, and the
 * feed shipped five uncheckable samples as "verified" news.
 */
const ROOT = join(__dirname, '..');
const ctx = {
  table: readTable(readFileSync(join(ROOT, 'src/lib/stores.ts'), 'utf8')),
  sources: readSources(join(ROOT, 'store/retailer-sources.json')),
  today: '2026-10-02',
};
const empty = { feed: 'kept-policy', note: 'n', updatedAt: '2026-09-28', updates: [] as unknown[] };
const good = {
  id: 'u_currys_window_30', store: 'Currys', changed: '2026-10-01', window: '30',
  text: 'Currys now gives 30 days from delivery for a change of mind.',
  note: 'new purchases get 30 days from delivery',
  source: 'https://www.currys.co.uk/help/returns-and-cancellations',
};

describe('publishing a checked change', () => {
  it('writes an entry the app will accept, citing where it was read', () => {
    const { doc, error } = addEntry(empty, good, ctx);
    expect(error).toBeUndefined();
    const [u] = readFeed(doc)!;
    expect(u).toMatchObject({ id: 'u_currys_window_30', store: 'Currys', newWindowDays: 30 });
    expect(u.source).toEqual({ url: 'https://www.currys.co.uk/help/returns-and-cancellations', checkedOn: '2026-10-02' });
    expect(doc.updatedAt).toBe('2026-10-02');
  });

  it('refuses a source that is not the retailer’s own site', () => {
    // A news article is not the retailer's terms.
    const { error } = addEntry(empty, { ...good, source: 'https://www.money-news.co.uk/currys-returns' }, ctx);
    expect(error).toMatch(/own site/);
  });

  it('refuses a shop the table does not know by that name', () => {
    expect(addEntry(empty, { ...good, store: 'currys' }, ctx).error).toMatch(/not a shop/);
  });

  it('refuses a change dated in the future — a promise is not a change', () => {
    expect(addEntry(empty, { ...good, changed: '2026-11-01' }, ctx).error).toMatch(/future/);
  });

  it('refuses to publish the same id twice, unless it says it is a correction', () => {
    const once = addEntry(empty, good, ctx).doc;
    expect(addEntry(once, good, ctx).error).toMatch(/already published/);
    const fixed = addEntry(once, { ...good, replace: true, window: '28' }, ctx).doc;
    expect(fixed.updates).toHaveLength(1);
    expect(fixed.updates[0].newWindowDays).toBe(28);
  });

  it('refuses http, and a window that is not a whole number of days', () => {
    expect(addEntry(empty, { ...good, source: 'http://www.currys.co.uk/help' }, ctx).error).toMatch(/https/);
    expect(addEntry(empty, { ...good, window: '30.5' }, ctx).error).toMatch(/whole number/);
  });
});
