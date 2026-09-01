import { describe, expect, it } from 'vitest';
import { ALIASES_BY_LENGTH, STORE_POLICIES, findStore, tableCheck, type StorePolicy } from '../src/lib/stores';
import { addDays, fromISODate, toISODate } from '../src/lib/dates';
import { parseReceiptText } from '../src/lib/parse';

/**
 * A sweep over the REAL policy table rather than a hand-kept list of examples,
 * so a twenty-first retailer is covered the day someone adds it.
 *
 * The table is the product — "kept knows each shop's real window and the trap
 * inside it" — and it is prose and data side by side, which is the shape that
 * drifts. The number in the sentence someone reads at the counter has to be
 * the number the app counted with, and a sentence that quotes a clock the app
 * does not keep has to say so.
 */
const TODAY = new Date(2026, 7, 28);

describe('the policy table agrees with itself', () => {
  it.each(STORE_POLICIES.map((s) => [s.name, s] as const))(
    '%s: the days in its sentence are the days it counts',
    (_name, store) => {
      const quoted = [...store.policy.matchAll(/\b(\d+)[- ]days?\b/gi)].map((m) => Number(m[1]));
      // A sentence may name more than one window — IKEA's 365 days with 14 for
      // cut fabric — so the requirement is that the one being counted appears,
      // not that it is alone.
      expect(quoted).toContain(store.windowDays);
    },
  );

  it.each(STORE_POLICIES.map((s) => [s.name, s] as const))(
    '%s: a clock this app does not keep is not left unsaid',
    (_name, store) => {
      /*
       * Three retailers quoted "28 days from delivery" while the app clocked
       * them from the order date and said nothing about the difference. The
       * direction is the safe one — an earlier deadline than the real one —
       * but silence about it is how a receipt comes to look expired on a day
       * it is not, and this app knows the arrival date of nothing.
       *
       * `clockStart: 'dispatch'` IS kept, through `Receipt.windowStartsOn`, so
       * it needs no note beyond its own gotcha. Everything else that names a
       * start other than the purchase has to explain itself.
       */
      const named = /\bfrom (delivery|dispatch|the day it)/i.exec(store.policy);
      if (!named) return;
      if (store.clockStart === 'dispatch') {
        expect(store.gotcha, `${store.name} counts from dispatch and should say so`).toBeTruthy();
        return;
      }
      expect(store.gotcha ?? '', `${store.name} quotes "${named[0]}" but is clocked from purchase`)
        .toMatch(/earliest|arrives/i);
    },
  );

  it('finds the traps it is meant to be reading', () => {
    // Without this the sweep below is a loop over whichever rows happen to
    // carry a number today, and a table that stopped carrying any would report
    // success for a question it never asked.
    expect(STORE_POLICIES.filter((s) => /\d/.test(s.gotcha ?? '')).length).toBeGreaterThanOrEqual(4);
  });

  it.each(STORE_POLICIES.filter((s) => /\d/.test(s.gotcha ?? '')).map((s) => [s.name, s] as const))(
    '%s: its trap quotes no figure the rest of its row does not',
    (_name, store) => {
      /*
       * The gotcha is the differentiator — "kept knows the trap inside the
       * window" — and it is a THIRD copy of the same numbers, after
       * `windowDays` and the policy sentence. The check above holds the
       * sentence to the number the app counts with. Nothing held the trap to
       * either, so Apple's "counts the 14 days" and IKEA's "not 365" could
       * each drift away from the row they sit in unnoticed.
       *
       * Found by mutation: five numerals inside those strings could be changed
       * and the whole suite stayed green.
       *
       * Every numeral, not only the ones followed by "days" — IKEA's trap
       * names its long window as a bare "not 365", and that is the figure most
       * worth holding, since the trap exists to say the 365 does not apply.
       *
       * One-way on purpose. A policy may name a figure the trap does not
       * repeat, because a trap is a warning and not a summary — ASOS's 45 days
       * for some categories is in the sentence and not in the warning. A trap
       * naming a figure that appears nowhere else in its row is the direction
       * that means something: it is quoting a window this table does not hold.
       */
      const figures = (text: string) => [...text.matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]);
      const known = new Set([...figures(store.policy), String(store.windowDays)]);
      const strays = figures(store.gotcha ?? '').filter((n) => !known.has(n));
      expect(strays, `${store.name}'s trap names ${strays.join(', ')}, which the rest of its row does not`)
        .toEqual([]);
    },
  );

  it('no alias resolves to a shop other than its own', () => {
    /*
     * This guards the INDEX, not the aliases: two shops claiming overlapping
     * names, or a longer alias swallowing a shorter one, resolves silently to
     * the wrong retailer and quotes the wrong window at a counter.
     *
     * Being straight about its limit, because the first version of it read as
     * more than this: it builds each probe out of the alias it is checking, so
     * it can never fail for an alias that has stopped appearing in real order
     * emails. Nothing offline can check that.
     */
    for (const store of STORE_POLICIES) {
      for (const alias of store.aliases) {
        const out = parseReceiptText(`Your ${alias} order · Total £20.00 · 20 Aug 2026`, TODAY);
        expect(out.ok, `${alias} parsed nothing`).toBe(true);
        if (out.ok) expect(out.value.store, `"${alias}" resolved to the wrong shop`).toBe(store.name);
      }
    }
  });

  it('finds a store by its display name, whatever the case', () => {
    for (const store of STORE_POLICIES) {
      expect(findStore(store.name)?.name, store.name).toBe(store.name);
      expect(findStore(store.name.toUpperCase())?.name, store.name).toBe(store.name);
    }
  });
});

describe('naming a shop that is not there', () => {
  /*
   * `pickStore` matched a bare substring, so an order from a shop Kept has
   * never heard of was reported as one it has. Four of these were live at
   * once, and the first is on a large fraction of order emails ever sent.
   *
   * The cost is not cosmetic. A named shop brings its window, so a Vinted
   * order became a 35-day Boots one, and its policy sentence, which is the
   * wording someone repeats at a counter. Naming nothing is visibly an
   * assumption — "Not recognised", against a 28-day window the add screen says
   * is assumed — and an assumption someone can correct beats a confident lie.
   */
  const store = (text: string) => {
    const out = parseReceiptText(text, TODAY);
    return out.ok ? out.value.store : null;
  };

  it.each([
    ['a shipping phrase', 'Your Vinted order · next day delivery · Total £20.00 · 20 Aug 2026'],
    ['an item that is also a shop', 'Your Vinted order · walking boots · Total £40.00 · 20 Aug 2026'],
    ['a shop’s name inside a longer word', 'Your Etsy order · pineapple print tea towel · Total £12.00 · 20 Aug 2026'],
    ['an ordinary use of the word', 'Your Depop order · Nike Air Max, next size up · Total £55.00 · 20 Aug 2026'],
  ])('does not invent a retailer from %s', (_label, text) => {
    expect(store(text)).toBeNull();
  });

  it.each([
    ['Boots', 'Boots order · No7 set · £24.98 · 20 Aug 2026'],
    ['Next', 'Your Next order · £30.00 · 20 Aug 2026'],
    ['Apple', 'Your Apple order · AirPods · £129.00 · 20 Aug 2026'],
    ['Boots', 'Thanks for shopping at boots.com · £24.98 · 20 Aug 2026'],
    ['Next', 'Order confirmation from next.co.uk · £30.00 · 20 Aug 2026'],
  ])('still recognises a real %s email', (name, text) => {
    expect(store(text)).toBe(name);
  });

  it('lets an unambiguous shop win over an ordinary word in the same email', () => {
    expect(store('Amazon order · next day delivery · Total £20.00 · 20 Aug 2026')).toBe('Amazon');
  });
});

describe('where each entry says its clock starts', () => {
  /**
   * The field and the prose beside it have to agree.
   *
   * Apple, Amazon and ASOS each carried a gotcha explaining that they count
   * from the day the parcel arrives, and a `clockStart` of 'purchase' two
   * lines above it. Nothing held the two together, so the table stated a rule
   * in a field the app reads and contradicted it in a sentence the app shows.
   */
  const saysDelivery = (p: StorePolicy) =>
    /from delivery|from the day it arrives/i.test(`${p.policy} ${p.gotcha ?? ''}`);
  const saysDispatch = (p: StorePolicy) => /from dispatch/i.test(`${p.policy} ${p.gotcha ?? ''}`);

  it('finds entries of each kind to check', () => {
    // A sweep over an empty set passes silently.
    expect(STORE_POLICIES.filter((p) => p.clockStart === 'delivery').length).toBeGreaterThan(0);
    expect(STORE_POLICIES.filter((p) => p.clockStart === 'dispatch').length).toBeGreaterThan(0);
    expect(STORE_POLICIES.filter((p) => p.clockStart === 'purchase').length).toBeGreaterThan(0);
  });

  it('never says "from delivery" while counting from the till', () => {
    const wrong = STORE_POLICIES.filter((p) => saysDelivery(p) && p.clockStart !== 'delivery').map((p) => p.name);
    expect(wrong).toEqual([]);
  });

  it('never says "from dispatch" while counting from anywhere else', () => {
    const wrong = STORE_POLICIES.filter((p) => saysDispatch(p) && p.clockStart !== 'dispatch').map((p) => p.name);
    expect(wrong).toEqual([]);
  });

  it('never counts from delivery or dispatch without saying so', () => {
    // The other direction: a clock the app runs and the wording never
    // mentions is a deadline nobody can check at a counter.
    const silent = STORE_POLICIES.filter(
      (p) => (p.clockStart === 'delivery' && !saysDelivery(p)) || (p.clockStart === 'dispatch' && !saysDispatch(p)),
    ).map((p) => p.name);
    expect(silent).toEqual([]);
  });
});

describe('the order aliases are matched in', () => {
  /*
   * `pickStore` returns the FIRST alias that matches, so the order of this list
   * is the rule. Longest first, or a shop whose name contains another's — the
   * comment names "john lewis" against a future "john", and "marks and spencer"
   * against a bare "m&s" in the same email footer — resolves to the wrong one.
   *
   * Nothing tested it. Flipping the comparator's subtraction to an addition
   * garbles the whole list and every parse test still passed, because no two
   * shops' aliases overlap TODAY. That is exactly the state in which this
   * ordering is protecting a future entry rather than a present one, and the
   * state in which it is easiest to break without noticing.
   */
  it('is longest first, with no shorter alias ahead of a longer one', () => {
    const lengths = ALIASES_BY_LENGTH.map((a) => a.alias.length);
    expect(lengths.length).toBeGreaterThan(20);
    expect([...lengths].sort((a, b) => b - a)).toEqual(lengths);
  });

  it('picks the longer alias when a text carries both', () => {
    // Two real aliases from two different shops, the shorter one first in the
    // text: only the ORDER of the list decides this, not where they appear.
    const short = [...ALIASES_BY_LENGTH].reverse()[0];
    const long = ALIASES_BY_LENGTH[0];
    expect(long.alias.length).toBeGreaterThan(short.alias.length);
    const out = parseReceiptText(
      `Order confirmation from ${short.alias} and ${long.alias} · Total £20.00 · 20 Aug 2026`,
      new Date(2026, 7, 28),
    );
    if (!out.ok) throw new Error(`expected a parse, got ${out.reason}`);
    expect(out.value.store).toBe(long.store.name);
  });
});

describe('how current the retailer table claims to be', () => {
  /*
   * `TABLE_CHECKED_ON` was added because "20 verified today" claimed a
   * freshness nothing recorded. It fixed the claim and stopped one step short:
   * a date, once set, sits there forever. Measured with the date at 3
   * September 2026 — the row reads "20 shops · checked 3 September 2026" on
   * the 4th, and reads exactly the same in 2029.
   *
   * Which matters more here than it would elsewhere. This table is maintained
   * by hand, and the app has a whole policy feed precisely BECAUSE shops
   * change their windows.
   */
  const CHECKED = '2026-09-03';

  it('says nothing about a check that has not happened', () => {
    expect(tableCheck(new Date(2026, 8, 4), null)).toEqual({ state: 'never' });
  });

  it('quotes a recent check', () => {
    expect(tableCheck(new Date(2026, 8, 4), CHECKED).state).toBe('fresh');
  });

  it('stops quoting one that has gone off', () => {
    // The defect in one line: without this, 2029 reads the same as the day
    // after.
    expect(tableCheck(new Date(2029, 8, 4), CHECKED).state).toBe('stale');
  });

  it('has an expiry that bites within a plausible life of the app', () => {
    /*
     * The number is our judgement and no test asserts it — but that an expiry
     * EXISTS is the property, and one that only bit after a century would
     * satisfy the case above while changing nothing real.
     */
    expect(tableCheck(new Date(2028, 0, 1), CHECKED).state).toBe('stale');
    expect(tableCheck(new Date(2026, 9, 1), CHECKED).state).toBe('fresh');
  });

  it('does not call a check stale on the day it stops being fresh', () => {
    // The last-day edge this codebase has got wrong twice elsewhere: a window
    // is open on its final day.
    const on = fromISODate(CHECKED);
    expect(tableCheck(addDays(on, 365), CHECKED).state).toBe('fresh');
    expect(tableCheck(addDays(on, 366), CHECKED).state).toBe('stale');
  });

  it('reads a date in the future as fresh, not stale', () => {
    // A device clock behind the day of the check is the ordinary cause, and
    // calling a check that has just happened "old" is the worse of the two.
    expect(tableCheck(new Date(2026, 0, 1), CHECKED).state).toBe('fresh');
  });

  it('hands back the date, so the screen quotes the record rather than reformatting it', () => {
    const check = tableCheck(new Date(2026, 8, 4), CHECKED);
    expect(check.state === 'never' ? null : toISODate(check.on)).toBe(CHECKED);
  });
})
