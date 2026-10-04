import { category, color, font } from '../../tokens';
import type { Category } from '../../lib/types';
import { CatIcon } from './Icons';

/**
 * The shop's initials, round, in its category's colour — with the kind of
 * thing as a small badge on the rim.
 *
 * A bank statement draws each payee as a round logo, and that is most of why
 * a statement scans: the eye finds the shop by shape before reading a word.
 * Kept cannot show shops' logos — it would be fetching them from somewhere,
 * which the privacy notice rules out, and they are not ours to use — so the
 * initials stand in, and the category tint does the work colour does in a
 * statement. Decorative throughout: the row's own text names the shop.
 */
export function Avatar({ store, cat, size = 44 }: { store: string; cat: Category; size?: number }) {
  const tone = category[cat];
  const badge = Math.round(size * 0.42);
  return (
    <span aria-hidden="true" style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'block' }}>
      <span
        style={{
          width: size, height: size, borderRadius: '50%', background: tone.tint, color: tone.ink,
          display: 'grid', placeItems: 'center', fontFamily: font.display, fontWeight: 700,
          fontSize: Math.round(size * 0.36), letterSpacing: '-0.02em',
        }}
      >
        {initials(store)}
      </span>
      <span
        style={{
          position: 'absolute', left: size - badge + 3, top: size - badge + 3, width: badge, height: badge, borderRadius: '50%',
          background: color.white, boxShadow: `0 0 0 2px ${color.white}`, display: 'grid', placeItems: 'center',
        }}
      >
        <span style={{ transform: `scale(${(badge - 4) / 20})`, display: 'grid', placeItems: 'center' }}>
          <CatIcon cat={cat} stroke={tone.ink} />
        </span>
      </span>
    </span>
  );
}

/** "John Lewis" → "JL", "Currys" → "C", "M&S" → "M". Two at most, letters and digits only. */
export function initials(store: string): string {
  const words = store.split(/[\s\-/]+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
  if (words.length === 0) return '·';
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}
