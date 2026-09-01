import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { addDays, toISODate } from '../src/lib/dates';
import {
  COOLING_OFF_DAYS,
  REJECT_DAYS,
  RETURN_AFTER_CANCEL_DAYS,
  legalRights,
  type LegalRight,
} from '../src/lib/legal';
import { toPence } from '../src/lib/money';
import type { Receipt } from '../src/lib/types';

const TODAY = new Date(2026, 7, 28);
const ago = (n: number) => toISODate(addDays(TODAY, -n));

/** Ordered online, so it carries both rights. */
const online: Receipt = {
  id: 'r', store: 'Zara', item: 'Coat', cat: 'clothing', amount: toPence(34.99),
  purchasedOn: ago(5), windowDays: 30, policy: 'p', distance: true, status: 'active',
};
/** The same purchase made over a counter, which carries only one. */
const inStore: Receipt = { ...online, store: 'Boots', distance: false };

const chips = (rs: LegalRight[]) => rs.map((r) => r.chip);
const find = (rs: LegalRight[], chip: string) => rs.find((r) => r.chip === chip)!;

describe('which rights a purchase carries', () => {
  it('gives a distance purchase both, not a choice between them', () => {
    // The bug this replaced: `legalDays: 14 | 30` made them exclusive, so a
    // receipt showing the cooling-off period never mentioned the 30-day right
    // to reject faulty goods that it also had.
    expect(chips(legalRights(online, TODAY, true))).toEqual(['Consumer Contracts Regs', 'Consumer Rights Act']);
  });

  it('never claims a cooling-off period for something bought in a shop', () => {
    // The Consumer Contracts Regulations cover distance and off-premises
    // contracts only. Stating it over a counter sends someone to be refused.
    const rights = legalRights(inStore, TODAY, true);
    expect(chips(rights)).toEqual(['Consumer Rights Act']);
    expect(rights.map((r) => r.body).join(' ')).not.toMatch(/cooling-off/i);
  });

  it('states the 30-day right for a shop purchase, which does carry it', () => {
    const r = legalRights(inStore, TODAY, true)[0];
    expect(r.live).toBe(true);
    expect(r.body).toContain('25 days left');
    expect(r.body).toContain('wherever you bought it');
  });

  it('leads with the stronger right while it is live, and steps back once it is not', () => {
    expect(chips(legalRights({ ...online, purchasedOn: ago(20) }, TODAY, true)))
      .toEqual(['Consumer Rights Act', 'Consumer Contracts Regs']);
  });
});

describe('the cooling-off clock', () => {
  const coolingOff = (r: Receipt, storeOpen = true) => find(legalRights(r, TODAY, storeOpen), 'Consumer Contracts Regs');

  it('does not tell you a right you still hold has ended', () => {
    // The prototype's wording was inverted here: a live 14-day cooling-off
    // period rendered as "ended". That is the one thing this screen must
    // never say, so it gets its own test.
    const r = coolingOff(online);
    expect(r.live).toBe(true);
    expect(r.body).not.toMatch(/passed|ended/i);
    expect(r.body).toContain('9 days left');
  });

  it('uses the singular on the last day', () => {
    expect(coolingOff({ ...online, purchasedOn: ago(13) }).body).toContain('1 day left');
  });

  it('is still live on the final day, not the day before', () => {
    expect(coolingOff({ ...online, purchasedOn: ago(14) }).live).toBe(true);
    expect(coolingOff({ ...online, purchasedOn: ago(15) }).live).toBe(false);
  });

  it('does not say a live right has run out, on the last day of it', () => {
    /*
     * `live` was checked at this boundary; the WORDS were not. The flag and the
     * prose are two `left >= 0` comparisons, and only one of them was pinned —
     * so the card could carry live: true above a sentence saying the right had
     * gone, which is the same lie the inverted prototype told, one field along.
     */
    const r = coolingOff({ ...online, purchasedOn: ago(14) });
    expect(r.live).toBe(true);
    expect(r.body).not.toMatch(/passed|run out/i);
    expect(r.body).toContain('0 days left');
  });

  it('points at the shop window when cooling-off has run out but the shop has not', () => {
    const r = coolingOff({ ...online, purchasedOn: ago(20) });
    expect(r.live).toBe(false);
    expect(r.body).toContain('shop’s own window above is still open');
  });

  it('does not claim an open shop window when there is none', () => {
    const r = coolingOff({ ...online, purchasedOn: ago(20) }, false);
    expect(r.body).not.toContain('still open');
    // It points at the rights above rather than repeating them, because the
    // 30-day one is on the same screen and may still be live.
    expect(r.body).toContain('rights above');
  });
});

describe('the 30-day right to reject', () => {
  const reject = (r: Receipt) => find(legalRights(r, TODAY, true), 'Consumer Rights Act');

  /*
   * The stronger of the two rights, and the one every purchase carries —
   * counter or online. Its last day had no test at all: neither the flag nor
   * the wording. Both are `left >= 0`, and tightening either to `> 0` tells
   * somebody the right to a full refund on faulty goods ran out on the day
   * they still held it.
   */
  it('is still live on its final day', () => {
    const r = reject({ ...inStore, purchasedOn: ago(30) });
    expect(r.live).toBe(true);
    expect(r.body).not.toMatch(/passed|run out/i);
    expect(r.body).toContain('0 days left');
  });

  it('has gone the day after, and says so', () => {
    const r = reject({ ...inStore, purchasedOn: ago(31) });
    expect(r.live).toBe(false);
    expect(r.body).toMatch(/passed|run out/i);
  });

  it('still offers the repair right once the thirty days are gone', () => {
    // The sentence that matters after the window: six years in England and
    // Wales, five in Scotland. Losing it would leave the card saying only that
    // something has expired.
    expect(reject({ ...inStore, purchasedOn: ago(31) }).body).toMatch(/six years|five in Scotland/i);
  });
});

describe('what the clocks are counted from', () => {
  // Both rights legally start the day the goods arrive, not the day they are
  // paid for. On a counter purchase that is the same day. On a delivered one
  // the app does not know it, so what it computes is the EARLIEST the right
  // could end — and it has to say so rather than assert a date it cannot know.
  const bodies = (r: Receipt, storeOpen = true) => legalRights(r, TODAY, storeOpen).map((x) => x.body).join(' ');

  it('is exact for a counter purchase, and does not hedge about a parcel', () => {
    const text = bodies(inStore);
    expect(text).toContain('ends ');
    expect(text).not.toMatch(/arrived|at least/);
  });

  it('gives a delivered purchase the earliest date, not a definite one', () => {
    const text = bodies(online);
    expect(text).toContain('at least until');
    expect(text).toContain('starts the day it arrived');
  });

  it.each(['Consumer Rights Act', 'Consumer Contracts Regs'])(
    'never flatly says a lapsed %s right has expired on a date it cannot know',
    (chip) => {
      // The same failure as the inverted cooling-off wording, one step along:
      // counted from the order, both clocks read as run out on a day the
      // parcel may not even have arrived. Asserted per right, because the two
      // strings are built separately and one satisfying it says nothing about
      // the other.
      const body = find(legalRights({ ...online, purchasedOn: ago(40) }, TODAY, true), chip).body;
      expect(body).toContain('Counting from your order');
      expect(body).toContain('check that date');
    },
  );

  it('still says so plainly for a counter purchase, where the date is known', () => {
    const lapsed = bodies({ ...inStore, purchasedOn: ago(40) });
    expect(lapsed).toContain('has passed');
    expect(lapsed).not.toContain('Counting from your order');
  });
});

describe('once the day it arrived is known', () => {
  /*
   * Both clocks legally start when the goods reach you. Without that date the
   * app computes from the order and says so — "at least until", and a lapsed
   * right points at the arrival date rather than declaring itself gone.
   * Given it, the dates are simply right, and the hedging goes away.
   */
  const arrived = (n: number) => ({ ...online, arrivedOn: ago(n) });

  it('states the dates plainly instead of as a floor', () => {
    const text = legalRights(arrived(3), TODAY, true).map((r) => r.body).join(' ');
    expect(text).not.toContain('at least until');
    expect(text).not.toContain('Counting from your order');
    expect(text).toContain('the day it arrived');
  });

  it('counts the cooling-off from arrival, not from the order', () => {
    // Ordered 5 days ago, landed 3 days ago: 11 days of cooling-off left, not 9.
    const r = find(legalRights(arrived(3), TODAY, true), 'Consumer Contracts Regs');
    expect(r.body).toContain('11 days left');
    expect(r.live).toBe(true);
  });

  it('counts the 30-day right from arrival too', () => {
    expect(find(legalRights(arrived(3), TODAY, true), 'Consumer Rights Act').body).toContain('27 days left');
  });

  it('can keep a right alive that the order date said had gone', () => {
    // Ordered 20 days ago — the cooling-off reads as run out. It arrived 8
    // days ago, so there are 6 days of it left, and the app was telling this
    // person to stop trying.
    const late = { ...online, purchasedOn: ago(20), arrivedOn: ago(8) };
    const r = find(legalRights(late, TODAY, true), 'Consumer Contracts Regs');
    expect(r.live).toBe(true);
    expect(r.body).toContain('6 days left');
  });

  it('says a lapsed right has lapsed, once it can be sure', () => {
    const r = find(legalRights({ ...online, purchasedOn: ago(30), arrivedOn: ago(20) }, TODAY, false), 'Consumer Contracts Regs');
    expect(r.live).toBe(false);
    expect(r.body).toContain('counting from the day it arrived');
    expect(r.body).not.toContain('check that date');
  });

  it('is not asked of a counter purchase, which arrives when it is bought', () => {
    const text = legalRights(inStore, TODAY, true).map((r) => r.body).join(' ');
    expect(text).not.toMatch(/arrived|at least/);
  });
});

describe('the 30-day right to reject faulty goods', () => {
  const reject = (r: Receipt) => find(legalRights(r, TODAY, true), 'Consumer Rights Act');

  it('counts from purchase', () => {
    expect(reject({ ...online, purchasedOn: ago(10) }).body).toContain('20 days left');
  });

  it('runs its own 30 days on a distance purchase, outliving the cooling-off', () => {
    // Day 20: cancelling for any reason has gone, rejecting a faulty one has
    // not. Telling this person they only have a repair coming would cost them
    // a refund they are still entitled to.
    const rights = legalRights({ ...online, purchasedOn: ago(20) }, TODAY, true);
    expect(find(rights, 'Consumer Rights Act').live).toBe(true);
    expect(find(rights, 'Consumer Contracts Regs').live).toBe(false);
  });

  it('keeps the repair right alive after the 30 days lapse', () => {
    const r = reject({ ...online, purchasedOn: ago(60) });
    expect(r.live).toBe(false);
    expect(r.body).toContain('repair or replacement');
  });
});

describe('the parts a person only finds out by asking', () => {
  const TODAY = new Date(2026, 7, 28);
  const bought = (daysAgo: number, distance: boolean): Receipt => ({
    id: 'x', store: 'ASOS', item: 'Coat', cat: 'clothing', amount: 4000,
    purchasedOn: toISODate(addDays(TODAY, -daysAgo)), windowDays: 28, policy: 'p',
    distance, status: 'active',
  });

  it('names the Scottish period as well as the English one', () => {
    // "up to six years in England and Wales" gives a Scottish reader no
    // number at all, on an app sold UK-wide.
    const [reject] = legalRights(bought(60, false), TODAY, true);
    expect(reject.live).toBe(false);
    expect(reject.body).toContain('six years in England and Wales');
    expect(reject.body).toContain('five in Scotland');
  });

  it('says an expired cooling-off may not be expired', () => {
    // Regulation 31: if the trader never gave the cancellation information,
    // the period ends twelve months after it otherwise would have. Closing
    // the door on that is closing it on a refund the person may still be owed.
    const rights = legalRights(bought(40, true), TODAY, true);
    const coolingOff = rights.find((r) => r.chip === 'Consumer Contracts Regs')!;
    expect(coolingOff.live).toBe(false);
    expect(coolingOff.body).toMatch(/never told you about this right/);
    expect(coolingOff.body).toMatch(/up to a year/);
  });

  it('says it whether or not the arrival date is known', () => {
    const withArrival = { ...bought(40, true), arrivedOn: toISODate(addDays(TODAY, -38)) };
    const known = legalRights(withArrival, TODAY, true).find((r) => r.chip === 'Consumer Contracts Regs')!;
    expect(known.live).toBe(false);
    expect(known.body).toMatch(/never told you about this right/);
  });

  it('does not clutter a live right with it', () => {
    // While the right is plainly running there is nothing here worth the
    // words, and the sentence would read as a warning about the wrong thing.
    const rights = legalRights(bought(3, true), TODAY, true);
    const coolingOff = rights.find((r) => r.chip === 'Consumer Contracts Regs')!;
    expect(coolingOff.live).toBe(true);
    expect(coolingOff.body).not.toMatch(/never told you about this right/);
  });
});

describe('when both clocks have run out, it still says what is left', () => {
  /*
   * Found by mutation: `shopStillOpen || 'You keep the rights above…'` flipped
   * to `&&` and nothing failed. `shopStillOpen` is a STRING, so the `||` is
   * choosing between two sentences — the shop's window is still open, OR the
   * only thing left is the faulty-goods route. The flip swaps them, which
   * drops the reassurance in exactly the case that needs it: the cooling-off
   * has run out AND the shop's window has shut.
   *
   * That is the moment this app exists for. A person who has just been told
   * two clocks have run out is one sentence away from believing there is
   * nothing left to do.
   */
  const expired = { ...online, purchasedOn: ago(20), arrivedOn: ago(20) };

  it('names the faulty-goods route once the shop is shut too', () => {
    const [, ...rest] = legalRights(expired, TODAY, false);
    const cooling = [...rest, ...legalRights(expired, TODAY, false)].find((r) => r.chip === 'Consumer Contracts Regs');
    expect(cooling?.live).toBe(false);
    expect(cooling?.body).toContain('You keep the rights above for anything that turns out to be faulty');
  });

  it('points at the shop instead while the shop is still open', () => {
    const cooling = legalRights(expired, TODAY, true).find((r) => r.chip === 'Consumer Contracts Regs');
    expect(cooling?.body).toContain('The shop’s own window above is still open either way');
    // And not both, which would be two answers to one question.
    expect(cooling?.body).not.toContain('You keep the rights above for anything');
  });
});

/**
 * Every period these sentences state, against the constant that produced the
 * date sitting beside it.
 *
 * They were typed out — "30-day right to reject", "then 14 more days to send
 * it back" — so the sentence and the date could disagree, and mutation says
 * nothing would have noticed: changing the numeral in any of the ten literals
 * that carry one left the whole suite green. That is a statement of UK law
 * shown to somebody as a right they have, drifting from the clock the app
 * counts on.
 *
 * The fix is the one the landing page already has (`${REJECT_DAYS} days to
 * reject`) and the one `brand.ts` and `pricing.ts` exist for: not a guard over
 * a second copy, but no second copy. What is below is what stops one coming
 * back.
 */
describe('the periods are written from the constants, not typed twice', () => {
  const SOURCE = join(__dirname, '..', 'src', 'lib', 'legal.ts');

  /**
   * The literal halves only. A template's `${...}` is not part of any of these
   * nodes, so an interpolated period leaves nothing here to find — which is
   * exactly the property being asked about, and why this reads the file with
   * the TypeScript parser rather than a regex: a regex over the source would
   * see the `30` in `${REJECT_DAYS}` nowhere and the `30` in a comment
   * everywhere.
   */
  const literals = (): string[] => {
    const sf = ts.createSourceFile(SOURCE, readFileSync(SOURCE, 'utf8'), ts.ScriptTarget.Latest, true);
    const out: string[] = [];
    const walk = (n: ts.Node) => {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text);
      if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) out.push(n.text);
      ts.forEachChild(n, walk);
    };
    walk(sf);
    return out;
  };

  it('finds the sentences it is meant to be reading', () => {
    // A parse that returned nothing — a renamed file, a TypeScript API change —
    // would leave the check below comparing an empty list with empty.
    const found = literals();
    expect(found.length).toBeGreaterThan(20);
    expect(found.filter((t) => t.includes('cooling-off')).length).toBeGreaterThanOrEqual(4);
    expect(found.filter((t) => t.includes('reject')).length).toBeGreaterThanOrEqual(4);
  });

  it('states no period as a typed numeral', () => {
    // Negative on purpose: it asks that NO literal here states a period, not
    // that the ten known sentences state the right one, so an eleventh is
    // covered on the day it is written.
    const typed = literals().filter((t) => /\b\d+[- ](?:days?|weeks?|months?|years?)\b/.test(t));
    expect(typed, `typed out rather than interpolated: ${typed.join(' | ')}`).toEqual([]);
  });

  it('and the sentences a person reads carry those numbers', () => {
    // The other direction. Interpolation removes the second copy; this says
    // the first one still reaches the screen, so the constants cannot be
    // interpolated somewhere nobody sees.
    const live = legalRights(online, TODAY, false);
    const lapsed = legalRights({ ...online, purchasedOn: ago(200) }, TODAY, false);
    for (const rs of [live, lapsed]) {
      expect(find(rs, 'Consumer Rights Act').body).toContain(`${REJECT_DAYS}-day`);
      expect(find(rs, 'Consumer Contracts Regs').body).toContain(`${COOLING_OFF_DAYS}-day`);
    }
    expect(find(live, 'Consumer Contracts Regs').body)
      .toContain(`${RETURN_AFTER_CANCEL_DAYS} more days to send it back`);
    // Both branches of each right were exercised, or the loop above proved
    // whichever one it happened to hit twice.
    expect(find(live, 'Consumer Rights Act').live).toBe(true);
    expect(find(lapsed, 'Consumer Rights Act').live).toBe(false);
    expect(find(live, 'Consumer Contracts Regs').live).toBe(true);
    expect(find(lapsed, 'Consumer Contracts Regs').live).toBe(false);
  });
});
