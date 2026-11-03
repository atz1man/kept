import { fmtDateLong, fromISODate, toISODate } from '../lib/dates';
import { COOLING_OFF_DAYS, REJECT_DAYS } from '../lib/legal';
import { CHECKED_ON, checkedCount, shopCheckedOn } from '../lib/stores';
import { CHRISTMAS } from '../lib/christmas';

/**
 * The landing page's proof: what Quids In can show for itself, and nothing it
 * cannot.
 *
 * The page once carried a money-recovered total, a star rating and named
 * reviewers, none of them real (test/landing-claims holds the page to having
 * none, and lists what was cut). What the product DOES have is checkable: return windows read off
 * each shop's own page on a date, the law's two periods, and Christmas dates
 * quoted from the shops. Every figure here is computed from the tables the
 * app itself runs on, on the day the page is opened, so it cannot claim more
 * than is true — a check that goes stale stops counting, and the Christmas
 * figure disappears once the last of those dates has passed.
 */
export interface ProofFact {
  figure: string;
  label: string;
}

export function proofFacts(today: Date): ProofFact[] {
  const { checked, total } = checkedCount(today);
  const fresh = Object.entries(CHECKED_ON).filter(([name]) => shopCheckedOn(name, today) !== null).map(([, on]) => on).sort();
  const latest = fresh.at(-1);
  const facts: ProofFact[] = [];
  // With no current check there is nothing to show here, and "0 of 111 read
  // off each shop's own page" would be a claim against itself.
  if (checked > 0 && latest) {
    facts.push({
      figure: checked === total ? `${total}` : `${checked} of ${total}`,
      label: `UK shops’ return windows read off each shop’s own returns page, most recently on ${fmtDateLong(fromISODate(latest))}. Not estimated by AI.`,
    });
  }
  facts.push(
    {
      figure: `${REJECT_DAYS} + ${COOLING_OFF_DAYS}`,
      label: `days the law gives you, to reject faulty goods and to cancel online orders, counted beside every shop’s own clock.`,
    },
  );
  const iso = toISODate(today);
  const christmas = CHRISTMAS.filter((x) => x.returnBy >= iso);
  if (christmas.length > 0) {
    facts.push({
      figure: `${christmas.length}`,
      label: `shops’ Christmas return dates, quoted from their own pages, so a present bought in December shows the date the shop really gives.`,
    });
  }
  return facts;
}
