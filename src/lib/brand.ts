/**
 * The tagline, in one place.
 *
 * It was three literals — the landing hero, the landing footer, and the line
 * under Settings — and changing one left the other two saying something else,
 * which is the drift this codebase keeps finding in prices and store windows.
 * A tagline is not load-bearing the way a price is, but it is the first thing
 * on the page someone reads before installing and the last thing in the app
 * they read after, and those two should not be different claims.
 *
 * The words themselves changed too. "WORK HARD · PLAY HARD" sat in the most
 * prominent typographic slot the hero has and said nothing about returns,
 * money or privacy — generic hustle copy in a product about not losing £61 to
 * a shop. Same rhythm, same two beats and middot; now about the thing being
 * sold. One export to revert if the brand disagrees.
 */
export const TAGLINE = 'return deadlines, watched';

/** The hero and the landing footer set it in caps; Settings sets it in prose. */
/** The tagline as a line of its own, sentence case. */
export const TAGLINE_LEAD = TAGLINE[0].toUpperCase() + TAGLINE.slice(1);

/**
 * Where privacy questions go. Deliberately unset: it has to be an address
 * someone reads, and that is not a thing to guess. While it is null the page
 * says so in plain view rather than printing an address nobody answers.
 */
// Read from here by the privacy page and by Settings' "Send feedback", and by
// `npm run preflight`, which stays red while it is null.
export const CONTACT_EMAIL: string | null = null;
