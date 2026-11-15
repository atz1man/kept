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

/**
 * Whether this place's heading is still owed a focus move.
 *
 * A screen in a chunk of its own (Settings, the claim pack) mounts a moment
 * after the navigation, so its heading is not in the document when the effect
 * runs: the move has to wait for it. Waiting is a second thing StrictMode's
 * re-run could lose — the first run starts the wait and is torn down, and the
 * second, asking only "is this somewhere new?", is told no. So what is owed
 * is kept by place as well: true on arrival, and true again on every re-run
 * until `awaiting.current` is cleared by the move itself. Leaving for another
 * place drops the debt, because `awaiting` then names the new one.
 */
export function headingOwed(last: { current: string }, awaiting: { current: string | null }, place: string): boolean {
  if (arrivedSomewhereNew(last, place)) awaiting.current = place;
  return awaiting.current === place;
}
