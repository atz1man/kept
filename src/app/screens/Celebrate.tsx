import { useState } from 'react';
import { category, color, font, gradient, radius, shadow } from '../../tokens';
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


/**
 * The dots that leave the tick, once: ten, evenly round a circle, in the
 * category inks and the accent — the colours the list already wears, so the
 * moment belongs to the same app rather than to a confetti library.
 */
const BURST = (() => {
  // The category TINTS, on the hero's gradient: the light half of each pair is what reads on indigo.
  const fills = [color.white, category.audio.tint, category.kitchen.tint, category.clothing.tint, category.beauty.tint, category.furniture.tint];
  return Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    const r = i % 2 ? 40 : 58;
    return { dx: Math.round(Math.cos(a) * r), dy: Math.round(Math.sin(a) * r), fill: fills[i % fills.length] };
  });
})();

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
        {/* The money arriving, drawn as the home screen draws the balance: the
            hero's gradient, declared at its lightest stop so the contrast
            sweep measures every word here where white is weakest. */}
        <div style={{ backgroundColor: color.heroEnd, backgroundImage: gradient.hero, color: color.white, borderRadius: radius.heroLg, padding: '28px 24px', boxShadow: shadow.lift, position: 'relative', overflow: 'hidden' }}>
          <span style={{ position: 'relative', display: 'inline-block' }}>
            <span className="k-pop" style={{ display: 'inline-block' }}><LogoChecked /></span>
            {BURST.map(({ dx, dy, fill }, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="k-burst"
                style={{
                  position: 'absolute', left: 'calc(50% - 4px)', top: 'calc(50% - 4px)', width: 8, height: 8,
                  borderRadius: radius.pill, background: fill, pointerEvents: 'none',
                  ['--dx' as string]: `${dx}px`, ['--dy' as string]: `${dy}px`,
                }}
              />
            ))}
          </span>
          <h1 tabIndex={-1} style={{ fontSize: 14.5, color: color.onHeroSoft, fontWeight: 600, margin: '14px 0 0' }}>
            Money back
          </h1>
          <div style={{ fontFamily: font.figures, fontSize: 56, fontWeight: 700, letterSpacing: '-0.05em', color: color.white, marginTop: 4, lineHeight: 1.05 }}>
            {money(amount)}
          </div>
          {amount !== cost && (
            <div style={{ fontFamily: font.figures, fontSize: 13.5, color: color.onHeroSoft, marginTop: 2 }}>of the {money(cost)} it cost</div>
          )}
          <div style={{ fontSize: 15.5, fontWeight: 500, color: color.white, marginTop: 10 }}>
            {winCardLine(store, inTime)}
          </div>
          <div style={{ borderTop: `1px solid ${color.onInkBorderStrong}`, marginTop: 20, paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: font.figures, fontSize: 13.5 }}>
            <span style={{ color: color.onHeroSoft }}>Kept back so far</span>
            <span style={{ color: color.white, fontWeight: 700, fontSize: 16 }}>{money(recovered)}</span>
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
