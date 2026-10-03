import { useState } from 'react';
import { color, font, radius, shadow } from '../../tokens';
import { winCardLine } from '../win-card';
import { money, type Pence } from '../../lib/money';
import { LogoChecked } from '../components/Icons';
import { Pressable } from '../components/Pressable';
import { RefundForm } from '../components/RefundForm';

interface Props {
  /** What came back — the price, unless it has been said to be less. */
  amount: Pence;
  /** What it cost. */
  cost: Pence;
  store: string;
  /**
   * Whether the shop's own window was still open when this was marked
   * returned. The line below asserted it unconditionally, and the button that
   * leads here is offered on any active receipt — so a refund won AFTER the
   * window, which is the harder one and the one most worth celebrating, was
   * congratulated with a sentence that was not true.
   */
  inTime: boolean;
  recovered: Pence;
  shared: 'no' | 'shared' | 'copied' | 'failed';
  /** The sentence itself, so a failed copy can still be read and selected. */
  line: string;
  onShare: () => void;
  onSetRefund: (pence: number | null) => void;
  onDone: () => void;
  /**
   * The return's undo offer is floating over the foot of the screen. It
   * always is, for its first eight seconds: it rides above the tab bar and
   * covered "Back to receipts" on a short phone.
   */
  undoShowing?: boolean;
}

export function Celebrate({ amount, cost, store, inTime, recovered, shared, line, onShare, onSetRefund, onDone, undoShowing = false }: Props) {
  const [correcting, setCorrecting] = useState(false);
  return (
    // Bottom padding clears the floating tab bar. The design drew this screen
    // with the same 40px inset every full-bleed screen has, which puts "Back to
    // receipts" underneath the bar — visible, and unclickable.
    // Scrolls, like every other screen: it was sized to fit exactly, and the
    // refund form opening under the card pushed its own buttons beneath the
    // tab bar with no way to reach them. The middle grows to centre the card
    // and never shrinks below its content.
    <div className="k-fade" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: `6px 20px ${undoShowing ? 196 : 104}px` }}>
      <div style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ background: color.white, color: color.ink, borderRadius: radius.heroLg, padding: '28px 24px', border: `1px solid ${color.borderHair}`, boxShadow: shadow.raisedLg, position: 'relative', overflow: 'hidden' }}>
          <LogoChecked />
          <h1 tabIndex={-1} style={{ fontSize: 14, color: color.muted, fontWeight: 600, margin: '14px 0 0' }}>
            Money back
          </h1>
          <div style={{ fontFamily: font.figures, fontSize: 52, fontWeight: 600, letterSpacing: '-2px', color: color.accentInk, marginTop: 4 }}>
            {money(amount)}
          </div>
          {amount !== cost && (
            <div style={{ fontFamily: font.figures, fontSize: 13.5, color: color.muted, marginTop: 2 }}>of the {money(cost)} it cost</div>
          )}
          <div style={{ fontSize: 15, color: color.body, marginTop: 8 }}>
            {winCardLine(store, inTime)}
          </div>
          <div style={{ borderTop: `1px solid ${color.borderHair}`, marginTop: 20, paddingTop: 14, display: 'flex', justifyContent: 'space-between', fontFamily: font.figures, fontSize: 13 }}>
            <span style={{ color: color.muted }}>Kept back so far</span>
            <span style={{ color: color.accentInk, fontWeight: 600 }}>{money(recovered)}</span>
          </div>
        </div>
        {/* Before the share, not after it: the figure on the card is the one
            the share sends. The one-tap return records the whole price, which
            is wrong for the common partial case — and this screen is where
            the figure is read. */}
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          {!correcting ? (
            <Pressable
              onClick={() => setCorrecting(true)}
              style={{ display: 'inline-flex', width: 'auto', minHeight: 44, alignItems: 'center', fontSize: 13.5, fontWeight: 600, textDecoration: 'underline', color: color.bodyStrong }}
            >
              {amount !== cost ? 'Change the amount' : `Not the full ${money(cost)}?`}
            </Pressable>
          ) : (
            <RefundForm id="celebrate-refund" cost={cost} current={amount} onSet={onSetRefund} onClose={() => setCorrecting(false)} />
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Pressable
          className="k-primary"
          onClick={onShare}
          style={{ padding: 13, textAlign: 'center', background: color.accent, color: color.white, border: 0, borderRadius: radius.control, fontWeight: 600, fontSize: 15, boxShadow: shadow.raised }}
        >
          {shared === 'shared'
            ? 'Shared ✓'
            : shared === 'copied'
              ? 'Copied — paste it anywhere ✓'
              : shared === 'failed'
                ? 'Copy it from here'
                : 'Share'}
        </Pressable>
        {/* A refused clipboard used to render as "Copied ✓". It fails on any
            insecure origin and wherever the permission is denied, and the
            person found out by pasting nothing into a message. The sentence
            itself is the honest fallback: it is right there to select. */}
        {shared === 'failed' && (
          <p
            role="status"
            style={{
              margin: 0, padding: '12px 14px', background: color.white, border: `1px solid ${color.border}`,
              borderRadius: 12, fontSize: 13.5, lineHeight: 1.5, color: color.bodyStrong, userSelect: 'all',
            }}
          >
            {line}
          </p>
        )}
        <Pressable onClick={onDone} style={{ padding: 13, textAlign: 'center', fontWeight: 600, fontSize: 14, color: color.muted }}>
          Back to receipts
        </Pressable>
      </div>
    </div>
  );
}
