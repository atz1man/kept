import type { Screen } from '../lib/types';

/** The four places the tab bar goes, named by the screen each tab opens. */
export type Tab = 'home' | 'watch' | 'add' | 'settings';

/**
 * Which tab is lit on each screen: where you are in the app, not which
 * component happens to be mounted.
 *
 * The bar tested `screen === 'home' || screen === 'detail'` for Receipts and
 * nothing else, so on the claim pack, Edit and the money-back screen — all
 * reached from a receipt — no tab was lit at all, and the bar stopped saying
 * where you were on exactly the screens furthest from it. A table typed by
 * every `Screen` instead of a test of two, so a tenth screen does not compile
 * until somebody has said which tab it belongs to.
 */
const TAB_OF: Record<Screen, Tab | null> = {
  home: 'home',
  // A receipt, and everything opened from one, is under Receipts. The Watch
  // tab opens receipts too, but the receipt's own Back goes to the list
  // (`backTarget`), so the list is where it lives.
  detail: 'home',
  edit: 'home',
  pack: 'home',
  celebrate: 'home',
  watch: 'watch',
  add: 'add',
  settings: 'settings',
  // No bar is drawn during onboarding.
  onboard: null,
};

export function tabOf(screen: Screen): Tab | null {
  return TAB_OF[screen];
}
