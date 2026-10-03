import { useState } from 'react';
import { color, radius } from '../../tokens';
import { cancelLetter, cancelOffered, sendBackBy } from '../../lib/cancel-notice';
import { fmtDate, fmtDateLong, fromISODate } from '../../lib/dates';
import { LEGAL_DISCLAIMER } from '../../lib/legal';
import type { Receipt } from '../../lib/types';
import { Letter } from './Letter';
import { Pressable } from './Pressable';

/**
 * "Cancel the order" — for an online order, in writing, inside the fourteen
 * days — and, once it has gone, the day it has to be sent back by.
 *
 * Closed until asked for, as the fault panel is: most orders are returned
 * through the shop's own page, and this is for the ones that are not, or
 * where the dates are going to matter.
 */
export function CancelPanel({ receipt, today, onSent, onUnsent }: {
  receipt: Receipt;
  today: Date;
  onSent: () => void;
  onUnsent: () => void;
}) {
  const [open, setOpen] = useState(false);
  const offered = cancelOffered(receipt, today);
  const by = sendBackBy(receipt);
  if (!offered && !by) return null;

  return (
    <div style={{ background: color.white, border: `1px solid ${color.border}`, borderRadius: radius.cardLg, marginTop: 12, padding: '15px 18px' }}>
      <Pressable
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontWeight: 600, fontSize: 15 }}
      >
        <span>{by ? 'Order cancelled' : 'Cancel the order in writing'}</span>
        <svg width="10" height="7" viewBox="0 0 10 7" style={{ flexShrink: 0, transform: `rotate(${open ? 180 : 0}deg)`, transition: 'transform .2s' }} aria-hidden="true">
          <path d="M1 1.5l4 4 4-4" fill="none" stroke={color.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Pressable>

      {open && (
        <div data-cancel-panel>
          {by && receipt.cancelledOn ? (
            <div data-cancel-sent style={{ marginTop: 12, padding: 12, background: color.surfaceAlt, border: `1px solid ${color.borderHair}`, borderRadius: 10, fontSize: 13.5, lineHeight: 1.5, color: color.body }}>
              Cancelled on {fmtDateLong(fromISODate(receipt.cancelledOn))}. Send it back by {fmtDateLong(by)} — the law gives
              fourteen days from cancelling.
            </div>
          ) : (
            offered && (
              <>
                <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 10, color: color.muted }}>
                  Cancelling is telling the shop, before {offered.hedged ? 'at least ' : ''}
                  {fmtDate(offered.ends)}. Sending it back comes after, with fourteen days of its own. A return started on the
                  shop’s own website usually counts as telling them; this is the notice in writing, for when it matters.
                </div>
                <Letter letter={cancelLetter(receipt)} title={`Cancellation: ${receipt.item}`} receipt={receipt} />
              </>
            )
          )}
          <Pressable
            className="k-row-white"
            onClick={() => (by ? onUnsent() : onSent())}
            style={{ marginTop: 10, padding: 13, textAlign: 'center', borderRadius: radius.control, fontWeight: 600, fontSize: 14, background: color.white, border: `1px solid ${color.borderSoft}` }}
          >
            {by ? 'Not sent after all' : 'I’ve sent the notice'}
          </Pressable>
          <div style={{ fontSize: 12, marginTop: 10, color: color.muted }}>{LEGAL_DISCLAIMER}</div>
        </div>
      )}
    </div>
  );
}
