import { color, font } from '../../tokens';

/**
 * The three "problem" illustrations.
 *
 * Drawn as the product rather than as cartoons: miniature rows, an inbox and a
 * page of terms, in the app's own thin lines and colours. The first drawings
 * were shopping bags with clock faces, scattered tickets and a magnifying
 * glass, which read as a children's app on a page asking to be trusted with
 * money. Still a one-component swap when real photography exists.
 */
const frame = { width: '100%', height: '100%', viewBox: '0 0 400 220', preserveAspectRatio: 'xMidYMid slice' } as const;
const FONT = font.ui;

const bar = (x: number, y: number, w: number, strong = false) => (
  <rect x={x} y={y} width={w} height={strong ? 7 : 6} rx={3} fill={strong ? color.ink : color.muted} opacity={strong ? 0.75 : 0.3} />
);

/** Five shops, one afternoon, five clocks already running. */
export function HaulArt() {
  const rows = [
    { y: 34, rule: '14 days from purchase', urgent: true },
    { y: 86, rule: '28 days from delivery', urgent: false },
    { y: 138, rule: '30 days from dispatch', urgent: false },
  ];
  return (
    <svg {...frame} role="img" aria-label="Three purchases, each with a different return clock">
      <rect width="400" height="220" fill={color.surfaceAlt} />
      {rows.map((r) => (
        <g key={r.y} transform={`translate(70 ${r.y})`}>
          <rect width="260" height="44" rx="10" fill={color.white} stroke={color.borderHair} />
          <rect x="10" y="10" width="24" height="24" rx="6" fill={color.surfaceAlt} />
          {bar(44, 13, 70, true)}
          {bar(44, 25, 96)}
          <text x="250" y="27" textAnchor="end" fontSize="9.5" fontWeight="600" fill={r.urgent ? color.danger : color.muted} fontFamily={FONT}>{r.rule}</text>
        </g>
      ))}
    </svg>
  );
}

/** The proof of purchase is somewhere in thousands of emails. */
export function LostReceiptsArt() {
  return (
    <svg {...frame} role="img" aria-label="An inbox where the order confirmation is buried">
      <rect width="400" height="220" fill={color.surfaceAlt} />
      <g transform="translate(70 26)">
        <rect width="260" height="168" rx="12" fill={color.white} stroke={color.borderHair} />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} transform={`translate(0 ${12 + i * 31})`}>
            {i > 0 && <rect x="14" y="-6" width="232" height="1" fill={color.borderHair} />}
            <circle cx="28" cy="10" r="8" fill={i === 2 ? color.accentSoft : color.surfaceAlt} />
            {bar(44, 4, i === 2 ? 64 : 80 - i * 6, i === 2)}
            {bar(44, 15, 130 - (i % 3) * 18)}
            <text x="244" y="12" textAnchor="end" fontSize="8.5" fontWeight="500" fill={color.muted} fontFamily={FONT}>{['09:12', 'Mon', '12 Aug', 'Jul', 'Jun'][i]}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/** The one clause that decides the deadline, in the middle of a page of them. */
export function FinePrintArt() {
  return (
    <svg {...frame} role="img" aria-label="A page of terms with the returns clause picked out">
      <rect width="400" height="220" fill={color.surfaceAlt} />
      <g transform="translate(100 18)">
        <rect width="200" height="184" rx="10" fill={color.white} stroke={color.borderHair} />
        {bar(18, 18, 90, true)}
        {[38, 52, 66].map((y) => bar(18, y, 164 - (y % 3) * 10))}
        <rect x="12" y="80" width="176" height="34" rx="6" fill={color.accentSoft} />
        <text x="20" y="94" fontSize="9" fontWeight="600" fill={color.accentInk} fontFamily={FONT}>14b. Returns</text>
        <text x="20" y="107" fontSize="9" fontWeight="500" fill={color.ink} fontFamily={FONT}>30 days from dispatch, unworn.</text>
        {[124, 138, 152, 166].map((y) => bar(18, y, 160 - (y % 4) * 12))}
      </g>
    </svg>
  );
}
