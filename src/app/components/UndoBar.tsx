import { useEffect, useRef } from 'react';
import { color, shadow } from '../../tokens';
import { Pressable } from './Pressable';

/** Long enough to notice and reach, short enough not to linger. */
const DISMISS_AFTER_MS = 8000;

/**
 * The way back from a delete.
 *
 * Delete was one tap, immediate, and the only action in the app with no
 * recovery — on a screen you reach by tapping a row, next to a button you
 * might have been aiming for. A backup is not an undo.
 *
 * A timed offer rather than a confirmation dialog: confirmations tax every
 * deliberate delete to catch the rare accidental one, and this app's whole
 * posture is getting out of the way.
 */
export function UndoBar({ label, onUndo, onDismiss }: { label: string; onUndo: () => void; onDismiss: () => void }) {
  /*
   * The latest callback, read when the timer fires — NOT a dependency of it.
   * App passes a fresh arrow on every render, so with `onDismiss` in the
   * dependency list every App render restarted the eight seconds: a feed
   * landing, an alert recorded, another tab syncing, and the bar outstayed its
   * window indefinitely. A second delete still gets its own full window: App
   * keys this component by the receipt it offers back.
   */
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    const t = setTimeout(() => dismiss.current(), DISMISS_AFTER_MS);
    return () => clearTimeout(t);
  }, [label]);

  return (
    <div
      role="status"
      style={{
        position: 'absolute',
        // Clear of the floating tab bar, which sits at bottom 24 and is 63 tall.
        // Rides above the tab bar, so it has to move with it. See TabBar.
        bottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
        left: 16,
        right: 16,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px 12px 16px',
        background: color.ink,
        color: color.canvas,
        border: `1px solid ${color.border}`,
        borderRadius: 16,
        boxShadow: shadow.lift,
      }}
      className="k-fade"
    >
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, minWidth: 0 }}>{label}</span>
      <Pressable
        onClick={onUndo}
        style={{
          width: 'auto', flexShrink: 0, padding: '7px 14px', borderRadius: 999,
          background: color.accent, color: color.white, fontWeight: 700, fontSize: 13,
        }}
      >
        Undo
      </Pressable>
    </div>
  );
}
