/**
 * A tab left open across a deploy, and a file it can no longer fetch.
 *
 * Phones resume an installed app rather than reload it, so a tab can sit on
 * build A for days while build B is deployed. Its code is A's, and the pieces
 * A loads only when asked — the PDF reader, the receipt scanner — are A's file
 * names, which B's server no longer has. Measured on main: open the app, deploy,
 * choose a file, and "kept couldn't read that file", every time, for as long as
 * the tab lived. Nothing about the file was wrong.
 *
 * The cure is a reload, into the build that is there now. The care is all in
 * WHEN, because a reload is not free on this app:
 *
 *   - Offline, with no newer build to go to, it would trade a screen that
 *     works for the browser's own error page — on the train, the one place
 *     the app promises to work. So the reload happens only when a build OTHER
 *     than the one on screen can be named: the shell the worker holds, or
 *     the one the server answers with. If neither can be asked, the failure
 *     stays a failure the screen already explains.
 *   - The receipts must already be in storage, because a reload loads the
 *     store, not the screen. They are on every save — the save runs after
 *     every change — except when the save FAILED (quota, a store that refuses
 *     writes) or is held back on iOS. Then what is on screen is the only copy,
 *     and the banner offering an export is the right answer, not a reload.
 *   - Once per build per tab. If a reload lands on the very build it left — a
 *     server still handing out the old shell — it does not go round again.
 *
 * What a reload does lose is a screen half filled in. That is the price of the
 * worst case, and the alternative was a feature that could never work again.
 */

/** The module script a document boots from — the name every build changes. */
export function bootScript(html: string): string | null {
  for (const tag of html.match(/<script\b[^>]*>/gi) ?? []) {
    if (!/\btype\s*=\s*["']?module\b/i.test(tag)) continue;
    const src = /\bsrc\s*=\s*["']?([^"'\s>]+)/i.exec(tag);
    if (src) return src[1];
  }
  return null;
}

export interface StaleCheck {
  /** The build on screen, named by the script it booted from. */
  onScreen: string | null;
  /** The build a reload would open, named the same way; null when nobody could be asked. */
  available: string | null;
  /** The build this tab has already reloaded away from once, if any. */
  reloadedFrom: string | null;
  /** Whether everything on screen is already in storage. */
  saved: boolean;
}

export function shouldReload({ onScreen, available, reloadedFrom, saved }: StaleCheck): boolean {
  if (!saved) return false;
  if (onScreen === null || available === null) return false;
  if (available === onScreen) return false;
  if (reloadedFrom === onScreen) return false;
  return true;
}
