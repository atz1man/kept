/**
 * Whether this page is the landing page's live demo.
 *
 * The landing page embeds this same build, at this same origin, as
 * `/app/?embed=1`. So everything the device keeps for the real app is within
 * the demo's reach unless something stops it: the library and the copy a bad
 * launch set aside, in localStorage; the iPhone's mirror and photographs; the
 * notifications lodged with iOS, and the origin's permission to show any; the
 * service worker. The demo's own receipts lived in memory, and that was not
 * enough. A demo screen calling the store directly went straight past it:
 * Erase everything, pressed in the demo, wrote an empty library over the
 * visitor's real one. Measured: [Sofa, Kettle, Coat] became [].
 *
 * So each store asks this at its own door, rather than trusting every caller to
 * have asked first, and refuses the demo there. `embedded-effects.test.ts`
 * holds every door in `src` to that.
 *
 * Decided once, from the address the page was opened at, and never asked
 * again: a demo must not turn into the real app halfway through a session,
 * whatever later happens to the URL. A page with no address to read is not
 * the demo, because the demo is defined by its address.
 */
let decided: boolean | null = null;

export function embedded(): boolean {
  if (decided === null) {
    try {
      decided = new URLSearchParams(window.location.search).has('embed');
    } catch {
      decided = false;
    }
  }
  return decided;
}
