import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHRISTMAS, christmasCover, christmasDeadline, christmasLine, type ChristmasExtension } from '../src/lib/christmas';
import { addDays, fromISODate, toISODate } from '../src/lib/dates';
import { derive } from '../src/lib/receipts';
import { claimPack } from '../src/lib/claim-pack';
import { copyFor } from '../src/lib/alerts';
import { findStore } from '../src/lib/stores';
import type { Receipt } from '../src/lib/types';
// @ts-expect-error - a small JS helper, run as `npm run check:retailers`
import { siteOf } from '../scripts/retailer-check-lib.mjs';
import sources from '../store/retailer-sources.json';

/*
 * A shop's Christmas returns date moves a deadline only for the purchases it
 * covers, only later, and only where the app can tell the purchase qualifies.
 * The logic is tested against a table made here, so it does not depend on
 * which shops have published this year; the real table is held to the shops'
 * own words further down.
 */
const T: ChristmasExtension[] = [
  { store: 'Dunelm', boughtFrom: '2026-10-12', boughtTo: '2026-12-24', returnBy: '2027-01-31', appliesTo: 'all', checkedOn: '2026-11-03' },
  { store: 'Boohoo', boughtFrom: '2026-10-29', returnBy: '2027-01-05', appliesTo: 'online', checkedOn: '2026-11-03' },
  { store: 'M&S', boughtFrom: '2026-10-22', returnBy: '2027-01-17', appliesTo: 'all', condition: 'full-price items', checkedOn: '2026-11-03' },
];
const r = (store: string, purchasedOn: string, distance = false, windowDays = 28) => ({ store, purchasedOn, distance, windowDays });
const ordinary = (x: { purchasedOn: string; windowDays: number }) => addDays(fromISODate(x.purchasedOn), x.windowDays);
const by = (x: ReturnType<typeof r>) => {
  const d = christmasDeadline(x, ordinary(x), T);
  return d ? toISODate(d) : null;
};

describe('which purchases a Christmas date covers', () => {
  it('covers a purchase inside the dates, at both ends', () => {
    expect(by(r('Dunelm', '2026-10-12'))).toBe('2027-01-31');
    expect(by(r('Dunelm', '2026-12-01'))).toBe('2027-01-31');
    expect(by(r('Dunelm', '2026-12-24'))).toBe('2027-01-31');
  });

  it('not one bought the day before it starts or the day after it ends', () => {
    expect(by(r('Dunelm', '2026-10-11'))).toBeNull();
    expect(by(r('Dunelm', '2026-12-25'))).toBeNull();
  });

  it('finds the shop by any name the table knows it by', () => {
    expect(christmasCover(r('dunelm', '2026-12-01'), T)?.store).toBe('Dunelm');
    expect(christmasCover(r('Marks & Spencer', '2026-12-01'), T)?.store).toBe('M&S');
  });

  it('keeps to online orders where the shop does', () => {
    expect(by(r('Boohoo', '2026-12-01', true))).toBe('2027-01-05');
    expect(by(r('Boohoo', '2026-12-01', false))).toBeNull();
  });

  it('has no end where the shop gives none', () => {
    expect(christmasCover(r('Boohoo', '2027-03-01', true), T)).not.toBeNull();
  });
});

describe('what it does to the deadline', () => {
  it('only ever moves it later', () => {
    // Bought 20 December with 28 days: 17 January, past Boohoo's 5th.
    expect(by(r('Boohoo', '2026-12-20', true))).toBeNull();
    // And a shop with no Christmas date is untouched.
    expect(by(r('Argos', '2026-12-01'))).toBeNull();
  });

  it('leaves it alone where the shop puts a condition the app cannot see', () => {
    // A sale jumper does not qualify, and nothing on a receipt says which it was.
    expect(by(r('M&S', '2026-12-01'))).toBeNull();
    expect(christmasCover(r('M&S', '2026-12-01'), T)?.condition).toBe('full-price items');
  });
});

describe('what the receipt screen says', () => {
  it('says whose date it is, and the window it replaced', () => {
    expect(christmasLine(r('Dunelm', '2026-12-01'), { christmas: true, deadline: fromISODate('2027-01-31') }, T)).toBe(
      'Christmas returns: Dunelm takes things bought 12 October 2026 to 24 December 2026 back until 31 January 2027, later than its usual 28 days.',
    );
  });

  it('says the condition and the date, and that the date above is the ordinary one', () => {
    expect(christmasLine(r('M&S', '2026-12-01'), { christmas: false, deadline: fromISODate('2026-12-29') }, T)).toBe(
      'Christmas returns: M&S takes full-price items bought from 22 October 2026 back until 17 January 2027. If this qualifies, you have until then; the date above is the ordinary 28-day window.',
    );
  });

  it('says nothing about a conditional date earlier than the ordinary one', () => {
    // Bought 1 January with 28 days: 29 January, past M&S's 17th.
    expect(christmasLine(r('M&S', '2027-01-01'), { christmas: false, deadline: fromISODate('2027-01-29') }, T)).toBeNull();
  });

  it('says nothing where the date did not move it, or nothing covers it', () => {
    expect(christmasLine(r('Boohoo', '2026-12-20', true), { christmas: false, deadline: fromISODate('2027-01-17') }, T)).toBeNull();
    expect(christmasLine(r('Dunelm', '2026-09-01'), { christmas: false, deadline: fromISODate('2026-09-29') }, T)).toBeNull();
  });
});

/*
 * The real table. Every row is the shop's own words: a report in
 * store/retailer-check/ dated `checkedOn` quotes the shop's own site naming
 * the day it can go back until. Without this the table is a list somebody
 * typed, and a wrong date here is a present sent back to a shop that refuses it.
 */
const ROOT = join(__dirname, '..');
const DIR = join(ROOT, 'store/retailer-check');
const reports = readdirSync(DIR).filter((f) => f.endsWith('.md')).map((f) => ({ f, text: readFileSync(join(DIR, f), 'utf8') }));
const own = (sources as { sources: Record<string, string[]> }).sources;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The quotes under "## <shop> — Christmas" in the reports of that day, with each page's URL. */
function christmasQuotes(name: string, on: string): { url: string; quote: string }[] {
  const out: { url: string; quote: string }[] = [];
  for (const rep of reports.filter((x) => x.f.startsWith(on))) {
    for (const section of rep.text.split('\n## ').slice(1)) {
      if (section.split('\n')[0] !== `${name} — Christmas`) continue;
      let url = '';
      for (const line of section.split('\n')) {
        const page = /^- (https?:\/\/\S+)/.exec(line);
        if (page) url = page[1];
        else if (line.startsWith('  - > ') && url) out.push({ url, quote: line.slice(6) });
      }
    }
  }
  return out;
}

/** "31st January", "31 Jan", "Sunday 31 January": the day and its month, as shops write them. */
function namesDay(quote: string, iso: string): boolean {
  const d = fromISODate(iso);
  const month = MONTHS[d.getMonth()];
  return new RegExp(`\\b${d.getDate()}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${month.slice(0, 3)}`, 'i').test(quote)
    || new RegExp(`\\b${month.slice(0, 3)}[a-z]*\\.?\\s+${d.getDate()}\\b`, 'i').test(quote);
}

function quoted(x: ChristmasExtension): boolean {
  const site = siteOf(new URL(own[x.store][0]).hostname);
  return christmasQuotes(x.store, x.checkedOn)
    .filter((q) => siteOf(new URL(q.url).hostname) === site)
    .some((q) => namesDay(q.quote, x.returnBy));
}

describe('the Christmas table', () => {
  it('names only shops in the table, once each', () => {
    for (const x of CHRISTMAS) expect(findStore(x.store)?.name, x.store).toBe(x.store);
    expect(new Set(CHRISTMAS.map((x) => x.store)).size).toBe(CHRISTMAS.length);
  });

  it.each(CHRISTMAS.map((x) => [x.store, x] as const))('%s: its date is quoted from its own site, that day', (_name, x) => {
    expect(quoted(x), `${x.store}: no quote from its own site on ${x.checkedOn} names ${x.returnBy}`).toBe(true);
  });

  it('has dates that make sense: covers a span, and ends after it starts', () => {
    for (const x of CHRISTMAS) {
      if (x.boughtTo) expect(x.boughtTo >= x.boughtFrom, x.store).toBe(true);
      expect(x.returnBy > (x.boughtTo ?? x.boughtFrom), x.store).toBe(true);
    }
  });

  it('finds no evidence where there is none', () => {
    // The sweep above proves nothing unless it can fail: a date no report quotes.
    const made = { ...CHRISTMAS[0], returnBy: '2027-02-29'.replace('29', '27') };
    expect(quoted(made)).toBe(false);
    expect(namesDay('returned until 31st January 2027', '2027-01-31')).toBe(true);
    expect(namesDay('returned until 13th January 2027', '2027-01-31')).toBe(false);
    expect(namesDay('have until until Jan 5, 2027', '2027-01-05')).toBe(true);
    expect(namesDay('have until until Jan 15, 2027', '2027-01-05')).toBe(false);
  });
});

describe('every surface reads the same deadline', () => {
  const x = CHRISTMAS.find((e) => !e.condition && e.appliesTo !== 'online')!;
  const shop = findStore(x.store)!;
  const receipt: Receipt = {
    id: 'x', store: x.store, item: 'A present', cat: 'other', amount: 2000 as Receipt['amount'],
    purchasedOn: x.boughtFrom, windowDays: shop.windowDays, policy: shop.policy, distance: false, status: 'active',
  } as Receipt;

  it('derive gives the Christmas date, and measures the ring against it', () => {
    const d = derive(receipt, fromISODate(x.boughtFrom));
    expect(toISODate(d.deadline)).toBe(x.returnBy);
    expect(d.christmas).toBe(true);
    expect(d.windowLength).toBeGreaterThan(shop.windowDays);
    expect(d.daysLeft).toBe(d.windowLength);
  });

  it('and the ordinary date for the same thing bought after it ends', () => {
    const later = { ...receipt, purchasedOn: '2027-02-01' };
    const d = derive(later, fromISODate('2027-02-01'));
    expect(toISODate(d.deadline)).toBe(toISODate(addDays(fromISODate('2027-02-01'), shop.windowDays)));
    expect(d.christmas).toBe(false);
    expect(d.windowLength).toBe(shop.windowDays);
  });
});

describe('what the shop leaves out', () => {
  it('is said after the date, as the shop puts it', () => {
    const line = christmasLine({ store: 'Next', purchasedOn: '2026-12-01', distance: true, windowDays: 28 }, { christmas: true, deadline: fromISODate('2027-01-05') });
    expect(line).toBe('Christmas returns: Next takes things bought 23 October 2026 to 25 December 2026 back until 5 January 2027, later than its usual 28 days. Not for Outlet or Clearance stores, or Christmas decorations.');
  });
});

describe('the words that go with it', () => {
  // Dunelm, 28 days: bought 1 December, ordinarily back by 29 December; Dunelm says 31 January.
  const dunelm = findStore('Dunelm')!;
  const base = {
    id: 'd', store: 'Dunelm', item: 'Throw', cat: 'other', amount: 4000 as Receipt['amount'],
    purchasedOn: '2026-12-01', windowDays: dunelm.windowDays, policy: dunelm.policy, distance: false,
  } as Receipt;

  it('the claim pack calls a return in January in time, and says whose window it was', () => {
    const sent = { ...base, status: 'sent', sentOn: '2027-01-10' } as Receipt;
    expect(claimPack(sent, fromISODate('2027-01-12')).standing[0]).toMatch(/inside the shop’s own Christmas returns window/);
  });

  it('a reminder on the last day does not call it "the 30 days"', () => {
    // A window typed in by hand, so the reminder says it is the saved one,
    // not the shop's — and what ends on the 31st is the Christmas time.
    const r = { ...base, status: 'active', windowDays: 30 } as Receipt;
    const { body } = copyFor('today', r, 0, fromISODate('2027-01-31'));
    expect(body).not.toMatch(/30 days/);
    expect(body).toMatch(/its Christmas returns time ends today/);
  });
});
