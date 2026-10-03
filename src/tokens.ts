/**
 * Kept design tokens — the single source for every colour, shadow and typeface
 * in the app and the landing page. Components import from here; no raw hex
 * literals live in a component file.
 */
export const color = {
  /*
   * Quiet utility. The first palette was cream paper, mustard fills and hard
   * ink offsets — warm, and read as a toy by the people this app is for: an
   * adult with £89 at stake wants a tool that looks like the bank app beside
   * it. Near-white, near-black, one deep green for the thing to press, and
   * red only when a deadline is close. Every pair below is measured by
   * scripts/contrast.mjs and test/tokens.test.ts, not trusted.
   */
  ink: '#14161A',
  inkHover: '#000000',

  /** The page. Warm off-white, so white cards read as cards on it. */
  canvas: '#FFFFFF',
  /** Inputs, secondary buttons, quiet panels. 5.3:1 for `muted` on it. */
  surfaceAlt: '#EEEEEA',
  /** Row and button hover. */
  surfaceHover: '#FAFAF8',
  /** The deepest neutral: pressed states, the soft hover. */
  surfaceDeep: '#E4E4DE',
  white: '#ffffff',

  /** The one accent: the button to press, the current tab, the live dot. 6.4:1 under white text. */
  accent: '#1F6B4E',
  accentHover: '#185A41',
  /** The top of the logo tile's gradient; it runs down to accentHover. */
  accentTile: '#25805E',
  /** A tint of it for selected states and quiet highlights; never text on its own. */
  accentSoft: '#E2F0E8',
  accentSoftHover: '#D3E8DC',
  /** The accent as small text: labels, links. 6.7:1 or better on every light ground. */
  accentInk: '#1A5C43',

  /** Secondary text. 4.9:1 on the deepest neutral, 6.2:1 on white. */
  muted: '#5E6168',
  /** Only legible on the INK surfaces (6.7:1 there). Under 3:1 on light grounds. */
  faint: '#9A9DA3',
  fainter: '#B4B7BC',
  body: '#3B3E44',
  bodyStrong: '#25282D',
  onInkBody: '#D5D7DB',
  onInkFaint: '#8B8E95',

  danger: '#B42318',
  dangerDot: '#D92D20',
  dangerChipBg: 'rgba(217,45,32,0.10)',
  onInkDanger: '#FF9C8F',

  border: 'rgba(20,22,26,0.12)',
  borderHair: 'rgba(20,22,26,0.07)',
  borderSoft: 'rgba(20,22,26,0.15)',
  onInkBorder: 'rgba(255,255,255,0.12)',
  onInkBorderStrong: 'rgba(255,255,255,0.18)',
  onInkDash: 'rgba(255,255,255,0.16)',
  rail: 'rgba(20,22,26,0.14)',
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
  display: "'Instrument Sans', system-ui, -apple-system, sans-serif",
  /** Money, day counts, dates — set with tabular figures (see styles.css). */
  figures: "'Instrument Sans', ui-sans-serif, system-ui, sans-serif",
  /** Body text and controls. */
  ui: "'Instrument Sans', system-ui, -apple-system, sans-serif",
} as const;

export const shadow = {
  /*
   * Soft elevation only. The hard ink offsets were the loudest part of the
   * old look; a card now sits on the page the way a card does in a bank app.
   */
  /** Buttons and emphasised cards. */
  raised: '0 1px 2px rgba(20,22,26,0.06), 0 2px 8px rgba(20,22,26,0.06)',
  raisedLg: '0 2px 4px rgba(20,22,26,0.06), 0 8px 24px rgba(20,22,26,0.08)',
  /** The hero card and floating toasts. */
  lift: '0 8px 28px rgba(20,22,26,0.12)',
  /** The tab bar, from above. */
  bar: '0 -1px 0 rgba(20,22,26,0.08)',
} as const;

export const radius = {
  /** Status chips and badges: squared off, not lozenges. */
  chip: 6,
  /** Buttons, inputs and tabs. A pill on every control read as a toy. */
  control: 10,
  card: 12,
  cardLg: 14,
  hero: 16,
  heroLg: 16,
  /** Only for things that are round: dots, toggles, progress bars. */
  pill: 999,
} as const;

/** The page ground. Named for the paper grain it used to carry; now plain. */
export const paperGrain = {
  backgroundColor: color.canvas,
} as const;
