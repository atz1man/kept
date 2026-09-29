import sources from '../../store/retailer-sources.json';
import { findStore } from './stores';

/**
 * Where a shop takes its returns, on its own site.
 *
 * kept worked out the deadline and then stopped at the one step that is the
 * point of it: going back to the shop. Every receipt now links to that shop's
 * own returns page, the same page `npm run check:retailers` reads the window
 * from. The link is read out of that one file rather than copied into the
 * table, so the page a person is sent to is the page that gets checked, and a
 * moved page is caught by the check rather than found by a customer.
 *
 * Only a page on the shop's own site. A link is a person leaving the app, and
 * `feed-add` already refuses any source that is not the retailer's own domain;
 * a returns link is held to the same rule by `test/returns-pages.test.ts`.
 */
const PAGES = (sources as { sources: Record<string, string[]> }).sources;

export interface ReturnsPage {
  url: string;
  /** The site the link opens, shown on the button: a person should see where they are going. */
  host: string;
}

/** The shop's own returns page, or null for a shop kept does not know. */
export function returnsPageFor(storeName: string): ReturnsPage | null {
  const shop = findStore(storeName);
  const url = shop ? PAGES[shop.name]?.[0] : undefined;
  if (!url) return null;
  return { url, host: new URL(url).hostname.replace(/^www\d*\./, '') };
}
