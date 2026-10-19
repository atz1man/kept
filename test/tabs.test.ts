import { describe, expect, it } from 'vitest';
import { tabOf } from '../src/app/tabs';
import { backTarget } from '../src/app/back';
import type { Screen } from '../src/lib/types';

const EVERY: Screen[] = ['onboard', 'home', 'watch', 'detail', 'edit', 'pack', 'add', 'settings', 'celebrate'];

describe('which tab is lit', () => {
  it('lights Receipts on a receipt and on everything opened from one: the claim pack, Edit, the money-back screen', () => {
    for (const s of ['home', 'detail', 'pack', 'edit', 'celebrate'] as const) expect(tabOf(s), s).toBe('home');
  });

  it('lights each other tab on its own screen', () => {
    expect(tabOf('watch')).toBe('watch');
    expect(tabOf('add')).toBe('add');
    expect(tabOf('settings')).toBe('settings');
  });

  it('lights a tab on every screen the bar is drawn on', () => {
    for (const s of EVERY.filter((x) => x !== 'onboard')) expect(tabOf(s), s).not.toBeNull();
    expect(tabOf('onboard')).toBeNull();
  });

  it('agrees with Back: a screen under Receipts goes back towards the list', () => {
    // Back from a deeper screen lands on one lit the same way, so pressing it
    // never moves the highlight to a different tab.
    for (const s of EVERY) {
      const to = backTarget(s);
      if (to !== null && to !== 'home') expect(tabOf(to), `${s} → ${to}`).toBe(tabOf(s));
    }
  });
});
