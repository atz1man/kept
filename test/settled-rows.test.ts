import { describe, expect, it } from 'vitest';
import { SETTLED_SHOWN, settledRows } from '../src/lib/receipts';

const list = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('how much of a settled section shows', () => {
  it('shows every row while there is at most one more than the limit', () => {
    expect(settledRows(list(SETTLED_SHOWN + 1), false, false)).toEqual({ rows: list(SETTLED_SHOWN + 1), hidden: 0 });
  });

  it('holds back the rest, from the latest few, once two or more would be held', () => {
    const out = settledRows(list(SETTLED_SHOWN + 2), false, false);
    expect(out.rows).toEqual(list(SETTLED_SHOWN));
    expect(out.hidden).toBe(2);
    expect(settledRows(list(40), false, false).hidden).toBe(40 - SETTLED_SHOWN);
  });

  it('shows everything once asked, and everything a search found', () => {
    expect(settledRows(list(40), true, false)).toEqual({ rows: list(40), hidden: 0 });
    expect(settledRows(list(40), false, true)).toEqual({ rows: list(40), hidden: 0 });
  });
});
