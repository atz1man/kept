import { useId, type CSSProperties } from 'react';
import { color, font } from '../../tokens';
import type { Category } from '../../lib/types';

/*
 * The mark: a Q drawn as the countdown ring every receipt in the app carries,
 * its last stretch spent, with a tick for a tail — a return made in time,
 * which is what "quids in" means. It replaced a gold coin inside a return
 * arrow, which said "refund" in the way every refund icon does and had nothing
 * to do with the ring the product is built around.
 *
 * One drawing, on the icon's own 512 grid: these paths are public/icons/icon.svg's,
 * verbatim, so the app icon and every mark inside the app cannot drift apart.
 *
 * The tick is CUT out of the ring rather than drawn over it with an outline:
 * an outline has to be painted in the tile's colour, which is a gradient, and
 * would be right at one height of it only. A cut lets whatever is behind show,
 * so the same drawing works on the tile, the soft tile, and in one colour.
 *
 * Simple on purpose: it has to read at 29px on a Settings row, so it is one
 * ring, one tail and one gap.
 */
const SPENT = 'M245 122A134 134 0 0 1 361 189';
const RING = 'M361 189A134 134 0 1 1 245 122';
const TICK = 'M286 335L325 372L407 282';

function Glyph({ ring, tick, spent, spentOpacity }: { ring: string; tick: string; spent: string; spentOpacity: number }) {
  // An id per instance: a page can show several marks, and a shared mask id
  // would let one cut another's ring.
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <g>
      <mask id={`${id}c`} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
        <rect width="512" height="512" fill="#FFFFFF" />
        <path d={TICK} fill="none" stroke="#000000" strokeWidth={80} strokeLinecap="round" strokeLinejoin="round" />
      </mask>
      <g mask={`url(#${id}c)`}>
        <path d={SPENT} fill="none" stroke={spent} strokeOpacity={spentOpacity} strokeWidth={58} />
        <path d={RING} fill="none" stroke={ring} strokeWidth={58} strokeLinecap="round" />
      </g>
      <path d={TICK} fill="none" stroke={tick} strokeWidth={46} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** The logo: the gold ring and white tick on the violet tile — the app icon at header size. */
export function Logo({ size = 28, style }: { size?: number; style?: CSSProperties }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color.accentTile} />
          <stop offset="1" stopColor={color.accentHover} />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${id}t)`} />
      <Glyph ring={color.gold} tick={color.white} spent={color.white} spentOpacity={0.24} />
    </svg>
  );
}

/** The bare mark, no tile, in one colour — for surfaces that are themselves the accent. */
export function LogoMark({ size = 18, fill = color.accent }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="74 85 364 342" aria-hidden="true">
      <Glyph ring={fill} tick={fill} spent={fill} spentOpacity={0.28} />
    </svg>
  );
}

/** The celebrate variant: the mark on the soft tile — returned in time. */
export function LogoChecked({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="112" fill={color.accentSoft} />
      <Glyph ring={color.accent} tick={color.accent} spent={color.accent} spentOpacity={0.25} />
    </svg>
  );
}

/** The empty state: the mark in outline, waiting for a first receipt. */
export function LogoDashed({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" style={{ margin: '0 auto 20px' }} aria-hidden="true">
      <rect x="13" y="13" width="486" height="486" rx="109" fill="none" stroke={color.borderSoft} strokeWidth="13" strokeDasharray="32 32" />
      <Glyph ring={color.fainter} tick={color.fainter} spent={color.fainter} spentOpacity={0.35} />
    </svg>
  );
}

export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    /*
     * The name, set the way "kept." was — the display face at 600, pulled in
     * half a pixel — in ink throughout. The old mark's green full stop needed
     * WCAG 1.4.3's logotype exemption (`data-logotype`, which
     * scripts/contrast.mjs honours); this one is plain ink and does not, so
     * the contrast sweep measures it like any other text.
     *
     * nowrap: the name is two words now, and "Quids" over "In" in a header
     * squeezed at 320px is a different mark.
     */
    <span
      style={{ fontFamily: font.figures, fontSize: size, fontWeight: 600, letterSpacing: '-0.5px', lineHeight: 1, whiteSpace: 'nowrap' }}
    >
      Quids In
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

