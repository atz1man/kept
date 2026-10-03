import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STORE_POLICIES } from '../src/lib/stores';
// @ts-expect-error - a small JS helper, run as `npm run check:retailers`
import { candidateStatus, channelIn, leftTheSite, clockIn, daysIn, looksBlocked, proposal, readSources, readTable, returnsLinks, siteOf, verdict, windowSentences } from '../scripts/retailer-check-lib.mjs';

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
    expect(parsed).toEqual(STORE_POLICIES.map((s) => ({
      name: s.name, windowDays: s.windowDays, clockStart: s.clockStart,
      ...('onlineWindowDays' in s ? { onlineWindowDays: s.onlineWindowDays } : {}),
    })));
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
    // Two windows, and the page has to name both.
    expect(verdict([30, 14], one('30 days in store, or 14 days from delivery online.'))).toBe('mentioned');
    expect(verdict([30, 14], one('Return within 30 days of purchase.'))).toBe('differs');
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

describe('the candidate retailers waiting to be read', () => {
  type Candidate = { home: string; returns?: string[]; aliases: string[]; cat?: string; commonWord?: boolean };
  const candidates = JSON.parse(readFileSync(join(ROOT, 'store/retailer-candidates.json'), 'utf8')).candidates as Record<string, Candidate>;
  const tableAliases = STORE_POLICIES.flatMap((s) => s.aliases);

  it('are shops the table does not already have', () => {
    expect(Object.keys(candidates).length).toBeGreaterThanOrEqual(50);
    for (const name of Object.keys(candidates)) expect(STORE_POLICIES.map((s) => s.name), name).not.toContain(name);
  });

  it('name each shop in a way no other shop is named', () => {
    // An alias shared with a table shop would let a candidate's row, once
    // added, take that shop's receipts — or the other way round.
    const seen = new Map<string, string>(tableAliases.map((a) => [a, 'the table']));
    for (const [name, c] of Object.entries(candidates)) {
      expect(c.aliases.length, name).toBeGreaterThan(0);
      for (const a of c.aliases) {
        expect(a, `${name}: aliases are matched lower-case`).toBe(a.toLowerCase());
        expect(seen.get(a), `${name}: "${a}" is already ${seen.get(a)}'s`).toBeUndefined();
        seen.set(a, name);
      }
    }
  });

  it('start from the shop\'s own https homepage', () => {
    for (const [name, c] of Object.entries(candidates)) expect(new URL(c.home).protocol, name).toBe('https:');
  });

  it('list returns pages only on the shop\'s own site', () => {
    // A listed page is read in place of finding one from the homepage, so it
    // is held to the rule a found one is: https, and the shop's own site. A
    // consumer blog quoting "30 days" is not the shop saying it.
    const listed = Object.entries(candidates).filter(([, c]) => c.returns?.length);
    expect(listed.length).toBeGreaterThan(0);
    for (const [name, c] of listed) {
      for (const page of c.returns!) {
        const u = new URL(page);
        expect(u.protocol, `${name}: ${page}`).toBe('https:');
        expect(siteOf(u.hostname), `${name}: ${page}`).toBe(siteOf(new URL(c.home).hostname));
      }
    }
  });
});

describe('where a page landed', () => {
  it('is the shop\'s site through its own subdomains and redirects', () => {
    expect(leftTheSite('https://www.next.co.uk/returns', 'https://zendesk.next.co.uk/hc/en-gb/articles/1')).toBeNull();
    expect(leftTheSite('https://www.ikea.com/gb/en/', 'https://ikea.com/gb/en/returns')).toBeNull();
  });

  it('names the host when a redirect took the page somewhere else', () => {
    // The real case: Joules' own returns URL now lands on a zendesk.com help centre.
    expect(leftTheSite('https://www.joules.com/faq/faqReturnsAndRefunds', 'https://joulesuk.zendesk.com/hc/en-gb/sections/1-Returns')).toBe('joulesuk.zendesk.com');
    expect(leftTheSite('https://www.next.co.uk/', 'https://nextdoor.co.uk/')).toBe('nextdoor.co.uk');
  });
});

describe('what a candidate\'s reading came to', () => {
  const page = (sentences: string[], unreadable?: string) => ({ sentences, unreadable });

  it('is read when any page it reached states a period, even past a refusing homepage', () => {
    // The listed help page answered, the homepage was not needed.
    expect(candidateStatus(null, [page(['Return within 28 days.'])])).toBe('read');
    const blocked = page([], 'blocked by the site');
    expect(candidateStatus(blocked, [blocked, page(['Return within 28 days.'])])).toBe('read');
  });

  it('says which step failed when nothing states a period', () => {
    const home = page([]);
    expect(candidateStatus(home, [home])).toBe('no returns link found');
    expect(candidateStatus(home, [home, page([])])).toBe('no window found');
    // A listed page that loaded but said nothing, behind a homepage that refused.
    const blocked = page([], 'blocked by the site');
    expect(candidateStatus(blocked, [blocked, page([])])).toBe('no window found');
  });

  it('is unreadable only when no page could be read, naming each refusal once', () => {
    const blocked = page([], 'blocked by the site');
    expect(candidateStatus(blocked, [blocked])).toBe('unreadable: blocked by the site');
    expect(candidateStatus(blocked, [page([], 'HTTP 404'), blocked, page([], 'HTTP 404')])).toBe('unreadable: HTTP 404; blocked by the site');
  });
});

describe('finding a candidate\'s returns page from its homepage', () => {
  const home = 'https://www.shop.co.uk/';

  it('treats a shop\'s subdomains as the shop, and nothing else', () => {
    expect(siteOf('www.next.co.uk')).toBe('next.co.uk');
    expect(siteOf('help.next.co.uk')).toBe('next.co.uk');
    expect(siteOf('help.asos.com')).toBe('asos.com');
    expect(siteOf('next.co.uk')).not.toBe(siteOf('nextdoor.co.uk'));
  });

  it('follows the shop\'s own Returns links, the link text before the path', () => {
    const links = [
      { text: 'Delivery', href: '/help/delivery' },
      { text: 'Help', href: '/help/returns-and-refunds' },
      { text: 'Returns & refunds', href: '/customer-service/rr' },
      { text: 'Returns', href: '/customer-service/rr#top' },
    ];
    expect(returnsLinks(links, home)).toEqual(['https://www.shop.co.uk/customer-service/rr', 'https://www.shop.co.uk/help/returns-and-refunds']);
  });

  it('never leaves the shop\'s site: another site\'s words are not the shop\'s', () => {
    const links = [
      { text: 'Returns', href: 'https://www.returns-portal.com/shop' },
      { text: 'Returns', href: 'http://www.shop.co.uk/returns' },
      { text: 'Refunds', href: 'https://help.shop.co.uk/refunds' },
    ];
    expect(returnsLinks(links, home)).toEqual(['https://help.shop.co.uk/refunds']);
  });

  it('follows at most three', () => {
    const links = Array.from({ length: 6 }, (_, i) => ({ text: 'Returns', href: `/r${i}` }));
    expect(returnsLinks(links, home)).toHaveLength(3);
  });

  it('summarises the periods named, most often first, for a person to read against the quotes', () => {
    const p = proposal([
      'Return within 28 days of delivery for a refund.',
      'Changed your mind? 28 days, 28-day returns on everything.',
      'Members can return within 60 days.',
    ]);
    // Counted once per sentence: a sentence repeating "28" is one statement.
    expect(p.periods).toEqual([{ days: 28, times: 2 }, { days: 60, times: 1 }]);
    expect(p.clocks).toEqual(['delivery']);
  });
});
