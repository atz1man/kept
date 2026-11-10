import { useState } from 'react';
import { color, font, radius } from '../../tokens';
import { Pressable } from './Pressable';

/**
 * The order number, one tap from the shop's returns form.
 *
 * "Start your return" opens the shop's own page, and the first thing that
 * page asks for is the order number. It was on this screen as small grey text
 * under the price: to use it a person had to press and hold, drag two handles
 * round a string of digits, copy, and then find their way back to the shop's
 * tab. So it sits directly under the link it is needed for, as one control.
 *
 * Nothing goes with the link itself (`returns-pages.ts` says why); the number
 * travels on the clipboard, by the person's own tap, and nowhere else.
 *
 * A refused copy says so — the clipboard fails on an insecure origin and
 * wherever the permission is withheld, and "Copied" over an empty clipboard
 * is found out at the shop's form. The number stays selectable for that case.
 */
export function OrderRefCopy({ orderRef }: { orderRef: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(orderRef);
      setState('copied');
    } catch {
      setState('failed');
    }
  };

  return (
    <div data-order-copy style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 8px 14px', background: color.surface, border: `1px solid ${color.borderSoft}`, borderRadius: radius.control }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: color.muted }}>Order number</div>
          <div style={{ fontFamily: font.figures, fontSize: 14.5, fontWeight: 600, color: color.ink, userSelect: 'text', overflowWrap: 'anywhere' }}>{orderRef}</div>
        </div>
        <Pressable
          className="k-secondary"
          aria-label={`Copy order number ${orderRef}`}
          onClick={() => void copy()}
          style={{ flex: '0 0 auto', width: 'auto', minHeight: 40, padding: '9px 16px', background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
        >
          Copy
        </Pressable>
      </div>
      <div role="status" aria-live="polite" style={{ fontSize: 12.5, marginTop: 6, minHeight: 18, color: state === 'failed' ? color.danger : color.muted }}>
        {state === 'copied'
          ? 'Copied — paste it into the shop’s form.'
          : state === 'failed'
            ? 'Couldn’t copy here — press and hold the number to select it.'
            : 'The shop’s returns form will ask for this.'}
      </div>
    </div>
  );
}
