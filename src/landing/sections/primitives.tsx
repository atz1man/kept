import type { CSSProperties, ReactNode } from 'react';
import { color, font, radius, shadow } from '../../tokens';
import { LogoMark } from '../../app/components/Icons';

export const WRAP: CSSProperties = { maxWidth: 1160, margin: '0 auto', padding: '0 28px' };

export function Eyebrow({ children, onInk }: { children: ReactNode; onInk?: boolean }) {
  return (
    <div style={{ fontSize: 13, color: onInk ? color.accentSoft : color.accentInk, fontWeight: 600 }}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, maxWidth = 620 }: { children: ReactNode; maxWidth?: number }) {
  return (
    <h2 style={{ fontFamily: font.display, fontSize: 'clamp(30px, 4vw, 40px)', fontWeight: 700, letterSpacing: '-0.03em', margin: '14px 0 0', maxWidth, lineHeight: 1.1 }}>
      {children}
    </h2>
  );
}

/**
 * The App Store button. It is an anchor, not a div: it is the page's whole
 * conversion path, and a control that cannot be opened in a new tab or
 * reached by keyboard is not one.
 */
/**
 * The page's way into the product.
 *
 * It was an App Store badge with `href="#"`. Two things wrong with that, and
 * the second is worse than the first: it promised an iOS app that does not
 * exist, and it went NOWHERE — so did the nav button beside it, which pointed
 * at the pricing section. The landing page's only mention of `/app/` was the
 * demo iframe's `src`. A visitor who read the whole page and wanted to use
 * kept had no way to reach it.
 *
 * The product is an installable PWA served from this same origin, which is
 * both true and better than the promise it replaces: nothing to download, and
 * it works offline once opened.
 */
export function OpenAppButton({ large }: { large?: boolean }) {
  return (
    <a
      className="k-primary"
      href="/app/"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 12, background: color.accent, color: color.white,
        padding: large ? '15px 30px' : '14px 26px', borderRadius: 12, boxShadow: shadow.raised,
      }}
    >
      <LogoMark size={22} fill={color.white} />
      <span>
        <span style={{ display: 'block', fontSize: 10, fontWeight: 600, letterSpacing: 0, opacity: 0.8 }}>
          Nothing to install
        </span>
        <span style={{ display: 'block', fontSize: 17, fontWeight: 600, lineHeight: 1.1 }}>Open Quids In</span>
      </span>
    </a>
  );
}

export function Card({ children, emphasised = true, style }: { children: ReactNode; emphasised?: boolean; style?: CSSProperties }) {
  return (
    <div
      style={{
        // As the app draws its cards: an emphasised one floats on a soft
        // shadow, the rest sit in the grey card colour — neither outlined.
        background: emphasised ? color.white : color.surfaceAlt,
        borderRadius: radius.cardLg,
        boxShadow: emphasised ? shadow.raisedLg : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
