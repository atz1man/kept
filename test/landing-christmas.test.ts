import { describe, expect, it } from 'vitest';
import { christmasRows } from '../src/landing/christmas';
import { CHRISTMAS, type ChristmasExtension } from '../src/lib/christmas';
import { addDays, fromISODate } from '../src/lib/dates';

/*
 * The landing page's Christmas returns section (src/landing/christmas.ts):
 * the app's own table, shown only in season, and never a date that has gone.
 */
const at = (iso: string) => fromISODate(iso);

describe('the Christmas returns section', () => {
  it('lists every shop in the table, in season, from the table itself', () => {
    const rows = christmasRows(at('2026-11-03'));
    expect(rows.map((r) => r.store).sort()).toEqual(CHRISTMAS.map((x) => x.store).sort());
    const dunelm = rows.find((r) => r.store === 'Dunelm')!;
    expect(dunelm).toMatchObject({ bought: 'Bought 12 October to 24 December', returnBy: 'Back by 31 January 2027' });
  });

  it('puts the latest return date first', () => {
    const dates = christmasRows(at('2026-11-03')).map((r) => CHRISTMAS.find((x) => x.store === r.store)!.returnBy);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('drops each shop the day after its date, and the whole section after the last', () => {
    const last = CHRISTMAS.map((x) => x.returnBy).sort().at(-1)!;
    expect(christmasRows(at(last)).length).toBeGreaterThan(0);
    expect(christmasRows(addDays(at(last), 1))).toEqual([]);
    const early = CHRISTMAS.map((x) => x.returnBy).sort()[0];
    expect(christmasRows(addDays(at(early), 1)).map((r) => r.store)).not.toContain(CHRISTMAS.find((x) => x.returnBy === early)!.store);
  });

  it('is not shown out of season, when the dates are a year away', () => {
    expect(christmasRows(at('2026-08-01'))).toEqual([]);
  });

  it('says the shop’s own limit beside the date, so a sale item is not promised January', () => {
    const t: ChristmasExtension[] = [
      { store: 'M&S', boughtFrom: '2026-10-22', returnBy: '2027-01-17', appliesTo: 'all', condition: 'full-price items', checkedOn: '2026-11-03' },
      { store: 'Next', boughtFrom: '2026-10-23', boughtTo: '2026-12-25', returnBy: '2027-01-05', appliesTo: 'all', excludes: 'Not for Outlet or Clearance stores.', checkedOn: '2026-11-03' },
    ];
    const rows = christmasRows(at('2026-11-03'), t);
    expect(rows.find((r) => r.store === 'M&S')).toMatchObject({ bought: 'Bought from 22 October', note: 'Only full-price items' });
    expect(rows.find((r) => r.store === 'Next')!.note).toBe('Not for Outlet or Clearance stores');
  });
});
