import { category, color, font } from '../../tokens';
import { findStore } from '../../lib/stores';

/**
 * The three "problem" illustrations.
 *
 * Drawn as the things themselves: three real orders with their clocks, a till
 * receipt fading on top of a buried inbox, and a page of terms with the one
 * clause that matters marked. The first version of each was grey bars standing
 * in for text, which read as a wireframe left on the page rather than as a
 * picture of anything. Every shop window named here is read from the table, so
 * a corrected window corrects the drawing too.
 */
const frame = { width: '100%', height: '100%', viewBox: '0 0 400 220', preserveAspectRatio: 'xMidYMid slice' } as const;
const UI = font.ui;
const FIG = font.figures;

const FROM = { purchase: 'from purchase', dispatch: 'from dispatch', delivery: 'from delivery' } as const;
function clock(name: string): { days: number; from: string } {
  const s = findStore(name);
  return { days: s?.windowDays ?? 0, from: s ? FROM[s.clockStart] : '' };
}

/** A soft drop shadow, drawn rather than filtered so it themes with the ink. */
const lift = (w: number, h: number, r: number) => <rect x="2" y="5" width={w} height={h} rx={r} fill={color.ink} opacity="0.07" />;

/** Three orders from one afternoon, each on a different clock. */
export function HaulArt() {
  const rows = [
    { shop: 'Currys', item: 'Headphones', tile: category.audio, ...clock('Currys') },
    { shop: 'ASOS', item: 'Linen shirt', tile: category.clothing, ...clock('ASOS') },
    { shop: 'IKEA', item: 'Bookcase', tile: category.furniture, ...clock('IKEA') },
  ];
  return (
    <svg {...frame} role="img" aria-label={`Three purchases from one afternoon, each on its own return clock: ${rows.map((r) => `${r.shop}, ${r.days} days ${r.from}`).join('; ')}`}>
      <defs>
        <linearGradient id="haul-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color.accentSoft} />
          <stop offset="1" stopColor={color.surfaceAlt} />
        </linearGradient>
      </defs>
      <rect width="400" height="220" fill="url(#haul-ground)" />
      <circle cx="362" cy="22" r="62" fill="none" stroke={color.accent} strokeOpacity="0.12" strokeWidth="14" />
      {rows.map((r, i) => (
        <g key={r.shop} transform={`translate(${50 + i * 10} ${22 + i * 60}) rotate(${[-1.5, 0.8, -0.6][i]})`}>
          {lift(284, 50, 12)}
          <rect width="284" height="50" rx="12" fill={color.surface} />
          <rect x="11" y="11" width="28" height="28" rx="8" fill={r.tile.tint} />
          <text x="25" y="30" textAnchor="middle" fontSize="13" fontWeight="700" fill={r.tile.ink} fontFamily={UI}>{r.shop[0]}</text>
          <text x="50" y="23" fontSize="12" fontWeight="650" fill={color.ink} fontFamily={UI}>{r.shop}</text>
          <text x="50" y="37" fontSize="10.5" fill={color.muted} fontFamily={UI}>{r.item}</text>
          <rect x="164" y="15" width="110" height="20" rx="10" fill={i === 0 ? color.caution : color.surfaceAlt} />
          <text x="219" y="29" textAnchor="middle" fontSize="9.5" fontWeight="650" fill={i === 0 ? color.cautionInk : color.bodyStrong} fontFamily={UI}>{r.days} days {r.from}</text>
        </g>
      ))}
    </svg>
  );
}

/** A till receipt, already fading, on top of an inbox where the order email sank. */
export function LostReceiptsArt() {
  const items: [string, string][] = [['LINEN SHIRT M', '32.00'], ['SOCKS X3', '9.00'], ['GIFT BAG', '0.50']];
  // The torn bottom edge: a zigzag back from right to left.
  const edge = Array.from({ length: 15 }, (_, i) => `L${120 - i * 8} ${i % 2 ? 196 : 190}`).join(' ');
  const paper = `M8 6 H128 L128 196 ${edge} L8 196 Z`;
  return (
    <svg {...frame} role="img" aria-label="A faded till receipt lying on top of an inbox with thousands of unread emails">
      <rect width="400" height="220" fill={color.surfaceAlt} />
      <g transform="translate(178 28) rotate(4)">
        {lift(190, 152, 14)}
        <rect width="190" height="152" rx="14" fill={color.surface} />
        <text x="16" y="27" fontSize="11.5" fontWeight="700" fill={color.ink} fontFamily={UI}>Inbox</text>
        <rect x="116" y="13" width="60" height="19" rx="9.5" fill={color.danger} />
        <text x="146" y="26.5" textAnchor="middle" fontSize="9.5" fontWeight="700" fill={color.white} fontFamily={FIG}>9,214</text>
        {['Your order has shipped', 'Flash sale: 40% off', 'Re: Saturday?', 'Your parcel is on its way', 'Last chance!'].map((t, i) => (
          <g key={t} transform={`translate(16 ${50 + i * 21})`}>
            <circle cx="4" cy="-3.5" r="3" fill={i % 2 ? color.borderSoft : color.accent} />
            <text x="14" y="0" fontSize="10" fill={i % 2 ? color.muted : color.bodyStrong} fontFamily={UI}>{t}</text>
          </g>
        ))}
      </g>
      <g transform="translate(46 12) rotate(-5)">
        <path d={paper} fill={color.ink} opacity="0.07" transform="translate(3 6)" />
        <path d={paper} fill={color.surface} />
        <text x="68" y="28" textAnchor="middle" fontSize="10" fontWeight="700" fill={color.ink} fontFamily={FIG}>THANK YOU</text>
        <text x="68" y="42" textAnchor="middle" fontSize="8.5" fill={color.muted} fontFamily={FIG}>12/08/26  14:32</text>
        <line x1="18" x2="118" y1="52" y2="52" stroke={color.borderSoft} strokeDasharray="3 3" />
        {items.map(([name, price], i) => (
          <g key={name}>
            <text x="18" y={70 + i * 15} fontSize="8.5" fill={color.bodyStrong} fontFamily={FIG}>{name}</text>
            <text x="118" y={70 + i * 15} textAnchor="end" fontSize="8.5" fill={color.bodyStrong} fontFamily={FIG}>{price}</text>
          </g>
        ))}
        <line x1="18" x2="118" y1="116" y2="116" stroke={color.borderSoft} strokeDasharray="3 3" />
        <text x="18" y="134" fontSize="10" fontWeight="700" fill={color.ink} fontFamily={FIG}>TOTAL</text>
        <text x="118" y="134" textAnchor="end" fontSize="10" fontWeight="700" fill={color.ink} fontFamily={FIG}>£41.50</text>
        {/* Thermal paper fades from the bottom up: the proof is already going. */}
        <defs>
          <linearGradient id="receipt-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color.surface} stopOpacity="0" />
            <stop offset="1" stopColor={color.surface} stopOpacity="0.92" />
          </linearGradient>
        </defs>
        <rect x="8" y="122" width="120" height="76" fill="url(#receipt-fade)" />
      </g>
    </svg>
  );
}

/** The one clause that decides the deadline, in the middle of a page of them. */
export function FinePrintArt() {
  const zara = clock('Zara');
  const before = ['13. Prices include VAT and may change', 'without notice. Offers cannot be used', 'with any other promotion or discount.'];
  const after = ['15. Refunds are made to the original', 'payment method within 14 days of', 'the item reaching our warehouse.'];
  return (
    <svg {...frame} role="img" aria-label={`A page of terms with the returns clause marked: ${zara.days} days ${zara.from}, unworn, tags attached`}>
      <rect width="400" height="220" fill={color.surfaceAlt} />
      <g transform="translate(92 12) rotate(1.2)">
        {lift(216, 196, 10)}
        <rect width="216" height="196" rx="10" fill={color.surface} />
        <text x="16" y="25" fontSize="10.5" fontWeight="700" fill={color.ink} fontFamily={UI}>Terms and conditions of sale</text>
        {before.map((t, i) => <text key={t} x="16" y={45 + i * 12} fontSize="8.5" fill={color.muted} fontFamily={UI}>{t}</text>)}
        <rect x="10" y="84" width="196" height="48" rx="6" fill={color.caution} />
        <rect x="10" y="84" width="4" height="48" rx="2" fill={color.gold} />
        <text x="21" y="100" fontSize="9.5" fontWeight="700" fill={color.cautionInk} fontFamily={UI}>14b. Returns</text>
        <text x="21" y="113" fontSize="8.5" fill={color.cautionInk} fontFamily={UI}>{`${zara.days} days ${zara.from}, unworn, tags`}</text>
        <text x="21" y="125" fontSize="8.5" fill={color.cautionInk} fontFamily={UI}>attached. Exclusions apply (see 14f).</text>
        {after.map((t, i) => <text key={t} x="16" y={150 + i * 12} fontSize="8.5" fill={color.muted} fontFamily={UI}>{t}</text>)}
      </g>
    </svg>
  );
}
