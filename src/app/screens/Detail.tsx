import { useState } from 'react';
import { color, font, radius, shadow } from '../../tokens';
import { addDays, fmtDateLong, fmtDatesTogether, fromISODate } from '../../lib/dates';
import { firstToClose, firstToCloseLine, legalRights } from '../../lib/legal';
import { REFUND_CHASE_DAYS } from '../../lib/alerts';
import { money } from '../../lib/money';
import { asksForGuarantee, derive, refundOf } from '../../lib/receipts';
import type { Receipt } from '../../lib/types';
import { clockFor, findStore } from '../../lib/stores';
import { returnsPageFor } from '../../lib/returns-pages';
import { urgency } from '../../lib/urgency';
import { ChevronLeft, Warning } from '../components/Icons';
import { Pressable } from '../components/Pressable';
import { ReceiptPhoto } from '../components/ReceiptPhoto';
import { FaultPanel } from '../components/FaultPanel';
import { RefundForm } from '../components/RefundForm';

/** 2π × 40, the circumference of the ring the countdown draws on. */
const RING_CIRCUMFERENCE = 251.3;

interface Props {
  receipt: Receipt;
  today: Date;
  urgentDays: number;
  onBack: () => void;
  onEdit: () => void;
  onReturn: () => void;
  onUnreturn: () => void;
  onKeep: () => void;
  onUnkeep: () => void;
  onSend: () => void;
  onUnsend: () => void;
  /** Record less than the full price as refunded; null for the whole price. */
  onSetRefund: (pence: number | null) => void;
  onDelete: () => void;
}

const cardLabel = { fontSize: 11, fontWeight: 700, letterSpacing: '1.4px', color: color.muted } as const;

export function Detail({ receipt, today, urgentDays, onBack, onEdit, onReturn, onUnreturn, onKeep, onUnkeep, onSend, onUnsend, onSetRefund, onDelete }: Props) {
  const [legalOpen, setLegalOpen] = useState(true);
  const d = derive(receipt, today);
  const u = urgency(d.daysLeft, urgentDays);
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
  const remaining = Math.max(0, Math.min(1, (d.daysLeft + 1) / receipt.windowDays));
  /*
   * A settled receipt — returned or kept — has no clock. The ring went on
   * counting down in urgency red ("closed", "RETURN BY", "3 days left")
   * directly above a panel saying "No more return reminders", which is the
   * app contradicting itself on one screen. Settled, it is a closed full
   * circle in a quiet ink, and the date is stated as history.
   */
  const settled = receipt.status !== 'active';
  const ringOffset = settled ? '0' : (RING_CIRCUMFERENCE * (1 - remaining)).toFixed(1);
  const ringColor = settled
    ? color.faint
    : d.expired ? color.onInkDanger : u.level === 'critical' ? color.onInkDanger : u.level === 'soon' ? color.yellow : color.cream;

  const dispatchDiffers = receipt.windowStartsOn && receipt.windowStartsOn !== receipt.purchasedOn;
  // The table, not the receipt: which clock a shop runs is not something a
  // receipt records, and unlike the WINDOW it is not a term that changes under
  // a purchase — a shop counts from the till, the warehouse or the doormat,
  // and it does not switch.
  // The online clock for an online order, where the shop has one (`clockFor`).
  const shop = findStore(receipt.store);
  const clockStart = shop ? clockFor(shop, receipt.distance) : 'purchase';
  /*
   * The step the deadline is for. Only while it can still be taken: after the
   * shop's window a returns page invites a change-of-mind return the shop will
   * refuse, and the rights that outlast it (faulty goods) are set out below.
   */
  const returnsPage = receipt.status === 'active' && !d.expired ? returnsPageFor(receipt.store) : null;

  // Rendered as a pair: a year on the deadline and none on the purchase is
  // what let "RETURN BY 15 Feb 2027" sit above "bought 15 Feb". See
  // fmtDatesTogether.
  const [deadlineText, boughtText, returnedText] = fmtDatesTogether(
    [d.deadline, fromISODate(receipt.purchasedOn), ...(receipt.returnedOn ? [fromISODate(receipt.returnedOn)] : [])],
    today,
  );

  return (
    <div className="k-fade" style={{ flex: 1, overflow: 'auto', padding: '6px 16px 120px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '8px 0 16px' }}>
        <Pressable
          className="k-row-white"
          onClick={onBack}
          style={{
            display: 'inline-flex', width: 'auto', alignItems: 'center', gap: 6, padding: '9px 15px 9px 11px',
            background: color.white, border: `1.5px solid ${color.ink}`, borderRadius: 999,
            fontSize: 13, fontWeight: 700,
          }}
        >
          <ChevronLeft />
          Back
        </Pressable>
        <Pressable
          className="k-row-white"
          onClick={onEdit}
          style={{
            display: 'inline-flex', width: 'auto', alignItems: 'center', gap: 6, padding: '9px 16px',
            background: color.white, border: `1.5px solid ${color.border}`, borderRadius: 999,
            fontSize: 13, fontWeight: 700,
          }}
        >
          Edit
        </Pressable>
      </div>

      <div style={{ background: color.ink, color: color.cream, borderRadius: radius.hero, padding: '22px 20px', boxShadow: shadow.lift }}>
        {/*
          * The amount gets its own line rather than the name getting none.
          *
          * A price is one unbreakable token, so its min-content width is the
          * whole of "£1,299,999.99" — and the name column beside it carries
          * `minWidth: 0`, which is what lets a flex child be squeezed below
          * the width of its own longest word. Rendered at 320px with a browser
          * minimum font size of 20px, that is exactly what happened: the item
          * name came out one word per line, eleven lines of it, beside a price
          * at its full width.
          *
          * Wrapping the row is the whole fix. Where both fit they sit side by
          * side as before; where they do not, the price drops below instead of
          * taking the room out of the name. `60%` is the basis rather than a
          * pixel floor because the pressure here is the ratio between two
          * pieces of text, not the size of the screen.
          */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: '1 1 60%' }}>
            <h1 tabIndex={-1} style={{ fontSize: 21, fontWeight: 700, margin: 0 }}>{receipt.store}</h1>
            <div style={{ fontSize: 13, color: color.faint, marginTop: 3 }}>{receipt.item}</div>
            {receipt.orderRef && (
              <div style={{ fontSize: 12, color: color.faint, marginTop: 3, fontFamily: font.figures, userSelect: 'text', overflowWrap: 'anywhere' }}>
                Order {receipt.orderRef}
              </div>
            )}
          </div>
          <div style={{ fontFamily: font.figures, fontSize: 26, fontWeight: 700, color: color.yellow }}>
            {money(receipt.amount)}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 20 }}>
          <div style={{ position: 'relative', width: 92, height: 92, flexShrink: 0 }}>
            <svg width="92" height="92" viewBox="0 0 92 92" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
              <circle cx="46" cy="46" r="40" fill="none" stroke={color.onInkBorder} strokeWidth="7" />
              <circle
                cx="46" cy="46" r="40" fill="none" stroke={ringColor} strokeWidth="7" strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={ringOffset}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {/* Coloured like the count on the home hero, which has always
                  done this. Here the ring's stroke was the only urgency
                  signal on the screen, and on the last day it was a hairline. */}
              <div style={{ fontFamily: font.figures, fontSize: settled || d.expired ? 15 : 22, fontWeight: 700, lineHeight: 1, color: ringColor }}>
                {receipt.status === 'returned' ? 'back' : receipt.status === 'kept' ? 'kept' : receipt.status === 'sent' ? 'sent' : d.expired ? 'closed' : d.daysLeft}
              </div>
              {!settled && !d.expired && <div style={{ fontSize: 10, color: color.faint, marginTop: 2 }}>days left</div>}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: '1.6px', color: color.faint, fontWeight: 600 }}>
              {settled ? 'THE WINDOW RAN TO' : d.expired ? 'WINDOW CLOSED' : 'RETURN BY'}
            </div>
            <div style={{ fontFamily: font.figures, fontSize: 24, fontWeight: 700, marginTop: 4 }}>
              {deadlineText}
            </div>
            <div style={{ fontSize: 12, color: color.faint, marginTop: 6 }}>
              {settled ? `${receipt.windowDays}-day window · bought ${boughtText}` : `${d.daysUsed} of ${receipt.windowDays} days used · bought ${boughtText}`}
            </div>
          </div>
        </div>
        {/* The comparison the ring and the legal panel left to the reader:
            with IKEA's year, the first thing to go is the 30-day right to
            reject, and nothing said so. */}
        {firstClock && (
          <div style={{ fontSize: 13, lineHeight: 1.45, color: color.onInkBody, marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${color.onInkDash}` }}>
            {firstToCloseLine(firstClock)}
          </div>
        )}
      </div>

      <div style={{ background: color.white, border: `1.5px solid ${color.border}`, borderRadius: radius.cardLg, marginTop: 12 }}>
        <div style={{ padding: '16px 18px 14px' }}>
          <ReceiptPhoto receiptId={receipt.id} />

          <div style={cardLabel}>STORE POLICY</div>
          <div style={{ fontSize: 14, marginTop: 5, lineHeight: 1.5, color: color.bodyStrong }}>{receipt.policy}</div>
          {returnsPage && (
            /* A link, not a button: it leaves the app, and says where to. The
               shop's own page, the one `check:retailers` reads; nothing about
               the purchase goes with it. */
            <a
              href={returnsPage.url}
              target="_blank"
              rel="noopener noreferrer"
              className="k-ink"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12,
                minHeight: 44, padding: '10px 16px', borderRadius: 999, background: color.ink, color: color.cream,
                textDecoration: 'none', fontSize: 14, fontWeight: 700,
              }}
            >
              <span>Start your return</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: color.faint }}>{returnsPage.host}<span aria-hidden="true"> ↗</span></span>
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
          {clockStart !== 'purchase' && !receipt.windowStartsOn && (
            <div style={{ fontSize: 12.5, marginTop: 8, color: color.muted }}>
              {receipt.store} counts from {clockStart === 'dispatch' ? 'dispatch' : 'the day it arrives'}, not from your
              order — and this receipt does not say when that was, so the date above is the earliest it can be, never
              the latest.
            </div>
          )}
        </div>

        <div style={{ borderTop: `1.5px solid ${color.borderHair}`, padding: '15px 18px' }}>
          <Pressable
            onClick={() => setLegalOpen((v) => !v)}
            aria-expanded={legalOpen}
            style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', minWidth: 0 }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '1.4px', color: color.amber }}>
              {rights.length > 1 ? 'YOUR LEGAL RIGHTS' : 'YOUR LEGAL RIGHT'}
            </span>
            {/* One chip per right. A distance purchase carries two, and which
                statute each comes from is the part someone repeats at a
                counter — see legal.ts for why they are not alternatives. */}
            {rights.map((right) => (
              <span
                key={right.chip}
                style={{ fontSize: 10, fontWeight: 700, background: color.yellowLight, padding: '2px 8px', borderRadius: 999 }}
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

        {asksForGuarantee(receipt) && (
          <div style={{ borderTop: `1.5px solid ${color.borderHair}`, padding: '15px 18px' }}>
            <div style={cardLabel}>WARRANTY</div>
            <div style={{ fontSize: 14, marginTop: 5, lineHeight: 1.5, color: color.bodyStrong }}>
              None recorded. Most electricals and furniture come with one — add its length and Kept counts it down
              beside the return window.
            </div>
            <Pressable
              className="k-row-white"
              onClick={onEdit}
              style={{ display: 'inline-flex', width: 'auto', marginTop: 10, padding: '10px 16px', background: color.white, border: `1.5px solid ${color.borderSoft}`, borderRadius: 999, fontWeight: 700, fontSize: 13.5 }}
            >
              Add its guarantee
            </Pressable>
          </div>
        )}

        {receipt.warranty && (
          <div style={{ borderTop: `1.5px solid ${color.borderHair}`, padding: '15px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <div style={cardLabel}>WARRANTY</div>
              {/* The clock, not a sentence about one. The question a warranty
                  has to answer is "is the repair free today?", and prose could
                  not answer it. */}
              {d.warranty && d.warranty.months > 0 && (
                <div
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                    background: d.warranty.expired ? color.creamAlt : color.yellowLight,
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
      {(receipt.status === 'active' || receipt.status === 'kept') && <FaultPanel receipt={receipt} today={today} />}

      {receipt.gotcha && (
        <div style={{ display: 'flex', gap: 10, background: color.yellowLight, border: `1.5px solid ${color.ink}`, borderRadius: 16, padding: '14px 16px', marginTop: 12 }}>
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
          <RefundPanel receipt={receipt} returnedText={returnedText} onSetRefund={onSetRefund} />
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <Pressable
              className="k-row-white"
              onClick={onUnreturn}
              style={{ flex: 1, padding: 15, textAlign: 'center', background: color.white, border: `1.5px solid ${color.borderSoft}`, borderRadius: 999, fontWeight: 700, fontSize: 14 }}
            >
              Not actually returned
            </Pressable>
            <Pressable
              onClick={onDelete}
              style={{ width: 'auto', padding: '15px 18px', textAlign: 'center', background: color.white, border: `1.5px solid ${color.borderSoft}`, color: color.danger, borderRadius: 999, fontWeight: 700, fontSize: 14 }}
            >
              Delete
            </Pressable>
          </div>
        </>
      ) : receipt.status === 'sent' ? (
        <>
          {/* Gone back, money still to come. The day it went is the one that
              decides whether it was in time, so it is said; and the day worth
              chasing from, so that is said too. */}
          <div style={{ marginTop: 16, padding: 15, background: color.white, border: `1.5px solid ${color.border}`, borderRadius: 16 }}>
            <div style={{ fontWeight: 700 }}>
              Sent back{receipt.sentOn ? ` · ${fmtDateLong(fromISODate(receipt.sentOn))}` : ''}
            </div>
            <div style={{ fontSize: 13, color: color.muted, lineHeight: 1.5, marginTop: 4 }}>
              Waiting for the refund.
              {receipt.sentOn && ` If it has not arrived by ${fmtDateLong(addDays(fromISODate(receipt.sentOn), REFUND_CHASE_DAYS))}, chase it`}
              {receipt.sentOn && (receipt.distance ? ` — for an online order, the shop has ${REFUND_CHASE_DAYS} days from getting it back.` : '.')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <Pressable
              className="k-cta-yellow"
              onClick={onReturn}
              style={{ flex: 1, padding: 16, textAlign: 'center', background: color.yellow, border: `1.5px solid ${color.ink}`, borderRadius: 999, fontWeight: 700, fontSize: 15, boxShadow: shadow.hard }}
            >
              Got my money back
            </Pressable>
            <Pressable
              onClick={onDelete}
              style={{ width: 'auto', padding: '16px 18px', textAlign: 'center', background: color.white, border: `1.5px solid ${color.borderSoft}`, color: color.danger, borderRadius: 999, fontWeight: 700, fontSize: 15 }}
            >
              Delete
            </Pressable>
          </div>
          <Pressable
            className="k-row-white"
            onClick={onUnsend}
            style={{ marginTop: 10, padding: 15, textAlign: 'center', background: color.white, border: `1.5px solid ${color.borderSoft}`, borderRadius: 999, fontWeight: 700, fontSize: 14 }}
          >
            Not sent after all
          </Pressable>
        </>
      ) : receipt.status === 'kept' ? (
        <>
          {/* Settled without a refund. The reminders stop; the rights set out
              above do not, which is the reason to keep the receipt at all. */}
          <div style={{ marginTop: 16, padding: 15, background: color.creamAlt, border: `1.5px solid ${color.border}`, borderRadius: 16 }}>
            <div style={{ fontWeight: 700 }}>
              Keeping it{receipt.keptOn ? ` · since ${fmtDateLong(fromISODate(receipt.keptOn))}` : ''}
            </div>
            <div style={{ fontSize: 13, color: color.muted, lineHeight: 1.5, marginTop: 4 }}>
              No more return reminders. If it turns out to be faulty, your rights above still apply.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <Pressable
              className="k-row-white"
              onClick={onUnkeep}
              style={{ flex: 1, padding: 15, textAlign: 'center', background: color.white, border: `1.5px solid ${color.borderSoft}`, borderRadius: 999, fontWeight: 700, fontSize: 14 }}
            >
              Not keeping it after all
            </Pressable>
            <Pressable
              onClick={onDelete}
              style={{ width: 'auto', padding: '15px 18px', textAlign: 'center', background: color.white, border: `1.5px solid ${color.borderSoft}`, color: color.danger, borderRadius: 999, fontWeight: 700, fontSize: 14 }}
            >
              Delete
            </Pressable>
          </div>
        </>
      ) : (
        <>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <Pressable
            className="k-cta-yellow"
            onClick={onReturn}
            style={{ flex: 1, padding: 16, textAlign: 'center', background: color.yellow, border: `1.5px solid ${color.ink}`, borderRadius: 999, fontWeight: 700, fontSize: 15, boxShadow: shadow.hard }}
          >
            Got my money back
          </Pressable>
          <Pressable
            onClick={onDelete}
            style={{ width: 'auto', padding: '16px 18px', textAlign: 'center', background: color.white, border: `1.5px solid ${color.borderSoft}`, color: color.danger, borderRadius: 999, fontWeight: 700, fontSize: 15 }}
          >
            Delete
          </Pressable>
        </div>
        {/* The two other ends: in the post with the refund to come, and the
            commonest of all, which had no way to be said. */}
        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <Pressable
            className="k-row-white"
            onClick={onSend}
            style={{ flex: '1 1 140px', padding: 15, textAlign: 'center', background: color.white, border: `1.5px solid ${color.borderSoft}`, borderRadius: 999, fontWeight: 700, fontSize: 14 }}
          >
            I’ve sent it back
          </Pressable>
          <Pressable
            className="k-row-white"
            onClick={onKeep}
            style={{ flex: '1 1 140px', padding: 15, textAlign: 'center', background: color.white, border: `1.5px solid ${color.borderSoft}`, borderRadius: 999, fontWeight: 700, fontSize: 14 }}
          >
            I’m keeping it
          </Pressable>
        </div>
        </>
      )}
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
    <div style={{ marginTop: 16, padding: 15, textAlign: 'center', background: color.yellowLight, border: `1.5px solid ${color.ink}`, borderRadius: 16 }}>
      <div style={{ fontWeight: 700 }}>
        Money back · {money(got)} recovered{returnedText ? ` on ${returnedText}` : ''} ✓
      </div>
      {got !== receipt.amount && (
        <div style={{ fontSize: 13, color: color.body, marginTop: 4 }}>of the {money(receipt.amount)} it cost</div>
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
