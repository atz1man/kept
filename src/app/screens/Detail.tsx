import { useState, type ReactNode } from 'react';
import { color, font, radius, shadow } from '../../tokens';
import { daysBetween, fmtDateLong, fmtDatesTogether, fromISODate } from '../../lib/dates';
import { firstToClose, firstToCloseLine, LEGAL_DISCLAIMER, legalRights } from '../../lib/legal';
import { money } from '../../lib/money';
import { asksForGuarantee, awaitingArrival, derive, floorClock, floorWords, refundOf } from '../../lib/receipts';
import type { Receipt } from '../../lib/types';
import { clockFor, findStore, shopCheckedOn, windowChecked } from '../../lib/stores';
import { returnsPageFor } from '../../lib/returns-pages';
import { urgency, windowRemaining } from '../../lib/urgency';
import { ChevronLeft, ReceiptGlyph, Tick, Warning } from '../components/Icons';
import { Avatar } from '../components/Avatar';
import { Pressable } from '../components/Pressable';
import { ReceiptPhoto } from '../components/ReceiptPhoto';
import { CancelPanel } from '../components/CancelPanel';
import { Escalation } from '../components/Escalation';
import { FaultPanel } from '../components/FaultPanel';
import { SplitPanel } from '../components/SplitPanel';
import { canSplit } from '../../lib/split';
import { RefundForm } from '../components/RefundForm';
import { Letter } from '../components/Letter';
import { readReturnRef, REG34_CLOCK, refundChase, refundChaseLine, refundLetter } from '../../lib/refund-chase';
import { possessive } from '../../lib/words';

/** 2π × 40, the circumference of the ring the countdown draws on. */
const RING_CIRCUMFERENCE = 251.3;

interface Props {
  receipt: Receipt;
  today: Date;
  urgentDays: number;
  onBack: () => void;
  onEdit: () => void;
  /** Everything about it on one page: the claim pack. */
  onPack: () => void;
  onReturn: () => void;
  onUnreturn: () => void;
  /** Swapped for another: settle this one and open the one that came home. */
  onExchange: () => void;
  onUnexchange: () => void;
  /**
   * Set when the swap cannot be taken back, because something has happened to
   * the receipt it produced (`swapInFate`): what to say instead of the button,
   * and the way to that receipt.
   */
  swapBlocked: { text: string; onOpen: () => void } | null;
  onKeep: () => void;
  onUnkeep: () => void;
  onSend: () => void;
  onUnsend: () => void;
  /** Record less than the full price as refunded; null for the whole price. */
  onSetRefund: (pence: number | null) => void;
  onSetReturnRef: (ref: string | null) => void;
  onSetCredit: (credit: { expires?: string } | null) => void;
  onCreditSpent: (spent: boolean) => void;
  onFaultSent: (what: string) => void;
  onFaultUnsent: () => void;
  onFinalRejectSent: (what: string) => void;
  onFinalRejectUnsent: () => void;
  onCancelSent: () => void;
  onCancelUnsent: () => void;
  onArrived: () => void;
  onDelete: () => void;
  /** One thing out of this receipt, as a receipt of its own. */
  onSplit: (item: string, pence: number) => void;
  /** Back into the receipt it was split from; offered only while that receipt is here. */
  onUnsplit: (() => void) | null;
  /** The receipt this part was split from, to name it. */
  splitFromReceipt: Receipt | null;
}

const cardLabel = { fontSize: 13, fontWeight: 600, color: color.muted } as const;

/** The one filled button a screen should show at a time, and the outlined kind beside it. */
const primaryButton = { flex: 1, padding: 13, textAlign: 'center', background: color.accent, color: color.white, border: 0, borderRadius: radius.control, fontWeight: 600, fontSize: 15, boxShadow: shadow.raised } as const;
const secondaryButton = { flex: 1, padding: 13, textAlign: 'center', background: color.surface, border: `1px solid ${color.borderSoft}`, borderRadius: radius.control, fontWeight: 600, fontSize: 14 } as const;

export function Detail({ receipt, today, urgentDays, onBack, onEdit, onPack, onReturn, onUnreturn, onKeep, onUnkeep, onSend, onUnsend, onSetRefund, onSetReturnRef, onSetCredit, onCreditSpent, onArrived, onFaultSent, onFaultUnsent, onFinalRejectSent, onFinalRejectUnsent, onCancelSent, onCancelUnsent, onExchange, onUnexchange, swapBlocked, onDelete, onSplit, onUnsplit, splitFromReceipt }: Props) {
  const [legalOpen, setLegalOpen] = useState(true);
  const d = derive(receipt, today);
  /*
   * The deadline is a floor (`floorClock`): counted from the order, for a
   * shop that counts from delivery or dispatch, because nobody has said when
   * that was. Past it, the ring said "closed" and the heading "Window closed"
   * directly above the sentence saying the date "is the earliest it can be,
   * never the latest" — and the reminders, Home and the claim pack all said
   * the same as the ring. They read this one condition now; so does this.
   */
  const floor = floorClock(receipt);
  const unsure = receipt.status === 'active' && d.expired && floor !== null;
  const u = urgency(d.daysLeft, urgentDays, floor !== null);
  const rights = legalRights(receipt, today, !d.expired);
  const firstClock = receipt.status === 'active' ? firstToClose(receipt, today, d.deadline) : null;

  /*
   * The ring shows time REMAINING, so it empties as the window closes — the
   * arc a glance reads as "how much is left". Clamped at both ends: a receipt
   * past its deadline draws nothing rather than sweeping backwards.
   *
   * Counted INCLUSIVE of today, which it was not. `daysLeft` is 0 on the last
   * day the thing can go back, so the arc was zero-length on exactly the day
   * the ring matters most: the screen read "0 days left · RETURN BY 29 Aug"
   * beside an empty grey track, with no red anywhere on it. There is still a
   * day left on the last day, and the ring now says so — thinly.
   */
  const remaining = windowRemaining(d.daysLeft, receipt.windowDays);
  /*
   * A settled receipt — returned or kept — has no clock. The ring went on
   * counting down in urgency red ("closed", "RETURN BY", "3 days left")
   * directly above a panel saying "No more return reminders", which is the
   * app contradicting itself on one screen. Settled, it is a closed full
   * circle in a quiet ink, and the date is stated as history.
   */
  const settled = receipt.status !== 'active';
  const ringOffset = settled ? '0' : (RING_CIRCUMFERENCE * (1 - remaining)).toFixed(1);
  /** Gone back and the money not yet come: when it is due, and whether it is late. */
  const chase = refundChase(receipt, today);
  // On the white card now: red when it is close or gone, the accent when it
  // is coming up, ink otherwise. Kept, grey: nothing more is coming. Sent
  // back, the accent while the refund is awaited and red once it is late;
  // returned, the accent around a tick.
  const ringColor =
    receipt.status === 'returned' ? color.accentFigure
    : receipt.status === 'sent' ? (chase?.late ? color.danger : color.accentFigure)
    : settled ? color.muted
    : unsure ? color.accentFigure : d.expired ? color.danger : u.level === 'critical' ? color.danger : color.accentFigure;

  const dispatchDiffers = receipt.windowStartsOn && receipt.windowStartsOn !== receipt.purchasedOn;
  // The table, not the receipt: which clock a shop runs is not something a
  // receipt records, and unlike the WINDOW it is not a term that changes under
  // a purchase — a shop counts from the till, the warehouse or the doormat,
  // and it does not switch.
  // The online clock for an online order, where the shop has one (`clockFor`).
  const shop = findStore(receipt.store);
  const clockStart = shop ? clockFor(shop, receipt.distance) : 'purchase';
  const checkedOn = shop ? shopCheckedOn(shop.name) : null;
  /*
   * The step the deadline is for. Only while it can still be taken: after the
   * shop's window a returns page invites a change-of-mind return the shop will
   * refuse, and the rights that outlast it (faulty goods) are set out below.
   */
  const returnsPage = receipt.status === 'active' && (!d.expired || unsure) ? returnsPageFor(receipt.store) : null;

  // Rendered as a pair: a year on the deadline and none on the purchase is
  // what let "RETURN BY 15 Feb 2027" sit above "bought 15 Feb". See
  // fmtDatesTogether.
  const [deadlineText, boughtText, returnedText] = fmtDatesTogether(
    [d.deadline, fromISODate(receipt.purchasedOn), ...(receipt.returnedOn ? [fromISODate(receipt.returnedOn)] : [])],
    today,
  );
  const [dueText, sentText] = chase && receipt.sentOn ? fmtDatesTogether([chase.due, fromISODate(receipt.sentOn)], today) : [];

  return (
    <div className="k-fade" style={{ flex: 1, overflow: 'auto', padding: '6px 16px 120px', scrollPaddingBottom: 120 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '4px -2px 10px' }}>
        {/* Text controls, the way a phone's own navigation bar draws them:
            boxed buttons up here were two more cards on a screen of cards. */}
        <Pressable
          onClick={onBack}
          style={{
            display: 'inline-flex', width: 'auto', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 8px 0 2px',
            background: 'transparent', borderRadius: radius.control, color: color.accentInk,
            fontSize: 15, fontWeight: 500,
          }}
        >
          <ChevronLeft stroke={color.accentInk} />
          Back
        </Pressable>
        <Pressable
          onClick={onEdit}
          style={{
            display: 'inline-flex', width: 'auto', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 2px 0 8px',
            background: 'transparent', borderRadius: radius.control, color: color.accentInk,
            fontSize: 15, fontWeight: 500,
          }}
        >
          Edit
        </Pressable>
      </div>

      {/*
        * The purchase, as a statement opens one payment: who, what, and the
        * money, centred and big, before any of the detail.
        *
        * Stacked rather than side by side, which also ends a layout fault the
        * side-by-side version had to work around: a price is one unbreakable
        * token, so beside the name it took its full width and squeezed the
        * item to one word per line at 320px with a large minimum font size.
        * Stacked, each has the whole width.
        */}
      <div style={{ textAlign: 'center', padding: '4px 8px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Avatar store={receipt.store} cat={receipt.cat} size={64} />
        <h1 tabIndex={-1} style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '12px 0 0', overflowWrap: 'anywhere' }}>{receipt.store}</h1>
        <div style={{ fontSize: 14.5, color: color.muted, marginTop: 3, overflowWrap: 'anywhere' }}>{receipt.item}</div>
        <div style={{ fontFamily: font.figures, fontSize: 40, fontWeight: 700, letterSpacing: '-0.045em', color: color.ink, marginTop: 10, lineHeight: 1.05 }}>
          {money(receipt.amount)}
        </div>
        {receipt.orderRef && (
          <div style={{ fontSize: 12.5, color: color.muted, marginTop: 6, fontFamily: font.figures, userSelect: 'text', overflowWrap: 'anywhere' }}>
            Order {receipt.orderRef}
          </div>
        )}
      </div>

      {/*
        * The card under the price says what this receipt is waiting on, and
        * that changes with what has happened to it. It used to be the shop's
        * return window whatever the status: a parcel posted a fortnight ago
        * still led with "The window runs to 21 Oct" above a ring reading
        * "sent", and "The refund is late" — the one thing that receipt was
        * for by then — sat two screenfuls down. Now a receipt in hand leads
        * with its deadline, one sent back with the refund it is owed, and one
        * returned with the money that came back. The window it was bought
        * under is still on the page, with the store policy it belongs to.
        */}
      {receipt.status === 'returned' ? (
        receipt.exchanged ? (
          <TopCard ring={<Ring offset="0" stroke={ringColor}><Tick size={34} stroke={ringColor} width={2.4} /></Ring>}>
            <div data-swapped style={{ fontSize: 16.5, fontWeight: 700, lineHeight: 1.35, letterSpacing: '-0.01em' }}>
              Swapped for another{returnedText ? ` on ${returnedText}` : ''}
            </div>
          </TopCard>
        ) : (
          <RefundCard
            receipt={receipt}
            returnedText={returnedText}
            ring={<Ring offset="0" stroke={ringColor}><Tick size={34} stroke={ringColor} width={2.4} /></Ring>}
            onSetRefund={onSetRefund}
          />
        )
      ) : receipt.status === 'sent' ? (
        <TopCard
          ring={
            <Ring offset="0" stroke={ringColor}>
              <div style={{ fontFamily: font.figures, fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: ringColor }}>
                {chase?.late ? 'Late' : 'Sent'}
              </div>
            </Ring>
          }
          below={
            /* Gone back, money still to come. The day it went is the one
               that decides whether it was in time, so it is said; and the day
               worth chasing from, so that is said too — `refundChase`'s, the
               same date the late panel, the claim pack and the reminder use.
               The shop's fourteen days only where reg. 34 gives them
               (`refundIsStatutory`): this line said it for every online
               order, above a late panel saying otherwise. */
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${color.borderHair}` }}>
              <div style={{ fontSize: 13.5, color: color.body, lineHeight: 1.45 }}>
                Waiting for the refund.
                {chase && ` If it has not arrived by ${fmtDateLong(chase.due)}, chase it`}
                {chase && (chase.statutory ? ` — for an online order, the shop has ${REG34_CLOCK}.` : '.')}
              </div>
              <ReturnRefField receipt={receipt} onSetReturnRef={onSetReturnRef} />
            </div>
          }
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: chase?.late ? color.danger : color.muted }}>
            {chase ? `Refund of ${money(receipt.amount)} ${chase.late ? 'was due' : 'due'}` : `Refund of ${money(receipt.amount)}`}
          </div>
          <div style={{ fontFamily: font.figures, fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 4 }}>
            {dueText ?? 'Awaited'}
          </div>
          <div style={{ fontSize: 13, color: color.muted, marginTop: 6 }}>
            {sentText ? `Sent back · ${sentText}` : 'Sent back'}
          </div>
        </TopCard>
      ) : (
        <TopCard
          ring={
            <Ring offset={ringOffset} stroke={ringColor}>
              {/* Coloured like the count on the home hero, which has always
                  done this. Here the ring's stroke was the only urgency
                  signal on the screen, and on the last day it was a hairline. */}
              <div style={{ fontFamily: font.figures, fontSize: settled || d.expired ? 15 : 26, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: ringColor }}>
                {receipt.status === 'kept' ? 'Keeping' : unsure ? 'open?' : d.expired ? 'closed' : d.daysLeft}
              </div>
              {!settled && !d.expired && <div style={{ fontSize: 11, color: color.muted, marginTop: 2 }}>days left</div>}
            </Ring>
          }
          below={
            /* The comparison the ring and the legal panel left to the reader:
               with IKEA's year, the first thing to go is the 30-day right to
               reject, and nothing said so. */
            firstClock && (
              <div style={{ fontSize: 13.5, lineHeight: 1.45, color: color.body, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${color.borderHair}` }}>
                {firstToCloseLine(firstClock)}
              </div>
            )
          }
        >
          <div style={{ fontSize: 13, color: color.muted, fontWeight: 600 }}>
            {settled ? (d.expired ? 'The window ran to' : 'The window runs to') : unsure ? 'Earliest it could close' : d.expired ? 'Window closed' : 'Return by'}
          </div>
          <div style={{ fontFamily: font.figures, fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 4 }}>
            {deadlineText}
          </div>
          <div style={{ fontSize: 13, color: color.muted, marginTop: 6 }}>
            {settled ? `${receipt.windowDays}-day window · bought ${boughtText}` : `${d.daysUsed} of ${receipt.windowDays} days used · bought ${boughtText}`}
          </div>
        </TopCard>
      )}

      {/* Once the refund is late, the chase comes straight after the card
          that says so, rather than after the store policy and the claim
          pack. */}
      {receipt.status === 'sent' && <RefundChasePanel receipt={receipt} today={today} />}
      {/* Credit is how the money came back, so it is said beside the money. */}
      {receipt.status === 'returned' && !receipt.exchanged && (
        <CreditPanel receipt={receipt} onSetCredit={onSetCredit} onCreditSpent={onCreditSpent} />
      )}

      {/* The fix for the floor, in one tap, while the parcel could plausibly
          still be coming. The order email is when most people add a receipt,
          and it arrives before the parcel does. Directly under the card whose
          dates it settles: "Return by 5 Nov" over "no earlier than 3 Nov"
          read as a contradiction while the question that resolves it sat
          half a page further down. Both answers are drawn alike — it is a
          question, not the step the screen is for. */}
      {awaitingArrival(receipt, today) && (
        <div data-arrival style={{ marginTop: 12, padding: 14, background: color.surfaceAlt, border: `1px solid ${color.borderHair}`, borderRadius: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14.5 }}>Has it arrived?</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 3, color: color.body }}>
            {clockStart === 'delivery'
              ? `${receipt.store}’s window and your legal rights both start the day it arrives, not the day you ordered.`
              : 'Your legal rights start the day it arrives, not the day you ordered.'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            <Pressable
              className="k-row-white k-secondary"
              onClick={onArrived}
              style={{ flex: '1 1 auto', width: 'auto', padding: 12, textAlign: 'center', background: color.surface, border: `1px solid ${color.borderSoft}`, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
            >
              It arrived today
            </Pressable>
            <Pressable
              className="k-row-white k-secondary"
              onClick={onEdit}
              style={{ flex: '1 1 auto', width: 'auto', padding: 12, textAlign: 'center', background: color.surface, border: `1px solid ${color.borderSoft}`, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
            >
              It came earlier
            </Pressable>
          </div>
        </div>
      )}

      {returnsPage && (
        /* A link, not a button: it leaves the app, and says where to. The
           shop's own page, the one `check:retailers` reads; nothing about
           the purchase goes with it. The step the deadline is for, so it
           sits under the deadline — it was below the photo explainer and the
           store policy, off the first screen with two days left. */
        <a
          href={returnsPage.url}
          target="_blank"
          rel="noopener noreferrer"
          className="k-primary"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12,
            minHeight: 50, boxSizing: 'border-box', padding: '12px 18px', borderRadius: radius.control, background: color.accent, color: color.white,
            textDecoration: 'none', fontSize: 15, fontWeight: 600, boxShadow: shadow.raised,
          }}
        >
          <span>Start your return</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: color.onAccentSoft }}>{returnsPage.host}<span aria-hidden="true"> ↗</span></span>
        </a>
      )}

      <div style={{ background: color.surfaceAlt, borderRadius: radius.cardLg, marginTop: 14 }}>
        <div style={{ padding: '16px 18px 14px' }}>
          <div style={cardLabel}>Store policy</div>
          <div style={{ fontSize: 14, marginTop: 5, lineHeight: 1.5, color: color.bodyStrong }}>{receipt.policy}</div>
          {/* Where that sentence came from, said under it: read off the shop's
              own page on a day, or not yet. The words a person repeats at a
              counter should say how far to trust them. */}
          {shop && (
            <div style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.5, color: color.muted }}>
              {checkedOn && windowChecked(receipt)
                ? `Checked against ${possessive(shop.name)} own returns page on ${fmtDateLong(checkedOn)}.`
                : checkedOn
                  ? `This receipt’s window differs from ${possessive(shop.name)}, which was checked on ${fmtDateLong(checkedOn)}.`
                  : `Not yet checked against ${possessive(shop.name)} own returns page — trust your receipt over this.`}
            </div>
          )}
          {/* The window it was bought under, once the card above has moved on
              to the refund: whether it went back in time is still worth
              being able to see, beside the policy that set it. */}
          {(receipt.status === 'sent' || receipt.status === 'returned') && (
            <div data-shop-window style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.5, color: color.muted }}>
              {d.expired ? 'The window ran to' : 'The window runs to'} {deadlineText} · {receipt.windowDays}-day window · bought {boughtText}
            </div>
          )}
          {dispatchDiffers && (
            <div style={{ fontSize: 12.5, marginTop: 8, color: color.muted }}>
              Clock started {fmtDateLong(fromISODate(receipt.windowStartsOn!))} ({clockStart === 'dispatch' ? 'dispatch' : 'delivery'}), not the day you ordered.
            </div>
          )}
          {/* The other half of the same fact, and the one that was silent.
              This shop counts from dispatch and this receipt does not know
              when that was — the paste did not say — so the app is counting
              from the order, which is earlier and therefore cautious. It was
              presenting that as the deadline rather than as a floor, and a
              floor shown as a fact says "window closed" on a day the shop
              would still take the thing back. Same hedge the statutory
              clocks make when the arrival date is unknown, pointing the
              other way. */}
          {/* Read off `floorClock`, the condition every other surface reads,
              which also asks whether it was an ONLINE order: this used to
              test the shop's clock alone, and so told someone who bought at
              Apple's counter that Apple counts from the day it arrives. */}
          {floor && (
            <div data-floor style={{ fontSize: 12.5, marginTop: 8, color: color.muted }}>
              {receipt.store} counts from {floor === 'dispatch' ? 'dispatch' : 'the day it arrives'}, not from your
              order — and this receipt does not say when that was, so the date above is the earliest it can be, never
              the latest.{unsure && ` Its window may still be open: ${floorWords(floor).addIt} to know.`}
            </div>
          )}
        </div>

        {/* Only while it is still with its owner. A returned receipt said "you
            can cancel for any reason until…, n days left" about a right it had
            already used, and one on its way back likewise: what is left for
            those is the refund, set out below. A kept one keeps its rights. */}
        {(receipt.status === 'active' || receipt.status === 'kept') && (
        <div style={{ borderTop: `1px solid ${color.borderHair}`, padding: '15px 18px' }}>
          <Pressable
            onClick={() => setLegalOpen((v) => !v)}
            aria-expanded={legalOpen}
            style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', minWidth: 0 }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: color.accentInk }}>
              {rights.length > 1 ? 'Your legal rights' : 'Your legal right'}
            </span>
            {/* One chip per right. A distance purchase carries two, and which
                statute each comes from is the part someone repeats at a
                counter — see legal.ts for why they are not alternatives. */}
            {rights.map((right) => (
              <span
                key={right.chip}
                style={{ fontSize: 10, fontWeight: 600, background: color.accentSoft, padding: '2px 8px', borderRadius: radius.chip }}
              >
                {right.chip}
              </span>
            ))}
            <svg width="10" height="7" viewBox="0 0 10 7" style={{ marginLeft: 'auto', flexShrink: 0, transform: `rotate(${legalOpen ? 180 : 0}deg)`, transition: 'transform .2s' }} aria-hidden="true">
              <path d="M1 1.5l4 4 4-4" fill="none" stroke={color.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Pressable>
          {legalOpen &&
            rights.map((right) => (
              <div key={right.chip} style={{ fontSize: 14, marginTop: 8, lineHeight: 1.5, color: color.bodyStrong }}>
                {right.body}
              </div>
            ))}
        </div>
        )}

        {asksForGuarantee(receipt) && (
          <div style={{ borderTop: `1px solid ${color.borderHair}`, padding: '15px 18px' }}>
            <div style={cardLabel}>Warranty</div>
            <div style={{ fontSize: 14, marginTop: 5, lineHeight: 1.5, color: color.bodyStrong }}>
              None recorded. Most electricals and furniture come with one — add its length and Quids In counts it down
              beside the return window.
            </div>
            <Pressable
              className="k-row-white k-secondary"
              onClick={onEdit}
              style={{ display: 'inline-flex', width: 'auto', marginTop: 10, padding: '10px 16px', background: color.surface, border: `1px solid ${color.borderSoft}`, borderRadius: radius.control, fontWeight: 600, fontSize: 13.5 }}
            >
              Add its guarantee
            </Pressable>
          </div>
        )}

        {receipt.warranty && (
          <div style={{ borderTop: `1px solid ${color.borderHair}`, padding: '15px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <div style={cardLabel}>Warranty</div>
              {/* The clock, not a sentence about one. The question a warranty
                  has to answer is "is the repair free today?", and prose could
                  not answer it. */}
              {d.warranty && d.warranty.months > 0 && (
                <div
                  style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: radius.chip,
                    background: d.warranty.expired ? color.surfaceAlt : color.accentSoft,
                    color: d.warranty.expired ? color.body : color.ink,
                  }}
                >
                  {d.warranty.expired ? 'expired' : `${d.warranty.label} left`}
                </div>
              )}
            </div>
            {d.warranty && d.warranty.months > 0 && (
              <div style={{ fontSize: 14, marginTop: 5, color: color.bodyStrong }}>
                {d.warranty.expired
                  ? `Cover ran out on ${fmtDateLong(d.warranty.ends)}.`
                  : `Repairs should be free until ${fmtDateLong(d.warranty.ends)}.`}
              </div>
            )}
            {receipt.warranty.note && (
              <div style={{ fontSize: 13, marginTop: 4, color: color.muted }}>{receipt.warranty.note}</div>
            )}
          </div>
        )}

        {/* Last in the card, not first: it is proof of purchase to keep, not
            the step a deadline is for, and its explainer led the card while
            the returns link sat below the fold. */}
        <ReceiptPhoto receiptId={receipt.id} />
      </div>

      {/* The rights above, turned into the letter that asks for them. Not on a
          refund: that purchase has already gone back. */}
      {receipt.status === 'active' && <CancelPanel receipt={receipt} today={today} onSent={onCancelSent} onUnsent={onCancelUnsent} />}
      {(receipt.status === 'active' || receipt.status === 'kept') && <FaultPanel receipt={receipt} today={today} onSent={onFaultSent} onUnsent={onFaultUnsent} onFinalSent={onFinalRejectSent} onFinalUnsent={onFinalRejectUnsent} />}

      {/* The case, assembled: what the shop, the bank or a card claim asks
          for, in date order, as one page to share or keep. */}
      <Pressable
        data-pack-open
        className="k-row-white"
        onClick={onPack}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, padding: '14px 16px', textAlign: 'left',
          background: color.surfaceAlt, borderRadius: radius.cardLg,
        }}
      >
        <span aria-hidden="true" style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, display: 'grid', placeItems: 'center', background: color.accentSoft }}>
          <ReceiptGlyph size={20} stroke={color.accentInk} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: color.ink }}>Claim pack</span>
          <span style={{ display: 'block', fontSize: 13, lineHeight: 1.4, color: color.muted, marginTop: 2 }}>
            Every date, right and letter on one page — for the shop, your bank or a card claim.
          </span>
        </span>
        <span aria-hidden="true" style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
          <ChevronLeft stroke={color.muted} />
        </span>
      </Pressable>

      {receipt.gotcha && (
        <div style={{ display: 'flex', gap: 10, background: color.accentSoft, border: `1px solid ${color.border}`, borderRadius: 12, padding: '14px 16px', marginTop: 12 }}>
          <Warning />
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            <strong>Gotcha:</strong> {receipt.gotcha}
          </div>
        </div>
      )}

      {receipt.status === 'returned' ? (
        <>
          {/* A swap whose swap-in has a refund, a posting or a swap of its own
              is not offered back: that tap removed the swap-in and all of it,
              with no undo. Said instead, with the way to it. */}
          {receipt.exchanged && swapBlocked ? (
            <div data-swap-blocked style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.5, color: color.body, textAlign: 'center' }}>
              {swapBlocked.text}{' '}
              <Pressable
                onClick={swapBlocked.onOpen}
                style={{ display: 'inline-flex', width: 'auto', minHeight: 44, alignItems: 'center', fontSize: 13.5, fontWeight: 600, textDecoration: 'underline' }}
              >
                Open that receipt
              </Pressable>
            </div>
          ) : (
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <Pressable
              className="k-row-white k-secondary"
              onClick={receipt.exchanged ? onUnexchange : onUnreturn}
              style={{ flex: 1, padding: 13, textAlign: 'center', background: color.surface, border: `1px solid ${color.borderSoft}`, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
            >
              {/* Posted first, so what is being taken back is the money:
                  the parcel went, and it goes back to waiting for a refund. */}
              {receipt.exchanged ? 'Not swapped after all' : receipt.sentOn ? 'The refund hasn’t come' : 'Not actually returned'}
            </Pressable>
          </div>
          )}
        </>
      ) : receipt.status === 'sent' ? (
        <>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            {/* Secondary once the refund is late: the chase letter above is
                then the step, and one filled button is what says so. */}
            <Pressable
              className={chase?.late ? 'k-row-white k-secondary' : 'k-primary'}
              onClick={onReturn}
              style={chase?.late ? secondaryButton : primaryButton}
            >
              Got my money back
            </Pressable>
          </div>
          <Pressable
            className="k-row-white k-secondary"
            onClick={onUnsend}
            style={{ marginTop: 10, padding: 13, textAlign: 'center', background: color.surface, border: `1px solid ${color.borderSoft}`, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
          >
            Not sent after all
          </Pressable>
        </>
      ) : receipt.status === 'kept' ? (
        <>
          {/* Settled without a refund. The reminders stop; the rights set out
              above do not, which is the reason to keep the receipt at all. */}
          <div style={{ marginTop: 16, padding: 15, background: color.surfaceAlt, border: `1px solid ${color.border}`, borderRadius: 12 }}>
            <div style={{ fontWeight: 600 }}>
              Keeping it{receipt.keptOn ? ` · since ${fmtDateLong(fromISODate(receipt.keptOn))}` : ''}
            </div>
            <div style={{ fontSize: 13, color: color.muted, lineHeight: 1.5, marginTop: 4 }}>
              No more return reminders. If it turns out to be faulty, your rights above still apply.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <Pressable
              className="k-row-white k-secondary"
              onClick={onUnkeep}
              style={{ flex: 1, padding: 13, textAlign: 'center', background: color.surface, border: `1px solid ${color.borderSoft}`, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
            >
              Not keeping it after all
            </Pressable>
          </div>
        </>
      ) : (
        <>
          {/* The receipt a swap produced says where its dates came from:
              the original's, which is the earlier clock, and not a guess at
              what the shop's swap did to its window. */}
          {receipt.swappedFrom && (
            <div data-swap-in style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.5, color: color.body }}>
              Swapped for the one you bought on {fmtDateLong(fromISODate(receipt.purchasedOn))}, so it keeps that receipt’s
              dates. If the shop gave you a new receipt, change them with Edit.
            </div>
          )}
          <ActiveActions distance={receipt.distance} quiet={!!returnsPage} onReturn={onReturn} onSend={onSend} onKeep={onKeep} />
          {/* The two less common endings, side by side and quiet: they were a
              stack of three underlined lines with Delete, each on its own. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 12, marginTop: 6 }}>
            <Pressable
              onClick={onExchange}
              style={{ display: 'inline-flex', width: 'auto', minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: '0 8px', fontWeight: 600, fontSize: 14, textDecoration: 'underline' }}
            >
              Swapped it for another
            </Pressable>
            {canSplit(receipt) && <SplitPanel key={receipt.id} receipt={receipt} onSplit={onSplit} />}
          </div>
        </>
      )}
      {/* A part split out of a basket says where it came from, and can go back in. */}
      {splitFromReceipt && onUnsplit && (
        <div data-split-part style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.5, color: color.body, textAlign: 'center' }}>
          Split from your {splitFromReceipt.store} receipt for {splitFromReceipt.item}.{' '}
          <Pressable
            onClick={onUnsplit}
            style={{ display: 'inline-flex', width: 'auto', minHeight: 44, alignItems: 'center', fontSize: 13.5, fontWeight: 600, textDecoration: 'underline' }}
          >
            Not split after all
          </Pressable>
        </div>
      )}
      {receipt.status === 'kept' && canSplit(receipt) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 }}>
          <SplitPanel key={receipt.id} receipt={receipt} onSplit={onSplit} />
        </div>
      )}
      {/* Last, and quiet. It sat beside the primary action as a pill of its
          own, on every receipt: the one irreversible-looking choice here drawn
          with the weight of the one the screen is for. It has an undo, and it
          is still one tap — it is just not the second thing you see. */}
      <Pressable
        onClick={onDelete}
        style={{ display: 'flex', width: 'auto', minHeight: 44, alignItems: 'center', justifyContent: 'center', margin: '18px auto 0', padding: '0 16px', fontWeight: 600, fontSize: 14, color: color.danger }}
      >
        Delete
      </Pressable>
    </div>
  );
}

/**
 * What came back, and the way to say it was less. The one-tap return records
 * the whole price, which is right most of the time and wrong for the common
 * partial case — one of two sizes sent back, a deduction for a missing box —
 * and the "kept back" total then counted money that never came.
 */
function RefundCard({ receipt, returnedText, ring, onSetRefund }: {
  receipt: Receipt;
  returnedText: string | undefined;
  ring: ReactNode;
  onSetRefund: (pence: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const got = refundOf(receipt);
  return (
    <TopCard
      ring={ring}
      below={editing && <RefundForm id="refund-amount" cost={receipt.amount} current={got} onSet={onSetRefund} onClose={() => setEditing(false)} />}
    >
      {/* With the date, which the receipt stored for months before this
          screen showed it: "£89.00 recovered ✓" is the same sentence whether
          the refund landed last week or last year. The tick is the ring's
          now; at the end of the sentence it wrapped to a line of its own. */}
      <div style={{ fontSize: 16.5, fontWeight: 700, lineHeight: 1.35, letterSpacing: '-0.01em' }}>
        {receipt.credit ? `Store credit · ${money(got)} at ${receipt.store}` : `Money back · ${money(got)} recovered`}
        {returnedText ? ` on ${returnedText}` : ''}
      </div>
      {got !== receipt.amount && (
        <div style={{ fontSize: 13, color: color.body, marginTop: 4 }}>of the {money(receipt.amount)} it cost</div>
      )}
      {receipt.returnRef && (
        <div style={{ fontSize: 13, color: color.body, marginTop: 4, overflowWrap: 'anywhere' }}>Tracking · {receipt.returnRef}</div>
      )}
      {!editing && (
        <Pressable
          onClick={() => setEditing(true)}
          style={{ display: 'inline-flex', width: 'auto', minHeight: 44, alignItems: 'center', fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}
        >
          {got !== receipt.amount ? 'Change the amount' : 'Not the full amount?'}
        </Pressable>
      )}
    </TopCard>
  );
}

/** The raised card under the price: the ring on the left, what it means on the right. */
function TopCard({ ring, below, children }: { ring: ReactNode; below?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ background: color.surface, color: color.ink, borderRadius: radius.cardLg, padding: '18px 18px', boxShadow: shadow.raisedLg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {ring}
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
      {below}
    </div>
  );
}

/** The ring, drawn to `offset` along its circumference, with what it counts in the middle. */
function Ring({ offset, stroke, children }: { offset: string; stroke: string; children: ReactNode }) {
  return (
    <div style={{ position: 'relative', width: 92, height: 92, flexShrink: 0 }}>
      <svg width="92" height="92" viewBox="0 0 92 92" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx="46" cy="46" r="40" fill="none" stroke={color.surfaceDeep} strokeWidth="7" />
        <circle
          cx="46" cy="46" r="40" fill="none" stroke={stroke} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={offset}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  );
}

/**
 * Proof it went: the reference on the post office's slip, or the courier's
 * tracking number. A chase rests on it, and for a cancelled online order it is
 * what starts the shop's fourteen days. Optional — most refunds just arrive.
 */
function ReturnRefField({ receipt, onSetReturnRef }: { receipt: Receipt; onSetReturnRef: (ref: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const read = readReturnRef(text);
  const error = read.ok ? undefined : read.error;
  const save = () => {
    if (!read.ok) return;
    onSetReturnRef(read.ref);
    setEditing(false);
  };
  if (!editing) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, marginTop: 6 }}>
        {receipt.returnRef && (
          <span style={{ fontSize: 13, color: color.body, overflowWrap: 'anywhere', minWidth: 0 }}>Tracking · {receipt.returnRef}</span>
        )}
        <Pressable
          onClick={() => {
            setText(receipt.returnRef ?? '');
            setEditing(true);
          }}
          style={{ display: 'inline-flex', width: 'auto', minHeight: 44, alignItems: 'center', fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}
        >
          {receipt.returnRef ? 'Change' : 'Add the tracking number'}
        </Pressable>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 10 }}>
      <label htmlFor="return-ref" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
        Tracking or proof-of-postage number
      </label>
      <input
        id="return-ref"
        value={text}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={!!error}
        aria-describedby={error ? 'return-ref-error' : undefined}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
        }}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: radius.control,
          border: `1px solid ${error ? color.danger : color.border}`, background: color.surface,
          fontFamily: font.figures, fontSize: 14.5, color: color.ink,
        }}
      />
      {error && (
        <div id="return-ref-error" role="alert" style={{ fontSize: 12.5, fontWeight: 600, color: color.danger, marginTop: 5 }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <Pressable
          className="k-primary"
          onClick={save}
          disabled={!!error}
          style={{ flex: 1, padding: 12, textAlign: 'center', background: color.accent, color: color.white, border: 0, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
        >
          Save
        </Pressable>
        <Pressable
          className="k-row-white k-secondary"
          onClick={() => setEditing(false)}
          style={{ flex: 1, padding: 12, textAlign: 'center', background: color.surface, border: `1px solid ${color.borderSoft}`, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
        >
          Cancel
        </Pressable>
      </div>
    </div>
  );
}

/**
 * Once the refund is late, the letter that chases it. Open, not folded away
 * like the fault panel: by now this is the one thing the receipt is for.
 */
function RefundChasePanel({ receipt, today }: { receipt: Receipt; today: Date }) {
  const chase = refundChase(receipt, today);
  const letter = refundLetter(receipt, today);
  if (!chase || !letter) return null;
  return (
    <section
      aria-labelledby="refund-late"
      data-refund-chase
      style={{ background: color.surfaceAlt, borderRadius: radius.cardLg, marginTop: 12, padding: '15px 18px' }}
    >
      <h2 id="refund-late" style={{ margin: 0, fontSize: 15, fontWeight: 600, color: color.bodyStrong }}>
        The refund is late
      </h2>
      <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 4, color: color.muted }}>{refundChaseLine(chase)}</div>
      <Letter letter={letter} title={`Refund not received: ${receipt.item}`} receipt={receipt} />
      <Escalation receipt={receipt} />
      <div style={{ fontSize: 12, marginTop: 10, color: color.muted }}>{LEGAL_DISCLAIMER}</div>
    </section>
  );
}

/**
 * Store credit rather than money: the commonest way a return ends without
 * cash, and one that had no way to be said. With the day the credit note says
 * it lapses, a reminder is due a month before — credit that runs out unspent
 * is money lost as surely as a missed return window.
 */
function CreditPanel({ receipt, onSetCredit, onCreditSpent }: {
  receipt: Receipt;
  onSetCredit: (credit: { expires?: string } | null) => void;
  onCreditSpent: (spent: boolean) => void;
}) {
  const [text, setText] = useState(receipt.credit?.expires ?? '');
  if (receipt.credit?.spentOn) {
    // Spent: nothing left to remind about, and the record says so.
    return (
      <div data-credit-spent style={{ marginTop: 10, padding: 14, background: color.surface, border: `1px solid ${color.border}`, borderRadius: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Store credit · spent {fmtDateLong(fromISODate(receipt.credit.spentOn))}</div>
        <Pressable
          onClick={() => onCreditSpent(false)}
          style={{ display: 'inline-flex', width: 'auto', minHeight: 44, alignItems: 'center', marginTop: 2, fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}
        >
          Not spent after all
        </Pressable>
      </div>
    );
  }
  if (!receipt.credit) {
    return (
      <Pressable
        onClick={() => onSetCredit({})}
        style={{ display: 'flex', width: 'auto', minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6, fontSize: 13.5, fontWeight: 600, textDecoration: 'underline' }}
      >
        It came back as store credit
      </Pressable>
    );
  }
  const given = receipt.returnedOn;
  const error =
    text && given && daysBetween(fromISODate(given), fromISODate(text)) < 0 ? 'It cannot run out before it was given' : undefined;
  return (
    <div data-credit style={{ marginTop: 10, padding: 14, background: color.surface, border: `1px solid ${color.border}`, borderRadius: 12 }}>
      <label htmlFor="credit-expires" style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
        When does the credit run out?
      </label>
      <input
        id="credit-expires"
        type="date"
        value={text}
        aria-invalid={!!error}
        aria-describedby="credit-expires-note"
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          const bad = v && given && daysBetween(fromISODate(given), fromISODate(v)) < 0;
          if (!bad) onSetCredit(v ? { expires: v } : {});
        }}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: radius.control,
          border: `1px solid ${error ? color.danger : color.border}`, background: color.surface,
          fontFamily: font.figures, fontSize: 14.5, color: color.ink,
        }}
      />
      {error ? (
        <div id="credit-expires-note" role="alert" style={{ fontSize: 12.5, fontWeight: 600, color: color.danger, marginTop: 5 }}>
          {error}
        </div>
      ) : (
        <div id="credit-expires-note" style={{ fontSize: 12.5, color: color.muted, marginTop: 5, lineHeight: 1.5 }}>
          Optional, from the credit note. With a date, a reminder is due a month before it lapses.
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 16, marginTop: 4 }}>
        <Pressable
          onClick={() => onCreditSpent(true)}
          style={{ display: 'inline-flex', width: 'auto', minHeight: 44, alignItems: 'center', fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}
        >
          I’ve spent it
        </Pressable>
        <Pressable
          onClick={() => onSetCredit(null)}
          style={{ display: 'inline-flex', width: 'auto', minHeight: 44, alignItems: 'center', fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}
        >
          It was money after all
        </Pressable>
      </div>
    </div>
  );
}

/**
 * The three ends of a purchase still in hand, led by the likelier next step.
 * Bought online, the next thing that happens is the parcel going back — the
 * refund comes days later, and "Got my money back" first invited marking the
 * money as arrived before it had. Bought over a counter, the refund is handed
 * over at the till the moment it goes back, so that is the step.
 */
function ActiveActions({ distance, quiet, onReturn, onSend, onKeep }: {
  distance: boolean;
  /**
   * The shop's returns link is on the screen, and it is the step the deadline
   * is for: the likelier ending still leads, but outlined, so the screen has
   * one filled button rather than two competing for the same thumb.
   */
  quiet: boolean;
  onReturn: () => void;
  onSend: () => void;
  onKeep: () => void;
}) {
  const secondary = { ...secondaryButton, flex: '1 1 140px' } as const;
  const sent = { label: 'I’ve sent it back', onClick: onSend };
  const back = { label: 'Got my money back', onClick: onReturn };
  const [first, second] = distance ? [sent, back] : [back, sent];
  return (
    <>
      <div style={{ display: 'flex', marginTop: 16 }}>
        <Pressable className={quiet ? 'k-row-white k-secondary' : 'k-primary'} onClick={first.onClick} style={quiet ? { ...secondaryButton, fontSize: 15 } : primaryButton}>
          {first.label}
        </Pressable>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <Pressable className="k-row-white k-secondary" onClick={second.onClick} style={secondary}>
          {second.label}
        </Pressable>
        <Pressable className="k-row-white k-secondary" onClick={onKeep} style={secondary}>
          I’m keeping it
        </Pressable>
      </div>
    </>
  );
}
