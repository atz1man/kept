import { describe, expect, it } from 'vitest';
import { passedDeadline } from '../src/lib/passed-deadline';
import { addDays } from '../src/lib/dates';

const TODAY = new Date(2026, 9, 19);

describe('a deadline already gone, on the add card', () => {
  it('says nothing while the deadline is today or ahead', () => {
    expect(passedDeadline(TODAY, TODAY, false)).toBeNull();
    expect(passedDeadline(addDays(TODAY, 5), TODAY, false)).toBeNull();
  });

  it('says when a firm window closed, in words a person would use', () => {
    expect(passedDeadline(addDays(TODAY, -1), TODAY, false)).toBe('The shop’s return window closed yesterday.');
    expect(passedDeadline(addDays(TODAY, -6), TODAY, false)).toBe('The shop’s return window closed 6 days ago.');
    // An August order pasted in October: 8 Sept to 19 Oct.
    expect(passedDeadline(new Date(2026, 8, 8), TODAY, false)).toBe('The shop’s return window closed 5 weeks ago.');
    expect(passedDeadline(addDays(TODAY, -120), TODAY, false)).toBe('The shop’s return window closed 4 months ago.');
  });

  it('never calls a floor closed: the window counts from a delivery day not yet known', () => {
    const said = passedDeadline(addDays(TODAY, -3), TODAY, true)!;
    expect(said).not.toMatch(/closed \d|closed yesterday/);
    expect(said).toMatch(/earliest/);
    expect(passedDeadline(addDays(TODAY, 3), TODAY, true)).toBeNull();
  });
});
