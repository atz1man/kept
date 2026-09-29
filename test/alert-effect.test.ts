import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * What the alert effect does with an alert it has already shown.
 *
 * It dropped the record whenever the effect had re-run while `deliver` was
 * in flight — and the in-flight guard had made that re-run return without
 * delivering anything. So an alert that WAS shown went unrecorded, and was
 * shown again at the next foreground. On first install the effect re-runs
 * during exactly that wait (the worker's own startup changes nothing, but a
 * feed landing or a day rolling over does), and in development it happens on
 * every launch.
 *
 * Read from the source, because this repository has no renderer to drive an
 * effect with — the same reason `embedded-effects.test.ts` reads state.ts.
 */
const APP = readFileSync(join(__dirname, '..', 'src', 'app', 'App.tsx'), 'utf8');

describe('an alert that was shown', () => {
  const between = (() => {
    const from = APP.indexOf('await deliver(');
    const to = APP.indexOf("dispatch({ type: 'alerted'", from);
    return from >= 0 && to > from ? APP.slice(from, to) : null;
  })();

  it('is found where it is recorded, so this is not reading an empty span', () => {
    expect(between).not.toBeNull();
  });

  it('is recorded whether or not the effect has re-run since', () => {
    // Only real code: the comment explaining the rule names the flag it removed.
    const code = between!.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/\bcancelled\b/);
  });
});
