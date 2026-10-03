import { describe, expect, it } from 'vitest';
import sources from '../store/retailer-sources.json';
import { returnsPageFor } from '../src/lib/returns-pages';
import { STORE_POLICIES } from '../src/lib/stores';

/**
 * Every receipt links to its shop's own returns page. A link is somebody
 * leaving the app, so each one is held to the rule `feed-add` applies to a
 * policy source: https, on the retailer's own site.
 */
describe('the returns page for each shop', () => {
  it('exists for every shop in the table', () => {
    expect(STORE_POLICIES.length).toBeGreaterThanOrEqual(20);
    const missing = STORE_POLICIES.filter((s) => returnsPageFor(s.name) === null).map((s) => s.name);
    expect(missing).toEqual([]);
  });

  it('is https and on the shop’s own site', () => {
    for (const shop of STORE_POLICIES) {
      const page = returnsPageFor(shop.name)!;
      const url = new URL(page.url);
      expect(url.protocol).toBe('https:');
      // The shop's name, squeezed, is in its own domain: argos.co.uk, johnlewis.com,
      // marksandspencer.com for M&S, diy.com for B&Q, www2.hm.com for H&M.
      const own: Record<string, string> = { 'M&S': 'marksandspencer', 'B&Q': 'diy', 'H&M': 'hm', 'Sainsbury’s': 'sainsburys', 'B&M': 'bmstores', 'Holland & Barrett': 'hollandandbarrett',
        Seasalt: 'seasaltcornwall', Jigsaw: 'jigsaw-online', 'Ellis Brigham': 'ellis-brigham', 'Mamas & Papas': 'mamasandpapas',
        Selco: 'selcobw', "Levi's": 'levi', 'Microsoft Store': 'microsoft', Coast: 'coastfashion', Toast: 'toa',
        Liberty: 'libertylondon', 'Snow+Rock': 'snowandrock', 'Fortnum & Mason': 'fortnumandmason', 'Bonmarché': 'bonmarche',
      };
      const expected = own[shop.name] ?? shop.name.toLowerCase().replace(/[^a-z]/g, '');
      expect(url.hostname.split('.')).toContain(expected);
    }
  });

  it('is the page the retailer check reads, not a copy of it', () => {
    const pages = (sources as { sources: Record<string, string[]> }).sources;
    for (const shop of STORE_POLICIES) expect(returnsPageFor(shop.name)!.url).toBe(pages[shop.name][0]);
  });

  it('is found by any name the shop goes by, and not for a shop kept does not know', () => {
    expect(returnsPageFor('marks and spencer')?.host).toBe('marksandspencer.com');
    expect(returnsPageFor('ARGOS')?.host).toBe('argos.co.uk');
    expect(returnsPageFor('Corner Shop')).toBeNull();
  });
});
