import type { CSSProperties } from 'react';
import { color, radius } from '../../tokens';
import { PURCHASES_OFF, type PlanId, type StoreNote, type StoreView } from '../../lib/app-store';
import { planLabel, RENEWAL_TERMS, TERMS_OF_USE_URL, type Offer } from '../../lib/pricing';
import { Pressable } from './Pressable';

/**
 * The buttons that sell Plus, wherever the app offers it: Settings, and the
 * add screen at the cap. One component, so the two cannot come to say
 * different things.
 *
 * One button per plan, the yearly first and filled. On the web each opens the
 * sheet that says nothing is charged. On iPhone each opens the App Store's
 * own sheet, and around them is what an auto-renewing subscription owes the
 * person buying it, and what App Review looks for (Guideline 3.1.2):
 * - each plan's name, period and the App Store's price for their storefront;
 * - that it renews until cancelled, and how to cancel;
 * - the terms of use and the privacy policy, a tap away;
 * - a way to restore it, and words for every way a purchase can end.
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
  onUnlock: (plan: PlanId) => void;
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
        <div style={{ display: 'grid', gap: 8, marginTop: 16, ...buttonStyle }}>
          {offer.plans.map((plan, i) => (
            <Pressable
              key={plan.id}
              className={i === 0 ? 'k-primary' : undefined}
              onClick={() => onUnlock(plan.id)}
              disabled={waiting}
              aria-busy={store.busy === 'buying'}
              style={{
                padding: 13, minHeight: 44, textAlign: 'center', borderRadius: radius.control,
                fontWeight: 600, fontSize: 15, opacity: waiting ? 0.7 : 1,
                ...(i === 0
                  ? { background: color.accent, color: color.white, border: 0 }
                  : { background: 'transparent', color: color.accentInk, border: `1.5px solid ${color.accent}` }),
              }}
            >
              {planLabel(plan)}
            </Pressable>
          ))}
          {store.busy === 'buying' && (
            <div style={{ fontSize: 13, color: color.muted, textAlign: 'center' }}>Waiting for the App Store…</div>
          )}
        </div>
      )}
      {appStore && (
        <p style={{ fontSize: 12, color: color.muted, lineHeight: 1.55, margin: '10px 0 0' }}>
          {RENEWAL_TERMS}{' '}
          <a href={TERMS_OF_USE_URL} target="_blank" rel="noreferrer" style={{ color: color.accentInk }}>Terms of use</a>
          {' · '}
          <a href="/privacy/" style={{ color: color.accentInk }}>Privacy</a>
        </p>
      )}
      {appStore && <RestorePurchase store={store} onRestore={onRestore} />}
    </>
  );
}

/** The App Store's answer and the restore button: beside the unlock, or on its own (`restoreOnlyOffered`). */
export function RestorePurchase({ store, onRestore }: { store: StoreView; onRestore: () => void }) {
  const waiting = store.busy !== null;
  return (
    <>
      {/* Always in the page, so what it says is announced when it changes:
          a live region added at the same moment as its text often is not. */}
      <div role="status">{store.note && <Note note={store.note} />}</div>
      <Pressable
        onClick={onRestore}
        disabled={waiting}
        aria-busy={store.busy === 'restoring'}
        style={{
          minHeight: 44, marginTop: 4, background: 'transparent', border: 0,
          color: color.accentInk, fontWeight: 600, fontSize: 13, textAlign: 'center', opacity: waiting ? 0.7 : 1,
        }}
      >
        {store.busy === 'restoring' ? 'Asking the App Store…' : 'Restore purchase'}
      </Pressable>
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
