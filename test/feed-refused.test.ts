import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { reducer, type AppState } from '../src/app/state';
import { Watch } from '../src/app/screens/Watch';

/*
 * A refused policy feed is said on the Watch screen (#7).
 *
 * A list whose signature does not check is not used, and the one already held
 * stays — right, but the screen went on saying the list is "fetched each time
 * you open the app" as though what it showed had just arrived. In the build
 * that ships no feed key is set, so this can only happen in a build with one;
 * scripts/feed-wiring.mjs builds that app and asserts the sentence appears for
 * every refused case and for no accepted one. Here: the state and the words.
 */
const ROOT = join(__dirname, '..');
const base = { screen: 'watch', receipts: [], updates: [] } as unknown as AppState;
const today = new Date(2026, 10, 7);
const watch = (over: Partial<Parameters<typeof Watch>[0]>) =>
  renderToStaticMarkup(createElement(Watch, { updates: [], receipts: [], today, watching: true, refreshes: true, onOpen: () => {}, ...over }));

describe('the refusal, in state', () => {
  it('is recorded, and cleared by a list that passes', () => {
    const refused = reducer(base, { type: 'feed-checked', refused: true }, today);
    expect(refused.feedRefused).toBe(true);
    expect(reducer(refused, { type: 'feed-checked', refused: false }, today).feedRefused).toBe(false);
  });

  it('changes nothing when the answer is the same, so nothing re-renders for it', () => {
    const refused = reducer(base, { type: 'feed-checked', refused: true }, today);
    expect(reducer(refused, { type: 'feed-checked', refused: true }, today)).toBe(refused);
  });

  it('is never saved: the next launch checks again, and only its answer is true of it', () => {
    const save = /const ok = save\(\{([\s\S]*?)\}\);/.exec(readFileSync(join(ROOT, 'src/app/state.ts'), 'utf8'))![1];
    expect(save).toContain('updates: state.updates');
    expect(save).not.toContain('feedRefused');
  });
});

describe('the Watch screen', () => {
  it('says the list was not used when it was refused', () => {
    const html = watch({ refused: true });
    expect(html).toContain('data-feed-refused');
    expect(html).toMatch(/could not be shown to be from Quids In, so it was not used/);
    expect(html).toMatch(/This is the\s+list already on your phone/);
  });

  it('says nothing of it otherwise, with the switch off, or in a build that fetches nothing', () => {
    expect(watch({})).not.toContain('data-feed-refused');
    expect(watch({ refused: true, watching: false })).not.toContain('data-feed-refused');
    expect(watch({ refused: true, refreshes: false })).not.toContain('data-feed-refused');
  });
});

describe('the wiring', () => {
  it('reports every check, both ways, before a refused list is dropped', () => {
    const app = readFileSync(join(ROOT, 'src/app/App.tsx'), 'utf8');
    const check = app.indexOf("dispatch({ type: 'feed-checked', refused: !accepted })");
    const drop = app.indexOf('if (!accepted) return;');
    expect(check).toBeGreaterThan(0);
    expect(drop).toBeGreaterThan(check);
  });
});
