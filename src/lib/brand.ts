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

/**
 * Who publishes Quids In, as the Companies House register has it.
 *
 * The app is sold by a UK limited company, and the Companies (Trading
 * Disclosures) Regulations 2008 want the company's website to say which one:
 * its registered name, its number, its registered office and the part of the
 * UK it is registered in. Apple's organisation enrolment checks the same thing
 * from the other side — that the website belongs to the seller. Four facts a
 * typo makes untrue, on pages that are a legal statement rather than copy, so
 * they live here once and every page draws them from this object: the landing
 * footer and both reading pages (`pages/Disclosure.tsx`), the line in
 * Settings, and the privacy policy's "Who runs Quids In".
 *
 * Read by `npm run preflight`, which stays red without it, and by
 * `npm run agreement`, which holds every page that names the company to it.
 * Not a placeholder: these are the register's own entries, checked by the
 * owner. An `SC` or `NI` number would mean Scotland or Northern Ireland, and
 * `jurisdiction` would have to change with it.
 */
export const COMPANY = {
  /** The register's form, in capitals, for anywhere that quotes it exactly. */
  registeredName: 'AP NEXUS ENGINEERING LIMITED',
  /** The same name as it is written in a sentence. */
  name: 'AP Nexus Engineering Limited',
  number: '15036434',
  registeredOffice: {
    lines: ['C/O Golder Baqa Ltd', 'Ground Floor', "1 Baker's Row"],
    town: 'London',
    postcode: 'EC1R 3DB',
    country: 'United Kingdom',
  },
  jurisdiction: 'England and Wales',
} as const;

/** "C/O Golder Baqa Ltd, Ground Floor, 1 Baker's Row, London EC1R 3DB" — UK pages need no country. */
export const REGISTERED_OFFICE = [...COMPANY.registeredOffice.lines, `${COMPANY.registeredOffice.town} ${COMPANY.registeredOffice.postcode}`].join(', ');
