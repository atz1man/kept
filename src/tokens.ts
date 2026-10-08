/**
 * Kept design tokens — the single source for every colour, shadow and typeface
 * in the app and the landing page. Components import from here; no raw hex
 * literals live in a component file.
 */
export const color = {
  /*
   * A money app, not a form. The quiet-utility palette — near-white, near-black
   * and one deep green — was measured against the bank app beside it and came
   * out looking like the other product this team builds: the same deep green,
   * the same grotesque, the same restrained white panels. Two products that
   * read as siblings is a brand problem before it is a taste one.
   *
   * So: electric indigo for the thing to press, a midnight-to-blue gradient
   * for the one number that matters, and the rest near-black on white. Red
   * stays reserved for a deadline that is close. Every pair below is measured
   * by scripts/contrast.mjs and test/contrast.test.ts, not trusted.
   */
  ink: '#0A0A12',
  inkHover: '#000000',

  /** The page. White, as asked for; cards sit on it in `surfaceAlt`. */
  canvas: '#FFFFFF',
  /** Cards, list groups, inputs, secondary buttons. 5.6:1 for `muted` on it. */
  surfaceAlt: '#F4F5F8',
  /** Row and button hover on white. */
  surfaceHover: '#F7F8FA',
  /** The deepest neutral: pressed states, hover on a card. 5.0:1 for `muted`. */
  surfaceDeep: '#E8EAF0',
  white: '#ffffff',

  /** The one accent: the button to press, the current tab, the live dot. 7.1:1 under white text. */
  accent: '#4636E8',
  accentHover: '#3626CF',
  /** The top of the logo tile's gradient; it runs down to accentHover. */
  accentTile: '#5B4CF5',
  /** A tint of it for selected states and quiet highlights; never text on its own. */
  accentSoft: '#EEEDFF',
  accentSoftHover: '#E2E0FF',
  /** The accent as small text: labels, links. 7.2:1 or better on every light ground. */
  accentInk: '#3B2BD6',

  /**
   * The coin in the mark: Quids In is money coming back, so the one thing on
   * the violet tile is a gold pound. Only the logo uses these. 3.5:1 against
   * the tile's lightest stop, so the coin holds its edge at 29px; `goldInk` is
   * the pound sign struck on it, 7.9:1 on the gold — a darker gold rather than
   * the ink, so it reads as one object rather than a sticker on one.
   */
  gold: '#F7C948',
  goldInk: '#4A2F00',

  /**
   * The hero's gradient, top to bottom. `heroEnd` is the LIGHTEST stop, and is
   * what the hero declares as its background colour: the contrast sweep reads
   * colours, not gradients, so it measures every word on the hero against the
   * stop where white is weakest (6.1:1) rather than against the page.
   */
  heroTop: '#0F0B3D',
  heroMid: '#3A27C9',
  heroEnd: '#2453E6',
  /** Secondary text on the hero. 4.8:1 on its lightest stop. */
  onHeroSoft: '#E9E7FF',
  /** Light on the hero's glass: the decorative discs. Never under text. */
  onHeroGlass: 'rgba(255,255,255,0.16)',
  /**
   * The glass under a chip on the hero: the gradient's own midnight, a
   * quarter strength. White glass was tried first and lifted the lightest
   * stop to 4.44:1 under white text — the contrast sweep found it. This one
   * deepens it instead: 8.3:1 there, measured in test/contrast.test.ts.
   */
  onHeroChip: 'rgba(15,11,61,0.25)',

  /** Secondary text. 5.0:1 on the deepest neutral, 6.1:1 on white. */
  muted: '#5F6270',
  /** Only legible on the INK surfaces (7.3:1 there). Under 3:1 on light grounds. */
  faint: '#9A9DA8',
  fainter: '#B4B7C0',
  body: '#3A3D48',
  bodyStrong: '#22242D',
  onInkBody: '#D5D7DE',
  onInkFaint: '#8B8E99',

  danger: '#C2261C',
  dangerDot: '#E5372B',
  dangerChipBg: 'rgba(229,55,43,0.10)',
  onInkDanger: '#FF9C8F',

  /**
   * "Check this": a figure the read was unsure of, on the Add card. Amber, so
   * it is neither the accent (press me) nor red (a deadline is close) — it
   * asks for a look, not an action. 6.6:1 for the ink on its ground.
   */
  caution: '#FFF1D6',
  cautionInk: '#7A4B00',

  border: 'rgba(10,10,18,0.10)',
  borderHair: 'rgba(10,10,18,0.06)',
  borderSoft: 'rgba(10,10,18,0.13)',
  onInkBorder: 'rgba(255,255,255,0.12)',
  onInkBorderStrong: 'rgba(255,255,255,0.18)',
  onInkDash: 'rgba(255,255,255,0.16)',
  rail: 'rgba(10,10,18,0.12)',
} as const;

/** The hero's gradient, drawn from the three stops above. */
export const gradient = {
  hero: `linear-gradient(155deg, ${color.heroTop} 0%, ${color.heroMid} 58%, ${color.heroEnd} 100%)`,
  /** The primary button: a light source on the accent, top to bottom. */
  accent: `linear-gradient(${color.accentTile}, ${color.accentHover})`,
} as const;

/**
 * A colour per kind of thing, for the small tile beside each receipt.
 *
 * Every row drew the same grey square, so a list of twelve receipts was
 * twelve identical grey squares and a person found the coat by reading.
 * A tint per category lets the eye find the kind before the name — the way
 * a bank app colours its spending categories — without becoming a second
 * urgency signal: red stays reserved for a deadline, so no tint here is red,
 * and none is the accent indigo the buttons use — clothing was violet beside
 * the old green, and moved to teal when the accent moved to indigo. Soft grounds, deep inks;
 * each ink is 5.7:1 or better on its own tint, measured.
 */
export const category = {
  audio: { tint: '#E7EEFB', ink: '#2A55A8' },
  kitchen: { tint: '#FCEEE2', ink: '#9A4510' },
  clothing: { tint: '#E2F4F2', ink: '#16645D' },
  beauty: { tint: '#FBE8EF', ink: '#A12F5B' },
  furniture: { tint: '#E9F2E3', ink: '#43652A' },
  other: { tint: color.surfaceAlt, ink: color.ink },
} as const;

/**
 * The three type roles, each with ONE fallback stack.
 *
 * These tokens existed and nothing used them: forty-eight font-family
 * literals were spelled out across fourteen files instead, in three different
 * stacks for Space Grotesk alone — 38 falling back to `monospace`, 9 to
 * `sans-serif`, and the token here to a third thing.
 *
 * That is not cosmetic on this app. The typefaces are self-hosted so a signed
 * screen renders offline, which means the FALLBACK is the state a phone with
 * a cold cache actually paints — and in it, the same face fell back to a
 * monospace in one element and a proportional sans in the next, on one
 * screen. Nobody had looked at that state, because nothing named it.
 *
 * `figures` is a real distinction and not a synonym for `display`: money,
 * countdowns and dates want digits that hold their column when the webfont is
 * missing, and a heading does not.
 */
export const font = {
  /** Headings and the wordmark: the same family as the text, at a heavier weight — no display face. */
  display: "'Geist', system-ui, -apple-system, sans-serif",
  /** Money, day counts, dates — set with tabular figures (see styles.css). */
  figures: "'Geist', ui-sans-serif, system-ui, sans-serif",
  /** Body text and controls. */
  ui: "'Geist', system-ui, -apple-system, sans-serif",
} as const;

export const shadow = {
  /*
   * Soft, wide and faint: cards float rather than sit. A money app's cards
   * are separated by space and a whisper of shadow, never by a border.
   */
  /** Buttons and emphasised cards. */
  raised: '0 1px 2px rgba(10,10,18,0.05), 0 4px 14px rgba(10,10,18,0.06)',
  raisedLg: '0 2px 6px rgba(10,10,18,0.05), 0 12px 32px rgba(10,10,18,0.09)',
  /** The hero and floating toasts: a glow in the hero's own hue. */
  lift: '0 14px 36px rgba(58,39,201,0.30)',
  /** The tab bar, from above. */
  bar: '0 -1px 0 rgba(10,10,18,0.06)',
} as const;

export const radius = {
  /** Status chips and badges. */
  chip: 8,
  /** Inputs and small controls. Buttons are pills — see `.k-primary` in styles.css. */
  control: 14,
  card: 20,
  cardLg: 22,
  hero: 28,
  heroLg: 28,
  /** Things that are round: avatars, dots, toggles, progress bars, buttons. */
  pill: 999,
} as const;

/** The page ground. Named for the paper grain it used to carry; now plain. */
export const paperGrain = {
  backgroundColor: color.canvas,
} as const;
