import { useState } from 'react';
import { color, radius } from '../../tokens';
import { faultAdvice, faultLetter } from '../../lib/fault-letter';
import { LEGAL_DISCLAIMER } from '../../lib/legal';
import type { Receipt } from '../../lib/types';
import { Field, inputStyle } from './Field';
import { Pressable } from './Pressable';

/**
 * "Something wrong with it?" — what the law gives today, and the letter that
 * asks for it. Closed until asked for: most receipts never break, and a panel
 * about faults on every one would read as the app expecting them to.
 *
 * The letter is built as the person types and never sent anywhere by the app.
 * Copy puts it on the clipboard; Share hands it to the phone's own sheet
 * (mail, a message, notes), where one exists.
 */
export function FaultPanel({ receipt, today }: { receipt: Receipt; today: Date }) {
  const [open, setOpen] = useState(false);
  const [whatsWrong, setWhatsWrong] = useState('');
  const [said, setSaid] = useState<'no' | 'copied' | 'shared' | 'failed'>('no');
  const advice = faultAdvice(receipt, today);
  const letter = faultLetter(receipt, today, whatsWrong);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    if (!letter) return;
    try {
      await navigator.clipboard.writeText(letter);
      setSaid('copied');
    } catch {
      setSaid('failed');
    }
  };
  const share = async () => {
    if (!letter) return;
    try {
      await navigator.share({ title: `Faulty goods: ${receipt.item}`, text: letter });
      setSaid('shared');
    } catch (e) {
      // A closed sheet is the person changing their mind, not a failure.
      if ((e as Error)?.name !== 'AbortError') setSaid('failed');
    }
  };

  const button = {
    flex: 1, padding: 13, textAlign: 'center', borderRadius: 999, fontWeight: 700, fontSize: 14,
  } as const;

  return (
    <div style={{ background: color.white, border: `1.5px solid ${color.border}`, borderRadius: radius.cardLg, marginTop: 12, padding: '15px 18px' }}>
      <Pressable
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontWeight: 700, fontSize: 15 }}
      >
        <span>Something wrong with it?</span>
        <svg width="10" height="7" viewBox="0 0 10 7" style={{ flexShrink: 0, transform: `rotate(${open ? 180 : 0}deg)`, transition: 'transform .2s' }} aria-hidden="true">
          <path d="M1 1.5l4 4 4-4" fill="none" stroke={color.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Pressable>

      {open && (
        <div data-fault-panel>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 12, color: color.bodyStrong }}>{advice.headline}</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 4, color: color.muted }}>{advice.explain}</div>

          {letter && (
            <>
              <Field id="fault-what" label="What’s wrong with it?" hint="Optional. In your own words — it goes into the letter as written.">
                {(p) => (
                  <textarea
                    {...p}
                    rows={3}
                    value={whatsWrong}
                    onChange={(e) => {
                      setWhatsWrong(e.target.value);
                      setSaid('no');
                    }}
                    style={{ ...inputStyle(false), resize: 'vertical', minHeight: 72 }}
                  />
                )}
              </Field>

              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.6px', color: color.muted, marginTop: 14, marginBottom: 6 }}>
                THE LETTER
              </div>
              <div
                aria-label="The letter"
                style={{
                  whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 13.5, lineHeight: 1.5, padding: 14,
                  background: color.creamAlt, border: `1.5px solid ${color.borderHair}`, borderRadius: 12, color: color.body,
                  userSelect: 'text',
                }}
              >
                {letter}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <Pressable
                  className="k-cta-yellow"
                  onClick={() => void copy()}
                  style={{ ...button, background: color.yellow, border: `1.5px solid ${color.ink}`, color: color.ink }}
                >
                  {said === 'copied' ? 'Copied ✓' : 'Copy the letter'}
                </Pressable>
                {canShare && (
                  <Pressable
                    className="k-row-white"
                    onClick={() => void share()}
                    style={{ ...button, background: color.white, border: `1.5px solid ${color.borderSoft}` }}
                  >
                    {said === 'shared' ? 'Shared ✓' : 'Share'}
                  </Pressable>
                )}
              </div>
              {said === 'failed' && (
                <div role="status" style={{ fontSize: 12.5, marginTop: 8, color: color.danger, fontWeight: 600 }}>
                  That did not work here. Select the letter above and copy it instead.
                </div>
              )}
            </>
          )}
          <div style={{ fontSize: 12, marginTop: 10, color: color.muted }}>{LEGAL_DISCLAIMER}</div>
        </div>
      )}
    </div>
  );
}
