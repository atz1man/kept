import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ukDay, ukMidnight } from '../src/lib/dates';
import { toPence } from '../src/lib/money';
import { planAlerts } from '../src/lib/schedule';
import type { Receipt } from '../src/lib/types';

/*
 * A UK deadline, with the phone abroad.
 *
 * Every window here closes at the end of a UK day, and reminders are lodged
 * for 9am on the phone. East of the UK, 9am local can still be the UK's day
 * before: in Sydney, "The saved window has passed" for a jacket whose last
 * day was Friday fired at 22:00 UK on the Friday — two hours before it
 * passed — which is the one thing `fireDayFor` exists to prevent.
 *
 * The suite runs in America/New_York, west of the UK, where 9am local is
 * always after UK midnight and this could never show; so this file moves the
 * process to Sydney and back.
 */
const zone = process.env.TZ;
const set = (tz: string) => {
  process.env.TZ = tz;
};
beforeAll(() => set('Australia/Sydney'));
afterAll(() => set(zone ?? 'America/New_York'));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterEach(() => {
  vi.useRealTimers();
});

const jacket: Receipt = {
  id: 'r1', store: 'Next', item: 'Jacket', cat: 'clothing', amount: toPence(60),
  purchasedOn: '2026-10-20', windowDays: 10, policy: 'p', distance: false, status: 'active',
};
const plan = (now: string) => {
  vi.setSystemTime(new Date(now));
  return planAlerts([jacket], ukDay(new Date()), 7, new Set());
};
const firing = (p: ReturnType<typeof plan>, rung: string) => p.find((a) => a.rung === rung)?.at.toISOString();

describe('a phone east of the UK', () => {
  it('never says the window has passed while it is still the last day in the UK', () => {
    // Monday 26 October, 11:00 in Sydney. The jacket's last UK day is Friday 30.
    const p = plan('2026-10-26T00:00:00Z');
    // Midnight UK at the end of Friday (GMT by then): 11:00 on Saturday in Sydney.
    expect(firing(p, 'closed')).toBe('2026-10-31T00:00:00.000Z');
    // And "ends today" not before Friday has begun in the UK.
    expect(firing(p, 'today')).toBe('2026-10-30T00:00:00.000Z');
  });

  it('reads UK midnight off the zone tables on either side of a clock change', () => {
    expect(ukMidnight(new Date(2027, 5, 15)).toISOString()).toBe('2027-06-14T23:00:00.000Z'); // BST
    expect(ukMidnight(new Date(2026, 9, 31)).toISOString()).toBe('2026-10-31T00:00:00.000Z'); // GMT
    expect(ukMidnight(new Date(2026, 9, 25)).toISOString()).toBe('2026-10-24T23:00:00.000Z'); // the day the clocks go back
    expect(ukMidnight(new Date(2027, 2, 28)).toISOString()).toBe('2027-03-28T00:00:00.000Z'); // the day they go forward
  });
});

describe('at home, and west of the UK', () => {
  it('still fires at 9am on the phone', () => {
    set('Europe/London');
    try {
      const p = plan('2026-10-26T08:00:00Z');
      expect(firing(p, 'closed')).toBe('2026-10-31T09:00:00.000Z');
      expect(firing(p, 'today')).toBe('2026-10-30T09:00:00.000Z');
    } finally {
      set('Australia/Sydney');
    }
    set('America/Los_Angeles');
    try {
      const p = plan('2026-10-26T16:00:00Z');
      // 9am in Los Angeles (PDT until 1 November), not 1am to suit London.
      expect(firing(p, 'closed')).toBe('2026-10-31T16:00:00.000Z');
    } finally {
      set('Australia/Sydney');
    }
  });
});
