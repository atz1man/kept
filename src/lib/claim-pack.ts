import { color } from '../tokens';
import { REFUND_CHASE_DAYS } from './alerts';
import { cancelLetter, cancelledInTime, sendBackBy } from './cancel-notice';
import { addDays, daysBetween, fmtDateLong, fromISODate, toISODate } from './dates';
import { escalation } from './escalate';
import { faultLetter, REPLY_DAYS } from './fault-letter';
import { COOLING_OFF_DAYS, LEGAL_DISCLAIMER, legalRights, PRESUMED_FAULT_MONTHS, presumedFaultEnds, REJECT_DAYS, type LegalRight } from './legal';
import { money } from './money';
import { derive, refundOf } from './receipts';
import { refundChase } from './refund-chase';
import type { Receipt } from './types';

/**
 * The claim pack: everything about one purchase, on one page, for whoever has
 * to be persuaded — the shop's complaints team, the bank for a chargeback, the
 * card company under Section 75, or a small-claims form.
 *
 * Every one of those asks the same questions — what, where, how much, when it
 * came, when you told them, what you asked for — and the answers were spread
 * across one screen's panels, two letters behind two buttons, and the person's
 * memory. Here they are in date order, from the dates the receipt RECORDS.
 *
 * Two kinds of line, kept apart because they are different claims:
 *  - what HAPPENED, which is only ever a date somebody recorded (bought,
 *    arrived, cancelled, reported, sent back, refunded). Nothing here infers
 *    an event from a deadline;
 *  - DEADLINES, which are computed, and say whether they have passed. Where
 *    the arrival day is unknown they are the earliest the right could end,
 *    and marked so, as on every other screen.
 *
 * Built on the phone and never sent anywhere by the app. A pure function of
 * the receipt and the day, like every other rule here, so it can be tested.
 */

export interface PackEvent {
  on: Date;
  label: string;
  detail?: string;
  /** Recorded (it happened) or computed (a deadline). */
  kind: 'happened' | 'deadline';
  /** For a deadline: the day has gone. */
  passed: boolean;
  /** For a deadline: counted from the order because the arrival day is unknown — the earliest it could be. */
  hedged: boolean;
}

/**
 * Where a deadline stands, in the one place it is decided.
 *
 * `unsure` is a hedged date that has gone by: counted from the order because
 * nobody said when the parcel came, it is the EARLIEST the right could end,
 * so its passing proves nothing — a parcel that came later carries the right
 * later. Calling that "passed" told a person a right they may still hold had
 * gone, the one failure legal.ts exists to prevent ("check that date").
 */
export type DeadlineState = 'open' | 'passed' | 'unsure';

export function deadlineState(e: PackEvent): DeadlineState {
  if (!e.passed) return 'open';
  return e.hedged ? 'unsure' : 'passed';
}

/** The chip's words for each. */
export const DEADLINE_WORDS: Record<DeadlineState, string> = {
  open: 'Still open',
  passed: 'Passed',
  unsure: 'Check the arrival date',
};

export interface PackLetter {
  title: string;
  sentOn: Date;
  text: string;
}

export interface ClaimPack {
  title: string;
  store: string;
  item: string;
  amount: string;
  facts: { label: string; value: string }[];
  /** Where it stands, in a sentence or two. */
  standing: string[];
  timeline: PackEvent[];
  rights: LegalRight[];
  letters: PackLetter[];
  escalation: string[];
  disclaimer: string;
  madeOn: Date;
}

const sameDay = (a: string | undefined, b: string) => a !== undefined && a === b;

/** The letters as kept drafted them, and what that is worth. */
export const LETTERS_NOTE =
  'As kept drafted them on the day they were marked sent. If you changed the wording before sending, your own sent copy is the one that counts.';

export function claimPack(r: Receipt, today: Date): ClaimPack {
  const d = derive(r, today);
  const handover = fromISODate(r.arrivedOn ?? r.purchasedOn);
  // Both statutory clocks run from the day it came into the buyer's hands.
  // Unknown for a delivered order nobody has marked arrived: the dates below
  // are then the earliest they could be, and say so.
  const hedged = r.distance && r.arrivedOn === undefined;

  const happened = (on: string, label: string, detail?: string): PackEvent => ({
    on: fromISODate(on), label, detail, kind: 'happened', passed: true, hedged: false,
  });
  const deadline = (on: Date, label: string, detail?: string, isHedged = false): PackEvent => ({
    on, label, detail, kind: 'deadline', passed: daysBetween(today, on) < 0, hedged: isHedged,
  });

  const events: PackEvent[] = [
    happened(r.purchasedOn, r.distance ? 'Ordered' : 'Bought', `${money(r.amount)} at ${r.store}`),
  ];
  if (r.windowStartsOn && !sameDay(r.windowStartsOn, r.purchasedOn)) {
    events.push(happened(r.windowStartsOn, 'The shop’s returns clock started', 'The shop counts its window from this day, not the order.'));
  }
  if (r.arrivedOn && !sameDay(r.arrivedOn, r.purchasedOn)) events.push(happened(r.arrivedOn, 'Arrived'));
  if (r.cancelledOn) events.push(happened(r.cancelledOn, 'Cancellation notice sent'));
  if (r.faultClaim) events.push(happened(r.faultClaim.sentOn, 'Fault reported to the shop', r.faultClaim.what?.trim() || undefined));
  if (r.sentOn) events.push(happened(r.sentOn, 'Sent back', r.returnRef ? `Tracking ${r.returnRef}` : undefined));
  if (r.status === 'returned' && r.returnedOn) {
    const label = r.exchanged ? 'Swapped for another' : r.credit ? 'Refunded as store credit' : 'Refund received';
    events.push(happened(r.returnedOn, label, r.exchanged ? undefined : money(refundOf(r))));
  }
  if (r.credit?.spentOn) events.push(happened(r.credit.spentOn, 'Store credit spent'));
  if (r.status === 'kept' && r.keptOn) events.push(happened(r.keptOn, 'Decided to keep it'));

  events.push(deadline(d.deadline, 'The shop’s own return window closes', `${r.windowDays} days, any reason, on the shop’s terms`));
  if (r.distance) {
    events.push(deadline(addDays(handover, COOLING_OFF_DAYS), 'Last day to cancel for any reason', `${COOLING_OFF_DAYS} days from arrival — Consumer Contracts Regulations 2013`, hedged));
  }
  const sendBack = sendBackBy(r);
  if (sendBack) events.push(deadline(sendBack, 'Last day to send it back after cancelling', 'Regulation 35(4)'));
  events.push(deadline(addDays(handover, REJECT_DAYS), 'Last day to reject a fault for a full refund', `${REJECT_DAYS} days — Consumer Rights Act 2015, s.22`, hedged));
  // The LAST day it holds, like every other deadline here: on 15 July the
  // pack dated it 15 July and called it still open, a day after it had gone.
  events.push(deadline(presumedFaultEnds(handover), 'Last day a fault is presumed there from the start', `${PRESUMED_FAULT_MONTHS} months — Consumer Rights Act 2015, s.19(14)`, hedged));
  if (r.faultClaim) {
    // Our number, not the law's, and labelled as what the letter asked for.
    events.push(deadline(addDays(fromISODate(r.faultClaim.sentOn), REPLY_DAYS), 'Reply asked for by', `The fault letter asked for one within ${REPLY_DAYS} days`));
  }
  const chase = refundChase(r, today);
  if (chase?.statutory) {
    events.push(deadline(chase.due, 'Refund due', `${REFUND_CHASE_DAYS} days — Consumer Contracts Regulations 2013, reg. 34`));
  }
  if (d.warranty && d.warranty.months > 0) events.push(deadline(d.warranty.ends, 'Guarantee ends', `${d.warranty.months} months from purchase`));

  // Date order. On one day, what happened comes before what fell due: every
  // recorded step is pushed above every deadline, and the sort is stable.
  const timeline = events.sort((a, b) => a.on.getTime() - b.on.getTime());

  return {
    title: `Claim pack: ${r.item}`,
    store: r.store,
    item: r.item,
    amount: money(r.amount),
    facts: facts(r, d),
    standing: standing(r, today, d.deadline),
    timeline,
    rights: legalRights(r, today, r.status === 'active' && !d.expired),
    letters: letters(r),
    escalation: escalation(r).lines,
    disclaimer: LEGAL_DISCLAIMER,
    madeOn: today,
  };
}

function facts(r: Receipt, d: ReturnType<typeof derive>): ClaimPack['facts'] {
  const out: ClaimPack['facts'] = [
    { label: 'Shop', value: r.store },
    { label: 'Item', value: r.item },
    { label: 'Price paid', value: money(r.amount) },
    { label: r.distance ? 'Ordered' : 'Bought', value: `${fmtDateLong(fromISODate(r.purchasedOn))}${r.distance ? ', online or by phone' : ', in the shop'}` },
  ];
  if (r.distance || r.arrivedOn) out.push({ label: 'Arrived', value: r.arrivedOn ? fmtDateLong(fromISODate(r.arrivedOn)) : 'Not recorded' });
  if (r.orderRef) out.push({ label: 'Order number', value: r.orderRef });
  if (r.returnRef) out.push({ label: 'Return tracking', value: r.returnRef });
  if (r.status === 'returned' && !r.exchanged) out.push({ label: r.credit ? 'Store credit' : 'Refunded', value: money(refundOf(r)) });
  if (d.warranty && d.warranty.months > 0) out.push({ label: 'Guarantee', value: `${d.warranty.months} months, to ${fmtDateLong(d.warranty.ends)}` });
  if (r.policy.trim()) out.push({ label: 'Shop’s returns policy', value: r.policy.trim() });
  return out;
}

function standing(r: Receipt, today: Date, shopDeadline: Date): string[] {
  const out: string[] = [];
  if (r.cancelledOn) {
    out.push(cancelledInTime(r)
      ? `Cancelled on ${fmtDateLong(fromISODate(r.cancelledOn))}, inside the ${COOLING_OFF_DAYS}-day cancellation period.`
      : `Cancelled on ${fmtDateLong(fromISODate(r.cancelledOn))}.`);
  }
  if (r.sentOn) {
    const margin = daysBetween(fromISODate(r.sentOn), shopDeadline);
    out.push(margin >= 0
      ? `Sent back on ${fmtDateLong(fromISODate(r.sentOn))}, inside the shop’s own ${r.windowDays}-day window.`
      : `Sent back on ${fmtDateLong(fromISODate(r.sentOn))}, after the shop’s own window had closed.`);
  }
  const chase = refundChase(r, today);
  if (chase?.late) out.push(`The refund is late: it was due by ${fmtDateLong(chase.due)} and has not been recorded.`);
  if (r.faultClaim) out.push(`A fault was reported to the shop on ${fmtDateLong(fromISODate(r.faultClaim.sentOn))}.`);
  if (r.status === 'returned') out.push(r.exchanged ? 'Swapped for another; nothing further is owed.' : 'Refunded.');
  return out;
}

function letters(r: Receipt): PackLetter[] {
  const out: PackLetter[] = [];
  if (r.cancelledOn) out.push({ title: 'Cancellation notice', sentOn: fromISODate(r.cancelledOn), text: cancelLetter(r) });
  if (r.faultClaim) {
    // Drafted as of the day it went: the remedy a letter asks for depends on
    // the date, and today's would be a different letter from the one sent.
    const sentOn = fromISODate(r.faultClaim.sentOn);
    const text = faultLetter(r, sentOn, r.faultClaim.what ?? '');
    if (text) out.push({ title: 'Fault letter', sentOn, text });
  }
  return out.sort((a, b) => a.sentOn.getTime() - b.sentOn.getTime());
}

/** Plain text, for the share sheet and the clipboard: a message, an email, a form's box. */
export function claimPackText(p: ClaimPack): string {
  const when = (e: PackEvent) => `${e.hedged ? 'at least ' : ''}${fmtDateLong(e.on)}`;
  return [
    p.title,
    `${p.store} · ${p.amount}`,
    '',
    ...p.facts.map((f) => `${f.label}: ${f.value}`),
    ...(p.standing.length ? ['', 'Where it stands', ...p.standing] : []),
    '',
    'Timeline',
    ...p.timeline.map((e) => `${when(e)} — ${e.label}${e.kind === 'deadline' ? ` (${DEADLINE_WORDS[deadlineState(e)].toLowerCase()})` : ''}${e.detail ? `. ${e.detail}` : ''}`),
    '',
    'Your rights',
    ...p.rights.map((x) => `${x.chip}: ${x.body}`),
    ...p.letters.flatMap((l) => ['', `${l.title}, sent ${fmtDateLong(l.sentOn)}`, LETTERS_NOTE, '', l.text]),
    '',
    'If the shop won’t put it right',
    ...p.escalation,
    '',
    `Made with kept on ${fmtDateLong(p.madeOn)}. ${p.disclaimer}`,
  ].join('\n');
}

/**
 * Text into HTML. The item, the store, the fault in the person's own words and
 * the shop's policy are all typed or pasted — a pasted order email can carry
 * anything — and this page is opened in a browser.
 */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * The pack as one self-contained page, for the file the share sheet sends and
 * the copy saved to Files: no scripts, no fetches, the photo inline, laid out
 * for A4 so "Print → Save as PDF" makes the document a complaints team expects.
 */
export function claimPackHtml(p: ClaimPack, photoBase64: string | null): string {
  const e = escapeHtml;
  const row = (ev: PackEvent) => {
    const state = ev.kind === 'happened' ? 'done' : { open: 'open', passed: 'gone', unsure: 'unsure' }[deadlineState(ev)];
    const tag = ev.kind === 'deadline' ? `<span class="tag ${state}">${e(DEADLINE_WORDS[deadlineState(ev)])}</span>` : '';
    return `<li class="${state}"><time>${ev.hedged ? 'at least ' : ''}${e(fmtDateLong(ev.on))}</time><b>${e(ev.label)}</b>${tag}${ev.detail ? `<small>${e(ev.detail)}</small>` : ''}</li>`;
  };
  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(p.title)}</title>
<style>
@page { size: A4; margin: 16mm; }
body { margin: 0 auto; max-width: 720px; padding: 24px 16px; font: 14px/1.5 system-ui, -apple-system, sans-serif; color: ${color.ink}; background: ${color.white}; }
h1 { font-size: 22px; margin: 0 0 2px; } h2 { font-size: 15px; margin: 26px 0 8px; padding-bottom: 4px; border-bottom: 1px solid ${color.border}; }
.lede { color: ${color.muted}; margin: 0 0 16px; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; } dt { color: ${color.muted}; } dd { margin: 0; overflow-wrap: anywhere; }
ol { list-style: none; margin: 0; padding: 0 0 0 18px; border-left: 2px solid ${color.rail}; }
li { position: relative; margin: 0 0 12px; padding-left: 8px; break-inside: avoid; }
li::before { content: ''; position: absolute; left: -27px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: ${color.accent}; border: 2px solid ${color.white}; }
li.open::before, li.unsure::before { background: ${color.white}; border-color: ${color.accent}; } li.gone::before { background: ${color.fainter}; }
time { display: block; font-size: 12px; color: ${color.muted}; } small { display: block; color: ${color.body}; }
.tag { margin-left: 8px; font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 6px; }
.tag.open, .tag.unsure { background: ${color.accentSoft}; color: ${color.accentInk}; } .tag.gone { background: ${color.surfaceAlt}; color: ${color.muted}; }
.chip { font-weight: 600; } pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; padding: 12px; border: 1px solid ${color.border}; border-radius: 8px; }
img { max-width: 100%; max-height: 520px; border: 1px solid ${color.border}; border-radius: 8px; }
footer { margin-top: 28px; font-size: 12px; color: ${color.muted}; }
</style></head><body>
<h1>${e(p.title)}</h1>
<p class="lede">${e(p.store)} · ${e(p.amount)}</p>
<dl>${p.facts.map((f) => `<dt>${e(f.label)}</dt><dd>${e(f.value)}</dd>`).join('')}</dl>
${p.standing.length ? `<h2>Where it stands</h2>${p.standing.map((s) => `<p>${e(s)}</p>`).join('')}` : ''}
<h2>Timeline</h2><ol>${p.timeline.map(row).join('')}</ol>
<h2>Your rights</h2>${p.rights.map((x) => `<p><span class="chip">${e(x.chip)}.</span> ${e(x.body)}</p>`).join('')}
${p.letters.length ? `<h2>Letters sent</h2><p class="lede">${e(LETTERS_NOTE)}</p>${p.letters.map((l) => `<h3>${e(l.title)}, sent ${e(fmtDateLong(l.sentOn))}</h3><pre>${e(l.text)}</pre>`).join('')}` : ''}
${photoBase64 ? `<h2>Proof of purchase</h2><img alt="Photo of the receipt" src="data:image/jpeg;base64,${photoBase64.replace(/[^A-Za-z0-9+/=]/g, '')}">` : ''}
<h2>If the shop won’t put it right</h2>${p.escalation.map((s) => `<p>${e(s)}</p>`).join('')}
<footer>Made with kept on ${e(fmtDateLong(p.madeOn))}. ${e(p.disclaimer)}</footer>
</body></html>
`;
}

/** "kept-claim-sony-2026-10-04.html" — the shop and the day, so two packs do not collide. */
export function claimPackFilename(r: Receipt, today: Date): string {
  const slug = r.store.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
  return `kept-claim-${slug || 'receipt'}-${toISODate(today)}.html`;
}
