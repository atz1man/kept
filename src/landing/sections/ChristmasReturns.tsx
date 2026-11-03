import { color, font, radius, shadow } from '../../tokens';
import { christmasRows } from '../christmas';
import { SectionHead, WRAP } from './primitives';

/** How many rows show before "and N more": a phone screen's worth. */
const SHOWN = 6;

/**
 * "Bought a present?" — the shops' Christmas return dates, in season only
 * (src/landing/christmas.ts). Each row loads its shop into the checker above,
 * which counts with the same dates.
 */
export function ChristmasReturns({ today, onCheck }: { today: Date; onCheck: (store: string) => void }) {
  const rows = christmasRows(today);
  if (rows.length === 0) return null;
  const row = (r: (typeof rows)[number]) => (
    <li key={r.store}>
      <button
        type="button"
        className="k-chip"
        onClick={() => onCheck(r.store)}
        aria-label={`Check a ${r.store} return`}
        style={{ width: '100%', textAlign: 'left', display: 'grid', gap: 4, background: color.surface, border: 0, borderRadius: radius.card, padding: '14px 16px', minHeight: 44, boxShadow: shadow.raised, cursor: 'pointer', fontFamily: font.ui, color: color.ink }}
      >
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 650, fontSize: 15.5 }}>{r.store}</span>
          <span style={{ fontWeight: 650, fontSize: 15, color: color.accentInk }}>{r.returnBy}</span>
        </span>
        <span style={{ fontSize: 13.5, color: color.body }}>{r.bought}{r.note ? ` · ${r.note}` : ''}</span>
      </button>
    </li>
  );
  const list = { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 10 } as const;
  return (
    <section id="christmas" aria-labelledby="christmas-title" className="k-anchor" style={{ ...WRAP, padding: 'clamp(64px, 9vw, 112px) 28px 0' }}>
      <div style={{ background: color.surfaceAlt, borderRadius: radius.hero, padding: 'clamp(24px, 5vw, 48px)' }}>
        <SectionHead
          id="christmas-title"
          eyebrow="Christmas returns"
          title="Bought a present? You may have longer than you think."
          lede={`${rows.length} shops give later return dates for things bought before Christmas, each quoted from the shop’s own page. Quids In counts with them, so a December present shows the date the shop really gives. Tap one to check.`}
        />
        <ul style={{ ...list, marginTop: 28 }}>{rows.slice(0, SHOWN).map(row)}</ul>
        {rows.length > SHOWN && (
          <details className="k-faq" style={{ marginTop: 10 }}>
            <summary style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, cursor: 'pointer', fontSize: 15, fontWeight: 600, color: color.accentInk }}>
              And {rows.length - SHOWN} more shops
            </summary>
            <ul style={{ ...list, marginTop: 10 }}>{rows.slice(SHOWN).map(row)}</ul>
          </details>
        )}
      </div>
    </section>
  );
}
