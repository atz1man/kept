import { describe, expect, it } from 'vitest';
import { DEFAULT_URGENT_DAYS, heroCount, urgency } from '../src/lib/urgency';

describe('the default urgent threshold', () => {
  it('is a week, which is what the rung it drives is called', () => {
    /*
     * `rungFor` calls everything inside this threshold the 'week' rung, and
     * the alert copy is written for someone with about a week to act. The
     * number and the name are the same fact in two files, and nothing held
     * them together — every other test passes a threshold explicitly, so the
     * default was free to drift away from the word for it.
     */
    expect(DEFAULT_URGENT_DAYS).toBe(7);
  });
});

describe('urgency ladder', () => {
  it('calls the last day "today"', () => {
    expect(urgency(0).label).toBe('today ⚠');
    expect(urgency(0).level).toBe('critical');
  });

  it('uses the singular for one day', () => {
    expect(urgency(1).label).toBe('1 day ⚠');
  });

  it('is critical up to and including 3 days', () => {
    expect(urgency(3).level).toBe('critical');
    expect(urgency(4).level).toBe('soon');
  });

  it('honours a widened urgent threshold', () => {
    expect(urgency(10, 7).level).toBe('relaxed');
    expect(urgency(10, 14).level).toBe('soon');
  });

  it('reports a closed window rather than negative days', () => {
    const u = urgency(-3);
    expect(u.level).toBe('expired');
    expect(u.label).toBe('window closed');
    expect(u.label).not.toContain('-');
  });
});

describe('hero count', () => {
  it('names the last day instead of printing zero', () => {
    expect(heroCount(0).count).toBe('Today');
  });

  it('uses the singular for one day', () => {
    expect(heroCount(1)).toEqual({ count: '1', word: 'day left to return your' });
  });

  it('speaks in the past tense once the window has closed', () => {
    expect(heroCount(-1).count).toBe('Gone');
  });
});

describe('the boundaries of the ladder, which nothing pinned', () => {
  /*
   * Found by mutation: `daysLeft <= urgentDays` flipped to `<` and the whole
   * suite still passed. A receipt exactly `urgentDays` from its deadline is
   * the one the week-ahead alert is named after, and it was free to become
   * "relaxed" — the grey chip — without a test noticing.
   */
  it('is "soon" on the day the window is exactly the warning distance away', () => {
    expect(urgency(7, 7).level).toBe('soon');
    expect(urgency(8, 7).level).toBe('relaxed');
  });

  it('respects a warning distance the person changed', () => {
    expect(urgency(14, 14).level).toBe('soon');
    expect(urgency(15, 14).level).toBe('relaxed');
  });
});
