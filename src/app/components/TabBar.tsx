import { color, shadow } from '../../tokens';
import type { Screen } from '../../lib/types';
import { BellGlyph, GearGlyph, PlusGlyph, ReceiptGlyph } from './Icons';
import { Pressable } from './Pressable';

interface Props {
  screen: Screen;
  /** A red dot rides the Watch tab when a policy change touches a held receipt. */
  alert: boolean;
  onGo: (s: Screen) => void;
}

/**
 * Which tab you are on, said twice: the colour, and a short bar above it.
 *
 * It was once a pale fill alone, which measured 1.28:1 against the bar where
 * WCAG 2.1 SC 1.4.11 asks 3:1 of a state indicator, and which vanished under
 * forced colours (a background is replaced by the system's; a border is not).
 * Then an outlined pill, which carried the state but read as a toy. Now the
 * way a phone's own apps do it: the current tab's icon and label in the
 * accent, and a 2px accent bar over it — a BORDER, so it survives forced
 * colours, and only rendered on the current tab, because a transparent border
 * is forced to a system colour like any other.
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

/** The current tab's bar: a border on an otherwise empty box. */
const Indicator = () => (
  <span
    aria-hidden="true"
    data-tab-indicator
    style={{ position: 'absolute', top: -7, left: '50%', transform: 'translateX(-50%)', width: 24, height: 0, borderTop: `2px solid ${color.accent}`, borderRadius: 2 }}
  />
);

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
  // The detail screen is reached from the receipts list, so the list stays lit
  // while it is open — the tab shows where you are in the app, not which
  // component happens to be mounted.
  const onReceipts = screen === 'home' || screen === 'detail';
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
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        borderTop: `1px solid ${color.border}`,
        boxShadow: shadow.bar,
        zIndex: 30,
      }}
    >
      <Pressable className={onReceipts ? 'k-tab k-tab-on' : 'k-tab'} style={tab(onReceipts)} aria-current={onReceipts ? 'page' : undefined} onClick={() => onGo('home')}>
        {onReceipts && <Indicator />}
        <ReceiptGlyph size={22} stroke={onReceipts ? color.accentInk : color.muted} />
        <span style={label(onReceipts)}>Receipts</span>
      </Pressable>

      <Pressable
        className={screen === 'watch' ? 'k-tab k-tab-on' : 'k-tab'}
        style={tab(screen === 'watch')}
        aria-current={screen === 'watch' ? 'page' : undefined}
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
        {screen === 'watch' && <Indicator />}
        <BellGlyph size={22} stroke={screen === 'watch' ? color.accentInk : color.muted} />
        <span style={label(screen === 'watch')}>Watch</span>
      </Pressable>

      {/* Adding is a tab like the others, not a floating disc: the bright
          round button was the loudest thing on every screen, and the add
          screen is somewhere you go, like the rest. */}
      <Pressable
        className={screen === 'add' ? 'k-tab k-tab-on' : 'k-tab'}
        style={tab(screen === 'add')}
        aria-label="Add a receipt"
        aria-current={screen === 'add' ? 'page' : undefined}
        onClick={() => onGo('add')}
      >
        {screen === 'add' && <Indicator />}
        <PlusGlyph stroke={screen === 'add' ? color.accentInk : color.muted} size={22} />
        <span style={label(screen === 'add')}>Add</span>
      </Pressable>

      <Pressable className={screen === 'settings' ? 'k-tab k-tab-on' : 'k-tab'} style={tab(screen === 'settings')} aria-current={screen === 'settings' ? 'page' : undefined} onClick={() => onGo('settings')}>
        {screen === 'settings' && <Indicator />}
        <GearGlyph size={22} stroke={screen === 'settings' ? color.accentInk : color.muted} />
        <span style={label(screen === 'settings')}>Settings</span>
      </Pressable>
    </nav>
  );
}
