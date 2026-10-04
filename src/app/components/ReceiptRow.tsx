import { useRef, useState } from 'react';
import { category, color, font } from '../../tokens';
import { money } from '../../lib/money';
import type { Receipt } from '../../lib/types';
import type { Urgency } from '../../lib/urgency';
import { CatIcon, Tick } from './Icons';

/** Past this many pixels of leftward drag, releasing marks the receipt returned. */
const COMMIT_PX = 80;
/** The row stops travelling here, so the yellow backing never fully takes over. */
const MAX_PX = 120;
/** Movement beyond this is a swipe, not a tap — the click that follows is dropped. */
const TAP_SLOP_PX = 8;

interface Props {
  receipt: Receipt;
  urgency: Urgency;
  /** Which hover the row takes: the urgent sections' rows, or the quieter ones. */
  emphasised: boolean;
  /** True when a watched policy change touches this receipt's retailer. */
  policyChanged: boolean;
  /** Ordered online and not yet known to have arrived (`awaitingArrival`). */
  onItsWay?: boolean;
  onOpen: () => void;
  onSwipe: () => void;
}

/**
 * The floor under a row's store name, in pixels. Matches the number the
 * layout sweep enforces — see `MIN_NAME_PX` in scripts/layout.mjs. Below this
 * a name is not truncated, it is erased.
 */
const MIN_NAME_PX = 64;

export function ReceiptRow({ receipt, urgency, emphasised, policyChanged, onItsWay = false, onOpen, onSwipe }: Props) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const swiped = useRef(false);

  const end = () => {
    const commit = dx < -COMMIT_PX;
    startX.current = null;
    setDragging(false);
    setDx(0);
    if (commit) onSwipe();
  };

  return (
    <li style={{ position: 'relative', listStyle: 'none', overflow: 'hidden' }}>
      {/* The backing revealed by the swipe. Hidden from assistive tech: it is
          the visual result of a gesture, not a second control — the keyboard
          route to the same outcome is the first button on the detail screen:
          "I've sent it back" for an online order, "Got my money back" otherwise. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'flex-end', paddingRight: 20, background: color.accentSoft,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
          <Tick size={14} />
          {receipt.distance ? 'Sent back' : 'Returned'}
        </span>
      </div>

      <button
        type="button"
        className={`k-press ${emphasised ? 'k-row-white' : 'k-row-plain'}`}
        onPointerDown={(e) => {
          startX.current = e.clientX;
          swiped.current = false;
          setDragging(true);
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Pointer capture is a nicety; the drag still tracks without it.
          }
        }}
        onPointerMove={(e) => {
          if (startX.current === null) return;
          const next = Math.max(-MAX_PX, Math.min(0, e.clientX - startX.current));
          if (next < -TAP_SLOP_PX) swiped.current = true;
          setDx(next);
        }}
        onPointerUp={end}
        onPointerCancel={() => {
          startX.current = null;
          setDragging(false);
          setDx(0);
        }}
        onClick={() => {
          // A finished swipe still fires a click; opening the detail screen on
          // top of the celebrate screen would bury the thing just confirmed.
          if (swiped.current) {
            swiped.current = false;
            return;
          }
          onOpen();
        }}
        // "(sample)" and "(on its way)" sit with the item rather than at the end, because the
        // agreement sweep reads the amount and the status off the last two
        // fields of this label — and because "mixer (sample)" is how a person
        // would say it.
        aria-label={`${receipt.store}, ${receipt.item}${receipt.demo ? ' (sample)' : ''}${onItsWay ? ' (on its way)' : ''}, ${money(receipt.amount)}, ${urgency.label}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px',
          // A row in a grouped list (`.k-group`), not a card of its own: the
          // list is the card, rows are divided by a hairline, and urgency is
          // said in the red of the countdown rather than by lifting the row.
          background: color.white,
          border: 0,
          borderRadius: 0,
          position: 'relative',
          transform: `translateX(${dx}px)`,
          transition: dragging ? 'none' : 'transform .25s ease',
          touchAction: 'pan-y',
        }}
      >
        <div
          style={{
            width: 36, height: 36, borderRadius: 9, background: category[receipt.cat].tint,
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
          }}
        >
          <CatIcon cat={receipt.cat} stroke={category[receipt.cat].ink} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Wraps, and the name keeps a floor.
              At 320px there is about 134px for this whole block and the
              POLICY CHANGED chip wants 95 of it, so with the chip refusing to
              shrink the name absorbed every pixel: "Zara" rendered 4px wide of
              32. Nothing failed — a squeezed name neither overflows the page
              nor covers a button — which is why the layout sweep now measures
              it. The chip drops to its own line when the two will not fit,
              instead of eating the one word that says whose return this is. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, rowGap: 4, minWidth: 0, flexWrap: 'wrap' }}>
            {/* Truncated like the item beneath it. A store name is free text —
                the edit form accepts anything — and an untruncated one wrapped
                to five lines on a 320px phone while the item it belongs to was
                still being clipped to one. */}
            {/* data-name is read by the layout sweep, which measures whether
                anything beside this has squeezed it past reading. */}
            <span data-name style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: MIN_NAME_PX }}>
              {receipt.store}
            </span>
            {policyChanged && (
              <span style={{ fontSize: 10.5, fontWeight: 550, color: color.accentInk, background: color.accentSoft, padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0 }}>
                Policy changed
              </span>
            )}

          </div>
          {/* A fresh install opens on five receipts nobody added, and until
              this they were indistinguishable from real ones — which also made
              the "0 of 10 free receipts" beside them look like a bug rather
              than a deliberate generosity.

              On the ITEM line, not up beside the store name as a chip. Tried
              that: on a row that also carries POLICY CHANGED the store was
              crushed to "Cu…" and "Z…" on a 402px phone — two characters of
              the one word that says whose return this is. Nothing failed;
              every sweep was green, because a squeezed name does not overflow
              and does not cover a button.

              And BEFORE the item, not after it. Tried that too: this line
              truncates from the tail, so at 320px every row read "Kenwood
              kMix stan…" and the marker vanished on exactly the phone with
              the least room to explain itself. */}
          <div style={{ fontSize: 13, color: color.muted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {receipt.demo && <span>sample · </span>}
            {/* Before the item for the same reason as "sample": this line
                truncates from the tail. Until it arrives, the count beside it
                runs from the order and is the earliest it can be. */}
            {onItsWay && <span>on its way · </span>}
            {receipt.item}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: font.figures, fontSize: 15, fontWeight: 550 }}>{money(receipt.amount)}</div>
          {/* Said in colour and in words, not in a pill: red and "2 days
              left" when it is close, the accent when it is coming up, grey
              when there is time. */}
          <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: urgency.level === 'critical' || urgency.level === 'expired' ? 600 : 500, color: urgency.fg }}>
            {urgency.label}
          </div>
        </div>
      </button>
    </li>
  );
}
