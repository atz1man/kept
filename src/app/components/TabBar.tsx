import { color, shadow } from '../../tokens';
import type { Screen } from '../../lib/types';
import { BellGlyph, GearGlyph, PlusGlyph, ReceiptGlyph } from './Icons';
import { Pressable } from './Pressable';
import { tabOf } from '../tabs';

interface Props {
  screen: Screen;
  /** A red dot rides the Watch tab when a policy change touches a held receipt. */
  alert: boolean;
  onGo: (s: Screen) => void;
}

/**
 * Which tab you are on, said three ways: the colour, the glyph FILLED rather
 * than outlined, and the label in a heavier weight — the way a phone's own
 * tab bars do it, and nothing drawn above the tab.
 *
 * It was once a pale fill alone, which measured 1.28:1 against the bar where
 * WCAG 2.1 SC 1.4.11 asks 3:1 of a state indicator, and which vanished under
 * forced colours (a background is replaced by the system's). Then an outlined
 * pill, which read as a toy; then a 2px accent bar over the current tab, a
 * border so it survived forced colours, but a web tab strip's mark rather
 * than a phone's. The filled glyph is a difference of SHAPE and the weight a
 * difference of type, so both survive forced colours, where every colour
 * becomes the system's own — the a11y sweep checks it there.
 */
const tab = (active: boolean) => ({
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  gap: 3,
  flex: 1,
  background: 'transparent',
  color: active ? color.accentInk : color.muted,
  position: 'relative' as const,
  // Allowed to shrink. A flex item will not go below its content width
  // without this, which is how the bar came to be wider than the phone.
  minWidth: 0,
  borderRadius: 10,
});

/*
 * The label truncates rather than the bar leaving the screen.
 *
 * At 10px this is the text a browser's minimum-font-size setting inflates
 * most — 10 to 18 is 1.8x — and at that size the four tabs need 370px. On a
 * 320px screen the bar, centred with translateX(-50%), sat from -25 to 345:
 * the R of "Receipts" cut off at one edge and "Settings" at the other, on the
 * app's only navigation. Nothing could see it, either. The shell is
 * `overflow: hidden`, so the page reported no sideways scroll at all and the
 * layout sweep passed.
 *
 * The accessible name is unaffected, so "Setti…" is only ever a visual last
 * resort — and a truncated label you can still tap beats a tab off the screen.
 */
const label = (active: boolean) => ({
  fontSize: 10.5,
  fontWeight: active ? 600 : 500,
  letterSpacing: '0.01em',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis' as const,
  whiteSpace: 'nowrap' as const,
});

export function TabBar({ screen, alert, onGo }: Props) {
  // Where you are in the app, not which component is mounted: a receipt, its
  // claim pack, its edit form and the money-back screen are all under
  // Receipts (`tabOf`).
  const lit = tabOf(screen);
  const onReceipts = lit === 'home';
  return (
    <nav
      aria-label="Main"
      style={{
        /*
         * Docked to the bottom edge, full width, the way a phone's own apps
         * do it. It used to float as a pill 24px above the edge with a hard
         * ink shadow, which read as a toy and also sat on top of whatever
         * was last on the screen. The home indicator owns roughly the bottom
         * 34px of an iPhone, so the bar's own padding grows by that inset.
         */
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        gap: 0,
        padding: '6px 8px calc(4px + env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
        background: color.bar,
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        borderTop: `1px solid ${color.border}`,
        boxShadow: shadow.bar,
        zIndex: 30,
      }}
    >
      <Pressable className={onReceipts ? 'k-tab k-tab-on' : 'k-tab'} style={tab(onReceipts)} aria-current={onReceipts ? 'page' : undefined} onClick={() => onGo('home')}>
        <ReceiptGlyph size={22} stroke={onReceipts ? color.accentInk : color.muted} filled={onReceipts} />
        <span style={label(onReceipts)}>Receipts</span>
      </Pressable>

      <Pressable
        className={lit === 'watch' ? 'k-tab k-tab-on' : 'k-tab'}
        style={tab(lit === 'watch')}
        aria-current={lit === 'watch' ? 'page' : undefined}
        // The dot's meaning belongs to the TAB, as its name. Labelling the dot
        // itself glued "Policy updates affect your receipts" onto the front of
        // the button's accessible name, so the tab announced as a sentence and
        // stopped being findable by the word on it.
        aria-label={alert ? 'Watch — policy updates affect your receipts' : undefined}
        onClick={() => onGo('watch')}
      >
        {alert && (
          <span
            aria-hidden="true"
            /* Bordered as well as filled: under forced colours a background is
               replaced by the system's and the dot vanished, taking the one
               signal that a policy change touches a receipt you hold. */
            style={{ position: 'absolute', top: 2, left: 'calc(50% + 6px)', width: 7, height: 7, borderRadius: 999, background: color.danger, border: `1px solid ${color.danger}` }}
          />
        )}
        <BellGlyph size={22} stroke={lit === 'watch' ? color.accentInk : color.muted} filled={lit === 'watch'} />
        <span style={label(lit === 'watch')}>Watch</span>
      </Pressable>

      {/* Adding is a tab like the others, not a floating disc: the bright
          round button was the loudest thing on every screen, and the add
          screen is somewhere you go, like the rest. */}
      <Pressable
        className={lit === 'add' ? 'k-tab k-tab-on' : 'k-tab'}
        style={tab(lit === 'add')}
        aria-label="Add a receipt"
        aria-current={lit === 'add' ? 'page' : undefined}
        onClick={() => onGo('add')}
      >
        <PlusGlyph stroke={lit === 'add' ? color.accentInk : color.muted} size={22} filled={lit === 'add'} />
        <span style={label(lit === 'add')}>Add</span>
      </Pressable>

      <Pressable className={lit === 'settings' ? 'k-tab k-tab-on' : 'k-tab'} style={tab(lit === 'settings')} aria-current={lit === 'settings' ? 'page' : undefined} onClick={() => onGo('settings')}>
        <GearGlyph size={22} stroke={lit === 'settings' ? color.accentInk : color.muted} filled={lit === 'settings'} />
        <span style={label(lit === 'settings')}>Settings</span>
      </Pressable>
    </nav>
  );
}
