import { daysBetween } from './dates';

/**
 * What the add card says under a return deadline that has already gone.
 *
 * Paste an order from August in October and the card read "Deadline 8 Sept"
 * in the accent colour, the same as a deadline next week — nothing said it
 * had closed six weeks before, and saving it was the first anyone heard. A
 * receipt is still worth keeping after its window (a fault, a guarantee), so
 * this does not stop the save; it says what the date means before it.
 *
 * A FLOOR is not a close. An online order whose window counts from delivery,
 * with no delivery day yet, shows the earliest the window could end — so a
 * floor in the past says the window MAY have closed, the words the policy
 * feed already uses for the same case, and points at the day that settles it.
 */
export function passedDeadline(deadline: Date, today: Date, floor: boolean): string | null {
  const gone = daysBetween(deadline, today);
  if (gone <= 0) return null;
  if (floor) return 'That date has passed, but it is the earliest the window could close — add the day it arrived to know for sure.';
  return `The shop’s return window closed ${ago(gone)}.`;
}

function ago(days: number): string {
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 61) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.round(days / 30.44)} months ago`;
}
