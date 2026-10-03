import type { ReactNode } from 'react';
import { color, font } from '../tokens';

/**
 * The shell for the site's plain reading pages — privacy, rights. One column,
 * the app's own type and colours, and a way back at the top: in the iOS app
 * there is no browser chrome, and "/" is the app itself.
 */
export function ProsePage({ title, lede, children }: { title: string; lede: ReactNode; children: ReactNode }) {
  return (
    <main style={{ background: color.canvas, color: color.ink, fontFamily: font.ui, minHeight: '100vh' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '44px 20px 80px' }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontFamily: font.display, fontWeight: 600, fontSize: 18, color: color.ink, textDecoration: 'none' }}>
          ← kept.
        </a>
        <h1 style={{ fontFamily: font.display, fontSize: 'clamp(32px, 6vw, 44px)', fontWeight: 600, letterSpacing: '-1.4px', lineHeight: 1.05, margin: '28px 0 0' }}>
          {title}
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: color.bodyStrong, marginTop: 16 }}>{lede}</p>
        {children}
      </div>
    </main>
  );
}

export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} style={{ marginTop: 34 }}>
      <h2 style={{ fontFamily: font.display, fontSize: 21, fontWeight: 600, letterSpacing: '-0.4px', margin: 0 }}>{title}</h2>
      <div style={{ fontSize: 16, lineHeight: 1.65, color: color.body, marginTop: 10 }}>{children}</div>
    </section>
  );
}

export function Fine({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: 13, color: color.muted, marginTop: 44, lineHeight: 1.6 }}>{children}</p>;
}
