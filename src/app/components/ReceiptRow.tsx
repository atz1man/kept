import { useRef, useState } from 'react';
import { color, font } from '../../tokens';
import { money } from '../../lib/money';
import type { Receipt } from '../../lib/types';
import type { Urgency } from '../../lib/urgency';
import { Tick } from './Icons';
import { Avatar } from './Avatar';

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
          display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px',
          // A row in a grouped list (`.k-group`), not a card of its own: the
          // list is the card, rows are divided by a hairline, and urgency is
          // said in the red of the countdown rather than by lifting the row.
          // Opaque, in the card's own grey, so the swipe's backing stays
          // hidden until the row is dragged off it.
          background: color.surfaceAlt,
          border: 0,
          borderRadius: 0,
          position: 'relative',
          transform: `translateX(${dx}px)`,
          transition: dragging ? 'none' : 'transform .25s ease',
          touchAction: 'pan-y',
        }}
      >
        <Avatar store={receipt.store} cat={receipt.cat} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/*
           * Titled by the THING, with the shop beneath it.
           *
           * The shop led, and a list of four Currys rows read "Currys,
           * Currys, Currys, Currys" with the one word that told them apart —
           * the item — cut off on the line below behind "sample ·". What a
           * person looks for in this list is the thing they bought; the
           * Watch tab's Coming up list is titled the same way.
           *
           * The title keeps a floor (`data-name`, read by the layout sweep):
           * a squeezed title neither overflows the page nor covers a button,
           * so nothing else would notice it read "Ke…".
           */}
          <span data-name style={{ display: 'block', fontWeight: 600, fontSize: 15.5, letterSpacing: '-0.015em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: MIN_NAME_PX }}>
            {receipt.item}
          </span>
          {/*
           * The shop, and what is true of this receipt besides its deadline.
           * Everything here is short and leads with what matters most, because
           * the line truncates from the tail: the sample tag first (a fresh
           * install opens on five receipts nobody added, and that must never
           * be lost at 320px), then the shop, then the rest.
           */}
          <div style={{ fontSize: 13, color: color.muted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {receipt.demo && <SampleTag />}
            {receipt.store}
            {/* Until it arrives, the count beside it runs from the order and
                is the earliest it can be. */}
            {onItsWay && <span> · on its way</span>}
          </div>
          {/* A line of its own, in words, only where it applies — and words
              rather than the filled chip that sat beside the name, which
              took 95px of a 134px title on a small phone. Appended to the
              shop's line instead, it was the first thing cut: "Zara · on its
              way · po…" on the seeded list at 390px. */}
          {policyChanged && <div style={{ fontSize: 12, fontWeight: 500, color: color.accentInk, marginTop: 1 }}>Policy changed</div>}
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: font.figures, fontSize: 15.5, fontWeight: 650, letterSpacing: '-0.01em' }}>{money(receipt.amount)}</div>
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

/**
 * A receipt nobody bought, said once per row as a small tag rather than as
 * "sample ·" in front of every line: the samples must read as samples (they
 * are ours, not yours), and the tag does that without spending the words the
 * row needs for the item. Its own words are in the row's accessible name
 * ("(sample)"), so it is hidden from assistive tech here.
 *
 * `spoken` is for a place with no such name — a policy change on Watch is a
 * card of text, not a button — where the tag is the only thing that says the
 * change is invented, and so must be read out. Same look either way: the
 * samples were labelled two ways on one screen, a boxed "Sample" on the rows
 * and a filled lowercase "sample" pill on the cards below them.
 */
export function SampleTag({ spoken = false }: { spoken?: boolean }) {
  return (
    <span
      data-sample
      aria-hidden={spoken ? undefined : 'true'}
      style={{
        display: 'inline-block', fontSize: 10.5, fontWeight: 600, lineHeight: '15px', letterSpacing: '0.02em',
        padding: '0 5px', marginRight: spoken ? 0 : 6, verticalAlign: 1, color: color.muted, whiteSpace: 'nowrap',
        border: `1px solid ${color.border}`, borderRadius: 4,
      }}
    >
      Sample
    </span>
  );
}
