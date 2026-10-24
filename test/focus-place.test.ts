import { describe, expect, it } from 'vitest';
import { arrivedSomewhereNew, placeOf } from '../src/lib/focus-place';

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
