import { useState } from 'react';
import { color, radius } from '../../tokens';
import { faultAdvice, faultLetter } from '../../lib/fault-letter';
import { LEGAL_DISCLAIMER } from '../../lib/legal';
import type { Receipt } from '../../lib/types';
import { Field, inputStyle } from './Field';
import { Letter } from './Letter';
import { Pressable } from './Pressable';

/**
 * "Something wrong with it?" — what the law gives today, and the letter that
 * asks for it. Closed until asked for: most receipts never break, and a panel
 * about faults on every one would read as the app expecting them to.
 *
 * The letter is built as the person types; `Letter` is how it leaves.
 */
export function FaultPanel({ receipt, today }: { receipt: Receipt; today: Date }) {
  const [open, setOpen] = useState(false);
  const [whatsWrong, setWhatsWrong] = useState('');
  const advice = faultAdvice(receipt, today);
  const letter = faultLetter(receipt, today, whatsWrong);

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
                    onChange={(e) => setWhatsWrong(e.target.value)}
                    style={{ ...inputStyle(false), resize: 'vertical', minHeight: 72 }}
                  />
                )}
              </Field>

              <Letter letter={letter} title={`Faulty goods: ${receipt.item}`} receipt={receipt} />
            </>
          )}
          <div style={{ fontSize: 12, marginTop: 10, color: color.muted }}>{LEGAL_DISCLAIMER}</div>
        </div>
      )}
    </div>
  );
}
