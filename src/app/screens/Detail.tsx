import { useState } from 'react';
import { color, font, radius, shadow } from '../../tokens';
import { addDays, daysBetween, fmtDateLong, fmtDatesTogether, fromISODate } from '../../lib/dates';
import { firstToClose, firstToCloseLine, LEGAL_DISCLAIMER, legalRights } from '../../lib/legal';
import { REFUND_CHASE_DAYS } from '../../lib/alerts';
import { money } from '../../lib/money';
import { asksForGuarantee, awaitingArrival, derive, floorClock, floorWords, refundOf } from '../../lib/receipts';
import type { Receipt } from '../../lib/types';
import { clockFor, findStore, shopCheckedOn, windowChecked } from '../../lib/stores';
import { returnsPageFor } from '../../lib/returns-pages';
import { urgency, windowRemaining } from '../../lib/urgency';
import { ChevronLeft, ReceiptGlyph, Warning } from '../components/Icons';
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
import { readReturnRef, refundChase, refundChaseLine, refundIsStatutory, refundLetter } from '../../lib/refund-chase';
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

export function Detail({ receipt, today, urgentDays, onBack, onEdit, onPack, onReturn, onUnreturn, onKeep, onUnkeep, onSend, onUnsend, onSetRefund, onSetReturnRef, onSetCredit, onCreditSpent, onArrived, onFaultSent, onFaultUnsent, onCancelSent, onCancelUnsent, onExchange, onUnexchange, swapBlocked, onDelete, onSplit, onUnsplit, splitFromReceipt }: Props) {
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
  // On the white card now: red when it is close or gone, the accent when it
  // is coming up, ink otherwise; grey once settled.
  const ringColor = settled
    ? color.muted
    : unsure ? color.accent : d.expired ? color.danger : u.level === 'critical' ? color.danger : color.accent;

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

  return (
    <div className="k-fade" style={{ flex: 1, overflow: 'auto', padding: '6px 16px 120px' }}>
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

      <div style={{ background: color.white, color: color.ink, borderRadius: radius.cardLg, padding: '18px 18px', boxShadow: shadow.raisedLg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative', width: 92, height: 92, flexShrink: 0 }}>
            <svg width="92" height="92" viewBox="0 0 92 92" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
              <circle cx="46" cy="46" r="40" fill="none" stroke={color.surfaceDeep} strokeWidth="7" />
              <circle
                cx="46" cy="46" r="40" fill="none" stroke={ringColor} strokeWidth="7" strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={ringOffset}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {/* Coloured like the count on the home hero, which has always
                  done this. Here the ring's stroke was the only urgency
                  signal on the screen, and on the last day it was a hairline. */}
              <div style={{ fontFamily: font.figures, fontSize: settled || d.expired ? 15 : 26, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: ringColor }}>
                {receipt.status === 'returned' ? 'back' : receipt.status === 'kept' ? 'kept' : receipt.status === 'sent' ? 'sent' : unsure ? 'open?' : d.expired ? 'closed' : d.daysLeft}
              </div>
              {!settled && !d.expired && <div style={{ fontSize: 11, color: color.muted, marginTop: 2 }}>days left</div>}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: color.muted, fontWeight: 600 }}>
              {settled ? 'The window ran to' : unsure ? 'Earliest it could close' : d.expired ? 'Window closed' : 'Return by'}
            </div>
            <div style={{ fontFamily: font.figures, fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 4 }}>
              {deadlineText}
            </div>
            <div style={{ fontSize: 13, color: color.muted, marginTop: 6 }}>
              {settled ? `${receipt.windowDays}-day window · bought ${boughtText}` : `${d.daysUsed} of ${receipt.windowDays} days used · bought ${boughtText}`}
            </div>
          </div>
        </div>
        {/* The comparison the ring and the legal panel left to the reader:
            with IKEA's year, the first thing to go is the 30-day right to
            reject, and nothing said so. */}
        {firstClock && (
          <div style={{ fontSize: 13.5, lineHeight: 1.45, color: color.body, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${color.borderHair}` }}>
            {firstToCloseLine(firstClock)}
          </div>
        )}
      </div>

      <div style={{ background: color.surfaceAlt, borderRadius: radius.cardLg, marginTop: 14 }}>
        <div style={{ padding: '16px 18px 14px' }}>
          <ReceiptPhoto receiptId={receipt.id} />

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
          {returnsPage && (
            /* A link, not a button: it leaves the app, and says where to. The
               shop's own page, the one `check:retailers` reads; nothing about
               the purchase goes with it. */
            <a
              href={returnsPage.url}
              target="_blank"
              rel="noopener noreferrer"
              className="k-primary"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12,
                minHeight: 46, boxSizing: 'border-box', padding: '10px 16px', borderRadius: radius.control, background: color.accent, color: color.white,
                textDecoration: 'none', fontSize: 14, fontWeight: 600,
              }}
            >
              <span>Start your return</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: color.accentSoft }}>{returnsPage.host}<span aria-hidden="true"> ↗</span></span>
            </a>
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
          {/* The fix for the floor above, in one tap, while the parcel could
              plausibly still be coming. The order email is when most people
              add a receipt, and it arrives before the parcel does. */}
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
                  className="k-primary"
                  onClick={onArrived}
                  style={{ flex: '1 1 auto', width: 'auto', padding: 12, textAlign: 'center', background: color.accent, color: color.white, border: 0, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
                >
                  It arrived today
                </Pressable>
                <Pressable
                  className="k-row-white k-secondary"
                  onClick={onEdit}
                  style={{ flex: '1 1 auto', width: 'auto', padding: 12, textAlign: 'center', background: color.white, border: `1px solid ${color.borderSoft}`, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
                >
                  It came earlier
                </Pressable>
              </div>
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
              None recorded. Most electricals and furniture come with one — add its length and Kept counts it down
              beside the return window.
            </div>
            <Pressable
              className="k-row-white k-secondary"
              onClick={onEdit}
              style={{ display: 'inline-flex', width: 'auto', marginTop: 10, padding: '10px 16px', background: color.white, border: `1px solid ${color.borderSoft}`, borderRadius: radius.control, fontWeight: 600, fontSize: 13.5 }}
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
      </div>

      {/* The rights above, turned into the letter that asks for them. Not on a
          refund: that purchase has already gone back. */}
      {receipt.status === 'active' && <CancelPanel receipt={receipt} today={today} onSent={onCancelSent} onUnsent={onCancelUnsent} />}
      {(receipt.status === 'active' || receipt.status === 'kept') && <FaultPanel receipt={receipt} today={today} onSent={onFaultSent} onUnsent={onFaultUnsent} />}

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
          {/* The date, which the receipt has been storing since the day this
              screen was written and never showing. "£89.00 recovered ✓" is
              the same sentence whether the refund landed last week or last
              year, and it is the only fact a returned receipt carries that is
              not already on the row. */}
          {receipt.exchanged ? (
            <div data-swapped style={{ marginTop: 16, padding: 13, textAlign: 'center', background: color.accentSoft, border: `1px solid ${color.border}`, borderRadius: 12, fontWeight: 600 }}>
              Swapped for another{returnedText ? ` on ${returnedText}` : ''} ✓
            </div>
          ) : (
            <>
              <RefundPanel receipt={receipt} returnedText={returnedText} onSetRefund={onSetRefund} />
              <CreditPanel receipt={receipt} onSetCredit={onSetCredit} onCreditSpent={onCreditSpent} />
            </>
          )}
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
              style={{ flex: 1, padding: 13, textAlign: 'center', background: color.white, border: `1px solid ${color.borderSoft}`, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
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
          {/* Gone back, money still to come. The day it went is the one that
              decides whether it was in time, so it is said; and the day worth
              chasing from, so that is said too. The shop's fourteen days only
              where reg. 34 gives them (`refundIsStatutory`): this line said it
              for every online order, above a late panel saying otherwise. */}
          <div style={{ marginTop: 16, padding: 15, background: color.white, border: `1px solid ${color.border}`, borderRadius: 12 }}>
            <div style={{ fontWeight: 600 }}>
              Sent back{receipt.sentOn ? ` · ${fmtDateLong(fromISODate(receipt.sentOn))}` : ''}
            </div>
            <div style={{ fontSize: 13, color: color.muted, lineHeight: 1.5, marginTop: 4 }}>
              Waiting for the refund.
              {receipt.sentOn && ` If it has not arrived by ${fmtDateLong(addDays(fromISODate(receipt.sentOn), REFUND_CHASE_DAYS))}, chase it`}
              {receipt.sentOn && (refundIsStatutory(receipt) ? ` — for an online order, the shop has ${REFUND_CHASE_DAYS} days from getting it back.` : '.')}
            </div>
            <ReturnRefField receipt={receipt} onSetReturnRef={onSetReturnRef} />
          </div>
          <RefundChasePanel receipt={receipt} today={today} />
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <Pressable
              className="k-primary"
              onClick={onReturn}
              style={{ flex: 1, padding: 13, textAlign: 'center', background: color.accent, color: color.white, border: 0, borderRadius: radius.control, fontWeight: 600, fontSize: 15, boxShadow: shadow.raised }}
            >
              Got my money back
            </Pressable>
          </div>
          <Pressable
            className="k-row-white k-secondary"
            onClick={onUnsend}
            style={{ marginTop: 10, padding: 13, textAlign: 'center', background: color.white, border: `1px solid ${color.borderSoft}`, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
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
              style={{ flex: 1, padding: 13, textAlign: 'center', background: color.white, border: `1px solid ${color.borderSoft}`, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
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
          <ActiveActions distance={receipt.distance} onReturn={onReturn} onSend={onSend} onKeep={onKeep} />
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
          Split out of the {splitFromReceipt.store} receipt for {splitFromReceipt.item}.{' '}
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
function RefundPanel({ receipt, returnedText, onSetRefund }: {
  receipt: Receipt;
  returnedText: string | undefined;
  onSetRefund: (pence: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const got = refundOf(receipt);
  return (
    <div style={{ marginTop: 16, padding: 13, textAlign: 'center', background: color.accentSoft, border: `1px solid ${color.border}`, borderRadius: 12 }}>
      <div style={{ fontWeight: 600 }}>
        {receipt.credit ? `Store credit · ${money(got)} at ${receipt.store}` : `Money back · ${money(got)} recovered`}
        {returnedText ? ` on ${returnedText}` : ''} ✓
      </div>
      {got !== receipt.amount && (
        <div style={{ fontSize: 13, color: color.body, marginTop: 4 }}>of the {money(receipt.amount)} it cost</div>
      )}
      {receipt.returnRef && (
        <div style={{ fontSize: 13, color: color.body, marginTop: 4, overflowWrap: 'anywhere' }}>Tracking · {receipt.returnRef}</div>
      )}
      {!editing ? (
        <Pressable
          onClick={() => setEditing(true)}
          style={{ display: 'inline-flex', width: 'auto', minHeight: 44, alignItems: 'center', marginTop: 4, fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}
        >
          {got !== receipt.amount ? 'Change the amount' : 'Not the full amount?'}
        </Pressable>
      ) : (
        <RefundForm id="refund-amount" cost={receipt.amount} current={got} onSet={onSetRefund} onClose={() => setEditing(false)} />
      )}
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
          border: `1px solid ${error ? color.danger : color.border}`, background: color.white,
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
          style={{ flex: 1, padding: 12, textAlign: 'center', background: color.white, border: `1px solid ${color.borderSoft}`, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
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
      <div data-credit-spent style={{ marginTop: 10, padding: 14, background: color.white, border: `1px solid ${color.border}`, borderRadius: 12 }}>
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
    <div data-credit style={{ marginTop: 10, padding: 14, background: color.white, border: `1px solid ${color.border}`, borderRadius: 12 }}>
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
          border: `1px solid ${error ? color.danger : color.border}`, background: color.white,
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
function ActiveActions({ distance, onReturn, onSend, onKeep }: {
  distance: boolean;
  onReturn: () => void;
  onSend: () => void;
  onKeep: () => void;
}) {
  const primary = { flex: 1, padding: 13, textAlign: 'center', background: color.accent, color: color.white, border: 0, borderRadius: radius.control, fontWeight: 600, fontSize: 15, boxShadow: shadow.raised } as const;
  const secondary = { flex: '1 1 140px', padding: 13, textAlign: 'center', background: color.white, border: `1px solid ${color.borderSoft}`, borderRadius: radius.control, fontWeight: 600, fontSize: 14 } as const;
  const sent = { label: 'I’ve sent it back', onClick: onSend };
  const back = { label: 'Got my money back', onClick: onReturn };
  const [first, second] = distance ? [sent, back] : [back, sent];
  return (
    <>
      <div style={{ display: 'flex', marginTop: 16 }}>
        <Pressable className="k-primary" onClick={first.onClick} style={primary}>
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
