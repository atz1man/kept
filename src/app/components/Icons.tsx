import { useId, type CSSProperties } from 'react';
import { color, font } from '../../tokens';
import type { Category } from '../../lib/types';

/*
 * The mark: a receipt that smiles, because the money came back. Two receipt
 * lines for eyes, a torn foot, and a smile bent into a return arrow. It
 * replaced a Q drawn as the countdown ring; the brand moved to warm and human
 * (cream, tomato, plum), and a ring reads as a timer, where a receipt with a
 * face reads as the thing you are keeping and the feeling of getting it back.
 *
 * One drawing, on the icon's own 512 grid: these paths are public/icons/icon.svg's,
 * verbatim, so the app icon and every mark inside the app cannot drift apart.
 *
 * In one colour the face is CUT out of the receipt rather than drawn on it, so
 * whatever is behind shows through and the same mark works on any ground.
 *
 * Simple on purpose: at 29px on a Settings row it has to read as one paper
 * shape with a face, so the eyes and smile are heavy and there is no detail
 * finer than the zigzag.
 */
const PAPER = 'M136 132Q136 104 164 104L348 104Q376 104 376 132L376 392L356 418L336 392L316 418L296 392L276 418L256 392L236 418L216 392L196 418L176 392L156 418L136 392Z';
const EYES = ['M196 196L226 196', 'M286 196L316 196'];
const SMILE = 'M190 268Q256 336 322 268';
const ARROW = 'M300 246L330 262L314 294';

function Face({ ink, smile }: { ink: string; smile: string }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {EYES.map((d) => <path key={d} d={d} stroke={ink} strokeWidth={22} />)}
      <path d={SMILE} stroke={smile} strokeWidth={26} />
      <path d={ARROW} stroke={smile} strokeWidth={22} />
    </g>
  );
}

/** The receipt in one colour, its face cut through to whatever is behind. */
function Cutout({ fill }: { fill: string }) {
  // An id per instance: a page can show several marks, and a shared mask id
  // would let one cut another.
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <g>
      <mask id={`${id}f`} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
        <rect width="512" height="512" fill="#FFFFFF" />
        <Face ink="#000000" smile="#000000" />
      </mask>
      <path d={PAPER} fill={fill} mask={`url(#${id}f)`} />
    </g>
  );
}

/** The logo: the cream receipt on the tomato tile — the app icon at header size. */
export function Logo({ size = 28, style }: { size?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" style={style} aria-hidden="true">
      <rect width="512" height="512" rx="112" fill={color.logoTile} />
      <path d={PAPER} fill={color.logoPaper} />
      <Face ink={color.logoInk} smile={color.logoTile} />
    </svg>
  );
}

/** The bare mark, no tile, in one colour — for surfaces that are themselves the accent. */
export function LogoMark({ size = 18, fill = color.accent }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="120 96 272 332" aria-hidden="true">
      <Cutout fill={fill} />
    </svg>
  );
}

/** The celebrate variant: the receipt on the soft tile — returned in time. */
export function LogoChecked({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="112" fill={color.accentSoft} />
      <Cutout fill={color.accent} />
    </svg>
  );
}

/** The empty state: the receipt in outline, waiting for a first one. */
export function LogoDashed({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" style={{ margin: '0 auto 20px' }} aria-hidden="true">
      <rect x="13" y="13" width="486" height="486" rx="109" fill="none" stroke={color.borderSoft} strokeWidth="13" strokeDasharray="32 32" />
      <Cutout fill={color.fainter} />
    </svg>
  );
}

export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    /*
     * "quids in!": the name in lower case, the display face at 700, with "in!" in the
     * brand's italic serif and the accent ink. The accent ink, not the logo's
     * bright tomato, so the exclamation reads at text contrast in both schemes
     * and needs no logotype exemption from the contrast sweep.
     *
     * Read as its proper name: a screen reader hears "Quids In", not the
     * lower-case styling or the punctuation.
     *
     * nowrap: "quids" over "in!" in a header squeezed at 320px is a different mark.
     */
    <span
      role="img"
      aria-label="Quids In"
      style={{ fontFamily: font.display, fontSize: size, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, whiteSpace: 'nowrap' }}
    >
      quids
      <span style={{ fontFamily: font.accent, fontStyle: 'italic', fontWeight: 400, fontSize: '1.08em', letterSpacing: '-0.01em', color: color.accentInk, marginLeft: '0.18em' }}>in!</span>
    </span>
  );
}

const STROKE = {
  fill: 'none' as const,
  stroke: color.ink,
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Category tile icons — 1.5px line work, one per receipt category. */
export function CatIcon({ cat, stroke: ink = color.ink }: { cat: Category; stroke?: string }) {
  const common = { width: 20, height: 20, viewBox: '0 0 20 20', 'aria-hidden': true } as const;
  const stroke = { ...STROKE, stroke: ink };
  switch (cat) {
    case 'audio':
      return (
        <svg {...common}>
          <path {...stroke} d="M3 12v-1a7 7 0 0114 0v1" />
          <rect {...stroke} x={2} y={11.5} width={4} height={6} rx={1.5} />
          <rect {...stroke} x={14} y={11.5} width={4} height={6} rx={1.5} />
        </svg>
      );
    case 'kitchen':
      return (
        <svg {...common}>
          <path {...stroke} d="M4 3h9a4 4 0 010 8H4z" />
          <path {...stroke} d="M6 11v6M11 11v6M4 17h9" />
        </svg>
      );
    case 'clothing':
      return (
        <svg {...common}>
          <path {...stroke} d="M7 3L3 6l2 3 1.5-1V17h7V8L15 9l2-3-4-3a3 3 0 01-6 0z" />
        </svg>
      );
    case 'beauty':
      return (
        <svg {...common}>
          <rect {...stroke} x={6} y={8} width={8} height={9} rx={2} />
          <path {...stroke} d="M8 8V5.5h4V8M10 3v2.5" />
        </svg>
      );
    case 'furniture':
      return (
        <svg {...common}>
          <rect {...stroke} x={3} y={4} width={14} height={13} rx={1.5} />
          <path {...stroke} d="M3 10.5h14M10 4v13M6.5 7.5h.01M13.5 7.5h.01M6.5 13.5h.01M13.5 13.5h.01" />
        </svg>
      );
    default:
      return (
        <svg width={20} height={20} viewBox="0 0 40 52" aria-hidden="true">
          <path {...stroke} d="M8 1H32Q39 1 39 9V44L32.7 50 26.3 44 20 50 13.7 44 7.3 50 1 44V9Q1 1 8 1Z" />
          <path {...stroke} d="M9 13h22M9 20h22M9 27h13" />
        </svg>
      );
  }
}

export function Tick({ size = 16, stroke: s = color.ink, width = 2.2 }: { size?: number; stroke?: string; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8.5l3.5 3.5L13 4.5" fill="none" stroke={s} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowRight({ stroke: s = color.ink }: { stroke?: string }) {
  return (
    <svg width="12" height="10" viewBox="0 0 12 10" aria-hidden="true">
      <path d="M1 5h9M7 1.5L10.5 5 7 8.5" fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronLeft({ stroke: s = color.ink }: { stroke?: string } = {}) {
  return (
    <svg width="9" height="15" viewBox="0 0 7 12" aria-hidden="true">
      <path d="M6 1L1 6l5 5" stroke={s} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A row that opens somewhere else, as an iPhone settings list ends one. */
export function ChevronRight({ stroke: s = color.muted }: { stroke?: string } = {}) {
  return (
    <svg width="8" height="13" viewBox="0 0 7 12" aria-hidden="true">
      <path d="M1 1l5 5-5 5" stroke={s} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A row whose value is a menu: the system's up-and-down mark beside it. */
export function ChevronUpDown({ stroke: s = color.muted }: { stroke?: string } = {}) {
  return (
    <svg width="9" height="14" viewBox="0 0 9 14" aria-hidden="true">
      <path d="M1.5 5L4.5 2l3 3M1.5 9l3 3 3-3" stroke={s} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Warning({ stroke: s = color.ink }: { stroke?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true">
      <path d="M8 1.5L15 14H1z" fill="none" stroke={s} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 6v4M8 11.8v.4" stroke={s} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/*
 * The tab bar's four glyphs come in two weights, the way a phone's own tab
 * bars draw them: outlined, and FILLED for the tab you are on. Filled by
 * shape, not by a second colour: the details are holes cut with
 * `fillRule="evenodd"`, so under forced colours — where every fill and
 * stroke becomes the one system colour — the current tab is still the solid
 * one. `data-glyph` names which is drawn, for the a11y sweep.
 */

export function ReceiptGlyph({ size = 18, stroke: s = color.ink, filled = false }: { size?: number; stroke?: string; filled?: boolean }) {
  if (filled) {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" data-glyph="filled">
        <path
          fillRule="evenodd"
          fill={s}
          d="M3.2 1.2h11.6a1 1 0 011 1v14.2l-2.8-1.9-2 1.4-2-1.4-2 1.4-2-1.4-2.8 1.9V2.2a1 1 0 011-1zM6 5.3a.7.7 0 000 1.4h6a.7.7 0 000-1.4H6zm0 3a.7.7 0 000 1.4h6a.7.7 0 000-1.4H6z"
        />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" data-glyph="outline">
      <path d="M3 2h12v13l-2-1.4L11 15l-2-1.4L7 15l-2-1.4L3 15V2z" fill="none" stroke={s} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M6 6h6M6 9h6" stroke={s} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function BellGlyph({ size = 18, stroke: s = color.ink, filled = false }: { size?: number; stroke?: string; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" data-glyph={filled ? 'filled' : 'outline'}>
      <path d="M9 2a5 5 0 015 5c0 3.5 1.5 4.5 1.5 4.5h-13S4 10.5 4 7a5 5 0 015-5z" fill={filled ? s : 'none'} stroke={s} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7.5 14.5a1.6 1.6 0 003 0" fill="none" stroke={s} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function GearGlyph({ size = 18, stroke: s = color.ink, filled = false }: { size?: number; stroke?: string; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" data-glyph={filled ? 'filled' : 'outline'}>
      {filled ? (
        // A solid wheel the spokes join, with the axle cut out of it.
        <path fillRule="evenodd" fill={s} d="M14.6 9a5.6 5.6 0 11-11.2 0 5.6 5.6 0 0111.2 0zM11.2 9a2.2 2.2 0 10-4.4 0 2.2 2.2 0 004.4 0z" />
      ) : (
        <circle cx="9" cy="9" r="2.6" fill="none" stroke={s} strokeWidth="1.6" />
      )}
      <path d="M9 1.5v2.2M9 14.3v2.2M1.5 9h2.2M14.3 9h2.2M3.7 3.7l1.6 1.6M12.7 12.7l1.6 1.6M14.3 3.7l-1.6 1.6M5.3 12.7l-1.6 1.6" stroke={s} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** A plus in an outlined rounded square — the Add tab, drawn like its neighbours. */
export function PlusGlyph({ size = 18, stroke: s = color.ink, filled = false }: { size?: number; stroke?: string; filled?: boolean } = {}) {
  if (filled) {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" data-glyph="filled">
        <path
          fillRule="evenodd"
          fill={s}
          d="M6 1.8h6A4.2 4.2 0 0116.2 6v6a4.2 4.2 0 01-4.2 4.2H6A4.2 4.2 0 011.8 12V6A4.2 4.2 0 016 1.8zM8.3 5.3v3h-3v1.4h3v3h1.4v-3h3V8.3h-3v-3H8.3z"
        />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" data-glyph="outline">
      <rect x="2.5" y="2.5" width="13" height="13" rx="3.5" fill="none" stroke={s} strokeWidth="1.4" />
      <path d="M9 6v6M6 9h6" stroke={s} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** A magnifier, for the search field: drawn at the weight of the tab glyphs. */
export function SearchGlyph({ size = 16, stroke: s = color.muted }: { size?: number; stroke?: string } = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" data-glyph="search">
      <circle cx="7" cy="7" r="4.9" fill="none" stroke={s} strokeWidth="1.6" />
      <path d="M10.6 10.6L14 14" stroke={s} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function CameraGlyph({ size = 18, stroke: s = color.ink }: { size?: number; stroke?: string } = {}) {
  return (
    <svg width={size} height={(size * 16) / 18} viewBox="0 0 18 16" aria-hidden="true">
      <rect x="1" y="3.5" width="16" height="11" rx="2.5" fill="none" stroke={s} strokeWidth="1.6" />
      <path d="M6 3.5L7.2 1h3.6L12 3.5" fill="none" stroke={s} strokeWidth="1.6" />
      <circle cx="9" cy="9" r="3" fill="none" stroke={s} strokeWidth="1.6" />
    </svg>
  );
}

export function MailGlyph() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
      <rect x="1" y="1" width="16" height="12" rx="2" fill="none" stroke={color.ink} strokeWidth="1.5" />
      <path d="M1.5 2.5L9 8l7.5-5.5" fill="none" stroke={color.ink} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function ShareGlyph() {
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true">
      <path d="M8 1v10M4.5 4L8 1l3.5 3" fill="none" stroke={color.ink} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 8H2v9h12V8h-1" fill="none" stroke={color.ink} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

