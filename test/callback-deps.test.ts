import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A timer or a focus that re-arms on every render of the App.
 *
 * App passes its callbacks to these components as fresh arrows on each
 * render. Put in an effect's dependency list, that re-ran the effect every
 * time App rendered: the undo bar's eight seconds restarted whenever a feed
 * landed or an alert was recorded, and the upgrade sheet pulled keyboard
 * focus back to its first button. Read from the source — there is no renderer
 * here — and checked in both components, with the dependency arrays found
 * first so an empty match cannot pass.
 */
const read = (f: string) => readFileSync(join(__dirname, '..', 'src', 'app', 'components', f), 'utf8');

describe.each([
  ['UndoBar.tsx', ['onDismiss', 'onUndo']],
  ['UpgradeNotice.tsx', ['onCancel', 'onUnlock']],
])('%s', (file, callbacks) => {
  const deps = [...read(file).matchAll(/\}, \[([^\]]*)\]\);/g)].map((m) => m[1]);

  it('has an effect to check', () => {
    expect(deps.length).toBeGreaterThan(0);
  });

  it('keeps App’s callbacks out of its effects’ dependencies', () => {
    for (const d of deps) for (const cb of callbacks) expect(d, `[${d}]`).not.toMatch(new RegExp(`\\b${cb}\\b`));
  });
});
