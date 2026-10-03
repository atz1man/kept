import { useState } from 'react';
import { color, radius } from '../../tokens';
import { money } from '../../lib/money';
import { readSplit } from '../../lib/split';
import type { Receipt } from '../../lib/types';
import { Field, inputStyle } from './Field';
import { Pressable } from './Pressable';

/**
 * "Split this receipt" — one thing out of a basket, so it can be returned,
 * kept or claimed for on its own. Closed until asked for: most receipts are
 * one thing, and a form on every receipt would say otherwise.
 */
export function SplitPanel({ receipt, onSplit }: { receipt: Receipt; onSplit: (item: string, pence: number) => void }) {
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [tried, setTried] = useState(false);
  const read = readSplit(receipt, item, amount);
  const error = tried && !read.ok ? read.error : undefined;

  if (!open) {
    return (
      <Pressable
        onClick={() => setOpen(true)}
        style={{ display: 'inline-flex', width: 'auto', minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: '0 8px', fontWeight: 600, fontSize: 14, textDecoration: 'underline' }}
      >
        Split this receipt
      </Pressable>
    );
  }
  return (
    <div data-split style={{ flexBasis: '100%', marginTop: 14, padding: 14, background: color.white, border: `1px solid ${color.border}`, borderRadius: 12 }}>
      <div style={{ fontSize: 13.5, lineHeight: 1.5, color: color.body, marginBottom: 10 }}>
        Take one thing out as its own receipt, with the same shop and dates, so it can go back or stay on its own. The
        rest of the {money(receipt.amount)} stays here.
      </div>
      <Field id="split-item" label="What is it?">
        {(p) => <input {...p} value={item} onChange={(e) => setItem(e.target.value)} style={inputStyle(false)} />}
      </Field>
      <Field id="split-amount" label="What did it cost?" error={error}>
        {(p) => <input {...p} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle(!!error)} />}
      </Field>
      <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <Pressable
          className="k-cta-yellow"
          onClick={() => {
            setTried(true);
            if (read.ok) onSplit(read.item, read.pence);
          }}
          style={{ flex: '1 1 120px', padding: 12, textAlign: 'center', background: color.accent, color: color.white, border: 0, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
        >
          Split it out
        </Pressable>
        <Pressable
          onClick={() => setOpen(false)}
          style={{ flex: '1 1 120px', padding: 12, textAlign: 'center', background: color.white, border: `1px solid ${color.borderSoft}`, borderRadius: radius.control, fontWeight: 600, fontSize: 14 }}
        >
          Cancel
        </Pressable>
      </div>
    </div>
  );
}
