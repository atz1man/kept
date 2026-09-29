import { addDays, addMonths, daysBetween, fmtDateLong, fromISODate } from './dates';
import { PRESUMED_FAULT_MONTHS, REJECT_DAYS } from './legal';
import { money } from './money';
import type { Receipt } from './types';

/**
 * "Something wrong with it?" — the rights, turned into the letter.
 *
 * The app has always known which remedy the law gives a purchase on any given
 * day, and said so in a panel. What it left to the person was the part that
 * actually gets a refund: writing to the shop, naming the Act and the section,
 * and asking for the right thing. People ask for a repair they did not have to
 * accept, or give up at "our returns policy is 28 days", because nobody told
 * them which sentence to write.
 *
 * A template, not a model: every clause below is fixed text chosen by which
 * of three remedies today's date falls in, with the person's own description
 * of the fault dropped in as written. Nothing leaves the phone unless they
 * copy or share it. Guidance, not legal advice — the screen says so.
 *
 * Goods only, which is all this app tracks. The sections are the Consumer
 * Rights Act 2015's: 9-11 (satisfactory quality, fit for purpose, as
 * described), 19(14) (a fault within six months is presumed present at
 * delivery), 22 (short-term right to reject), 23 (repair or replacement),
 * 24 (price reduction or final right to reject).
 */

/**
 * Limitation Act 1980 s.5: six years to bring a claim in England and Wales
 * (five in Scotland, which the screen says). Parliament's number.
 */
export const CLAIM_YEARS = 6;

/**
 * How long the letter asks the shop to take to reply. OUR number, not the
 * law's — a reasonable, conventional deadline to put in a first letter — and
 * nothing on screen presents it as a statutory period.
 */
export const REPLY_DAYS = 14;

export type Remedy = 'reject' | 'repair-presumed' | 'repair' | 'too-late';

export interface FaultAdvice {
  remedy: Remedy;
  /** What the law gives today, in one line. */
  headline: string;
  /** The line under it. */
  explain: string;
  /**
   * True when the arrival date of a delivered order is unknown, so every date
   * is counted from the order and is the EARLIEST the right could end.
   */
  hedged: boolean;
}

/** The day the goods came into the buyer's hands, and whether that is known. */
function handedOver(r: Receipt): { from: Date; hedged: boolean } {
  return { from: fromISODate(r.arrivedOn ?? r.purchasedOn), hedged: r.distance && r.arrivedOn === undefined };
}

export function faultAdvice(r: Receipt, today: Date): FaultAdvice {
  const { from, hedged } = handedOver(r);
  const rejectEnds = addDays(from, REJECT_DAYS);
  const presumedEnds = addMonths(from, PRESUMED_FAULT_MONTHS);
  const claimEnds = addMonths(from, CLAIM_YEARS * 12);
  const until = (d: Date, capital = false) => `${capital ? 'U' : 'u'}ntil ${hedged ? 'at least ' : ''}${fmtDateLong(d)}`;
  const counted = hedged ? ' Counted from the day you ordered; if it arrived later, add that date with Edit and this moves.' : '';

  if (daysBetween(today, rejectEnds) >= 0) {
    return {
      remedy: 'reject',
      hedged,
      headline: `You can reject it for a full refund, ${until(rejectEnds)}.`,
      explain: `The ${REJECT_DAYS}-day short-term right to reject: you do not have to accept a repair instead.${counted}`,
    };
  }
  if (daysBetween(today, presumedEnds) >= 0) {
    return {
      remedy: 'repair-presumed',
      hedged,
      headline: 'Ask for a free repair or replacement.',
      explain: `${until(presumedEnds, true)}, a fault is taken to have been there when you got it, so it is for the shop to show it was not. If a repair does not fix it, you can ask for money back.${counted}`,
    };
  }
  if (daysBetween(today, claimEnds) >= 0) {
    return {
      remedy: 'repair',
      hedged,
      headline: 'Ask for a free repair or replacement.',
      explain: `It is now for you to show the fault was there when you got it — wear and tear does not count. Claims run for up to ${CLAIM_YEARS} years in England and Wales, five in Scotland. If a repair does not fix it, you can ask for money back.${counted}`,
    };
  }
  return {
    remedy: 'too-late',
    hedged,
    headline: 'This is likely too old to claim for.',
    explain: `More than ${CLAIM_YEARS} years have passed since you got it, which is the limit for a claim in England and Wales (five in Scotland). A shop may still help as a goodwill gesture.`,
  };
}

/** The letter, or null where there is no claim left to write. */
export function faultLetter(r: Receipt, today: Date, whatsWrong: string): string | null {
  const advice = faultAdvice(r, today);
  if (advice.remedy === 'too-late') return null;
  const bought = fmtDateLong(fromISODate(r.purchasedOn));
  const arrived = r.arrivedOn && r.arrivedOn !== r.purchasedOn ? `, and it was delivered on ${fmtDateLong(fromISODate(r.arrivedOn))}` : '';
  const problem = whatsWrong.trim().replace(/\s+/g, ' ');

  const ask =
    advice.remedy === 'reject'
      ? `I am rejecting the goods under my short-term right to reject (section 22), which lasts ${REJECT_DAYS} days from delivery, and I am asking for a full refund. Please tell me how you would like them returned.`
      : [
          'I am asking you to repair or replace the goods, free of charge and within a reasonable time (section 23).',
          ...(advice.remedy === 'repair-presumed'
            ? [`As the fault has appeared within ${PRESUMED_FAULT_MONTHS} months of delivery, it is taken to have been present when the goods were delivered unless you can show otherwise (section 19(14)).`]
            : []),
          'If a repair or replacement does not put this right, I will be entitled to a price reduction or to reject the goods for a refund (section 24).',
        ].join(' ');

  return [
    `Dear ${r.store},`,
    '',
    `Faulty goods: ${r.item}`,
    // Quoted where it is known: the first thing the shop will look it up by.
    ...(r.orderRef ? [`Order number: ${r.orderRef}`] : []),
    '',
    `On ${bought} I bought “${r.item}” from you for ${money(r.amount)}${arrived}. ${problem ? `The problem: ${problem}${/[.!?]$/.test(problem) ? '' : '.'}` : 'It has developed a fault.'}`,
    '',
    'Under the Consumer Rights Act 2015, goods must be of satisfactory quality, fit for purpose and as described (sections 9 to 11). These goods are not.',
    '',
    ask,
    '',
    `Please reply within ${REPLY_DAYS} days to tell me what you will do.`,
    '',
    'Yours faithfully,',
  ].join('\n');
}
