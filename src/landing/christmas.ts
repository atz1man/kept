import { addDays, fmtDateLong, fromISODate, toISODate } from '../lib/dates';
import { CHRISTMAS, type ChristmasExtension } from '../lib/christmas';

/**
 * The landing page's Christmas returns section: the shops' own later dates
 * for presents, from the same table the app counts with (src/lib/christmas.ts),
 * and only in the season they apply.
 *
 * It appears a month before the first of them starts covering purchases and
 * goes the day after the last return-by date. A section about Christmas
 * returns in March is a page nobody has looked at, and a stale date on it is
 * the one thing this product must never print.
 */
export interface ChristmasRow {
  store: string;
  /** "Bought 12 October to 24 December", or "Bought from 29 October". */
  bought: string;
  /** "Back by 31 January 2027". */
  returnBy: string;
  /** The shop's own limit, said plainly, where it has one. */
  note?: string;
}

const short = (iso: string) => fmtDateLong(fromISODate(iso)).replace(/ \d{4}$/, '');

export function christmasRows(today: Date, table: readonly ChristmasExtension[] = CHRISTMAS): ChristmasRow[] {
  const iso = toISODate(today);
  return table
    .filter((x) => iso <= x.returnBy && iso >= toISODate(addDays(fromISODate(x.boughtFrom), -31)))
    .slice()
    // Latest date first: the longest a present can wait is the most useful line to read.
    .sort((a, b) => b.returnBy.localeCompare(a.returnBy) || a.store.localeCompare(b.store))
    .map((x) => ({
      store: x.store,
      bought: x.boughtTo ? `Bought ${short(x.boughtFrom)} to ${short(x.boughtTo)}` : `Bought from ${short(x.boughtFrom)}`,
      returnBy: `Back by ${fmtDateLong(fromISODate(x.returnBy))}`,
      ...(x.condition ? { note: `Only ${x.condition.replace(/,$/, '')}` } : x.excludes ? { note: x.excludes.replace(/\.$/, '') } : {}),
    }));
}
