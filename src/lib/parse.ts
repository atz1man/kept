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
    /**
     * 'label': a total line; 'named': "total" with a product name beside it;
     * 'largest': no total line; 'part': only a basket or items total, which
     * may leave out delivery; 'several': totals that disagree, the last of the
     * surest kind taken.
     */
    amount: 'label' | 'named' | 'largest' | 'part' | 'several' | null;
    /**
     * 'label': an order-date label; 'only': the one past date there is;
     * 'latest': the newest of several; 'other': a dispatch or delivery
     * notice's date, nothing naming the order's; 'month-first': figures that
     * also read month first, the other way being the more recent.
     */
    purchasedOn: 'label' | 'only' | 'latest' | 'other' | 'month-first' | null;
    /**
     * 'clear': the sender, the heading, or named as the shop; 'mention': only
     * named in passing; 'several': more than one shop named as surely.
     */
    store: 'clear' | 'several' | 'mention' | null;
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
  '(?<![a-z])(?<!sub[\\s-])(?<!net\\s)total' +
    /*
     * Nor a total OF a part of the order: "Total Delivery £4.95", "Total
     * Goods £120.00", "Total postage". An invoice prints all of these above
     * its real total, and the first one found was the receipt's price — a
     * £89.95 order saved as £4.95. A total of the GOODS is kept (as a part,
     * below); a total of the delivery or the VAT is never the order's.
     */
    '(?!\\s*(?:savings?|saved|discounts?|vat|tax|delivery|shipping|postage|p\\s?&\\s?p|packing|carriage)\\b)' +
    '(?![^£\\n]{0,24}\\b(?:before|excl?\\.?|excluding|ex|net|without|pre)\\b)' +
    // What stands between the word and its figure is read below, so it is kept.
    // The figure may sit one line down, or two with a blank line between, as a
    // table pasted cell by cell sets it.
    '([^£\\n]{0,40})(?:\\n[ \\t]*){0,2}' +
    POUNDS,
  'gi',
);

/*
 * The money that actually left, in words that do not say "total": "Amount
 * paid £114.99", "Balance due". Without it a receipt whose only summary line
 * said this fell back to the largest figure on the page — which on a JD
 * Sports email was "Win £1,000 of vouchers" in the footer.
 */
const PAID_LABEL = new RegExp(
  '(?<![a-z])(?:amount\\s+(?:paid|due|payable|charged|to\\s+pay)|balance\\s+(?:due|paid)|you\\s+paid)\\b([^£\\n]{0,20})(?:\\n[ \\t]*){0,2}' +
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
 * before its balance line ("3 BALANCE DUE 14.20", "2 ITEMS TOTAL 34.98"), and
 * a camera reads a rule or a smudge as a lone letter ("J TOTAL £1,448.00"); a
 * product's name is neither a bare number nor one character. Measured over 132
 * photos, these two were every "named" total that was in fact the total.
 */
const NOT_A_NAME = /^(?:\d+|[a-z])$/i;

/*
 * How far back from a "total" its label is looked for. A label is a word or
 * two ("Order total", "3 BALANCE DUE"), and a receipt's line is under a
 * hundred characters; the whole line used to be sliced and split again for
 * every "total" on it, so one long line that said "total" many times took
 * time in the square of its length. Measured: a 40,000-character line took
 * 1.9 s, through the paste box. Past this distance the window may start in
 * the middle of a word, so that first fragment is dropped.
 */
const LABEL_LOOKBACK = 160;

/** The words before a "total" on its part of the line, or null when they make it a name. */
function labelBefore(text: string, at: number): string[] | null {
  const from = Math.max(0, at - LABEL_LOOKBACK);
  const window = text.slice(from, at);
  const newline = window.lastIndexOf('\n');
  const line = newline >= 0 ? window.slice(newline + 1) : from > 0 ? window.replace(/^\S*\s*/, '') : window;
  const before = line.split(/[·|:—–]|\s-\s/).pop() ?? '';
  const words = before.replace(/^\W+/, '').split(/\s+/).filter(Boolean);
  let counted = false;
  while (words.length > 0 && NOT_A_NAME.test(words[0])) {
    counted ||= /^\d+$/.test(words[0]);
    words.shift();
  }
  // "2 ITEMS TOTAL": the count a till prints, not a total of the items alone.
  if (counted && words.length > 0 && /^items?$/i.test(words[0])) words.shift();
  return AS_A_LABEL.test(words.length > 0 ? `${words.join(' ')} ` : '') ? words.map((w) => w.toLowerCase()) : null;
}

/*
 * What a label says about its figure, read off the words around "total".
 *
 * The first labelled total used to win, and an order email prints several:
 * "Basket total" before delivery, "Total (2 items)" before delivery, "Order
 * total" before a promotion code, "Order summary: Total" before a voucher —
 * and then the figure that was charged. In the parser audit's cases
 * (test/fixtures/parse-audit.ts), eight emails and till slips that say
 * "total" more than once were saved at the wrong figure, with nothing on the
 * card to say so. So each total is ranked by what it is:
 *
 *   3  the money that left: to pay, paid, payable, due, charged, grand, final
 *   2  the order's total: plain "Total", "Order total", "Invoice total"
 *   1  a part of it: a basket, bag or cart total, a total of the items or goods
 *   0  a product's name: "Total Care mouthwash 500ml £3.50"
 *
 * The last of the highest rank wins, because an order email states its totals
 * in the order the money is worked out and the charged figure comes last.
 */
const PAID_WORDS = new Set(['pay', 'paid', 'payable', 'due', 'charged', 'charge', 'owing', 'grand', 'final']);
const PART_WORDS = new Set(['items', 'item', 'goods', 'products', 'product', 'merchandise', 'basket', 'bag', 'cart', 'lines']);
/*
 * Words that may stand between "total" and its figure without making it a
 * name: "Total to pay", "Total (inc. VAT)", "Total (tax incl.)", "Total due
 * today", "Total £28.99 GBP". Anything else there — "Total Care mouthwash
 * 500ml" — is the rest of a product's name, and the line is an item.
 */
const TAIL_WORDS = new Set([
  'to', 'amount', 'inc', 'incl', 'including', 'included', 'vat', 'tax', 'taxes', 'gbp', 'order', 'value', 'sum',
  'of', 'for', 'the', 'your', 'in', 'uk', 'after', 'with', 'applied', 'and', 'all', 'cost', 'price', 'now', 'today',
  'is', 'was', 'delivery', 'shipping', 'postage', 'p&p', 'discount', 'discounts', 'savings', 'promo', 'promotions',
  'vouchers', 'pounds', 'sterling', 'stg', 'summary', 'spend', 'spent', 'be', 'will', 'been', 'has', 'card', 'account',
  'balance',
]);

type TotalRank = 0 | 1 | 2 | 3;

function rankTotal(before: string[] | null, tail: string): TotalRank {
  if (before === null) return 0;
  const words = [...before, ...tail.toLowerCase().replace(/[^a-z0-9&]+/g, ' ').split(' ').filter(Boolean)];
  let rank: TotalRank = 2;
  for (const w of words) {
    if (/^\d+$/.test(w) || w.length === 1) continue;
    if (PAID_WORDS.has(w)) rank = 3;
    else if (PART_WORDS.has(w)) {
      if (rank === 2) rank = 1;
    } else if (!TAIL_WORDS.has(w) && !AS_A_LABEL.test(`${w} `)) return 0;
  }
  return rank;
}

type Picked<T, H> = { value: T; how: H } | null;

/** The figure chosen, and where its line ends — what follows it is the email's footer. */
type PickedTotal = { value: Pence; how: 'label' | 'named' | 'largest' | 'part' | 'several'; end: number | null } | null;

function pickAmount(text: string): PickedTotal {
  const found: { value: Pence; rank: TotalRank; index: number; end: number }[] = [];
  const pence = (m: RegExpMatchArray) => toPence(parseFloat(m[2].replace(/,/g, '')));
  for (const m of text.matchAll(LABELLED_TOTAL)) {
    found.push({ value: pence(m), rank: rankTotal(labelBefore(text, m.index!), m[1]), index: m.index!, end: m.index! + m[0].length });
  }
  for (const m of text.matchAll(PAID_LABEL)) {
    found.push({ value: pence(m), rank: 3, index: m.index!, end: m.index! + m[0].length });
  }
  const usable = found.filter((t) => t.rank > 0).sort((a, b) => a.index - b.index);
  if (usable.length > 0) {
    const top = Math.max(...usable.map((t) => t.rank));
    const chosen = usable.filter((t) => t.rank === top).pop()!;
    /*
     * Still a choice when another total disagrees and the ranking did not
     * settle it — one of the same rank, or a lesser one printed AFTER the
     * chosen figure ("Order total £60.00 · Promo -£6.00 · Total £54.00").
     * The figure stands, and the card marks it.
     */
    const disputed = usable.some((t) => t.value !== chosen.value && (t.rank >= chosen.rank || t.index > chosen.index));
    return { value: chosen.value, how: disputed ? 'several' : chosen.rank === 1 ? 'part' : 'label', end: chosen.end };
  }
  if (found.length > 0) {
    const first = found.sort((a, b) => a.index - b.index)[0];
    return { value: first.value, how: 'named', end: null };
  }
  const all = amountsIn(text);
  if (all.length === 0) return null;
  return { value: Math.max(...all), how: 'largest', end: null };
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
  /**
   * The same figures read month first, where they read both ways: 10/01/2026
   * is 10 January here and 1 October in an American shop's email. Set only
   * for a numeric date whose day and month are both twelve or under and differ.
   */
  monthFirst?: Date;
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
  const push = (y: number, m: number, d: number, index: number, length: number, monthFirst?: Date) => {
    if (m < 0 || m > 11 || d < 1 || d > 31) return;
    // A run of text is one date. "21 Sep 26" is the 21st, day first with the
    // year cut to two digits — and its tail, "Sep 26", also reads month first
    // as the 26th, a second date that was never written. That phantom was the
    // later of the two, so it became the purchase: five days late, and every
    // deadline counted from it with it. A match lying wholly inside one
    // already found is part of that one; day-first is read first, as a UK
    // app reads dates.
    if (found.some((f) => index >= f.index && index + length <= f.index + f.length)) return;
    const dt = new Date(y, m, d);
    if (dt.getMonth() === m && dt.getDate() === d) found.push({ date: dt, index, length, ...(monthFirst ? { monthFirst } : {}) });
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
    const y = Number(m[4]) < 100 ? 2000 + Number(m[4]) : Number(m[4]);
    const [day, month] = [Number(m[1]), Number(m[3])];
    const other = day <= 12 && month <= 12 && day !== month ? new Date(y, day - 1, month) : undefined;
    push(y, month - 1, day, m.index ?? 0, m[0].length, other);
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
/*
 * Paying is buying, so "Payment date", "Paid on" and an invoice's or a
 * transaction's own date name the day too; "Placed on" is Shopify's and
 * Next's way of saying "order placed", and "Ordered:" Apple's.
 */
const ORDER_DATE_LABEL =
  /\b(?:order(?:ed)?\s*date|date\s+order(?:ed)?|date\s+of\s+(?:order|purchase)|order(?:ed)?\s+(?:on|placed)|order\s+placed(?:\s+on)?|ordered(?=\s*:)|placed\s+on|purchase(?:d)?\s*(?:date|on)|bought\s+on|(?:payment|invoice|transaction)\s+date|date\s+paid|paid\s+on)\b/gi;

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
type PurchaseHow = 'label' | 'only' | 'latest' | 'other' | 'month-first';

function pickDate(doc: Doc, today: Date): Picked<Date, PurchaseHow> {
  const { text } = doc;
  const past = datesIn(text, today)
    .filter((hit) => daysBetween(today, hit.date) <= 0 && !inMailHeader(doc, hit.index))
    .sort((a, b) => a.index - b.index);
  if (past.length === 0) return null;

  const labels = [...text.matchAll(ORDER_DATE_LABEL)].map((m) => (m.index ?? 0) + m[0].length);
  // Both halves of that conjunction matter and only one was ever tested: with
  // `||`, a date sitting BEFORE the label satisfies the reach test with a
  // negative distance, and the shipping line above "Order date" becomes the
  // purchase. See the last describe in parse.test.ts.
  const labelled = past.find((hit) => labels.some((end) => hit.index >= end && hit.index - end <= LABEL_REACH));
  if (labelled) return { value: labelled.date, how: readsBothWays(labelled, today) ? 'month-first' : 'label' };

  const newest = (hits: DateHit[]) => hits.reduce((best, hit) => (hit.date > best.date ? hit : best), hits[0]);
  const plain = past.filter(
    (hit) =>
      !NOT_A_PURCHASE.test(text.slice(Math.max(0, hit.index - 40), hit.index)) &&
      !NOT_A_PURCHASE_AFTER.test(text.slice(hit.index + hit.length)),
  );
  // Every date there is announced as something else — "Delivered on 3
  // October" on a delivery notice. Still the best evidence of when it was
  // bought (the order came before it), and still never stated as the order.
  if (plain.length === 0) return { value: newest(past).date, how: 'other' };
  // One date that is not announced as something else, however often it is
  // printed: a till slip's only date is the day of the sale, and "Ordered:"
  // beside a delivery date is the order. Nothing there was a choice between
  // candidates, so nothing there is a guess.
  if (new Set(plain.map((hit) => hit.date.getTime())).size === 1) {
    const only = plain[0];
    /*
     * Unless the paste is a dispatch or delivery notice and nothing on it says
     * which date is the order. "Your order has been dispatched" over a date on
     * the next line, "delivered to the front porch on Saturday 3 October":
     * the one date there is the day it left or landed, and it was stated as the
     * day of purchase, unmarked — the label check above reads 24 characters
     * back on the same line and the wording was further away than that.
     *
     * Not when a LATER date is announced as the dispatch or the delivery:
     * "Thursday 1 October" above "Dispatched: Friday 2 October" is the order,
     * because the email has already said which date the dispatch was.
     */
    const announcedLater = past.some((hit) => !plain.includes(hit) && hit.date > only.date);
    if (isNotice(text) && !announcedLater) return { value: only.date, how: 'other' };
    return { value: only.date, how: readsBothWays(only, today) ? 'month-first' : 'only' };
  }
  return { value: newest(plain).date, how: 'latest' };
}

/*
 * Wording that makes a paste a dispatch or delivery notice — an event that
 * happened to the parcel, not the noun on a price line ("Delivery £3.99",
 * "Free delivery over £50"), which every order confirmation carries.
 */
const EVENT_NOTICE =
  /\b(?:dispatched|despatched|shipped|delivered|out\s+for\s+delivery|on\s+(?:its|the|their)\s+way|(?:has|have)\s+been\s+sent|left\s+(?:our|the)\s+warehouse)\b/gi;

/*
 * The same words as a promise are not a notice: "we'll email you once it has
 * been dispatched" is in nearly every order confirmation, and marked its own
 * order date as a dispatch date's.
 */
const NOT_YET = /\b(?:when|once|after|until|as\s+soon\s+as|will|be|before|if)\b[^.!?\n]{0,40}$|['’]ll\b[^.!?\n]{0,40}$/i;

function isNotice(text: string): boolean {
  for (const m of text.matchAll(EVENT_NOTICE)) {
    const index = m.index ?? 0;
    if (!NOT_YET.test(text.slice(Math.max(0, index - 50), index))) return true;
  }
  return false;
}

/*
 * A date written in figures that reads both ways, where the month-first
 * reading is the later of the two and has already happened: 10/01/2026 read
 * on 5 October is 10 January to a UK shop and 1 October to an American one.
 * The day-first reading is still the one given — this is a UK app — but it is
 * marked, because a receipt nine months old added today is the less likely
 * story. A reading that is still to come is no purchase, so it raises nothing.
 */
function readsBothWays(hit: DateHit, today: Date): boolean {
  if (hit.monthFirst === undefined || hit.monthFirst <= hit.date) return false;
  const ago = -daysBetween(today, hit.monthFirst);
  return ago >= 0 && ago <= MONTH_FIRST_RECENT;
}

/*
 * How recent the month-first reading has to be to raise the question: a
 * receipt is added soon after it is bought, so the American reading is the
 * likelier one only when it is recent. Without a bound, every UK slip from
 * the first twelve days of a month earlier in the year would be marked.
 */
const MONTH_FIRST_RECENT = 60;

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
 * The paste as lines, read once: where each line starts, and which lines are
 * a mail client's header block rather than the email's own words.
 */
interface Doc {
  text: string;
  lower: string;
  lines: string[];
  /** Where each line starts in `text`. */
  starts: number[];
  /** Lines of a mail header block: "From:", "Sent:", "To:", "Subject:"… */
  header: Set<number>;
}

const MAIL_HEADER_LINE = /^\s*(?:from|to|cc|bcc|date|sent|subject|reply-to):/i;
const FROM_LINE = /^\s*from:/i;
const SUBJECT_LINE = /^\s*subject:/i;

/*
 * A header block is a "From:" line and the header lines touching it, two or
 * more together, as Mail, Gmail and Outlook copy them — and as a forwarded
 * email carries a second one halfway down. One "Date:" line on its own is the
 * ORDER's date in an order email's own body, and is left to be read.
 */
function headerLines(lines: readonly string[]): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (out.has(i) || !FROM_LINE.test(lines[i])) continue;
    let a = i;
    while (a > 0 && MAIL_HEADER_LINE.test(lines[a - 1])) a--;
    let b = i;
    while (b + 1 < lines.length && MAIL_HEADER_LINE.test(lines[b + 1])) b++;
    if (b > a) for (let k = a; k <= b; k++) out.add(k);
  }
  return out;
}

function readDoc(text: string): Doc {
  const lines = text.split('\n');
  const starts: number[] = [];
  let at = 0;
  for (const l of lines) {
    starts.push(at);
    at += l.length + 1;
  }
  return { text, lower: text.toLowerCase(), lines, starts, header: headerLines(lines) };
}

/** The line a position in the text is on. */
function lineAt(doc: Doc, index: number): number {
  let lo = 0;
  let hi = doc.starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (doc.starts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/*
 * Whether a position is in a mail header — the day the EMAIL was sent, by
 * whom, to whom. Never the day of purchase, dispatch or delivery: "Date: Sat,
 * 3 Oct 2026" on a pasted dispatch email was the purchase, and Outlook's
 * "Sent: Thursday, 1 October" was a Zara coat's dispatch, starting the clock
 * of a shop that counts from dispatch on the wrong day. The subject is the
 * email's own words and is read like the body.
 */
function inMailHeader(doc: Doc, index: number): boolean {
  const line = lineAt(doc, index);
  return doc.header.has(line) && !SUBJECT_LINE.test(doc.lines[line]);
}

/*
 * Words beside a name that make it THE SHOP rather than a word in a sentence
 * or a maker on a product: "Receipt from Boots", "shopping at Tesco", "your
 * Boots order", "boots.com". "Your" alone is not one: "Your Apple iPad is on
 * its way" from Very and "Your Samsung Galaxy" from Currys named the maker of
 * the thing as the shop that sold it.
 */
const CUE_BEFORE = /\b(?:from|at|with):?\s+$/i;
const CUE_AFTER = /^(?:\.com|\.co\.uk|['’]s?\s+(?:order|receipt|basket)\b|\s+(?:orders?|receipt|purchase|store|online|account|basket)\b)/i;
const DOMAIN_AFTER = /^\.(?:com|co\.uk)\b/i;

/*
 * A line saying who the seller is on a marketplace: "Sold by: Mamas & Papas
 * Ltd" on an Amazon order. The name there is not the shop the order was
 * placed with — Amazon's own heading is — and on an order "fulfilled by
 * Amazon" it is Amazon that takes the return. What a marketplace seller's own
 * return terms are is not guessed here; the line is simply not read for a
 * shop.
 */
const SOLD_BY = /^\s*(?:sold\s+(?:by|and\s+(?:dispatched|shipped)\s+by)|dispatched\s+from\s+and\s+sold\s+by|ships\s+from\s+and\s+sold\s+by|seller\b|marketplace\s+seller)/i;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/*
 * Each alias's pattern, compiled once for the life of the app.
 *
 * There are 163 aliases, every one tried for a shop kept does not know, and
 * each pattern was built again on every read: 128 ms for the first "Read it"
 * and 85 ms for the second, measured on a desktop, which is the better part of
 * a second on a phone, with the screen frozen. The `\p{L}` edges make a
 * pattern dear to compile and the engine's own cache did not keep them.
 */
const COMPILED = new Map<string, RegExp>();

/*
 * On word boundaries, not as a substring: "pineapple print tea towel" was
 * being read as an Apple purchase, and a receipt for a £12 tea towel then
 * carried Apple's 14-day window and Apple's policy sentence. The edges are
 * letters in any alphabet, not `\b`: JavaScript's `\b` knows only ASCII word
 * characters, so "bonmarché" could never end on one — the é and the space
 * after it are both "non-word" — and "& other stories" could never start on
 * one. Those shops' emails named no shop.
 */
function pattern(alias: string): RegExp {
  let re = COMPILED.get(alias);
  if (!re) {
    re = new RegExp(`(?<![\\p{L}\\p{N}])${escape(alias)}(?![\\p{L}\\p{N}])`, 'giu');
    COMPILED.set(alias, re);
  }
  return re;
}

/** How many alias patterns have been compiled so far: held by a test to "once each". */
export function compiledAliasPatterns(): number {
  return COMPILED.size;
}

/*
 * The shop's name as a line near the top of the paste: the logo's text, which
 * is what an order email opens with when it is copied. "NEXT" alone on the
 * first line is the shop in a way that "Next day delivery" is not — the whole
 * line, and only near the top, where a heading sits. A mail header above it
 * is not counted as part of the heading.
 */
const HEADING_LINES = 3;

function headingLines(doc: Doc): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < doc.lines.length && out.size < HEADING_LINES; i++) {
    const l = doc.lines[i].trim();
    if (!l || doc.header.has(i) || /^-{2,}.*forwarded/i.test(l)) continue;
    out.add(i);
  }
  return out;
}

/** A price: what marks a line as an item's, or money about the order. */
const PRICED = /[£€$]\s?\d/;

/** How many times one name is looked at: the places that decide are near the top. */
const MAX_MENTIONS = 50;

/** How far either side of a mention its line is read. */
const NEAR = 80;

/*
 * Where a mention of a shop sits, as a rank — lower is surer — or null where
 * it is not a mention of the shop at all.
 *
 *   0  the sender: a "From:" line in the mail header, name or domain
 *   1  the heading: one of the first lines of the email
 *   2  named as the shop in the body: "your Boots order", "shop at Tesco"
 *   3  a bare mention in the body — a guess, and marked as one
 *   4  after the total, as a line of its own or named as the shop — the
 *      sign-off; a guess, and marked
 *
 * And never: a name on a "Sold by" line; a name on an item's line, beside its
 * price ("Mint Velvet Cable Knit Jumper £89.00" on a John Lewis order); a
 * name in a sentence after the total — the footer's "family of brands", "find
 * us next to Dunelm, IKEA and B&Q", "£20 off your next order".
 *
 * The first alias found used to win, longest first, so a four-letter maker on
 * an item line beat a three-letter shop in the heading, and the footer's
 * "your next order" made a H&M, M&S or B&Q email a Next one.
 */
function rankMention(doc: Doc, store: StorePolicy, start: number, end: number, heading: Set<number>, lastBodyLine: number): number | null {
  const li = lineAt(doc, start);
  const line = doc.lines[li];
  const at = start - doc.starts[li];
  const name = line.slice(at, at + (end - start));
  if (doc.header.has(li)) {
    if (FROM_LINE.test(line)) return 0;
    if (!SUBJECT_LINE.test(line)) return null;
  }
  if (SOLD_BY.test(line)) return null;
  // A mention is judged by what stands near it on its line, not by the whole
  // of a line that may be a pasted page long: each look is bounded, so a paste
  // naming a shop fifty times on one line costs fifty short reads, not fifty long ones.
  const before = line.slice(Math.max(0, at - NEAR), at).split(/[·|]/).pop() ?? '';
  const after = line.slice(at + name.length, at + name.length + NEAR);
  const segment = `${before}${name}${after.split(/[·|]/)[0]}`;
  const domain = DOMAIN_AFTER.test(after);
  const cued = domain || CUE_BEFORE.test(before) || CUE_AFTER.test(after);
  const whole = line.length <= name.length + NEAR && line.trim().toLowerCase() === name.toLowerCase();
  const first = li === Math.min(...heading);
  // The heading is the first line, or a later line of the first few that
  // STARTS with the name — "ASOS" under "Thanks for your order!", "Boots.com
  // order confirmation" — not one with the name halfway along, which is how
  // an item's title reads: "NEW Decathlon Quechua tent" on an eBay order.
  const top = heading.has(li) && (first || /^\W*$/.test(before));
  /*
   * A name that is also an ordinary word needs more than a boundary, because
   * "walking boots" and "next day delivery" clear one comfortably: it has to
   * be the heading line, or sit beside a word that makes it the shop. And the
   * shop writes its own name with a capital — "your next order" in a footer is
   * not "your Next order".
   */
  if (store.commonWord) {
    if (!cued && !(whole && top)) return null;
    if (!domain && !(whole && top) && !/\p{Lu}/u.test(name)) return null;
  }
  if (li > lastBodyLine) return whole || cued ? 4 : null;
  if (PRICED.test(segment) && !cued) {
    // "Argos £12.00" typed in as the first line is the shop and its price;
    // anywhere else a name beside a price is an item's. Offered, and marked.
    return first && before.trim() === '' ? 3 : null;
  }
  if (top) return 1;
  return cued ? 2 : 3;
}

type ShopHow = 'clear' | 'several' | 'mention';

/**
 * The shop: the surest-placed mention, and how sure that is.
 *
 * A shop named only in passing, or one of two named as surely as each other,
 * is still offered — it is usually right, and the card marks it — but never
 * stated as plainly as a sender or a heading. Naming no shop is a flagged
 * assumption on screen ("Not recognised", and an assumed window the person
 * can see); naming the wrong one, unmarked, is a confident lie.
 */
function pickStore(doc: Doc, totalEnd: number | null): { policy: StorePolicy; how: ShopHow } | null {
  const heading = headingLines(doc);
  const lastBodyLine = totalEnd === null ? Infinity : lineAt(doc, Math.max(0, totalEnd - 1));
  const covered: { start: number; end: number; store: StorePolicy }[] = [];
  const best = new Map<StorePolicy, number>();
  // Longest alias first, so a shop whose name contains another's still
  // resolves to itself: a mention inside a longer one belongs to that one.
  for (const { alias, store } of ALIASES_BY_LENGTH) {
    // Checked first, as a plain substring, so a pattern is compiled and run
    // only for a shop that is there.
    if (!doc.lower.includes(alias.toLowerCase())) continue;
    let seen = 0;
    for (const m of doc.text.matchAll(pattern(alias))) {
      if (++seen > MAX_MENTIONS) break;
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (covered.some((c) => c.store !== store && start >= c.start && end <= c.end)) continue;
      covered.push({ start, end, store });
      const rank = rankMention(doc, store, start, end, heading, lastBodyLine);
      if (rank === null) continue;
      const had = best.get(store);
      if (had === undefined || rank < had) best.set(store, rank);
    }
  }
  // By rank; between equals, the longer name, as the table has always been
  // read (the map holds them in that order). Equals are marked either way.
  const ranked = [...best.entries()].sort((a, b) => a[1] - b[1]);
  if (ranked.length === 0) return null;
  const [policy, rank] = ranked[0];
  const rivals = ranked.slice(1).some(([, r]) => r <= Math.max(2, rank));
  return { policy, how: rivals ? 'several' : rank >= 3 ? 'mention' : 'clear' };
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
    // "£28.99 GBP", as Shopify writes its total, already has its £: the GBP
    // after it is dropped rather than made a second one. "££28.99" matched no
    // total, and the largest figure on the page stood in for it.
    .replace(/(£\s?\d[\d,]*(?:\.\d{1,2})?)\s?GBP\b/gi, '$1')
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

/**
 * The most of a paste that is read. An order email's text is a few thousand
 * characters, and the longest in the corpus is under twenty thousand; a
 * hundred thousand reads any real one whole, and keeps what an accidental
 * paste of a whole document costs bounded.
 */
export const MAX_PARSE_CHARS = 100_000;

/**
 * The paste as the rules read it: runs of spaces and tabs as one space, and
 * runs of blank lines as one. The scan and document readers already did the
 * first (receipt-scan.ts, documents.ts); a paste did not, and several rules
 * put a `\s*` either side of an optional piece, which on a long run of spaces
 * tries every way of sharing the run between them. Measured on main: "Order
 * no" and 2,000 spaces took 3.7 s and 6,000 more than 20 s, and 40,000 blank
 * lines 3.9 s, all on the main thread with the app frozen. No rule tells one
 * space from several, or one blank line from many.
 */
function tidy(raw: string): string {
  return raw
    .slice(0, MAX_PARSE_CHARS)
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n(?: ?\n)+/g, '\n\n');
}

export function parseReceiptText(raw: string, today: Date = new Date()): ParseOutcome {
  if (!raw.trim()) return { ok: false, reason: 'empty' };
  const text = deliveredRelative(gbpAsPounds(tidy(raw)), today);
  const doc = readDoc(text);

  const total = pickAmount(text);
  const shop = pickStore(doc, total?.end ?? null);
  const policy = shop?.policy ?? null;
  const amount = total?.value ?? null;
  // Neither a shop nor a price means there is nothing to build a deadline
  // from — better to say so than to save a receipt made of assumptions.
  if (!policy && amount === null) return { ok: false, reason: 'nothing-found' };

  const picked = pickDate(doc, today);
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
      how: { amount: total?.how ?? null, purchasedOn: picked?.how ?? null, store: shop?.how ?? null },
    },
  };
}
