import { toISODate } from './dates';
import { deadlineIsFloor, derive } from './receipts';
import type { Receipt } from './types';

/**
 * What the Home Screen widget shows, written for it by the app.
 *
 * A widget cannot run this app's code: it is a separate small program iOS
 * wakes on its own schedule, with no web view. So the app hands it the facts
 * the moment they change — the next few deadlines, as DATES — through the
 * App Group container the two share on the phone (packages/widget-bridge).
 * Nothing leaves the phone; the container is the phone's own storage.
 *
 * Dates, never "3 days left". The widget is drawn on days the app is not
 * opened, and a count frozen when the app last ran is wrong the next morning
 * — the defect `Receipt` was built to avoid (see its comment). The widget
 * counts the days itself from the deadline, at each midnight.
 *
 * The deadline is `derive`'s, the same one every other surface states,
 * Christmas dates and all. A deadline counted from the order for a shop that
 * counts from delivery is the EARLIEST it can close (`deadlineIsFloor`), and
 * the widget is told so, because "Last day" over a floor is the sentence this
 * app has been most careful never to say.
 */
export interface WidgetDeadline {
  store: string;
  item: string;
  /** The last day it can go back, inclusive: YYYY-MM-DD. */
  deadline: string;
  /** Integer pence. */
  pence: number;
  /** True where the date is the earliest the window can close, not the date it does. */
  atLeast: boolean;
}

export interface WidgetSnapshot {
  /** Bumped if the shape changes, so a widget from an older build can say "open the app" rather than misread it. */
  version: 1;
  /** Up to `WIDGET_ROWS` deadlines, soonest first, none already past. */
  next: WidgetDeadline[];
  /** How many more open returns there are beyond `next`, as of `today`. */
  more: number;
}

/** The most a widget can show: the large size fits four rows. */
export const WIDGET_ROWS = 4;

export function widgetSnapshot(receipts: readonly Receipt[], today: Date): WidgetSnapshot {
  const open = receipts
    .filter((r) => r.status === 'active')
    .map((r) => ({ r, d: derive(r, today) }))
    // A floor past its date may still be open, but the widget has no room to
    // say why; the app's own list does. It shows only deadlines still ahead.
    .filter(({ d }) => !d.expired)
    .sort((a, b) => a.d.deadline.getTime() - b.d.deadline.getTime() || a.r.id.localeCompare(b.r.id));
  return {
    version: 1,
    next: open.slice(0, WIDGET_ROWS).map(({ r, d }) => ({
      store: r.store,
      item: r.item,
      deadline: toISODate(d.deadline),
      pence: r.amount,
      atLeast: deadlineIsFloor(r),
    })),
    more: Math.max(0, open.length - WIDGET_ROWS),
  };
}
