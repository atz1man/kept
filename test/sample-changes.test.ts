import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assess, mergeFeed, policyAlertFor, readFeed, windowInForceFor } from '../src/lib/policy-feed';
import { seedReceipts, seedUpdates } from '../src/lib/seed';
import { hydrate } from '../src/lib/storage';
import { toPence } from '../src/lib/money';
import { addDays, toISODate } from '../src/lib/dates';
import type { PolicyUpdate, Receipt } from '../src/lib/types';

/**
 * The sample policy changes stay samples (APN-84).
 *
 * A fresh install arrived with five retailer policy changes — "ASOS: new
 * 28-day window for frequent returners", "Apple: 14-day window confirmed for
 * the iPhone 18 line" — dated days or weeks ago, unlabelled, and published in
 * the served feed under the note "Verified UK retailer policy changes". None
 * had been checked against the retailer. The sample RECEIPTS beside them were
 * labelled; these were not, and they did more than sit on a screen:
 *
 * - the list-screen banner matched them by shop, so a real Zara coat added on
 *   day one was told "Zara changed its returns policy — your coat is
 *   affected";
 * - `windowInForceFor` ranked them above the table, so a new purchase's
 *   window could be set by a change that never happened. Invisible today only
 *   because every sample's window happens to equal the table's.
 *
 * Each case below fails against the code before this change.
 */
const TODAY = new Date(2026, 7, 28);
const ago = (n: number) => toISODate(addDays(TODAY, -n));

const mine = (over: Partial<Receipt> = {}): Receipt => ({
  id: 'mine', store: 'Zara', item: 'Wool coat', cat: 'clothing', amount: toPence(34.99),
  purchasedOn: ago(3), windowDays: 30, policy: 'p', distance: true, status: 'active',
  ...over,
});

const real = (over: Partial<PolicyUpdate> = {}): PolicyUpdate => ({
  id: 'u_real', store: 'Zara', changedOn: ago(1), text: 'A checked change.',
  affectsStores: ['Zara'], affectNote: 'n', ...over,
});

describe('the seed’s policy changes', () => {
  it('are all marked as samples', () => {
    const seeded = seedUpdates(TODAY);
    expect(seeded.length).toBeGreaterThan(0);
    expect(seeded.every((u) => u.demo === true)).toBe(true);
  });

  it('keep the mark through a save and a relaunch', () => {
    // The store is read back through `readFeed`, which builds each entry
    // field by field — a field it does not copy is a field the next launch
    // does not have, and a sample that loses its label on relaunch is news.
    const stored = JSON.parse(JSON.stringify({ receipts: [], updates: seedUpdates(TODAY) }));
    const back = hydrate(stored, TODAY).updates;
    expect(back.length).toBe(seedUpdates(TODAY).length);
    expect(back.every((u) => u.demo === true)).toBe(true);
  });
});

describe('a downloaded entry', () => {
  it('cannot call itself a sample', () => {
    // "Only a sample" exempts an entry from being taken seriously: it would
    // escape `windowInForceFor` and be dropped by the next real feed.
    const out = readFeed({ feed: 'kept-policy', updates: [{ ...real(), demo: true }] })!;
    expect(out).toHaveLength(1);
    expect(out[0].demo).toBeUndefined();
  });
});

describe('what a sample may touch', () => {
  it('never sets the window of a new purchase', () => {
    const sample = real({ id: 'u_sample', newWindowDays: 7, changedOn: ago(10), demo: true });
    expect(windowInForceFor('Zara', ago(2), [sample])).toBeUndefined();
    // …while the same change, real, does — so this is the flag and not the date.
    expect(windowInForceFor('Zara', ago(2), [{ ...sample, demo: undefined }])).toEqual({ days: 7, changedOn: ago(10) });
  });

  it('speaks to the sample receipts and not to yours', () => {
    const [sampleZara] = seedReceipts(TODAY).filter((r) => r.store === 'Zara');
    const [a] = assess(seedUpdates(TODAY).filter((u) => u.store === 'Zara'), [sampleZara, mine()], TODAY);
    expect(a.impacts.map((i) => i.receipt.id)).toEqual([sampleZara.id]);
  });

  it('raises no banner and no badge over a real purchase', () => {
    const alert = policyAlertFor(seedUpdates(TODAY), [mine()], TODAY);
    expect(alert.line).toBeNull();
    expect(alert.changed.size).toBe(0);
  });

  it('says "Sample" when it is what the banner is about', () => {
    const alert = policyAlertFor(seedUpdates(TODAY), seedReceipts(TODAY), TODAY);
    expect(alert.line).toMatch(/^Sample: /);
  });

  it('and a real change does not', () => {
    const alert = policyAlertFor([real()], [mine()], TODAY);
    expect(alert.line).toBe('Zara changed its returns policy — your Wool coat is affected');
    expect([...alert.changed]).toEqual(['mine']);
  });
});

describe('the banner’s own sentence', () => {
  it('counts one shop as one shop', () => {
    // It printed "1 shops changed their returns policies" for two receipts
    // from one shop: it counted updates, and said shops.
    const line = policyAlertFor([real()], [mine(), mine({ id: 'mine2', item: 'Scarf' })], TODAY).line;
    expect(line).toBe('Zara changed its returns policy — 2 of your receipts are affected');
  });

  it('matches a shop the way the Watch tab does', () => {
    // It compared names exactly while `assess` canonicalises, so a feed
    // entry written "zara" lit the Watch tab and left the list silent.
    const line = policyAlertFor([real({ affectsStores: ['zara'] })], [mine()], TODAY).line;
    expect(line).not.toBeNull();
  });
});

describe('when a real change arrives', () => {
  const samples = seedUpdates(TODAY);

  it('the samples go', () => {
    const merged = mergeFeed(samples, [real()]);
    expect(merged.map((u) => u.id)).toEqual(['u_real']);
  });

  it('but an empty feed — the state this ships in — leaves them', () => {
    expect(mergeFeed(samples, [])).toEqual(samples);
  });
});

describe('the feed this app serves', () => {
  const doc = JSON.parse(readFileSync(join(__dirname, '..', 'public', 'policy-feed.json'), 'utf8'));

  it('publishes none of the samples as news', () => {
    const ids = new Set(seedUpdates(TODAY).map((u) => u.id));
    expect(doc.updates.filter((u: PolicyUpdate) => ids.has(u.id))).toEqual([]);
  });

  it('does not call itself verified', () => {
    // It said "Verified UK retailer policy changes" over five entries nobody
    // had checked. What the note may say is what the process is.
    expect(doc.note).not.toMatch(/\bverified\b/i);
  });
});
