import { useId, type CSSProperties } from 'react';
import { color, font } from '../../tokens';
import type { Category } from '../../lib/types';

/*
 * The mark: a lowercase k whose leg sweeps round like a clock hand — the
 * name, and a deadline running. Drawn on a 40-unit grid, the same geometry as
 * public/icons/icon.svg (512 units, ×12.8), so the app icon and every mark
 * inside the app are one drawing at different sizes.
 *
 * It replaced a tick inside a countdown ring: clear, but the tick-in-a-circle
 * is the stock symbol of half the to-do apps on the store, which made it
 * neither ownable nor safe to register. This one is drawn for kept.
 */
const K_PATHS = ['M14.22 9.22V30.78', 'M25.47 11.41L16.41 20', 'M16.41 20A11.72 11.72 0 0 1 26.41 30.47'];

function KGlyph({ ink, weight = 4.2 }: { ink: string; weight?: number }) {
  return (
    <g fill="none" stroke={ink} strokeWidth={weight} strokeLinecap="round">
      {K_PATHS.map((d) => <path key={d} d={d} />)}
    </g>
  );
}

/** The logo: the k, white, on the green tile — the app icon at header size. */
export function Logo({ size = 28, style }: { size?: number; style?: CSSProperties }) {
  // An id per instance: the header and the landing page can show two at once,
  // and a shared gradient id would let one tile paint with the other's.
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color.accentTile} />
          <stop offset="1" stopColor={color.accentHover} />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="8.75" fill={`url(#${id}t)`} />
      <KGlyph ink={color.white} weight={size < 32 ? 4.6 : 4.2} />
    </svg>
  );
}

/** The bare mark, no tile — for surfaces that are themselves the accent. */
export function LogoMark({ size = 18, fill = color.accent }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="6 5 28 30" aria-hidden="true">
      <KGlyph ink={fill} weight={4.4} />
    </svg>
  );
}

/** The celebrate variant: the mark on the soft tile — returned in time. */
export function LogoChecked({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="8.75" fill={color.accentSoft} />
      <KGlyph ink={color.accent} />
    </svg>
  );
}

/** The empty state: the mark in outline, waiting for a first receipt. */
export function LogoDashed({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ margin: '0 auto 20px' }} aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="8.5" fill="none" stroke={color.borderSoft} strokeWidth="1" strokeDasharray="2.5 2.5" />
      <KGlyph ink={color.fainter} weight={2.2} />
    </svg>
  );
}

export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    // data-logotype: WCAG 1.4.3 exempts text that is part of a logo or brand
    // name from the contrast minimum, and the green full stop is part of the
    // wordmark. Marked in the DOM rather than waved through,
    // so scripts/contrast.mjs applies the real exception to the real element
    // instead of carrying a hand-kept allowlist that would rot.
    <span
      data-logotype
      style={{ fontFamily: font.figures, fontSize: size, fontWeight: 600, letterSpacing: '-0.5px', lineHeight: 1 }}
    >
      kept<span style={{ color: color.accent }}>.</span>
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

export function Warning({ stroke: s = color.ink }: { stroke?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true">
      <path d="M8 1.5L15 14H1z" fill="none" stroke={s} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 6v4M8 11.8v.4" stroke={s} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ReceiptGlyph({ size = 18, stroke: s = color.ink }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path d="M3 2h12v13l-2-1.4L11 15l-2-1.4L7 15l-2-1.4L3 15V2z" fill="none" stroke={s} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M6 6h6M6 9h6" stroke={s} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function BellGlyph({ size = 18, stroke: s = color.ink }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path d="M9 2a5 5 0 015 5c0 3.5 1.5 4.5 1.5 4.5h-13S4 10.5 4 7a5 5 0 015-5z" fill="none" stroke={s} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7.5 14.5a1.6 1.6 0 003 0" fill="none" stroke={s} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function GearGlyph({ size = 18, stroke: s = color.ink }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="2.6" fill="none" stroke={s} strokeWidth="1.6" />
      <path d="M9 1.5v2.2M9 14.3v2.2M1.5 9h2.2M14.3 9h2.2M3.7 3.7l1.6 1.6M12.7 12.7l1.6 1.6M14.3 3.7l-1.6 1.6M5.3 12.7l-1.6 1.6" stroke={s} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** A plus in an outlined rounded square — the Add tab, drawn like its neighbours. */
export function PlusGlyph({ size = 18, stroke: s = color.ink }: { size?: number; stroke?: string } = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <rect x="2.5" y="2.5" width="13" height="13" rx="3.5" fill="none" stroke={s} strokeWidth="1.4" />
      <path d="M9 6v6M6 9h6" stroke={s} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function CameraGlyph() {
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" aria-hidden="true">
      <rect x="1" y="3.5" width="16" height="11" rx="2.5" fill="none" stroke={color.ink} strokeWidth="1.6" />
      <path d="M6 3.5L7.2 1h3.6L12 3.5" fill="none" stroke={color.ink} strokeWidth="1.6" />
      <circle cx="9" cy="9" r="3" fill="none" stroke={color.ink} strokeWidth="1.6" />
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

