import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * The demo in the landing page's iframe must not touch the world.
 *
 * It is THIS build, at this origin, with `?embed` in the query — so every
 * effect in `useKept` runs there too unless it says otherwise. Left unguarded,
 * a visitor scrolling past a marketing page would have real notifications
 * lodged with their phone about receipts that are not theirs, and the photo
 * cleanup would run against a library it does not own.
 *
 * The rule is written five times and was enforced nowhere: mutating
 * `state.embedded || !isNative()` to `&&` in any of those effects left the
 * whole suite green. They are React effects and this repository has no renderer
 * to exercise them, which is exactly the case a source sweep is for — the same
 * shape as `safe-area.test.ts`, which reads the source because the inset it
 * checks is zero in every browser here.
 *
 * It walks the REAL file with the TypeScript parser rather than a regex,
 * because an effect's body is nested arbitrarily and a regex would miss one
 * quietly, which is the failure mode this file exists to prevent.
 */
const SOURCE = join(__dirname, '..', 'src', 'app', 'state.ts');

/** Anything that reaches off this device or onto its disk. */
const REACHES_OUT = ['cleanupPhotos', 'onNotificationTap', 'syncScheduled', 'save', 'onExternalChange'];

interface Effect { line: number; text: string; calls: string[] }

const effects = (): Effect[] => {
  const src = readFileSync(SOURCE, 'utf8');
  const sf = ts.createSourceFile(SOURCE, src, ts.ScriptTarget.Latest, true);
  const out: Effect[] = [];
  const walk = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'useEffect' &&
      node.arguments.length > 0
    ) {
      const text = node.arguments[0].getText();
      const calls = REACHES_OUT.filter((name) => new RegExp(`\\b${name}\\s*\\(`).test(text));
      if (calls.length > 0) {
        out.push({ line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, text, calls });
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return out;
};

describe('the effects that reach outside the app', () => {
  it('finds the ones it is meant to be checking', () => {
    // A sweep over nothing passes silently. Four at the time of writing; the
    // floor is three so adding one is not a failure and removing the lot is.
    expect(effects().length).toBeGreaterThanOrEqual(3);
    expect(effects().flatMap((e) => e.calls)).toContain('syncScheduled');
  });

  it('every one of them stands down inside the demo frame', () => {
    const unguarded = effects().filter((e) => !/state\.embedded/.test(e.text));
    expect(
      unguarded.map((e) => `state.ts:${e.line} calls ${e.calls.join(', ')}`),
      'an effect reaching outside the app with no check for the embedded demo',
    ).toEqual([]);
  });

  it('checks it FIRST, before anything it guards has run', () => {
    /*
     * `if (state.embedded) return` has to come before the work, not after it.
     * An effect that schedules notifications and then notices it is embedded
     * has already scheduled them.
     */
    for (const e of effects()) {
      const guard = e.text.search(/state\.embedded/);
      const firstCall = Math.min(
        ...e.calls.map((name) => e.text.search(new RegExp(`\\b${name}\\s*\\(`))).filter((i) => i >= 0),
      );
      expect(guard, `state.ts:${e.line} does its work before checking`).toBeLessThan(firstCall);
    }
  });
});
