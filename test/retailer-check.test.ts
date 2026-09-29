import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STORE_POLICIES } from '../src/lib/stores';
// @ts-expect-error - a small JS helper, run as `npm run check:retailers`
import { channelIn, clockIn, daysIn, looksBlocked, readSources, readTable, verdict, windowSentences } from '../scripts/retailer-check-lib.mjs';

/**
 * `npm run check:retailers` reads each retailer's own returns page (APN-16).
 * It needs the network, so CI cannot run it; this holds the parts that decide
 * what the report says, so a run on somebody's laptop is worth reading.
 */
const ROOT = join(__dirname, '..');

describe('what the check reads the table as', () => {
  it('is the table', () => {
    // The script reads stores.ts as text; if that parse drifted, it would
    // compare the retailers' pages against the wrong numbers.
    const parsed = readTable(readFileSync(join(ROOT, 'src/lib/stores.ts'), 'utf8'));
    expect(parsed).toEqual(STORE_POLICIES.map((s) => ({ name: s.name, windowDays: s.windowDays, clockStart: s.clockStart })));
  });

  it('has a source for every shop, and none for a shop the table does not have', () => {
    const sources = readSources(join(ROOT, 'store/retailer-sources.json')) as Record<string, string[]>;
    expect(Object.keys(sources).sort()).toEqual(STORE_POLICIES.map((s) => s.name).sort());
    for (const [name, urls] of Object.entries(sources)) {
      expect(urls.length, name).toBeGreaterThan(0);
      for (const u of urls) expect(new URL(u).protocol, `${name} ${u}`).toBe('https:');
    }
  });
});

describe('which sentences count as a window', () => {
  const page = [
    'Free delivery on orders over £50.',
    'You have 30 days from the date of delivery to return an item for a refund.',
    'Our stores open at 9am. Gift cards are valid for 24 months.',
    'Changed your mind? Return it within a year, even assembled.',
    'You have 30 days from the date of delivery to return an item for a refund.',
  ].join('\n');

  it('keeps a period that is about returning something, once', () => {
    expect(windowSentences(page)).toEqual([
      'You have 30 days from the date of delivery to return an item for a refund.',
      'Changed your mind? Return it within a year, even assembled.',
    ]);
  });

  it('leaves out a period that is not about returns', () => {
    // "24 months" on a gift card is a period and not a return window.
    expect(windowSentences(page).some((s: string) => s.includes('Gift cards'))).toBe(false);
  });

  it('reads the numbers the way retailers write them', () => {
    expect(daysIn('a 28-day returns window')).toEqual([28]);
    expect(daysIn('within 14 calendar days of receipt')).toEqual([14]);
    expect(daysIn('return it within one year')).toEqual([365]);
    expect(daysIn('no period here')).toEqual([]);
  });

  it('says where the clock starts when the sentence does', () => {
    expect(clockIn('30 days from the date your order is dispatched')).toBe('dispatch');
    expect(clockIn('28 days from the day you receive your parcel')).toBe('delivery');
    expect(clockIn('35 days from the date of purchase')).toBe('purchase');
    expect(clockIn('within 30 days')).toBeNull();
  });
});

describe('what the report calls a shop', () => {
  const one = (s: string) => ({ sentences: [s] });

  it('mentioned only when the table’s number is on the page', () => {
    expect(verdict(30, one('Return within 30 days of purchase.'))).toBe('mentioned');
    expect(verdict(14, one('Return within 30 days of delivery.'))).toBe('differs');
  });

  it('never passes a page it could not read, or one that said nothing', () => {
    expect(verdict(30, { unreadable: 'HTTP 403', sentences: [] })).toBe('unreadable');
    expect(verdict(30, { sentences: [] })).toBe('no window found');
  });

  it('knows a bot wall when it sees one', () => {
    expect(looksBlocked(403, '')).toBe(true);
    expect(looksBlocked(200, 'Access Denied — you don’t have permission')).toBe(true);
    expect(looksBlocked(200, 'Returns policy. You have 30 days.')).toBe(false);
  });
});

describe('which purchase a quoted sentence is about', () => {
  it('tells an online order from a purchase in store', () => {
    // The evidence a separate online clock is set from, and only from.
    expect(channelIn('Online orders can be returned within 30 days of delivery.')).toBe('online');
    expect(channelIn('Items bought in store can be returned within 14 days.')).toBe('in store');
    expect(channelIn('Return anything within 30 days.')).toBeNull();
    expect(channelIn('Return online or in store within 30 days.')).toBeNull();
  });
});
