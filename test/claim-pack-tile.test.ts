import { describe, expect, it } from 'vitest';
import { deadlineTile, type PackEvent } from '../src/lib/claim-pack';

/*
 * The claim pack's headline count goes to a bank or a complaints team. It
 * read "3 deadlines open" over an eight-month-old order whose three dates
 * were each "At least …" and long gone — found walking the claim pack.
 */
const ev = (passed: boolean, hedged: boolean, kind: PackEvent['kind'] = 'deadline') =>
  ({ kind, passed, hedged, on: new Date(2026, 0, 1), what: 'x' }) as unknown as PackEvent;

describe('the claim pack’s deadline count', () => {
  it('does not call a hedged date that has gone by open', () => {
    expect(deadlineTile([ev(true, true), ev(true, true), ev(true, true)])).toEqual([3, 'dates to check', 0]);
    expect(deadlineTile([ev(true, true)])).toEqual([1, 'date to check', 0]);
  });

  it('counts a date still ahead as open, and says how many others to check', () => {
    expect(deadlineTile([ev(false, false), ev(false, true)])).toEqual([2, 'deadlines open', 0]);
    expect(deadlineTile([ev(false, false), ev(true, true)])).toEqual([1, 'deadline open', 1]);
  });

  it('counts a passed date as nothing, and what happened as no deadline', () => {
    expect(deadlineTile([ev(true, false), ev(false, false, 'happened')])).toEqual([0, 'deadlines open', 0]);
  });
});
