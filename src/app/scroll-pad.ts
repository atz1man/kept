/**
 * How far from the top edge of a screen's scroller a focused control is
 * scrolled to.
 *
 * Tabbing BACK up a screen scrolls each control into view at the scroller's
 * top edge, where the focus ring drawn round it — a 2.5px outline 2px out,
 * and a 5px halo — fell outside the scroller and was cut off. Measured: the
 * top of the ring was missing on Home's "Next to close", a receipt's "Got my
 * money back", Add's "Start again" and every category on Edit. The bottom
 * already had its padding, for the tab bar (scrollPaddingBottom on each
 * scroller); this is the top's. scripts/a11y.mjs tabs both ways and fails on
 * a ring cut off on any side.
 */
export const SCROLL_PAD_TOP = 12;
