/**
 * How long before a guarantee ends it is worth saying so. A month: long
 * enough to notice a fault you have been living with, book a repair and get
 * the thing looked at while it is still covered.
 *
 * On its own because two things state it: `alerts.ts`, which acts on it, and
 * the landing page, which says it — and the page must not carry the alert
 * engine in its bundle to print one number (`npm run budget` caught that).
 */
export const WARRANTY_NOTICE_DAYS = 30;
