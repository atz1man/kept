import { describe, expect, it } from 'vitest';
import { arrivedSomewhereNew, headingOwed, placeOf } from '../src/lib/focus-place';

describe('moving focus to a new screen', () => {
  it('is not an arrival on the first paint — even when StrictMode runs the effect twice', () => {
    // What StrictMode does in development: mount, tear down, mount again,
    // and each mount runs the effect. The ref survives (it is the same
    // component instance's state), so both runs see the first place.
    const last = { current: placeOf('home', null) };
    expect(arrivedSomewhereNew(last, placeOf('home', null))).toBe(false);
    expect(arrivedSomewhereNew(last, placeOf('home', null))).toBe(false);
  });

  it('is an arrival when the screen changes, once, however often it is asked', () => {
    const last = { current: placeOf('home', null) };
    expect(arrivedSomewhereNew(last, placeOf('detail', 'r1'))).toBe(true);
    expect(arrivedSomewhereNew(last, placeOf('detail', 'r1'))).toBe(false);
  });

  it('is an arrival when the same screen shows a different receipt, and on coming back', () => {
    const last = { current: placeOf('home', null) };
    expect(arrivedSomewhereNew(last, placeOf('detail', 'r1'))).toBe(true);
    expect(arrivedSomewhereNew(last, placeOf('detail', 'r2'))).toBe(true);
    expect(arrivedSomewhereNew(last, placeOf('home', null))).toBe(true);
  });
});

/**
 * A screen in a chunk of its own mounts after the navigation, so the move to
 * its heading has to wait — and a wait is one more thing a re-run could lose.
 */
describe('a heading that arrives late is still owed its focus move', () => {
  const refs = () => ({ last: { current: placeOf('home', null) }, awaiting: { current: null as string | null } });

  it('owes nothing on the first paint, however often it is asked', () => {
    const { last, awaiting } = refs();
    expect(headingOwed(last, awaiting, placeOf('home', null))).toBe(false);
    expect(headingOwed(last, awaiting, placeOf('home', null))).toBe(false);
  });

  it('still owes it when the effect runs again before the heading is there', () => {
    const { last, awaiting } = refs();
    const settings = placeOf('settings', null);
    expect(headingOwed(last, awaiting, settings)).toBe(true);
    // StrictMode's second run: not somewhere new, and the first run's wait was torn down.
    expect(headingOwed(last, awaiting, settings)).toBe(true);
  });

  it('owes nothing more once the move has been made', () => {
    const { last, awaiting } = refs();
    const settings = placeOf('settings', null);
    headingOwed(last, awaiting, settings);
    awaiting.current = null; // what `arrive` does
    expect(headingOwed(last, awaiting, settings)).toBe(false);
  });

  it('drops the debt when the person leaves before the heading came', () => {
    const { last, awaiting } = refs();
    headingOwed(last, awaiting, placeOf('settings', null));
    expect(headingOwed(last, awaiting, placeOf('home', null))).toBe(true);
    expect(awaiting.current).toBe(placeOf('home', null));
  });
});
