import { useState } from 'react';
import { color, radius } from '../../tokens';
import { faultAdvice, faultLetter, finalRejectLetter, REPLY_DAYS } from '../../lib/fault-letter';
import { addDays, daysBetween, fmtDateLong, fromISODate } from '../../lib/dates';
import { LEGAL_DISCLAIMER } from '../../lib/legal';
import type { Receipt } from '../../lib/types';
import { Field, inputStyle } from './Field';
import { Escalation } from './Escalation';
import { Letter } from './Letter';
import { Pressable } from './Pressable';

/**
 * "Something wrong with it?" — what the law gives today, and the letter that
 * asks for it. Closed until asked for: most receipts never break, and a panel
 * about faults on every one would read as the app expecting them to.
 *
 * The letter is built as the person types; `Letter` is how it leaves.
 */
export function FaultPanel({ receipt, today, onSent, onUnsent, onFinalSent, onFinalUnsent }: {
  receipt: Receipt;
  today: Date;
  /** The letter has gone, with the words it carried. */
  onSent: (what: string) => void;
  onUnsent: () => void;
  /** The final rejection has gone, with the words it carried. */
  onFinalSent: (what: string) => void;
  onFinalUnsent: () => void;
}) {
  const claim = receipt.faultClaim;
  const [open, setOpen] = useState(false);
  const [whatsWrong, setWhatsWrong] = useState(claim?.what ?? '');
  const advice = faultAdvice(receipt, today);
  const letter = faultLetter(receipt, today, whatsWrong);
  // After the repair or replacement, if it did not work: the next letter.
  const finalSent = claim?.finalReject;
  // Open already once it has gone: what was sent, and when, is the answer.
  const [stillWrong, setStillWrong] = useState(!!finalSent);
  const [nowWrong, setNowWrong] = useState(finalSent?.what ?? '');
  const followUp = finalRejectLetter(receipt, today, nowWrong);

  return (
    <div style={{ background: color.surfaceAlt, borderRadius: radius.cardLg, marginTop: 12, padding: '15px 18px' }}>
      <Pressable
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontWeight: 600, fontSize: 15 }}
      >
        <span>{claim ? 'Fault letter sent' : 'Something wrong with it?'}</span>
        <svg width="10" height="7" viewBox="0 0 10 7" style={{ flexShrink: 0, transform: `rotate(${open ? 180 : 0}deg)`, transition: 'transform .2s' }} aria-hidden="true">
          <path d="M1 1.5l4 4 4-4" fill="none" stroke={color.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Pressable>

      {open && (
        <div data-fault-panel>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 12, color: color.bodyStrong }}>{advice.headline}</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 4, color: color.muted }}>{advice.explain}</div>

          {/* Once it has gone: when, and the reply the letter itself asked for.
              The fortnight is the letter's ask, not the law's. */}
          {claim && (
            <div data-fault-sent style={{ marginTop: 12, padding: 12, background: color.surfaceAlt, border: `1px solid ${color.borderHair}`, borderRadius: 10, fontSize: 13.5, lineHeight: 1.5, color: color.body }}>
              Sent on {fmtDateLong(fromISODate(claim.sentOn))}, asking {receipt.store} to reply by{' '}
              {fmtDateLong(addDays(fromISODate(claim.sentOn), REPLY_DAYS))}.
              {daysBetween(fromISODate(claim.sentOn), today) >= REPLY_DAYS &&
                ' No reply yet? Citizens Advice’s consumer service can tell you what to do next.'}
              {daysBetween(fromISODate(claim.sentOn), today) >= REPLY_DAYS && <Escalation receipt={receipt} />}
            </div>
          )}
          {followUp && (
            <div style={{ marginTop: 10 }}>
              <Pressable
                onClick={() => setStillWrong((v) => !v)}
                aria-expanded={stillWrong}
                style={{ display: 'inline-flex', width: 'auto', minHeight: 44, alignItems: 'center', fontSize: 13.5, fontWeight: 600, textDecoration: 'underline' }}
              >
                It was repaired or replaced, and it’s still not right
              </Pressable>
              {stillWrong && (
                <div data-final-reject>
                  <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 4, color: color.muted }}>
                    After one repair or one replacement that has not fixed it, you can reject it for a refund — the final
                    right to reject (section 24).
                  </div>
                  <Field id="fault-still" label="What’s wrong with it now?" hint="Optional. It goes into the letter as written.">
                    {(p) => (
                      <textarea
                        {...p}
                        rows={2}
                        value={nowWrong}
                        onChange={(e) => setNowWrong(e.target.value)}
                        style={{ ...inputStyle(false), resize: 'vertical', minHeight: 56 }}
                      />
                    )}
                  </Field>
                  {/* Named apart from the first letter, which is on screen below it. */}
                  <Letter letter={followUp} title={`Final right to reject: ${receipt.item}`} receipt={receipt} name="final rejection letter" />
                  {finalSent && (
                    <div data-final-reject-sent style={{ marginTop: 12, padding: 12, background: color.surfaceAlt, border: `1px solid ${color.borderHair}`, borderRadius: 10, fontSize: 13.5, lineHeight: 1.5, color: color.body }}>
                      Final rejection sent on {fmtDateLong(fromISODate(finalSent.sentOn))}, asking {receipt.store} to reply by{' '}
                      {fmtDateLong(addDays(fromISODate(finalSent.sentOn), REPLY_DAYS))}.
                      {daysBetween(fromISODate(finalSent.sentOn), today) >= REPLY_DAYS &&
                        ' No reply yet? Citizens Advice’s consumer service can tell you what to do next.'}
                    </div>
                  )}
                  {/* Neither name contains the first letter's ("I’ve sent the
                      letter", "Not sent after all"): both pairs can be on
                      screen at once, and each must be found on its own. */}
                  <Pressable
                    className="k-row-white k-secondary"
                    onClick={() => (finalSent ? onFinalUnsent() : onFinalSent(nowWrong))}
                    style={{ marginTop: 10, padding: 13, textAlign: 'center', borderRadius: radius.control, fontWeight: 600, fontSize: 14, background: color.surface, border: `1px solid ${color.borderSoft}` }}
                  >
                    {finalSent ? 'Final rejection wasn’t sent' : 'I’ve sent the final rejection'}
                  </Pressable>
                </div>
              )}
            </div>
          )}
          {letter && (
            <>
              <Field id="fault-what" label="What’s wrong with it?" hint="Optional. In your own words — it goes into the letter as written.">
                {(p) => (
                  <textarea
                    {...p}
                    rows={3}
                    value={whatsWrong}
                    onChange={(e) => setWhatsWrong(e.target.value)}
                    style={{ ...inputStyle(false), resize: 'vertical', minHeight: 72 }}
                  />
                )}
              </Field>

              <Letter letter={letter} title={`Faulty goods: ${receipt.item}`} receipt={receipt} />
              <Pressable
                className="k-row-white k-secondary"
                onClick={() => (claim ? onUnsent() : onSent(whatsWrong))}
                style={{ marginTop: 10, padding: 13, textAlign: 'center', borderRadius: radius.control, fontWeight: 600, fontSize: 14, background: color.surface, border: `1px solid ${color.borderSoft}` }}
              >
                {claim ? 'Not sent after all' : 'I’ve sent the letter'}
              </Pressable>
            </>
          )}
          <div style={{ fontSize: 12, marginTop: 10, color: color.muted }}>{LEGAL_DISCLAIMER}</div>
        </div>
      )}
    </div>
  );
}
