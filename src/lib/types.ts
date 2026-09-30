import type { Pence } from './money';

export interface Warranty {
  /** Quoted the way manufacturers quote them: 12, 24, 120 months. */
  months: number;
  /** Anything the months cannot say — "10-year guarantee on MALM frames". */
  note?: string;
}

export type Category = 'audio' | 'kitchen' | 'clothing' | 'beauty' | 'furniture' | 'other';

export type ReceiptStatus = 'active' | 'sent' | 'returned' | 'kept';

/**
 * What the app persists per receipt.
 *
 * Dates are stored, never day-counts. The prototype carried `offset: 2` —
 * "two days left" frozen at design time — which is correct for exactly one
 * day and then quietly wrong forever. Everything a screen shows (days left,
 * deadline, elapsed) is derived from `purchasedOn` at read time, so a phone
 * left in a drawer for a week reopens telling the truth.
 */
export interface Receipt {
  id: string;
  store: string;
  item: string;
  cat: Category;
  /** Integer pence. */
  amount: Pence;
  /** ISO calendar date the item was bought. */
  purchasedOn: string;
  /**
   * ISO date the retailer's clock actually starts, when it is not the
   * purchase date. Zara counts from dispatch; this is the field that makes
   * that gotcha a computation rather than a sentence.
   */
  windowStartsOn?: string;
  windowDays: number;
  /**
   * ISO date the goods came into the buyer's hands, when that is known and is
   * not the purchase date.
   *
   * Both statutory clocks legally start here — the 30-day right to reject and
   * the 14-day right to cancel — and for a delivered order that is not the day
   * it was paid for. Without it the app can only say "at least until", because
   * what it computes from the order date is the EARLIEST either right could
   * end; with it the dates are exact.
   *
   * Optional and stays optional. Nobody should have to fill in a field to use
   * a receipt, an order that has not arrived yet genuinely has no such date,
   * and a counter purchase arrives when it is bought. Distinct from
   * `windowStartsOn`, which is the RETAILER's clock (Zara counts from
   * dispatch); these are different rules from different sources and conflating
   * them is how the app came to state one when it meant the other.
   */
  arrivedOn?: string;
  /**
   * The shop's order number, as the shop wrote it — read from a labelled line
   * in the paste, or typed on the edit screen. The first thing a returns
   * form, a chat window and the letter to the shop all ask for.
   */
  orderRef?: string;
  policy: string;
  /**
   * Whether this was a DISTANCE purchase — ordered online, by phone, or away
   * from the trader's premises.
   *
   * It is a property of how the thing was bought, not a number of days,
   * because the two statutory rights are not alternatives. The 30-day right to
   * reject faulty goods (Consumer Rights Act 2015 s.22) applies to every
   * purchase; the 14-day right to cancel for any reason (Consumer Contracts
   * Regulations 2013) applies ONLY on top of it, and only to a distance or
   * off-premises contract. The field this replaced was `legalDays: 14 | 30`,
   * which made them exclusive and so could only ever state one — see legal.ts.
   */
  distance: boolean;
  /**
   * A tracked clock, not a sentence. "Warranty clocks added to your receipts
   * automatically" was the claim; a free-text string could not answer the
   * question the claim implies — is the repair still free today?
   */
  warranty?: Warranty;
  gotcha?: string;
  status: ReceiptStatus;
  /** ISO date the refund landed — set when the receipt is marked returned. */
  returnedOn?: string;
  /**
   * How much actually came back, in pence, when it was less than was paid:
   * one of two sizes sent back, a partial refund, a deduction for a missing
   * box. Absent means the whole price, which is the one-tap case. It used to
   * be the only case, so a £30 refund on a £60 order counted £60 as kept back.
   */
  refunded?: number;
  /**
   * The refund came as store credit, not money — the commonest way a return
   * ends without cash, and one that had no way to be said. `expires` is the
   * day the credit note says it runs out, where it says one: credit that
   * lapses unspent is money lost as surely as a missed return window.
   */
  credit?: { expires?: string };
  /**
   * The fault letter, once it has gone: the day it was sent and the person's
   * own words about what is wrong, so the letter can be shown again as sent.
   * The letter asks for a reply within a fortnight; without a record that it
   * went, nothing could ask whether one came.
   */
  faultClaim?: { sentOn: string; what?: string };
  /**
   * The day notice of cancellation went to the shop, for an order bought at a
   * distance. Cancelling is telling the shop, not posting the parcel, and it
   * is this day that starts the fourteen to send it back and decides whether
   * the refund rule in regulation 34 applies.
   */
  cancelledOn?: string;
  /**
   * The day the person decided to keep it. Keeping is the commonest end to a
   * purchase and had no way to be said: the only exits were "returned" and
   * Delete, so a kept coat went on raising return reminders, then sat at the
   * top of the list under WINDOW CLOSED for good, and deleting it threw away
   * its warranty, its photo and the faulty-goods rights that outlast the
   * shop's window by years.
   */
  keptOn?: string;
  /**
   * The day it went back to the shop — posted, dropped off, handed over —
   * with the refund still to come. Posting a parcel on day 27 and seeing the
   * money on day 35 is how most online returns go, and there was nowhere to
   * be in between: mark it returned and the refund was celebrated before it
   * existed and never chased; leave it active and it went on saying "go now
   * or lose it" about a parcel already in the post. Kept on the receipt once
   * the refund lands, because it is the day that decides whether the return
   * was in time, not the day the money arrived.
   */
  sentOn?: string;
  /**
   * The tracking or proof-of-postage reference for a return, as printed on the
   * post office's slip. A refund chase rests on proof the parcel went, and for
   * a cancelled online order that proof is what starts the shop's fourteen
   * days (reg. 34). Carried through to the refund; cleared if it did not go.
   */
  returnRef?: string;
  /**
   * True for the five receipts a fresh install arrives with.
   *
   * They exist so a first launch is a working app rather than an empty list,
   * and they were being charged for: the free tier is ten receipts, the demo
   * set is five of them, so someone who had added nothing at all opened
   * Settings to "5 of 10 free receipts" and hit "That's your 10 free
   * receipts" after adding five of their own. Half the allowance went on
   * data they never entered, and the wall it produced asked them for money.
   *
   * A flag rather than an id prefix, because "this is demo data" is a fact
   * about the receipt and should be legible as one — including in an exported
   * backup, which is why it survives the round trip.
   */
  demo?: boolean;
}

export interface PolicyUpdate {
  id: string;
  store: string;
  /** ISO date the change was published; the "2d ago" label is derived. */
  changedOn: string;
  text: string;
  /** Only the receipts the user actually holds decide this at render time. */
  affectsStores: string[];
  affectNote: string;
  /**
   * The retailer's window AFTER the change, when the change moved it.
   *
   * Two readers now, and the second arrived after this comment was written: it
   * tells the holder of an EXISTING receipt what the change would have meant,
   * and it gives a NEW purchase from that shop the window actually in force on
   * the day it was bought (`windowInForceFor`). What it still never does is
   * rewrite a receipt already held, which keeps the terms it was bought under
   * — that is the line, and it is not "read on one screen only".
   */
  newWindowDays?: number;
  /**
   * True for the five changes a fresh install arrives with — the policy-watch
   * twin of `Receipt.demo`.
   *
   * They exist so the Watch tab is not empty on a first launch with no signal,
   * and they were shown as news: "ASOS: new 28-day window for frequent
   * returners", dated a week ago on every install, unlabelled, beside receipts
   * that WERE labelled as samples. Nobody had checked any of them against the
   * retailer. A claim about a named company that nobody verified is not news,
   * so a sample is labelled, only ever speaks to sample receipts, never sets a
   * real purchase's window, and goes the moment a real change arrives.
   *
   * Never read from the network: `readFeed` keeps it only from the device's
   * own store, so a downloaded entry cannot claim to be a harmless sample and
   * a stored sample cannot lose the label on the next launch.
   */
  demo?: boolean;
  /**
   * Where the change was read, and when: the retailer's own page. Required of
   * every downloaded entry (`readFeed` drops one without it), because a change
   * that moves a new purchase's deadline must be one someone can check — the
   * five samples this app shipped were five claims nobody could. `feed:add`
   * refuses a source on any host the retailer's own pages do not use.
   */
  source?: { url: string; checkedOn: string };
}

export type Screen = 'onboard' | 'home' | 'watch' | 'detail' | 'edit' | 'add' | 'settings' | 'celebrate';
