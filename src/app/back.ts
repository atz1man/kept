import type { Screen } from '../lib/types';

/**
 * Where the phone's own Back goes.
 *
 * The screens were never in the browser's history, so on the web — an
 * installed app on Android, or a tab — Back from a receipt, from Edit, from
 * Settings, left kept altogether: the gesture everyone uses to go up one
 * level threw them out of the app. Each screen now has a depth, the app keeps
 * one history entry per level, and Back goes up one.
 */

/** How many Backs a screen is from the list. */
export function screenDepth(screen: Screen): number {
  switch (screen) {
    case 'home':
    case 'onboard':
      return 0;
    case 'edit':
      return 2;
    default:
      return 1;
  }
}

/** The screen one Back leads to, or null where Back should leave the app. */
export function backTarget(screen: Screen): Screen | null {
  if (screen === 'edit') return 'detail';
  return screenDepth(screen) === 0 ? null : 'home';
}
