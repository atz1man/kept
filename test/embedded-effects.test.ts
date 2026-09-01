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

interface Effect {
  line: number;
  text: string;
  calls: string[];
  /** The early-return condition that mentions the demo, as source text. */
  guard: string | null;
}

/**
 * The condition of the first `if (...) return` in this effect that mentions
 * the demo frame, so the rule can be READ rather than looked for.
 */
const guardOf = (effect: ts.Node): string | null => {
  let found: string | null = null;
  const walk = (n: ts.Node) => {
    if (found) return;
    if (ts.isIfStatement(n) && !n.elseStatement && ts.isReturnStatement(n.thenStatement)) {
      const cond = n.expression.getText();
      if (/state\.embedded/.test(cond)) { found = cond; return; }
    }
    ts.forEachChild(n, walk);
  };
  walk(effect);
  return found;
};

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
        out.push({
          line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          text,
          calls,
          guard: guardOf(node.arguments[0]),
        });
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
    /*
     * The condition is EVALUATED, not looked for, and that is the whole of
     * this test being worth anything.
     *
     * Its first version asked whether the effect's text mentioned
     * `state.embedded` anywhere before its first outward call — which is what
     * the header above claims to have fixed, and did not. `state.embedded &&
     * !isNative()` mentions it, mentions it first, and passes: mutation says
     * so, and the mutation is not academic. That guard stands down only on the
     * WEB, so on a device the demo in the marketing iframe would lodge real
     * notifications about receipts that are not the reader's — the exact
     * defect this file exists to prevent, waved through by the check written
     * to prevent it. A static presence check passes every mutation.
     *
     * So the rule is asked as a rule: whatever the expression is, embedded
     * stands down, on either platform.
     */
    for (const e of effects()) {
      expect(e.guard, `state.ts:${e.line} has no early return that checks state.embedded`).toBeTruthy();
      const decides = new Function('state', 'isNative', `return Boolean(${e.guard});`) as (
        state: { embedded: boolean },
        isNative: () => boolean,
      ) => boolean;
      expect(decides({ embedded: true }, () => true), `state.ts:${e.line} runs in the demo on a device`).toBe(true);
      expect(decides({ embedded: true }, () => false), `state.ts:${e.line} runs in the demo on the web`).toBe(true);
      // And not by standing down always, which would satisfy both of those
      // while making the effect dead code on the platform it was written for.
      expect(decides({ embedded: false }, () => true), `state.ts:${e.line} never runs at all`).toBe(false);
    }
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
