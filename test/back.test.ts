import { describe, expect, it } from 'vitest';
import { backTarget, screenDepth } from '../src/app/back';

describe('where Back goes', () => {
  it('goes up one level: from editing or the claim pack to the receipt, from anything else to the list', () => {
    expect(backTarget('edit')).toBe('detail');
    expect(backTarget('pack')).toBe('detail');
    for (const s of ['detail', 'add', 'watch', 'settings', 'celebrate'] as const) expect(backTarget(s)).toBe('home');
  });

  it('leaves the app from the list and from onboarding', () => {
    expect(backTarget('home')).toBeNull();
    expect(backTarget('onboard')).toBeNull();
  });

  it('counts one Back per level, so the history holds exactly as many entries as Backs lead somewhere', () => {
    for (const s of ['home', 'onboard', 'detail', 'add', 'watch', 'settings', 'celebrate', 'edit', 'pack'] as const) {
      const to = backTarget(s);
      expect(screenDepth(s)).toBe(to === null ? 0 : screenDepth(to) + 1);
    }
  });
});
