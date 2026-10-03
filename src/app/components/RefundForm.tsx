import { useState } from 'react';
import { color, font } from '../../tokens';
import { readAmount } from '../../lib/draft';
import { money, type Pence } from '../../lib/money';
import { Pressable } from './Pressable';

/**
 * "How much came back?" — the one form for saying a refund was less than the
 * price. On the receipt, and on the celebration that follows a return, which
 * is where most people are when they see the figure: that screen went straight
 * back to the list, so the correction was one they had to go looking for.
 *
 * On white wherever it sits: the refusal's red is legible on white and
 * measured 4.02:1 on the yellow refund panel.
 */
export function RefundForm({ id, cost, current, onSet, onClose }: {
  id: string;
  cost: Pence;
  current: Pence;
  onSet: (pence: number | null) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(current !== cost ? (current / 100).toFixed(2) : '');
  const read = text.trim() ? readAmount(text) : null;
  const error =
    read && !read.ok ? read.error : read && read.ok && read.pence > cost ? `More than the ${money(cost)} it cost` : undefined;
  const save = () => {
    if (!read || !read.ok || error) return;
    onSet(read.pence);
    onClose();
  };
  return (
    <div style={{ textAlign: 'left', marginTop: 10, padding: 12, background: color.white, border: `1.5px solid ${color.borderSoft}`, borderRadius: 12 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 12.5, fontWeight: 700, marginBottom: 6, color: color.ink }}>
        How much came back?
      </label>
      <input
        id={id}
        inputMode="decimal"
        value={text}
        placeholder={(cost / 100).toFixed(2)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
        }}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 14,
          border: `1.5px solid ${error ? color.danger : color.border}`, background: color.white,
          fontFamily: font.figures, fontSize: 14.5, color: color.ink,
        }}
      />
      {error && (
        <div id={`${id}-error`} role="alert" style={{ fontSize: 12.5, fontWeight: 600, color: color.danger, marginTop: 5 }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <Pressable
          className="k-cta-yellow"
          onClick={save}
          disabled={!read || !read.ok || !!error}
          style={{ flex: 1, padding: 12, textAlign: 'center', background: color.accent, border: 0, borderRadius: 999, fontWeight: 700, fontSize: 14, color: color.white }}
        >
          Save
        </Pressable>
        <Pressable
          className="k-row-white"
          onClick={() => {
            onSet(null);
            onClose();
          }}
          style={{ flex: 1, padding: 12, textAlign: 'center', background: color.white, border: `1.5px solid ${color.borderSoft}`, borderRadius: 999, fontWeight: 700, fontSize: 14, color: color.ink }}
        >
          It was the full amount
        </Pressable>
      </div>
    </div>
  );
}
