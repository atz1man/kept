import { color } from '../../tokens';
import { escalation } from '../../lib/escalate';
import type { Receipt } from '../../lib/types';

/** "If the shop won't pay" — the card's doors, shown where the shop has gone quiet. */
export function Escalation({ receipt }: { receipt: Receipt }) {
  const { lines } = escalation(receipt);
  return (
    <div data-escalation style={{ marginTop: 12, paddingTop: 12, borderTop: `1.5px dashed ${color.borderHair}` }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: color.bodyStrong }}>If the shop won’t pay</div>
      {lines.map((line) => (
        <div key={line} style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 4, color: color.body }}>
          {line}
        </div>
      ))}
    </div>
  );
}
