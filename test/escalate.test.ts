import { describe, expect, it } from 'vitest';
import { escalation, S75_MAX_PENCE, S75_MIN_PENCE, s75Fits } from '../src/lib/escalate';
import { toPence } from '../src/lib/money';
import type { Receipt } from '../src/lib/types';

const r = (pounds: number): Receipt => ({
  id: 'a', store: 'Currys', item: 'Kettle', cat: 'kitchen', amount: toPence(pounds),
  purchasedOn: '2026-08-01', windowDays: 30, policy: 'p', distance: false, status: 'kept',
});

describe('where the shop will not pay', () => {
  it('pins Parliament’s numbers for Section 75', () => {
    expect(S75_MIN_PENCE).toBe(10000);
    expect(S75_MAX_PENCE).toBe(3000000);
  });

  it('names Section 75 over £100 and up to £30,000, and not at either side', () => {
    expect(s75Fits(r(100))).toBe(false);
    expect(s75Fits(r(100.01))).toBe(true);
    expect(s75Fits(r(30000))).toBe(true);
    expect(s75Fits(r(30000.01))).toBe(false);
  });

  it('always offers the chargeback, as the scheme’s rule and not the law, with no promised time limit', () => {
    const lines = escalation(r(40)).lines;
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/chargeback/);
    expect(lines[0]).toMatch(/rather than the law/);
    expect(lines[0]).not.toMatch(/\d+ days/);
  });

  it('leads with Section 75 where it fits, quoting the price', () => {
    const lines = escalation(r(249.99)).lines;
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^Paid by credit card\? At £249\.99, Section 75 of the Consumer Credit Act/);
  });
});
