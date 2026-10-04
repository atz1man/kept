import type { CSSProperties } from 'react';
import { color, radius } from '../../tokens';
import { PURCHASES_OFF, type StoreNote, type StoreView } from '../../lib/app-store';
import { unlockLabel, type Offer } from '../../lib/pricing';
import { Pressable } from './Pressable';

/**
 * The button that sells the unlock, wherever the app offers it: Settings, and
 * the add screen at the cap. One component, so the two cannot come to say
 * different things.
 *
 * On the web it opens the sheet that says nothing is charged. On iPhone it
 * opens the App Store's own sheet. Around it are what a one-off purchase owes
 * the person buying it, and what App Review looks for:
 * - the App Store's price for their storefront;
 * - a way to restore it;
 * - words for every way it can end.
 */
export function UnlockOffer({
  offer,
  store,
  onUnlock,
  onRestore,
  buttonStyle,
}: {
  offer: Exclude<Offer, { kind: 'none' }>;
  store: StoreView;
  onUnlock: () => void;
  onRestore: () => void;
  buttonStyle?: CSSProperties;
}) {
  const appStore = offer.kind === 'app-store';
  const waiting = store.busy !== null;
  return (
    <>
      {appStore && !offer.canPay ? (
        // No button where pressing it can only be refused: say why, and where
        // it can be changed, instead.
        <div style={{ marginTop: 14, fontSize: 13, color: color.body, lineHeight: 1.55 }}>{PURCHASES_OFF}</div>
      ) : (
        <Pressable
          className="k-primary"
          onClick={onUnlock}
          disabled={waiting}
          aria-busy={store.busy === 'buying'}
          style={{
            display: 'block', width: '100%', marginTop: 16, padding: 14, minHeight: 44, textAlign: 'center',
            background: color.accent, color: color.white, border: 0, borderRadius: radius.control,
            fontWeight: 600, fontSize: 15, opacity: waiting ? 0.7 : 1,
            ...buttonStyle,
          }}
        >
          {store.busy === 'buying' ? 'Waiting for the App Store…' : unlockLabel(offer.price)}
        </Pressable>
      )}
      {appStore && (
        <>
          {/* Always in the page, so what it says is announced when it changes:
              a live region added at the same moment as its text often is not. */}
          <div role="status">{store.note && <Note note={store.note} />}</div>
          <Pressable
            onClick={onRestore}
            disabled={waiting}
            aria-busy={store.busy === 'restoring'}
            style={{
              display: 'block', width: '100%', minHeight: 44, marginTop: 4, background: 'transparent', border: 0,
              color: color.accentInk, fontWeight: 600, fontSize: 13, textAlign: 'center', opacity: waiting ? 0.7 : 1,
            }}
          >
            {store.busy === 'restoring' ? 'Asking the App Store…' : 'Restore purchase'}
          </Pressable>
        </>
      )}
    </>
  );
}

const TONES: Record<StoreNote['tone'], { background: string; color: string }> = {
  ok: { background: color.accentSoft, color: color.ink },
  wait: { background: color.caution, color: color.cautionInk },
  bad: { background: color.dangerChipBg, color: color.danger },
};

/** What the App Store's answer means, said once, where the person pressed. */
export function Note({ note }: { note: StoreNote }) {
  return (
    <div
      data-store-note={note.tone}
      style={{ marginTop: 10, padding: '10px 13px', borderRadius: 12, fontSize: 12.5, fontWeight: 600, lineHeight: 1.5, ...TONES[note.tone] }}
    >
      {note.text}
    </div>
  );
}
