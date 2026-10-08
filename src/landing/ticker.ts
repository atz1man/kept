import { REJECT_DAYS } from '../lib/legal';
import { STORE_POLICIES, findStore } from '../lib/stores';

/**
 * The scrolling headline bar, derived from the table and the feed it claims
 * to be reporting.
 *
 * These were five hand-typed strings, and they lived in
 * `placeholder-content.ts` (since cut, with the social proof it held) — a
 * module whose own header said "nothing here is
 * measured" — under a note exempting them from it because they "restate
 * published retailer policies". That is exactly the reason they do not belong
 * there: a restatement is only true while it matches what it restates, and
 * nothing was holding it. The README's own pre-ship task is to check all
 * twenty windows against each retailer's terms; whoever does that changes
 * `stores.ts` and would have left this bar announcing the old numbers, on the
 * page whose entire claim is that kept knows the real ones.
 *
 * One of them was already wrong in a small way. "IKEA: 365 days, still
 * unbeaten" singles out IKEA, and Decathlon matches it at 365 in kept's own
 * list — literally unbeaten, and reading as a claim the table does not make.
 * The line is computed from the longest window now, and worded so a tie is
 * still true.
 */
/*
 * Taking [1] instead of [0] used to survive mutation, only because the table
 * had a tie at the top — IKEA and Decathlon both at 365, the very tie the old
 * hand-typed line got wrong. Decathlon's 365 turned out to be members-only and
 * the table now says 30, so the tie is broken and the test catches [1], which
 * is what the note here said would happen.
 */
const longest = [...STORE_POLICIES].sort((a, b) => b.windowDays - a.windowDays)[0];

/*
 * The fallback is unreachable while every name below is in the table, which is
 * what ticker.test.ts holds. It exists because a missing shop must not throw
 * on the marketing page — but a bar reading "ASOS: 0-day window" is its own
 * kind of wrong, so the test names the coupling rather than trusting it.
 */
const days = (name: string) => findStore(name)?.windowDays ?? 0;

/**
 * A gotcha, ready to follow "UNIQLO:" without saying Uniqlo twice.
 *
 * Every gotcha in the table opens with the shop's own name, because on the
 * detail screen it is read on its own; here the bar has already said it.
 */
function gotchaOf(name: string): string {
  const g = findStore(name)?.gotcha ?? '';
  return g.replace(new RegExp(`^${name}\\s+`, 'i'), '');
}

/*
 * Every line is the table or the law, and none of them is news.
 *
 * Two of them were. "ZARA changed its returns policy 2 days ago — kept
 * already updated" was the newest SAMPLE policy change, dated relative to
 * whenever the page was opened, so it was two days old forever. "APPLE:
 * 14-day window confirmed for iPhone 18" was another sample, stated as a fact
 * about a named company's product. Neither had been checked against anything,
 * and the page making the claims is the one people decide to trust kept on.
 * A third, "ASOS: 28-day window for frequent returners", misquoted the table
 * it reads: 28 days is the refund window for everyone. What replaces them
 * says only what kept's own list and the statute already say.
 */
const FROM: Record<'purchase' | 'dispatch' | 'delivery', string> = {
  purchase: 'the day you buy',
  dispatch: 'dispatch',
  delivery: 'delivery',
};

function windowLine(name: string): string {
  const s = findStore(name);
  return `${name.toUpperCase()}: ${days(name)} days from ${s ? FROM[s.clockStart] : 'purchase'}`;
}

export function tickerLines(): string[] {
  return [
    `ZARA: ${gotchaOf('Zara')}`,
    windowLine('ASOS'),
    `${longest.name.toUpperCase()}: ${longest.windowDays} days, and nothing in Quids In’s list beats it`,
    `THE LAW: ${REJECT_DAYS} days to reject faulty goods, whatever the shop’s own window says`,
    `UNIQLO: ${gotchaOf('Uniqlo')}`,
  ];
}
