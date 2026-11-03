import { color, font, radius } from '../../tokens';
import { proofFacts } from '../proof';
import { SectionHead, WRAP } from './primitives';

/** "Checked, not guessed": the page's proof, every figure from the app's own tables (src/landing/proof.ts). */
export function Proof({ today }: { today: Date }) {
  const facts = proofFacts(today);
  return (
    <section id="proof" aria-labelledby="proof-title" className="k-anchor" style={{ ...WRAP, padding: 'clamp(64px, 9vw, 112px) 28px 0' }}>
      <SectionHead id="proof-title" center eyebrow="Checked, not guessed" title="Every date has a source." />
      <ul style={{ listStyle: 'none', padding: 0, margin: '40px 0 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 16 }}>
        {facts.map((f) => (
          <li key={f.label} className="k-reveal" style={{ background: color.surfaceAlt, borderRadius: radius.hero, padding: '26px 24px' }}>
            <div style={{ fontFamily: font.figures, fontVariantNumeric: 'proportional-nums', fontSize: 'clamp(34px, 4vw, 44px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: color.accentInk }}>{f.figure}</div>
            <p style={{ fontSize: 15, lineHeight: 1.55, color: color.body, margin: '12px 0 0' }}>{f.label}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
