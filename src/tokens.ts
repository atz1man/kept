/**
 * Kept design tokens — the single source for every colour, shadow and typeface
 * in the app and the landing page. Components import from here; no raw hex
 * literals live in a component file.
 */
/*
 * Two palettes, one set of names.
 *
 * The app used to paint one palette and say so: `color-scheme: light`, a white
 * canvas, near-black ink, whatever the phone was set to. That was honest, but
 * a receipt tracker is opened in bed at eleven at night to check whether the
 * coat goes back tomorrow, and a full-white screen at that hour is the thing
 * people turn an app's brightness down for — or stop opening it.
 *
 * So every colour now exists twice, under the SAME name: `palette.light` is
 * the palette this file always held, unchanged to the hex, and `palette.dark`
 * is its counterpart. Components never see either. They import `color`, whose
 * values are CSS custom properties (`var(--k-ink)`), and the stylesheet decides
 * which palette those resolve to from `prefers-color-scheme`. That keeps the
 * forty-odd files that paint with inline styles exactly as they were, and it
 * means the switch happens in the browser's own cascade — no re-render, no
 * listener, no first frame painted in the wrong scheme.
 *
 * What cannot read a custom property reads a palette directly, and always the
 * LIGHT one: the win card is drawn on a <canvas>, the claim pack is a
 * standalone document a person sends to a shop, the store frames are images —
 * each is a file that leaves the phone, and a file someone else opens should
 * not depend on how the sender's phone was set when they made it.
 *
 * The stylesheet cannot import this file, which is why it drifts — so
 * test/scheme.test.ts reads every `--k-*` declaration back out of styles.css
 * and holds each to the palette value of the same name, in both schemes, and
 * the contrast tests measure every pairing in both.
 */
const light = {
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
  /**
   * The ink as a SURFACE: the toasts, the photo viewer. On a light device it
   * is the ink itself; on a dark one the ink is near-white text, and a toast
   * painted in it would be a white slab — so the surface has its own name.
   */
  inkSurface: '#0A0A12',

  /** The page. White, as asked for; cards sit on it in `surfaceAlt`. */
  canvas: '#FFFFFF',
  /**
   * A raised surface: a card on the page, a button on a grey panel, an input.
   * White on a light device, so it was spelled `white` at sixty call sites —
   * which on a dark device would have been sixty white slabs. `white` is now
   * only ever the colour white: text and glyphs on a fill.
   */
  surface: '#FFFFFF',
  /** Cards, list groups, inputs, secondary buttons. 5.6:1 for `muted` on it. */
  surfaceAlt: '#F4F5F8',
  /** Row and button hover on white. */
  surfaceHover: '#F7F8FA',
  /** The deepest neutral: pressed states, hover on a card. 5.0:1 for `muted`. */
  surfaceDeep: '#E8EAF0',
  /** White, in every scheme: text and glyphs on the accent, the danger fill, the hero, the toggle's knob. */
  white: '#FFFFFF',
  /** The tab bar: the page's own ground, frosted. */
  bar: 'rgba(255,255,255,0.94)',
  /** Under a sheet. */
  scrim: 'rgba(10,10,18,0.55)',

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
   * Secondary text ON the accent fill: the shop's address under "Start your
   * return". It borrowed `accentSoft`, which is right in daylight and is a
   * deep indigo in the dark — 2.9:1 on the button. So it has its own name,
   * and the same pale lilac in both.
   */
  onAccentSoft: '#EEEDFF',
  /**
   * The accent as a FIGURE on a card: the deadline ring on a receipt and the
   * day count inside it. The fill itself in daylight; on a dark card the fill
   * is 2.8:1, under what a 26px number or a ring that carries meaning needs,
   * and it cannot simply be lifted — white text on the buttons and the lilac
   * under "Start your return" both pin how light the fill may go.
   */
  accentFigure: '#4636E8',

  /**
   * The focus ring, outline and halo (see `:focus-visible` in styles.css). On
   * a light device the accent with a white halo, as it always was; on a dark
   * one the halo is the page and the outline the lifted accent ink — a 5px
   * white halo round every focused control on a black screen is a glare, not
   * an indicator.
   */
  focus: '#4636E8',
  focusHalo: '#FFFFFF',

  /**
   * The ring in the mark: Quids In is money coming back, so the one colour on
   * the violet tile besides the white tick is gold. Only the logo and a few
   * hero accents use it. 3.5:1 against the tile's lightest stop, so the ring
   * holds its edge at 29px.
   */
  gold: '#F7C948',

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
  /**
   * Red as a FILL under white text — the erase-everything confirm. The same
   * red as `danger` on a light device; on a dark one `danger` is lifted to be
   * read as text on black, and white on that lifted red would not be read.
   */
  dangerFill: '#C2261C',
  dangerDot: '#E5372B',
  dangerChipBg: 'rgba(229,55,43,0.10)',
  /** The edge of a refusal card. */
  dangerBorder: 'rgba(229,55,43,0.4)',
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
  /** The onboarding's pages not yet reached. */
  dotOff: 'rgba(10,10,18,0.18)',
} as const;

export type ColorName = keyof typeof light;

/*
 * The dark palette: an iOS-shaped one rather than an inverted one.
 *
 * Near-black rather than black for the page, because pure black under white
 * text smears on an OLED as it scrolls; raised things a step LIGHTER rather
 * than shadowed, because a shadow on black is invisible and elevation in the
 * dark is read as light. Grey panel #17171F, a card or button on it #23232E,
 * hover and pressed a step past that — the same ordering the light palette
 * has, run the other way.
 *
 * The accent is lifted, not kept: #4636E8 on the dark page is 2.6:1, under the
 * 3:1 a control's indicator needs, so the fill moves to #5A4BFA (3.6:1 on the
 * page, and still 5.5:1 under white text) and the accent AS TEXT to #ABA4FF,
 * which reads at 5.9:1 or better on every dark ground. Red is split the same
 * way: `danger` text lifts to #FF7B70, and the fill under white text holds at
 * #CC3226. The hero stays exactly as vivid as it is in daylight — it is the
 * one thing on the screen meant to be bright, and white on it was measured
 * against its own stops, not the page.
 */
const dark = {
  ink: '#F4F4F8',
  inkHover: '#FFFFFF',
  inkSurface: '#2A2A35',

  canvas: '#0B0B12',
  surface: '#23232E',
  surfaceAlt: '#17171F',
  surfaceHover: '#2A2A36',
  surfaceDeep: '#30303C',
  white: '#FFFFFF',
  bar: 'rgba(23,23,31,0.94)',
  scrim: 'rgba(0,0,0,0.6)',

  accent: '#5A4BFA',
  accentHover: '#4A3BF0',
  accentTile: '#5B4CF5',
  accentSoft: '#252148',
  accentSoftHover: '#2F2A5C',
  accentInk: '#ABA4FF',
  onAccentSoft: '#EEEDFF',
  accentFigure: '#ABA4FF',

  focus: '#ABA4FF',
  focusHalo: '#0B0B12',

  gold: '#F7C948',

  heroTop: '#0F0B3D',
  heroMid: '#3A27C9',
  heroEnd: '#2453E6',
  onHeroSoft: '#E9E7FF',
  onHeroGlass: 'rgba(255,255,255,0.16)',
  onHeroChip: 'rgba(15,11,61,0.25)',

  muted: '#A0A3B1',
  faint: '#9EA1B0',
  fainter: '#5F6272',
  body: '#CDD0DA',
  bodyStrong: '#E6E7EE',
  onInkBody: '#D5D7DE',
  onInkFaint: '#A3A6B3',

  danger: '#FF7B70',
  dangerFill: '#CC3226',
  dangerDot: '#FF5F52',
  dangerChipBg: 'rgba(255,95,82,0.16)',
  dangerBorder: 'rgba(255,95,82,0.5)',
  onInkDanger: '#FF9C8F',

  caution: '#3A2A0E',
  cautionInk: '#FFC970',

  border: 'rgba(255,255,255,0.12)',
  borderHair: 'rgba(255,255,255,0.07)',
  borderSoft: 'rgba(255,255,255,0.16)',
  onInkBorder: 'rgba(255,255,255,0.12)',
  onInkBorderStrong: 'rgba(255,255,255,0.18)',
  onInkDash: 'rgba(255,255,255,0.16)',
  rail: 'rgba(255,255,255,0.16)',
  dotOff: 'rgba(255,255,255,0.24)',
} as const satisfies Record<ColorName, string>;

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
 *
 * In the dark the relation turns over — deep grounds, light inks — at 7.5:1
 * or better, measured the same way.
 */
const categoryLight = {
  audio: { tint: '#E7EEFB', ink: '#2A55A8' },
  kitchen: { tint: '#FCEEE2', ink: '#9A4510' },
  clothing: { tint: '#E2F4F2', ink: '#16645D' },
  beauty: { tint: '#FBE8EF', ink: '#A12F5B' },
  furniture: { tint: '#E9F2E3', ink: '#43652A' },
  other: { tint: light.surfaceAlt, ink: light.ink },
} as const;

export type CategoryName = keyof typeof categoryLight;

const categoryDark = {
  audio: { tint: '#16233D', ink: '#8DB4FF' },
  kitchen: { tint: '#33210F', ink: '#F2A66B' },
  clothing: { tint: '#0F2C29', ink: '#6FD3C7' },
  beauty: { tint: '#361626', ink: '#F59BBE' },
  furniture: { tint: '#1C2A14', ink: '#A3CF7E' },
  other: { tint: dark.surfaceAlt, ink: dark.ink },
} as const satisfies Record<CategoryName, { tint: string; ink: string }>;

/** The raw values, for what cannot read a custom property — and for the tests. */
export const palette = { light, dark } as const;
export const categoryPalette = { light: categoryLight, dark: categoryDark } as const;

/** `accentSoftHover` → `--k-accent-soft-hover`. The one spelling styles.css is checked against. */
export const cssVarName = (name: string): string => `--k-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

const cssVar = (name: string) => `var(${cssVarName(name)})`;

/**
 * What components paint with: every name, as the custom property that
 * resolves to the current scheme's value. Concatenation still works
 * (`1px solid ${color.border}` is `1px solid var(--k-border)`); what does not
 * is parsing one, or handing one to a <canvas> — use `palette.light` there.
 */
export const color = Object.fromEntries(
  (Object.keys(light) as ColorName[]).map((name) => [name, cssVar(name)]),
) as { readonly [K in ColorName]: string };

/** The hero's gradient from any set of its three stops: the custom properties, or a palette's raw values. */
export const heroGradient = (c: { heroTop: string; heroMid: string; heroEnd: string }): string =>
  `linear-gradient(155deg, ${c.heroTop} 0%, ${c.heroMid} 58%, ${c.heroEnd} 100%)`;

/** The hero's gradient, drawn from the three stops above. */
export const gradient = {
  hero: heroGradient(color),
  /** The primary button: a light source on the accent, top to bottom. */
  accent: `linear-gradient(${color.accentTile}, ${color.accentHover})`,
} as const;

/** The category colours, as custom properties: `--k-cat-audio-tint`, `--k-cat-audio-ink`. */
export const category = Object.fromEntries(
  (Object.keys(categoryLight) as CategoryName[]).map((name) => [
    name,
    { tint: cssVar(`cat-${name}-tint`), ink: cssVar(`cat-${name}-ink`) },
  ]),
) as { readonly [K in CategoryName]: { readonly tint: string; readonly ink: string } };

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
