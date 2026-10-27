import type { CSSProperties, ReactNode } from 'react';
import { color, font, radius, shadow } from '../../tokens';
import { LogoMark } from '../../app/components/Icons';

export const WRAP: CSSProperties = { maxWidth: 1160, margin: '0 auto', padding: '0 28px' };

export function Eyebrow({ children, onInk }: { children: ReactNode; onInk?: boolean }) {
  return (
    <div style={{ fontSize: 13, color: onInk ? color.onHeroSoft : color.accentInk, fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
      {children}
    </div>
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
export function OpenAppButton({ large, onHero }: { large?: boolean; onHero?: boolean }) {
  return (
    <a
      // On the hero's gradient the accent button is violet on violet, so it
      // turns over: a white button with the accent as its ink.
      className={onHero ? 'k-on-hero' : 'k-primary'}
      href="/app/"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 12,
        background: onHero ? color.white : color.accent, color: onHero ? color.accentInk : color.white,
        padding: large ? '15px 30px' : '14px 26px', borderRadius: 999, boxShadow: onHero ? undefined : shadow.raised,
      }}
    >
      <LogoMark size={22} fill={onHero ? color.accentInk : color.white} />
      <span>
        <span style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: 0, opacity: onHero ? 1 : 0.85 }}>
          Nothing to install
        </span>
        <span style={{ display: 'block', fontSize: 17, fontWeight: 600, lineHeight: 1.1 }}>Open Quids In</span>
      </span>
    </a>
  );
}

/** A section's eyebrow, title and lede, set the same way on every section. */
export function SectionHead({ eyebrow, title, lede, center, onInk, id }: { eyebrow: string; title: ReactNode; lede?: ReactNode; center?: boolean; onInk?: boolean; id?: string }) {
  return (
    <div style={{ textAlign: center ? 'center' : undefined, maxWidth: center ? 720 : undefined, margin: center ? '0 auto' : undefined }}>
      <Eyebrow onInk={onInk}>{eyebrow}</Eyebrow>
      <h2 id={id} style={{ fontFamily: font.display, fontSize: 'clamp(30px, 4.2vw, 46px)', fontWeight: 700, letterSpacing: '-0.035em', margin: '14px 0 0', lineHeight: 1.08, color: onInk ? color.white : color.ink, maxWidth: center ? undefined : 720 }}>
        {title}
      </h2>
      {lede && (
        <p style={{ fontSize: 17, color: onInk ? color.onHeroSoft : color.body, margin: '18px 0 0', lineHeight: 1.6, maxWidth: center ? undefined : 600 }}>
          {lede}
        </p>
      )}
    </div>
  );
}

export function Card({ children, emphasised = true, style }: { children: ReactNode; emphasised?: boolean; style?: CSSProperties }) {
  return (
    <div
      style={{
        // As the app draws its cards: an emphasised one floats on a soft
        // shadow, the rest sit in the grey card colour — neither outlined.
        background: emphasised ? color.surface : color.surfaceAlt,
        borderRadius: radius.cardLg,
        boxShadow: emphasised ? shadow.raisedLg : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
