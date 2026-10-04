import { addDays, daysBetween, startOfDay, toISODate } from './dates';
import { toPence, type Pence } from './money';
import { ALIASES_BY_LENGTH, type StorePolicy } from './stores';

/**
 * The paste parser. Runs entirely on-device — an order email is pasted, read,
 * and the text is discarded; nothing is uploaded to be "understood" by a
 * server. That constraint is the reason this is a set of explicit rules
 * rather than a model call, and it is why every rule below has to be
 * defensible on its own.
 */
export interface ParsedReceipt {
  store: string | null;
  policy: StorePolicy | null;
  amount: Pence | null;
  /** ISO date; falls back to today when the paste carries no readable date. */
  purchasedOn: string;
  /** True when the date was actually found rather than assumed. */
  dateFound: boolean;
  /** ISO date the paste said it was delivered, or null when it did not say. */
  arrivedOn: string | null;
  /**
   * ISO date the paste said it was dispatched, or null. Meaningful only for a
   * shop that counts its window from dispatch — see `clockStart` in stores.ts.
   */
  dispatchedOn: string | null;
  windowDays: number;
  /**
   * What was bought, when the paste says it clearly enough — or null. A
   * suggestion for the Add screen's field, which stays editable: the parser
   * read the shop, the total and the dates and still made the person type
   * the one thing that names the receipt on every screen after.
   */
  item: string | null;
  /**
   * The shop's own order number, when the paste labels one — "Order #…",
   * "Order number: …", "Order ID", "Reference". It was read past on purpose
   * (it looks like a price) and then thrown away, and it is the first thing
   * a returns form, a chat window and the letter to the shop all ask for.
   */
  orderRef: string | null;
  /**
   * The things on the receipt and what each cost, where it lists several —
   * empty for a single item or where the list does not hold together (see
   * `pickLines`). What lets a basket be split into the parts that will be
   * returned and the parts that will be kept, without typing them again.
   */
  lines: { item: string; pence: Pence }[];
  /**
   * How each figure was found — read off a label, or the best of several
   * candidates. What the Add card marks for checking (see lib/confidence.ts):
   * a total that is merely the largest figure on the page, or one date picked
   * from several with nothing naming it the order date, is a guess the card
   * presented exactly as it presented a labelled fact.
   */
  how: {
    /** 'label': a total line; 'named': "total" with a product name before it; 'largest': no total line. */
    amount: 'label' | 'named' | 'largest' | null;
    /** 'label': an order-date label; 'only': the one past date there is; 'latest': the newest of several. */
    purchasedOn: 'label' | 'only' | 'latest' | null;
  };
}

export type ParseOutcome =
  | { ok: true; value: ParsedReceipt }
  | { ok: false; reason: 'empty' | 'nothing-found' };

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * One £ figure. The comma-grouped form needs at least ONE comma group: with
 * `*` it accepted none, matched the first three digits of "1299.00", and a
 * £1,299 order was saved as £129. Written without a comma is how most order
 * emails write a four-figure price.
 */
const POUNDS = '£\\s?(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)';

/** Every £ amount in the text, in order, as pence. */
function amountsIn(text: string): Pence[] {
  const out: Pence[] = [];
  const re = new RegExp(POUNDS, 'g');
  for (const m of text.matchAll(re)) out.push(toPence(parseFloat(m[1].replace(/,/g, ''))));
  return out;
}

/**
 * The order total, not the first price on the page. An order email lists
 * every line item before it lists the total, so "first £ found" reliably
 * picks a single sock out of a £240 basket. A labelled total wins; failing
 * that the largest figure is the only defensible guess.
 */
/*
 * "total" as a word, not as the end of "Subtotal" — which comes before the
 * real total in nearly every order email and is the figure before delivery.
 * "Sub-total" and "Sub total" are the same line written apart. A total OF
 * something else (savings, VAT, discount) is not the order total either; a
 * total that merely mentions VAT in passing — "Total (inc. VAT)" — is.
 */
/*
 * Nor a total BEFORE something: "Total before VAT", "Total excl. VAT",
 * "Total (ex VAT)", "Net total". Amazon's order summary prints its ex-VAT line
 * above the real total, and a figure that is not what was paid became the
 * receipt's price. Checked anywhere in the label, not only straight after
 * the word.
 *
 * And the figure may sit on the NEXT line: an order summary pasted from a
 * table puts "Order total" in one cell and "£349.00" in the next, and the
 * label found nothing, so the largest figure on the page won — a subtotal
 * before a discount, or a "free delivery over £50" banner.
 */
const LABELLED_TOTAL = new RegExp(
  '(?<![a-z])(?<!sub[\\s-])(?<!net\\s)total(?!\\s*(?:savings?|saved|discounts?|vat|tax)\\b)' +
    '(?![^£\\n]{0,24}\\b(?:before|excl?\\.?|excluding|ex|net|without|pre)\\b)' +
    '[^£\\n]{0,40}(?:\\n[ \\t]*)?' +
    POUNDS,
  'gi',
);

/*
 * "Total" is also a word in product names — Colgate Total, Total Care, Total
 * Gym — and on a till slip the item lines come first, so "COLGATE TOTAL 125ML
 * x2 £4.97" was read as the total of a £62.47 basket. What tells a label from
 * a name is what stands before the word on its line: nothing (TOTAL £62.47,
 * the till's own layout), or a word that makes it a label (Order total, Grand
 * total, Your total). A "·", "|", ":" or dash starts a new part of the line,
 * as it does in an email pasted onto one line.
 *
 * A preference, not a filter: a total with a name in front of it is still
 * read when it is the only one, because "Argos total £64" is how some people
 * type a receipt in and the figure is right.
 */
const AS_A_LABEL = /(?:^|\b(?:order|grand|basket|bag|cart|your|the|final|new|estimated|invoice|payment|purchase|transaction|sale|receipt)\s+)$/i;

/*
 * Nor is a count or a stray mark a name. A till prints the number of items
 * before its balance line ("3 BALANCE DUE 14.20"), and a camera reads a rule
 * or a smudge as a lone letter ("J TOTAL £1,448.00"); a product's name is
 * neither a bare number nor one character. Measured over 132 photos, these
 * two were every "named" total that was in fact the total.
 */
const NOT_A_NAME = /^(?:\d+|[a-z])$/i;

function readsAsLabel(text: string, at: number): boolean {
  const lineStart = Math.max(text.lastIndexOf('\n', at - 1), -1) + 1;
  const before = text.slice(lineStart, at).split(/[·|:—–]|\s-\s/).pop() ?? '';
  const words = before.replace(/^\W+/, '').split(/\s+/).filter(Boolean);
  while (words.length > 0 && NOT_A_NAME.test(words[0])) words.shift();
  return AS_A_LABEL.test(words.length > 0 ? `${words.join(' ')} ` : '');
}

type Picked<T, H> = { value: T; how: H } | null;

function pickAmount(text: string): Picked<Pence, 'label' | 'named' | 'largest'> {
  const labelled = [...text.matchAll(LABELLED_TOTAL)];
  const asLabel = labelled.find((m) => readsAsLabel(text, m.index!));
  const chosen = asLabel ?? labelled[0];
  if (chosen) return { value: toPence(parseFloat(chosen[1].replace(/,/g, ''))), how: asLabel ? 'label' : 'named' };
  const all = amountsIn(text);
  if (all.length === 0) return null;
  return { value: Math.max(...all), how: 'largest' };
}

/** A date found in the paste, and where it sat — the position is what lets a
 *  label beside it be read. */
interface DateHit {
  date: Date;
  index: number;
  /**
   * How many characters the date itself took, so a caller can look at what
   * comes immediately AFTER it. Guessing that from `index` alone means
   * allowing for the longest date form, and an allowance long enough for
   * "12 September 2026" is long enough to reach into the next clause.
   */
  length: number;
}

/** Candidate dates in the text, with their positions. */
function datesIn(text: string, today: Date): DateHit[] {
  const found: DateHit[] = [];
  /*
   * Two gates, and the second subsumes the first. `new Date(y, 12, 1)` rolls
   * into next January, so the round-trip check below rejects every value the
   * range check would have — which is why deleting the range check changes no
   * answer, and why deleting it survived the suite. It stays as the cheap
   * pre-filter it was written to be, and as the sentence saying what a month
   * and a day are allowed to be; the round trip is the thing that decides.
   *
   * The same applies to the `mon === undefined` guards in the two loops below:
   * an unrecognised month reaches here as undefined, `new Date` returns an
   * invalid date, and `getMonth()` is NaN, which equals nothing. Both are
   * belt and braces over a check that already holds.
   */
  const push = (y: number, m: number, d: number, index: number, length: number) => {
    if (m < 0 || m > 11 || d < 1 || d > 31) return;
    const dt = new Date(y, m, d);
    if (dt.getMonth() === m && dt.getDate() === d) found.push({ date: dt, index, length });
  };

  // "25 Aug", "25 August 2026", "25th Aug"
  // A figure followed by ":NN" is a time of day, never a day or a year: "1 Aug
  // 23:10" read 23 as the year 2023, and `mdy` below read it as 23 August.
  const dmy = /\b(\d{1,2})(?:st|nd|rd|th)?[ .\-/]+([a-z]{3,9})\.?,?(?:[ .\-/]+(\d{2,4})(?!:\d))?\b/gi;
  for (const m of text.matchAll(dmy)) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon === undefined) continue;
    push(resolveYear(m[3], mon, Number(m[1]), today), mon, Number(m[1]), m.index ?? 0, m[0].length);
  }
  // "Aug 25", "August 25, 2026"
  const mdy = /\b([a-z]{3,9})\.?[ .\-/]+(\d{1,2})(?!:\d)(?:st|nd|rd|th)?,?(?:[ .\-/]+(\d{2,4})(?!:\d))?\b/gi;
  for (const m of text.matchAll(mdy)) {
    const mon = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mon === undefined) continue;
    push(resolveYear(m[3], mon, Number(m[2]), today), mon, Number(m[2]), m.index ?? 0, m[0].length);
  }
  // "25/08/2026" — day first. This is a UK app; 05/08 is 5 August, never 8 May.
  // Written with dots or dashes too ("23.09.2026", H&M's and Zara's emails),
  // the same separator both times, so a price like 12.50 is never a date.
  // Only the slash was read, and a dotted order date fell back to today: a
  // deadline later than the real one, in the direction that costs money.
  for (const m of text.matchAll(/\b(\d{1,2})([/.-])(\d{1,2})\2(\d{2,4})\b/g)) {
    const y = Number(m[4]);
    push(y < 100 ? 2000 + y : y, Number(m[3]) - 1, Number(m[1]), m.index ?? 0, m[0].length);
  }
  // Year first: ISO, and "2026/09/20" or "2026.09.20". Nobody writes the year
  // and then the day, so this form is never ambiguous.
  for (const m of text.matchAll(/\b(\d{4})([/.-])(\d{1,2})\2(\d{1,2})\b/g)) {
    push(Number(m[1]), Number(m[3]) - 1, Number(m[4]), m.index ?? 0, m[0].length);
  }
  return found;
}

/**
 * A bare "25 Aug" means the most recent 25 August, not one in the future: an
 * order confirmation describes a purchase that has already happened. Reading
 * it as this year when this year is still ahead would start the return clock
 * on a date that has not arrived and report a window months too generous.
 */
function resolveYear(raw: string | undefined, month: number, day: number, today: Date): number {
  if (raw) return raw.length === 2 ? 2000 + Number(raw) : Number(raw);
  const thisYear = new Date(today.getFullYear(), month, day);
  return daysBetween(today, thisYear) > 0 ? today.getFullYear() - 1 : today.getFullYear();
}

/**
 * Phrases that name the day the order was PLACED.
 *
 * Deliberately whole phrases rather than the word "order" alone: an order
 * email is full of dates that sit near that word and mean something else —
 * "return your order by 5 Sept" most dangerously of all.
 */
const ORDER_DATE_LABEL =
  /\b(?:order(?:ed)?\s*date|date\s+order(?:ed)?|date\s+of\s+order|order(?:ed)?\s+(?:on|placed)|order\s+placed(?:\s+on)?|purchase(?:d)?\s*(?:date|on)|bought\s+on)\b/gi;

/** How far after its label a date may sit and still belong to it. */
const LABEL_REACH = 40;

/**
 * Words that introduce a date which is NOT the day of purchase — when the
 * parcel is coming, when it left, by when it has to go back.
 *
 * Applied as a preference rather than a filter: a date introduced by one of
 * these is the LAST thing to fall back on, never something to discard. A
 * delivery date is still evidence about when the order happened, and the
 * alternative fallback — assuming today — is further from the truth and in the
 * same dangerous direction.
 */
const OTHER_CLOCK = 'deliver\\w*|arriv\\w*|dispatch\\w*|ship\\w*|expect\\w*|estimat\\w*|return\\w*|collect\\w*|due';

const NOT_A_PURCHASE = new RegExp(`\\b(?:${OTHER_CLOCK})\\b[^\\n]{0,24}$`, 'i');

/**
 * The same words on the OTHER side of the date.
 *
 * The check above reads backwards, and so saw only the word order it was
 * written for. Measured, on an order placed 1 August read on 20 September:
 * "Dispatched 12 August" correctly yielded the 1st, while "12 August
 * dispatched", "12 August    Delivered" and "12 August (delivery)" all yielded
 * the 12th — the shipping-history table and the parenthesised column, which is
 * how a great many order emails set exactly this. Eleven days late, in the
 * direction this function's own comment names: the app promises days the shop
 * will not honour.
 *
 * Anchored tight against the end of the date, and that is the whole of what
 * keeps it safe. Only whitespace, a bracket or a dash may stand between the
 * two — never another word and never a comma — so "12 August 2026 dispatched"
 * is caught while "Ordered 1 August 2026, dispatch to follow" is not, and the
 * genuine purchase date in the second is not thrown away for a delivery date
 * further down. Which is why `DateHit` had to learn its own length: a lead
 * allowance generous enough for "12 September 2026" would reach into the next
 * clause on its own.
 */
const NOT_A_PURCHASE_AFTER = new RegExp(`^[ \\t]*[([–—-]?[ \\t]*(?:${OTHER_CLOCK})\\b`, 'i');

/**
 * The purchase date.
 *
 * A labelled order date wins, exactly as a labelled total does above, and for
 * the same reason: an order confirmation carries several dates and only one of
 * them is the day the thing was bought. Without this the rule was "the most
 * recent date that is not in the future", which on a real Currys email quietly
 * read the ESTIMATED DELIVERY line — six days after the order — and started
 * the return clock there. That is the dangerous direction: the app then
 * promises days the shop will not honour, on the one number it exists to get
 * right.
 *
 * Failing a label, the most recent past date is still the best guess — but not
 * one announced as a delivery, a dispatch or a return-by, which is the same
 * mistake one step quieter: "ordered 10 Aug, dispatched 12 Aug" used to yield
 * the 12th. A future date cannot be a purchase that has already happened, so
 * those are out first whatever introduces them.
 */
function pickDate(text: string, today: Date): Picked<Date, 'label' | 'only' | 'latest'> {
  const past = datesIn(text, today)
    .filter((hit) => daysBetween(today, hit.date) <= 0)
    .sort((a, b) => a.index - b.index);
  if (past.length === 0) return null;

  const labels = [...text.matchAll(ORDER_DATE_LABEL)].map((m) => (m.index ?? 0) + m[0].length);
  // Both halves of that conjunction matter and only one was ever tested: with
  // `||`, a date sitting BEFORE the label satisfies the reach test with a
  // negative distance, and the shipping line above "Order date" becomes the
  // purchase. See the last describe in parse.test.ts.
  const labelled = past.find((hit) => labels.some((end) => hit.index >= end && hit.index - end <= LABEL_REACH));
  if (labelled) return { value: labelled.date, how: 'label' };

  const newest = (hits: DateHit[]) => hits.reduce((best, hit) => (hit.date > best ? hit.date : best), hits[0].date);
  const plain = past.filter(
    (hit) =>
      !NOT_A_PURCHASE.test(text.slice(Math.max(0, hit.index - 40), hit.index)) &&
      !NOT_A_PURCHASE_AFTER.test(text.slice(hit.index + hit.length)),
  );
  // One date that is not announced as something else, however often it is
  // printed: a till slip's only date is the day of the sale, and "Ordered:"
  // beside a delivery date is the order. Nothing there was a choice between
  // candidates, so nothing there is a guess.
  if (new Set(plain.map((hit) => hit.date.getTime())).size === 1) return { value: plain[0].date, how: 'only' };
  return { value: newest(plain.length > 0 ? plain : past), how: 'latest' };
}

/**
 * Phrases that name the day the parcel actually landed.
 *
 * Kept apart from ORDER_DATE_LABEL rather than folded into it, because the
 * two answer opposite questions and one of them is dangerous to guess at.
 * Both statutory clocks — the 30-day right to reject and the 14-day right to
 * cancel — run from delivery, and the Add screen already asks for this date in
 * so many words. The order emails it is asking someone to copy it out of say
 * "Delivered 27 August 2026" three lines above the total.
 */
const DELIVERY_DATE_LABEL =
  /\b(?:deliver(?:ed|y)(?:\s+date)?|date\s+deliver(?:ed|y)|arrived(?:\s+on)?)\b/gi;

/**
 * Words that turn a delivery date into a PROMISE of one.
 *
 * "Estimated delivery 3 September" is not a day anything landed, and reading
 * it as one would start both statutory clocks before the parcel existed — the
 * expensive direction, since it makes a live right look expired. Most such
 * dates are in the future and are excluded anyway; this is for the email read
 * a fortnight late, where the estimate has quietly become the past.
 *
 * It used to be tested against the text BEFORE the label, and so caught only
 * the one word order it was written for. Measured: "Estimated delivery 3
 * September" was correctly refused, while "Delivery expected 3 September",
 * "Delivery due 3 September" and "Delivered by 3 September" all became an
 * arrival, and "Dispatch scheduled 3 September" a dispatch — including the
 * shape this comment's neighbour offers as its own example, "dispatching by
 * Friday". The window now runs from before the label to the date itself, so a
 * qualifier counts wherever it sits between the two.
 */
const NOT_AN_ARRIVAL = /\b(?:estimat\w*|expect\w*|due|scheduled|between)\b[^\n]{0,30}$/i;

/**
 * `by` on its own, kept apart from the list above because it is the only
 * ambiguous one: "delivered by DPD on 3 September" is an event and "delivered
 * by 3 September" is a promise, and the difference is entirely whether it sits
 * against the date. So it only counts adjacent to one — which is also why it
 * was inert in the old backward-looking window, since nothing writes the "by"
 * of a promise before the word delivery.
 */
const PROMISED_BY = /\bby\b[^\n]{0,3}$/i;

/**
 * Whether what stands between a label and its date makes the date a promise.
 *
 * The window deliberately spans BOTH sides of the label — an email writes the
 * qualifier before it ("estimated delivery") or after it ("delivery expected")
 * with no preference, and reading only one side is how four of the five shapes
 * got through.
 */
function promised(text: string, labelStart: number, dateIndex: number): boolean {
  const around = text.slice(Math.max(0, labelStart - 30), dateIndex);
  return NOT_AN_ARRIVAL.test(around) || PROMISED_BY.test(around);
}

/**
 * Dates a paste actually announces, under a given kind of label.
 *
 * The three conditions `pickArrival` and `pickDispatch` share, in the one
 * place, because they were written twice and the second copy said "same three
 * conditions as pickArrival, for the same reasons" — which is a comment doing
 * the job of an import. They differ only in which label they look for and, at
 * the end, in which of the answers they want.
 */
/*
 * A date belongs to the label nearest before it. "Your order has been
 * dispatched" as a heading, then "Order date 10 September" on the next line:
 * the 10th sat within reach of "dispatched" and was read as the dispatch date
 * — the order date, so a Zara coat's clock started two days early. Another
 * date's label in between means the date is that label's, not this one's.
 */
const ANOTHER_DATE_LABEL =
  /\b(?:order(?:ed)?|placed|purchased?|bought|deliver(?:ed|y)|arrived|received|dispatch(?:ed)?|despatch(?:ed)?|shipped)\b/i;

function claimedByAnother(between: string): boolean {
  return ANOTHER_DATE_LABEL.test(between);
}

function labelledEvents(
  text: string,
  today: Date,
  purchased: Date | null,
  label: RegExp,
): DateHit[] {
  const labels = [...text.matchAll(label)].map((m) => ({ end: (m.index ?? 0) + m[0].length, start: m.index ?? 0 }));
  if (labels.length === 0) return [];
  return datesIn(text, today)
    // A date still to come has not happened, whatever introduces it.
    .filter((hit) => daysBetween(today, hit.date) <= 0)
    .filter((hit) =>
      labels.some(
        (l) =>
          hit.index >= l.end &&
          hit.index - l.end <= LABEL_REACH &&
          !promised(text, l.start, hit.index) &&
          !claimedByAnother(text.slice(l.end, hit.index)),
      ),
    )
    // A parcel cannot land, or leave, before it is ordered. Such a pair means
    // the label was read off some other order, and the app refuses the
    // combination when it is typed by hand — it must not put it there itself.
    .filter((hit) => !purchased || daysBetween(purchased, hit.date) >= 0);
}

/**
 * The day it arrived, and only when the paste actually says so.
 *
 * Never inferred: an unlabelled date is a purchase date or noise, and the
 * field this fills is one the app treats as fact — it makes the difference
 * between "at least until 27 September" and "27 September". A wrong one is
 * worse than none, so every condition below has to hold.
 */
function pickArrival(text: string, today: Date, purchased: Date | null): Date | null {
  const candidates = labelledEvents(text, today, purchased, DELIVERY_DATE_LABEL);
  if (candidates.length === 0) return null;
  // The latest, because an email that mentions delivery twice is describing a
  // redelivery or a second parcel, and the clock the person cares about is the
  // one that started last.
  return candidates.reduce((best, hit) => (hit.date > best ? hit.date : best), candidates[0].date);
}

/**
 * Phrases that name the day the parcel left the warehouse.
 *
 * A third date, kept apart from the other two for the same reason they are
 * kept apart from each other: it answers a different question and belongs to
 * a different clock. `arrivedOn` starts the two STATUTORY clocks;
 * `windowStartsOn` starts the RETAILER's, and Zara's starts at dispatch.
 *
 * Only the retailer's clock uses it, and only for a shop whose table entry
 * says `clockStart: 'dispatch'` — see the add screen. An Argos email that
 * mentions a dispatch date must not get one, because Argos counts from the
 * purchase and a receipt carrying the wrong clock is worse than one carrying
 * none.
 */
const DISPATCH_DATE_LABEL =
  /\b(?:dispatch(?:ed)?(?:\s+(?:on|date))?|despatch(?:ed)?(?:\s+(?:on|date))?|shipped(?:\s+on)?|sent(?:\s+on)?|left\s+(?:our|the)\s+warehouse)\b/gi;

/**
 * The day it was dispatched, and only when the paste actually says so.
 *
 * The same three conditions as `pickArrival` — labelled, already happened,
 * and not before the order — because they are now literally the same code.
 * An estimate is excluded with them: "dispatching by Friday" is a promise
 * rather than an event, and until this commit that exact sentence was read as
 * a dispatch.
 */
function pickDispatch(text: string, today: Date, purchased: Date | null): Date | null {
  const candidates = labelledEvents(text, today, purchased, DISPATCH_DATE_LABEL);
  if (candidates.length === 0) return null;
  // The EARLIEST, where `pickArrival` takes the latest. A second dispatch is a
  // second parcel or a replacement, and the clock the shop is running started
  // when the first one left.
  return candidates.reduce((best, hit) => (hit.date < best ? hit.date : best), candidates[0].date);
}

/**
 * Words that make a mention of a shop a mention of THE SHOP.
 *
 * An order email says "your Boots order" or "boots.com". Something bought
 * elsewhere says "walking boots". Only the ambiguous names need this — see
 * `commonWord` in stores.ts.
 */
const STORE_CUE = '(?:your|from|at|orders?|receipt|purchased?)';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Does this text name this shop?
 *
 * On word boundaries, not as a substring: "pineapple print tea towel" was
 * being read as an Apple purchase, and a receipt for a £12 tea towel then
 * carried Apple's 14-day window and Apple's policy sentence.
 *
 * A name that is also an ordinary word needs more than a boundary, because
 * "walking boots" and "next day delivery" clear one comfortably. It has to sit
 * beside something that makes it the shop — the possessive an order email uses
 * about itself, or the shop's own domain. Failing that the parser names no
 * shop at all, which the add screen shows as "Not recognised" against an
 * assumed 28-day window: an assumption the person can see and correct, rather
 * than a wrong retailer they have no reason to doubt.
 */
function mentions(text: string, alias: string, commonWord: boolean): boolean {
  const a = escape(alias);
  /*
   * The alias's own edges are letters in any alphabet, not `\b`. JavaScript's
   * `\b` knows only ASCII word characters, so "bonmarché" could never end on
   * one — the é and the space after it are both "non-word" — and "& other
   * stories" could never start on one. Those shops' emails named no shop.
   */
  const start = '(?<![\\p{L}\\p{N}])';
  const end = '(?![\\p{L}\\p{N}])';
  if (!commonWord) return new RegExp(`${start}${a}${end}`, 'iu').test(text);
  return (
    new RegExp(
      `(?:\\b${STORE_CUE}\\s+${a}${end}|${start}${a}\\s+(?:${STORE_CUE}|store)\\b|${start}${a}\\.(?:com|co\\.uk))`,
      'iu',
    ).test(text) || isHeading(text, alias)
  );
}

/*
 * The shop's name as a whole line at the top of the paste: the logo's text,
 * which is what an order email opens with when it is copied. "NEXT" alone on
 * the first line is the shop in a way that "Next day delivery" is not — the
 * whole line, and only near the top, where a heading sits.
 */
const HEADING_LINES = 3;

function isHeading(text: string, alias: string): boolean {
  return text
    .split('\n')
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l.length > 0)
    .slice(0, HEADING_LINES)
    .includes(alias.toLowerCase());
}

function pickStore(text: string): StorePolicy | null {
  // Longest alias first, so a shop whose name contains another's still
  // resolves to itself.
  for (const { alias, store } of ALIASES_BY_LENGTH) {
    if (mentions(text, alias, store.commonWord === true)) return store;
  }
  return null;
}

/** The window used when the shop is not one Kept has verified. */
export const UNKNOWN_STORE_WINDOW_DAYS = 28;

/*
 * Words that mark a line as money ABOUT the order rather than a thing in it.
 * A line carrying a price is an item only if it carries none of these.
 */
const NOT_AN_ITEM = /\b(?:sub[\s-]?total|total|delivery|shipping|postage|p&p|vat|tax|discount|saving|savings|saved|promo|voucher|gift\s?card|payment|paid|card|visa|mastercard|amex|paypal|klarna|refund|balance|cash|change|tender(?:ed)?|contactless|order\s+(?:number|no|#|ref)|you\s+(?:paid|saved))\b/i;

/** Tidy a candidate: no bullets, no trailing price or separators, no runaway length. */
/** Where a long product title is cut: the name of a receipt, not its catalogue entry. */
const ITEM_SHORTENED_TO = 60;

/**
 * @param long 'shorten' where the line is explicitly an item — labelled, or
 *             on a quantity line — so a long product title is cut to a name
 *             rather than thrown away (most Amazon titles are over 80
 *             characters, and all of them were being dropped). 'refuse' for
 *             the guess from any priced line, where a long line is far more
 *             likely a banner than a product.
 */
function cleanItem(raw: string, long: 'shorten' | 'refuse' = 'refuse'): string | null {
  let s = raw
    .replace(/£\s?[\d,.]+/g, '')
    .replace(/^[\s•*·\-–—:|]+|[\s•*·\-–—:|,]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (s.length > 80 && long === 'shorten') {
    const cut = s.slice(0, ITEM_SHORTENED_TO + 1);
    const space = cut.lastIndexOf(' ');
    s = (space > 20 ? cut.slice(0, space) : cut.slice(0, ITEM_SHORTENED_TO)).replace(/[\s,;:(\-–—]+$/, '');
  }
  if (s.length < 3 || s.length > 80) return null;
  if (!/[a-z]{3}/i.test(s)) return null;
  return s;
}

/**
 * What was bought, read conservatively. Three rules, most explicit first, and
 * nothing when none of them holds: a wrong guess in an editable field costs a
 * correction, but a guess that reads like the answer is how "Delivery" ends up
 * as the name of a receipt.
 */
/**
 * Only a LABELLED order number: a bare run of digits in an email is as likely
 * a phone number, a postcode's neighbour or a price, and a wrong reference on
 * a returns form is worse than none. The token must carry at least four
 * digits, so "Order Total" and "Order date" can never be read as one.
 */
const ORDER_REF =
  /\b(?:order|receipt|transaction|trans|booking)\s*(?:number|no\.?|num|#|id|ref(?:erence)?)\s*[:#.]?\s*#?\s*([A-Z0-9][A-Z0-9-]{3,29})\b/i;

function pickOrderRef(text: string): string | null {
  for (const line of text.split('\n')) {
    const m = ORDER_REF.exec(line);
    if (m && (m[1].match(/\d/g) ?? []).length >= 4) return m[1].toUpperCase();
  }
  return null;
}

function pickItem(text: string, store: StorePolicy | null): string | null {
  // "Item: Wool coat", "Product - Kettle", "Description: …"
  const labelled = /(?:^|\n|·)\s*(?:item|product|description)(?:\s+name)?\s*[:\-–]\s*([^\n·]+)/i.exec(text);
  if (labelled) {
    const s = cleanItem(labelled[1], 'shorten');
    if (s && !NOT_AN_ITEM.test(s)) return s;
  }
  // "1 x Wool coat", "Qty: 2 × Socks"
  const qty = /(?:^|\n|·)\s*(?:qty\s*:?\s*)?\d{1,2}\s*[x×]\s+([^\n·]+)/i.exec(text);
  if (qty) {
    const s = cleanItem(qty[1], 'shorten');
    if (s && !NOT_AN_ITEM.test(s)) return s;
  }
  // A line with a price on it that is not money about the order.
  const storeWords = store ? [store.name, ...store.aliases].map((w) => w.toLowerCase()) : [];
  for (const segment of text.split(/\n|·/)) {
    if (!/£\s?\d/.test(segment) || NOT_AN_ITEM.test(segment)) continue;
    const s = cleanItem(segment);
    if (!s) continue;
    if (storeWords.includes(s.toLowerCase())) continue;
    return s;
  }
  return null;
}

/** A receipt with more lines than this is a statement, not a basket worth splitting. */
export const MAX_LINES = 30;

/**
 * Each thing the receipt lists and its price, or nothing.
 *
 * A line is a thing when it carries a £ figure and none of the words that
 * mark money about the order (totals, delivery, VAT, payment, savings) — the
 * same test `pickItem` uses for its last-resort guess — and its figure is
 * not a deduction: a "-£3.00" Clubcard line is money off, not a thing. The
 * price is the line's LAST figure, which on a quantity line ("2 x Socks
 * £3.00 £6.00") is what the line cost.
 *
 * Then the list has to hold together, or none of it is offered. At least
 * two things, or there is nothing to split; no thing dearer than the whole
 * receipt; and, where the total is known, the things adding up to somewhere
 * near it — within a third either way, which allows for multibuy savings
 * and a delivery charge but not for a list that has picked up a promotion
 * banner and a "you saved" line as purchases. A wrong list here would put a
 * made-up price on a receipt someone then returns; no list costs a typed one.
 */
function pickLines(text: string, store: StorePolicy | null, total: Pence | null): { item: string; pence: Pence }[] {
  const storeWords = store ? [store.name, ...store.aliases].map((w) => w.toLowerCase()) : [];
  const out: { item: string; pence: Pence }[] = [];
  for (const segment of text.split(/\n|·/)) {
    if (!/£\s?\d/.test(segment) || NOT_AN_ITEM.test(segment)) continue;
    if (/(?:-\s?£|£\s?-)\s?\d/.test(segment)) continue;
    const prices = amountsIn(segment);
    const pence = prices[prices.length - 1];
    if (!pence) continue;
    const item = cleanItem(segment.replace(/^\s*(?:qty\s*:?\s*)?\d{1,2}\s*[x×]\s+/i, ''), 'shorten');
    if (!item || storeWords.includes(item.toLowerCase())) continue;
    out.push({ item, pence });
  }
  if (out.length < 2 || out.length > MAX_LINES) return [];
  if (total !== null) {
    if (out.some((l) => l.pence > total)) return [];
    const sum = out.reduce((a, l) => a + l.pence, 0);
    if (sum < total * (2 / 3) || sum > total * (4 / 3)) return [];
  }
  return out;
}

/*
 * "GBP 59.99" and "45.99 GBP", as a retailer that sells in several currencies
 * writes its prices, read as the £ figures they are. Every reader below looks
 * for a £, so a total written this way came back as no price at all. Turned
 * into a £ here, once, so it meets exactly the rules a £ figure does: a GBP
 * subtotal is passed over for the GBP total the same way.
 */
function gbpAsPounds(text: string): string {
  return text
    .replace(/\bGBP\s?(?=\d)/gi, '£')
    .replace(/(?<![\d,.])(\d(?:[\d,]*\d)?(?:\.\d{1,2})?)\s?GBP\b/gi, '£$1');
}
/*
 * The `(?<![\d,.])` is what keeps that linear. Without it a figure could be
 * matched from ANY of its digits, and from each one the scan ran to the end of
 * the digits and back: a pasted run of 100,000 digits with no GBP after it
 * took ten seconds on the main thread, against five milliseconds for the rest
 * of the parse. Starting only where a figure starts, each run is read once.
 */

/*
 * "Delivered today" and "Delivered yesterday", read against the day the email
 * was SENT, never the day it is pasted: an Amazon email saying "Delivered
 * today" pasted ten days later would otherwise move the delivery, and the
 * deadline counted from it, ten days late. So it is read only when the paste
 * carries the email's own header — a From: line with a Date: or Sent: line
 * beside it, as Mail, Gmail and Outlook copy it — and left unread otherwise,
 * when the app counts from the order date and says "at least until".
 *
 * The header is required as a block, not a lone "Date:" line, because an
 * order email's own body says "Date: 16/09/2026" about the ORDER.
 */
const HEADER_LINES = 15;
const HEADER_REACH = 4;

function sentOn(text: string, today: Date): Date | null {
  const lines = text.split('\n').slice(0, HEADER_LINES);
  const from = lines.findIndex((l) => /^\s*from:/i.test(l));
  if (from === -1) return null;
  for (let i = Math.max(0, from - HEADER_REACH); i <= Math.min(lines.length - 1, from + HEADER_REACH); i++) {
    if (!/^\s*(?:date|sent):/i.test(lines[i])) continue;
    const hits = datesIn(lines[i], today);
    // A future header is not refused here: the delivery reader refuses a
    // delivery still to come, and one before the order, whatever wrote it.
    return hits.length === 1 ? hits[0].date : null;
  }
  return null;
}

function deliveredRelative(text: string, today: Date): string {
  const sent = sentOn(text, today);
  if (!sent) return text;
  return text.replace(/\b(delivered|arrived)\s+(today|yesterday)\b/gi, (_, word: string, when: string) =>
    `${word} ${toISODate(when.toLowerCase() === 'today' ? sent : addDays(sent, -1))}`,
  );
}

export function parseReceiptText(raw: string, today: Date = new Date()): ParseOutcome {
  if (!raw.trim()) return { ok: false, reason: 'empty' };
  const text = deliveredRelative(gbpAsPounds(raw), today);

  const policy = pickStore(text);
  const total = pickAmount(text);
  const amount = total?.value ?? null;
  // Neither a shop nor a price means there is nothing to build a deadline
  // from — better to say so than to save a receipt made of assumptions.
  if (!policy && amount === null) return { ok: false, reason: 'nothing-found' };

  const picked = pickDate(text, today);
  const date = picked?.value ?? null;
  const arrived = pickArrival(text, today, date);
  const dispatched = pickDispatch(text, today, date);
  return {
    ok: true,
    value: {
      store: policy?.name ?? null,
      policy,
      amount,
      purchasedOn: toISODate(date ?? startOfDay(today)),
      dateFound: date !== null,
      arrivedOn: arrived ? toISODate(arrived) : null,
      dispatchedOn: dispatched ? toISODate(dispatched) : null,
      windowDays: policy?.windowDays ?? UNKNOWN_STORE_WINDOW_DAYS,
      item: pickItem(text, policy),
      orderRef: pickOrderRef(text),
      lines: pickLines(text, policy, amount),
      how: { amount: total?.how ?? null, purchasedOn: picked?.how ?? null },
    },
  };
}
