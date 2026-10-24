/**
 * Whether the app has arrived somewhere new — the question App.tsx asks
 * before moving focus to a screen's heading.
 *
 * It keys on WHERE the app is, never on how many times it has been asked.
 * The first version was a boolean, "is this the first paint?", spent on the
 * first call. React's StrictMode mounts every component, tears it down and
 * mounts it again in development, running each effect twice: the first run
 * spent the boolean and the second, on the same first paint, moved focus to
 * the heading anyway. The fresh page then opened with a focus ring drawn
 * round "Quids In" — in dev only, which is exactly where the design is
 * looked at, and the production build (no double run) never showed it.
 *
 * A place compared with the last place answers the same on every re-run:
 * the second run of the first paint is still the first paint.
 */
export function arrivedSomewhereNew(last: { current: string }, place: string): boolean {
  if (last.current === place) return false;
  last.current = place;
  return true;
}

/** The place, as App.tsx names it: the screen, and the receipt it shows. */
export const placeOf = (screen: string, selId: string | null | undefined): string => `${screen}|${selId ?? ''}`;
