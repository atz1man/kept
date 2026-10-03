import { useEffect, useRef } from 'react';
import { color, font, radius, shadow } from '../../tokens';
import { UNLOCK } from '../../lib/pricing';
import { Pressable } from './Pressable';

/**
 * What a tap on a price actually does, said out loud before it does it.
 *
 * Tapping a price used to flip the plan to pro on the spot — no card, no
 * confirmation, no word about either. Someone taps the price, the paywall
 * vanishes, and the only reading available to them is that they were charged
 * it. Nothing was charged: payments are not built. An app that
 * shows a price, accepts a tap and then behaves as though money changed hands
 * is making a claim about somebody's bank account, and it is a false one.
 *
 * So the sheet leads with the fact that costs money to get wrong — no card,
 * nothing taken — and only then offers the unlock, which is real. The price
 * is named, because "what did I just press" is the next question and the
 * answer should not require closing this to go and look.
 */
export function UpgradeNotice({ onUnlock, onCancel }: { onUnlock: () => void; onCancel: () => void }) {
  const sheet = useRef<HTMLDivElement>(null);

  // Focus moves into the sheet, and Escape closes it. Without both, a keyboard
  // or screen-reader user is told nothing has appeared and cannot leave it.
  // Once, when the sheet opens. With `onCancel` — a fresh arrow from App on
  // every render — as a dependency, every App render moved keyboard focus back
  // to the first button, out from under whoever was reading the sheet.
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  useEffect(() => {
    sheet.current?.querySelector('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end',
        justifyContent: 'center', background: 'rgba(20,22,26,0.55)', padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upg-title"
        className="k-fade"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: color.white, borderRadius: radius.heroLg, border: `1px solid ${color.border}`,
          boxShadow: shadow.raisedLg, padding: '22px 20px 20px', width: '100%', maxWidth: 420,
          marginBottom: 'calc(84px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <h2 id="upg-title" style={{ fontFamily: font.display, fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>
          Nothing has been charged
        </h2>
        <p style={{ fontSize: 14, color: color.body, lineHeight: 1.6, margin: '10px 0 0' }}>
          kept cannot take payments yet — there is no card box, no {UNLOCK.price} leaving your account, and nothing to
          cancel later. {UNLOCK.price}, once, is what it is <em>meant</em> to cost.
        </p>
        <p style={{ fontSize: 14, color: color.body, lineHeight: 1.6, margin: '10px 0 0' }}>
          You can unlock everything now anyway, for free, and keep it.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 18 }}>
          <Pressable
            className="k-primary"
            onClick={onUnlock}
            style={{ padding: 13, textAlign: 'center', background: color.accent, color: color.white, border: 0, borderRadius: radius.control, fontWeight: 600, fontSize: 15 }}
          >
            Unlock everything, free
          </Pressable>
          <Pressable
            onClick={onCancel}
            style={{ padding: 12, textAlign: 'center', background: 'transparent', color: color.muted, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
          >
            Not now
          </Pressable>
        </div>
      </div>
    </div>
  );
}
