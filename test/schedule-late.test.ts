import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dueAlerts } from '../src/lib/alerts';
import { addDays, addMonths, startOfDay, toISODate } from '../src/lib/dates';
import { toPence } from '../src/lib/money';
import { FIRE_HOUR, MAX_PENDING, planAlerts, type PlannedAlert } from '../src/lib/schedule';
import type { Receipt } from '../src/lib/types';

/*
 * A single-shot alert recorded AFTER its notice morning, on iOS.
 *
 * The refund, the guarantee, the right to reject, the credit and the fault
 * letter each have ONE notice morning and no ladder after it. `planAlerts`
 * skipped any morning already past, so a receipt recorded inside its notice
 * period — a credit note with twenty days to run, a guarantee added in its
 * last month, an item kept on day 28 — was raised on the web the moment the
 * app opened and never lodged with iOS at all. iOS is the only path to a lock
 * screen there (`notify.ts` stands aside on native), so it was never said.
 *
 * `planAlerts` measures "past" against the real clock, so these pin it: a
 * Tuesday in June, once before nine and once after. The suite runs in
 * America/New_York; nothing here crosses a clock change.
 */

const DAY = new Date(2027, 5, 15); // Tue 15 June 2027
const BEFORE_NINE = new Date(2027, 5, 15, 8, 30);
const AFTER_NINE = new Date(2027, 5, 15, 10, 0);
const iso = (d: Date) => toISODate(d);
const nine = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), FIRE_HOUR, 0, 0, 0);
const TODAY_9 = nine(DAY);
const TOMORROW_9 = nine(addDays(DAY, 1));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterEach(() => {
  vi.useRealTimers();
});

const at = (now: Date) => vi.setSystemTime(now);

function receipt(over: Partial<Receipt> = {}): Receipt {
  return {
    id: 'r1', store: 'Argos', item: 'Kettle', cat: 'kitchen',
    amount: toPence(45), purchasedOn: iso(addDays(DAY, -40)), windowDays: 30,
    policy: 'p', distance: false, status: 'active',
    ...over,
  };
}

/** Store credit whose note runs out `left` days from DAY. */
const credit = (left: number) => receipt({ status: 'returned', returnedOn: iso(addDays(DAY, -5)), credit: { expires: iso(addDays(DAY, left)) } });
/** A kept item whose twelve-month guarantee ends `left` days from DAY. */
const warranty = (left: number) =>
  receipt({ status: 'kept', keptOn: iso(addDays(DAY, -300)), purchasedOn: iso(addMonths(addDays(DAY, left), -12)), warranty: { months: 12 } });
/** An item kept with `left` days of its 30-day right to reject still to run. */
const reject = (left: number) => receipt({ status: 'kept', keptOn: iso(DAY), purchasedOn: iso(addDays(DAY, left - 30)) });
/** Posted back `ago` days before DAY, refund not seen. */
const refund = (ago: number) => receipt({ status: 'sent', sentOn: iso(addDays(DAY, -ago)) });
/** A fault letter sent `ago` days before DAY. */
const fault = (ago: number) => receipt({ status: 'kept', keptOn: iso(addDays(DAY, -60)), purchasedOn: iso(addDays(DAY, -200)), faultClaim: { sentOn: iso(addDays(DAY, -ago)) } });

const plan = (rs: Receipt[], sent: string[] = []) => planAlerts(rs, DAY, 7, new Set(sent));
const lodged = (r: Receipt, rung: string): PlannedAlert | undefined => plan([r]).find((p) => p.rung === rung);

describe('a single-shot alert whose morning has gone is lodged for the next 9am', () => {
  /*
   * The four measured on main, each `[]` from `planAlerts` while `dueAlerts`
   * raised it, plus the two open-ended rungs, recorded late in the same way.
   */
  it.each([
    ['credit running out in 20 days', credit(20), 'credit'],
    ['a guarantee ending in 18 days', warranty(18), 'warranty'],
    ['kept on day 28: two days left to reject it', reject(2), 'reject'],
    ['kept with one day left to reject it', reject(1), 'reject'],
    ['a refund chased three weeks after it went back', refund(21), 'refund'],
    ['a fault letter unanswered after three weeks', fault(21), 'fault'],
  ])('%s', (_label, r, rung) => {
    at(BEFORE_NINE);
    expect(lodged(r, rung)?.at).toEqual(TODAY_9);
    at(AFTER_NINE);
    expect(lodged(r, rung)?.at).toEqual(TOMORROW_9);
  });

  it('at nine exactly, nine has gone: a moment already here is not ahead', () => {
    // The system fires a past-or-present moment at once, or refuses it.
    at(TODAY_9);
    expect(lodged(credit(20), 'credit')?.at).toEqual(TOMORROW_9);
    at(new Date(TODAY_9.getTime() - 1));
    expect(lodged(credit(20), 'credit')?.at).toEqual(TODAY_9);
  });

  it('still lodges the open-ended ones however long ago, as the web still raises them', () => {
    // No end: a refund never seen and a letter never answered stay worth asking.
    at(AFTER_NINE);
    expect(lodged(refund(200), 'refund')?.at).toEqual(TOMORROW_9);
    expect(lodged(fault(200), 'fault')?.at).toEqual(TOMORROW_9);
  });

  it('lodges one whose notice morning is today for 9am today, or tomorrow once nine has gone', () => {
    at(BEFORE_NINE);
    expect(lodged(credit(30), 'credit')?.at).toEqual(TODAY_9);
    expect(lodged(refund(14), 'refund')?.at).toEqual(TODAY_9);
    at(AFTER_NINE);
    expect(lodged(credit(30), 'credit')?.at).toEqual(TOMORROW_9);
    expect(lodged(refund(14), 'refund')?.at).toEqual(TOMORROW_9);
  });

  it('leaves one whose morning is still ahead where it was', () => {
    at(AFTER_NINE);
    expect(lodged(credit(31), 'credit')?.at).toEqual(TOMORROW_9);
    expect(lodged(credit(40), 'credit')?.at).toEqual(nine(addDays(DAY, 10)));
    expect(lodged(refund(13), 'refund')?.at).toEqual(TOMORROW_9);
    expect(lodged(refund(4), 'refund')?.at).toEqual(nine(addDays(DAY, 10)));
    expect(lodged(reject(5), 'reject')?.at).toEqual(nine(addDays(DAY, 2)));
  });

  it('fires at nine on the dot', () => {
    at(AFTER_NINE);
    for (const r of [credit(20), warranty(18), reject(2), refund(21), fault(21)]) {
      for (const p of plan([r])) {
        expect([p.at.getHours(), p.at.getMinutes(), p.at.getSeconds(), p.at.getMilliseconds()]).toEqual([FIRE_HOUR, 0, 0, 0]);
      }
    }
  });
});

describe('only while it is still true on the morning it fires', () => {
  /*
   * A credit note, a guarantee and a right each run to the END of their last
   * day. So one ending today is said at 9am if nine is still ahead, and not
   * at all once it has gone: tomorrow morning it would be about something
   * that had lapsed, and saying a lapsed right is live is the one thing this
   * app must never do.
   */
  const ending = [
    ['credit', credit],
    ['warranty', warranty],
    ['reject', reject],
  ] as const;

  it.each(ending)('%s ending today: 9am today before nine, nothing after', (rung, make) => {
    at(BEFORE_NINE);
    expect(lodged(make(0), rung)?.at).toEqual(TODAY_9);
    at(AFTER_NINE);
    expect(lodged(make(0), rung)).toBeUndefined();
  });

  it.each(ending)('%s ending tomorrow: 9am today before nine, 9am tomorrow after', (rung, make) => {
    at(BEFORE_NINE);
    expect(lodged(make(1), rung)?.at).toEqual(TODAY_9);
    at(AFTER_NINE);
    expect(lodged(make(1), rung)?.at).toEqual(TOMORROW_9);
  });

  it.each(ending)('%s that ended yesterday: never', (rung, make) => {
    for (const now of [BEFORE_NINE, AFTER_NINE]) {
      at(now);
      expect(lodged(make(-1), rung)).toBeUndefined();
    }
  });
});

describe('the words count the days from the morning it fires', () => {
  it('the right to reject: "2 days left" today, "1 day left" tomorrow, "Last day" on its last', () => {
    at(BEFORE_NINE);
    expect(lodged(reject(2), 'reject')!.title).toBe('2 days left to reject it if it’s faulty');
    expect(lodged(reject(0), 'reject')!.title).toBe('Last day to reject it if it’s faulty');
    at(AFTER_NINE);
    expect(lodged(reject(2), 'reject')!.title).toBe('1 day left to reject it if it’s faulty');
    expect(lodged(reject(1), 'reject')!.title).toBe('Last day to reject it if it’s faulty');
  });

  it('the credit and the guarantee: days from now, or "which is today"', () => {
    at(BEFORE_NINE);
    expect(lodged(credit(20), 'credit')!.body).toContain(', 20 days from now.');
    expect(lodged(warranty(18), 'warranty')!.body).toContain(', 18 days from now.');
    expect(lodged(credit(0), 'credit')!.body).toContain(', which is today.');
    at(AFTER_NINE);
    expect(lodged(credit(20), 'credit')!.body).toContain(', 19 days from now.');
    expect(lodged(warranty(18), 'warranty')!.body).toContain(', 17 days from now.');
    expect(lodged(credit(1), 'credit')!.body).toContain(', which is today.');
    expect(lodged(warranty(1), 'warranty')!.body).toContain(', which is today.');
  });

  it('a morning still ahead says the notice period, as it always did', () => {
    at(AFTER_NINE);
    expect(lodged(credit(40), 'credit')!.body).toContain(', 30 days from now.');
    expect(lodged(reject(5), 'reject')!.title).toBe('3 days left to reject it if it’s faulty');
  });
});

describe('iOS says what the web says', () => {
  /*
   * The property itself, over every rung and a spread of days either side of
   * each boundary: what `planAlerts` lodges for a morning is exactly what
   * `dueAlerts` would raise if the app were opened that morning — the same
   * key, the same words — and what `dueAlerts` would raise on the next
   * morning `planAlerts` can reach is lodged.
   */
  const makers = { credit, warranty, reject, refund: (n: number) => refund(-n + 14), fault: (n: number) => fault(-n + 14) } as const;

  for (const now of [BEFORE_NINE, AFTER_NINE]) {
    for (const [rung, make] of Object.entries(makers)) {
      it(`${rung}, at ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`, () => {
        at(now);
        const reach = now.getTime() < TODAY_9.getTime() ? DAY : addDays(DAY, 1);
        for (let n = -3; n <= 45; n += 1) {
          const r = make(n);
          const mine = plan([r]).filter((p) => p.rung === rung);
          const webOnReach = dueAlerts([r], reach, 7, new Set()).filter((a) => a.rung === rung);
          for (const p of mine) {
            const web = dueAlerts([r], startOfDay(p.at), 7, new Set()).find((a) => a.key === p.key);
            expect(web, `${rung} ${n}: lodged for ${p.at.toDateString()}, which the web would not raise`).toBeDefined();
            expect([p.title, p.body]).toEqual([web!.title, web!.body]);
          }
          if (webOnReach.length > 0) {
            expect(mine.map((p) => p.at), `${rung} ${n}: raised on the web on ${reach.toDateString()}, not lodged`).toEqual([nine(reach)]);
          }
        }
      });
    }
  }
});

describe('the guards the late path keeps', () => {
  it('stays silent about one already said', () => {
    at(AFTER_NINE);
    expect(plan([credit(20)], ['r1:credit'])).toEqual([]);
    expect(plan([reject(2)], ['r1:reject'])).toEqual([]);
    expect(plan([warranty(18)], ['r1:warranty'])).toEqual([]);
    expect(plan([refund(21)], ['r1:refund'])).toEqual([]);
    expect(plan([fault(21)], ['r1:fault'])).toEqual([]);
  });

  it('never about a sample', () => {
    at(AFTER_NINE);
    for (const r of [credit(20), warranty(18), reject(2), refund(21), fault(21)]) {
      expect(plan([{ ...r, demo: true }])).toEqual([]);
    }
  });

  it('uses the key the web dedups on', () => {
    at(AFTER_NINE);
    for (const [r, rung] of [[credit(20), 'credit'], [warranty(18), 'warranty'], [reject(2), 'reject'], [refund(21), 'refund'], [fault(21), 'fault']] as const) {
      expect(plan([r]).find((p) => p.rung === rung)!.key).toBe(dueAlerts([r], addDays(DAY, 1), 7, new Set())[0].key);
    }
  });

  it('sorts a late one ahead of a later rung, and the cap still keeps the soonest', () => {
    at(AFTER_NINE);
    // An active receipt with its ladder ahead, and a credit note recorded late.
    const ladder = receipt({ id: 'r2', purchasedOn: iso(addDays(DAY, -20)) });
    const out = plan([ladder, credit(20)]);
    expect(out[0].key).toBe('r1:credit');
    const times = out.map((p) => p.at.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);

    // 70 late credit notes and one far-off guarantee: the cap holds, and the
    // guarantee is what goes.
    const many = Array.from({ length: 70 }, (_, i) => ({ ...credit(20), id: `c${i}` }));
    const capped = plan([{ ...warranty(200), id: 'w' }, ...many]);
    expect(capped.length).toBe(MAX_PENDING);
    expect(capped.every((p) => p.rung === 'credit' && p.at.getTime() === TOMORROW_9.getTime())).toBe(true);
  });
});
