import type { CSSProperties, ReactNode } from 'react';
import { color, font, palette, shadow } from '../../tokens';
import { APP_STORE, BADGE_PATH, IPHONE_ANSWER_ID } from '../app-store-listing';
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

/**
 * The App Store, in the place a visitor looks for it.
 *
 * Live, it is Apple's own badge linking to the listing. Until then it is an
 * honest "coming" button that opens the answer about using Quids In on an
 * iPhone today — never a badge, which Apple permits only for an app on the
 * store, and never a link to nowhere, which is what the old one was.
 *
 * Always black on white type, in either theme: it stands for the App Store's
 * own black badge, so it does not turn pale in dark mode.
 */
export function AppStoreButton() {
  if (APP_STORE.url) {
    return (
      <a href={APP_STORE.url} style={{ display: 'inline-flex', minHeight: 48 }}>
        <img src={BADGE_PATH} alt="Download on the App Store" height={54} style={{ height: 54, width: 'auto', display: 'block' }} />
      </a>
    );
  }
  const ink = palette.light.ink;
  return (
    <a
      href={`#${IPHONE_ANSWER_ID}`}
      className="k-store"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: ink, color: palette.light.white, padding: '11px 22px 11px 18px', borderRadius: 14, border: `1.5px solid ${palette.light.onHeroSoft}`, minHeight: 48, boxSizing: 'border-box' }}
    >
      <svg aria-hidden="true" width="22" height="26" viewBox="0 0 22 26">
        <rect x="2" y="1" width="18" height="24" rx="4.5" fill="none" stroke={palette.light.white} strokeWidth="2" />
        <rect x="8" y="3.6" width="6" height="2" rx="1" fill={palette.light.white} />
      </svg>
      <span>
        <span style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: 0.2 }}>iPhone app</span>
        <span style={{ display: 'block', fontSize: 17, fontWeight: 650, lineHeight: 1.1, letterSpacing: '-0.01em' }}>Coming to the App Store</span>
      </span>
    </a>
  );
}
