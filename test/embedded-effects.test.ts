import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
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
 *
 * The effects turned out to be half of it. The demo erased a real library from
 * an event handler, which no effect sweep can see, so the second half below
 * holds the rule at every door to the device instead: see "every door".
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

/**
 * The alerts switch, which lives in the same unrenderable place.
 *
 * `state.ts` argues, in prose directly above the effect, that "the switch has
 * to SWITCH" — that turning deadline alerts off must cancel what is already
 * lodged rather than merely decline to add more, "which is exactly what
 * `policyWatch` turned out to be". Nothing held that argument to the code.
 *
 * Deleting the `!` from `if (!state.settings.deadlineAlerts)` left all 1068
 * tests passing. That mutant is the switch wired backwards: turning alerts ON
 * cancels every notification, and turning them OFF schedules them — the
 * control doing the opposite of what its label says, on a feature whose only
 * job is to warn you before a deadline passes.
 *
 * `schedule-native.test.ts` covers `syncScheduled` thoroughly, but every one of
 * those tests calls it directly. The DECISION of what to hand it is here, and
 * it is the decision that was unheld. It is tested beside the demo-frame rule
 * because it is the same effect, unreachable for the same reason: there is no
 * renderer in this suite.
 */
describe('the deadline-alerts switch', () => {
  /** The effect that talks to the notification plugin. */
  const alertsEffect = () => {
    const found = effects().filter((e) => e.calls.includes('syncScheduled'));
    return found;
  };

  /** The `if (...)` inside it whose condition reads the setting. */
  const branch = (text: string) => {
    const sf = ts.createSourceFile('effect.ts', `const _ = ${text}`, ts.ScriptTarget.Latest, true);
    let found: ts.IfStatement | null = null;
    const walk = (n: ts.Node) => {
      if (found) return;
      if (ts.isIfStatement(n) && /settings\.deadlineAlerts/.test(n.expression.getText())) { found = n; return; }
      ts.forEachChild(n, walk);
    };
    walk(sf);
    return found as ts.IfStatement | null;
  };

  it('finds the effect it is meant to be reading', () => {
    // Without this, a renamed effect makes every assertion below vacuous.
    expect(alertsEffect()).toHaveLength(1);
    expect(branch(alertsEffect()[0].text)).toBeTruthy();
  });

  it('cancels when the switch is OFF and schedules when it is ON', () => {
    /*
     * Evaluated, not matched. A presence check ("the effect mentions
     * deadlineAlerts") passes the inverted guard, which is the whole defect.
     */
    const b = branch(alertsEffect()[0].text)!;
    const decides = new Function('state', `return Boolean(${b.expression.getText()});`) as (
      state: { settings: { deadlineAlerts: boolean } },
    ) => boolean;
    expect(decides({ settings: { deadlineAlerts: false } }), 'switching alerts off does not take the cancel branch').toBe(true);
    expect(decides({ settings: { deadlineAlerts: true } }), 'switching alerts on takes the cancel branch').toBe(false);
  });

  it('cancels by lodging an empty plan, and plans only on the other side of it', () => {
    /*
     * The polarity above is only worth anything if the two sides do what their
     * names say. The OFF branch must hand the plugin an empty plan — that is
     * what clears alerts already lodged — and must not fall through into the
     * planner.
     */
    const e = alertsEffect()[0];
    const b = branch(e.text)!;
    const off = b.thenStatement.getText();
    expect(off.replace(/\s/g, ''), 'the off branch does not clear what is lodged').toContain('syncScheduled([])');
    expect(off, 'the off branch schedules alerts').not.toContain('planAlerts');
    expect(off, 'the off branch falls through into the planner').toMatch(/\breturn\b/);
    expect(e.text.slice(e.text.indexOf(off) + off.length), 'nothing plans alerts when the switch is on')
      .toContain('planAlerts');
  });
});

/**
 * Every door to the device, and the demo turned away at each one.
 *
 * Everything above reads `useEffect` calls in `state.ts`, which is where this
 * rule was written down and the only place it was kept. The demo erased a real
 * library anyway, from somewhere this file never looked: an event handler.
 * Erase everything called `wipe()` straight from App.tsx, the set-aside copy
 * was read and discarded straight from Settings, and nothing on either path
 * asked whether this was the demo. Measured on the built app: the visitor's
 * [Sofa, Kettle, Coat] became []. A sweep over callers is a list of the places
 * somebody remembered, and the defect is always the caller nobody listed.
 *
 * So the rule is held at the other end, where the list is short and does not
 * grow with the app: the places in `src` that actually reach something the
 * device keeps. Each must turn the demo away before it reaches through, or sit
 * in a branch the demo cannot take. A new screen that calls `wipe` is then
 * safe without knowing it, and a new line that touches localStorage directly
 * fails here, naming its line.
 *
 * What counts as reaching is the one hand-kept part, and a store it does not
 * name is a store this cannot see. Reading the notification PERMISSION is left
 * out on purpose, since the switch has to say what the browser will do, and so
 * are the camera and the document scanner, which keep nothing.
 */
const SRC = join(__dirname, '..', 'src');

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? sourceFiles(join(dir, d.name)) : /\.tsx?$/.test(d.name) ? [join(dir, d.name)] : [],
  );

/** Plugins whose whole business is something the device keeps. */
const STORE_PLUGINS = new Set(['@capacitor/filesystem', '@capacitor/local-notifications', '@capacitor/preferences']);

/** The web's own stores, reached as globals or off `window`. */
const WEB_STORES = new Set(['localStorage', 'sessionStorage', 'indexedDB', 'caches']);

/** What this node reaches on the device, or null. */
function doorOf(n: ts.Node): string | null {
  if (ts.isIdentifier(n) && WEB_STORES.has(n.text)) {
    const p = n.parent;
    // A key being declared is not a reach: `{ localStorage: fake }`.
    const declared =
      (ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isPropertyDeclaration(p) ||
        ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isBindingElement(p)) &&
      p.name === n;
    return declared ? null : n.text;
  }
  if (ts.isPropertyAccessExpression(n)) {
    const on = n.expression.getText();
    const name = n.name.text;
    if (name === 'serviceWorker') return 'the service worker';
    if (name === 'showNotification') return 'a notification';
    if (on === 'Notification' && name === 'requestPermission') return 'the notification permission';
    if (on === 'navigator' && name === 'storage') return 'persistent storage';
    if (on === 'document' && name === 'cookie') return 'cookies';
  }
  if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'Notification') {
    return 'a notification';
  }
  if (ts.isCallExpression(n)) {
    const [first] = n.arguments;
    if (n.expression.kind === ts.SyntaxKind.ImportKeyword && first && ts.isStringLiteral(first) && STORE_PLUGINS.has(first.text)) {
      return first.text;
    }
    const callee = n.expression;
    const name = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : '';
    if (name === 'addEventListener' && first && ts.isStringLiteral(first) && first.text === 'storage') {
      return 'another tab’s writes';
    }
  }
  if (
    ts.isImportDeclaration(n) &&
    !n.importClause?.isTypeOnly &&
    ts.isStringLiteral(n.moduleSpecifier) &&
    STORE_PLUGINS.has(n.moduleSpecifier.text)
  ) {
    return n.moduleSpecifier.text;
  }
  return null;
}

/**
 * A condition about the demo and the platform, EVALUATED rather than looked
 * for, for the reason the effects check above gives: `embedded() &&
 * !isNative()` mentions the demo, and lets it through on a phone.
 */
function decides(cond: string, demo: boolean, native: boolean): boolean {
  const run = new Function('state', 'embedded', 'isNative', 'navigator', `return Boolean(${cond});`) as (
    state: { embedded: boolean },
    embedded: () => boolean,
    isNative: () => boolean,
    navigator: object,
  ) => boolean;
  return run({ embedded: demo }, () => demo, () => native, { serviceWorker: {}, storage: {} });
}

/** `cond` holds for the demo on both platforms, and does not hold for the real app on at least one. */
const shutsDemoOut = (cond: string): boolean =>
  [true, false].every((native) => decides(cond, true, native)) &&
  ![true, false].every((native) => decides(cond, false, native));

/** A statement that leaves the function: `return`, `throw`, or a block of just one of them. */
const exits = (s: ts.Statement): boolean =>
  ts.isReturnStatement(s) || ts.isThrowStatement(s) || (ts.isBlock(s) && s.statements.length === 1 && exits(s.statements[0]));

/** Why nothing turns the demo away before this door, or null when something does. */
function unguarded(door: ts.Node): string | null {
  const unreadable: string[] = [];
  const shuts = (cond: string): boolean => {
    if (!/\bembedded\b/.test(cond)) return false;
    try {
      return shutsDemoOut(cond);
    } catch {
      unreadable.push(cond);
      return false;
    }
  };
  for (let child: ts.Node = door, n = door.parent; n; child = n, n = n.parent) {
    // Inside a branch the demo cannot take.
    if (ts.isIfStatement(n)) {
      const cond = n.expression.getText();
      if (child === n.thenStatement && shuts(`!(${cond})`)) return null;
      if (child === n.elseStatement && shuts(cond)) return null;
    }
    if (ts.isConditionalExpression(n)) {
      const cond = n.condition.getText();
      if (child === n.whenTrue && shuts(`!(${cond})`)) return null;
      if (child === n.whenFalse && shuts(cond)) return null;
    }
    // After a statement that sends the demo away. Only the statements BEFORE
    // the one holding the door count: a check below the reach is too late.
    if (ts.isBlock(n)) {
      for (const s of n.statements) {
        if (s === child) break;
        if (ts.isIfStatement(s) && !s.elseStatement && exits(s.thenStatement) && shuts(s.expression.getText())) return null;
      }
    }
  }
  return unreadable.length
    ? `its demo check cannot be read on its own; keep it to embedded(), state.embedded and isNative(): ${unreadable.join(' / ')}`
    : 'nothing turns the demo away before it';
}

interface Door {
  file: string;
  line: number;
  door: string;
  /** Why the demo is not turned away, or null when it is. */
  why: string | null;
}

function doors(file: string, text: string): Door[] {
  const sf = ts.createSourceFile(
    file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const out: Door[] = [];
  const walk = (n: ts.Node) => {
    const door = doorOf(n);
    if (door) out.push({ file, line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, door, why: unguarded(n) });
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

const everyDoor = (): Door[] =>
  sourceFiles(SRC).flatMap((f) => doors(relative(SRC, f).split('\\').join('/'), readFileSync(f, 'utf8')));

describe('every door to the device', () => {
  const found = everyDoor();

  it('finds the doors it is meant to be checking', () => {
    // A sweep over nothing passes silently. These are the stores the app has
    // today, and each must still be visible to the matcher, so a rename that
    // hides one from it fails here instead of leaving the rule below green.
    const seen = new Set(found.map((d) => `${d.door} in ${d.file}`));
    for (const want of [
      'localStorage in lib/storage.ts',
      'another tab’s writes in lib/storage.ts',
      '@capacitor/filesystem in lib/mirror.ts',
      '@capacitor/local-notifications in app/notify.ts',
      '@capacitor/local-notifications in app/schedule-native.ts',
      'the notification permission in app/notify.ts',
      'a notification in app/notify.ts',
      'the service worker in app/notify.ts',
      'the service worker in app/main.tsx',
      'persistent storage in app/App.tsx',
    ]) {
      expect([...seen], `the sweep no longer sees ${want}`).toContain(want);
    }
  });

  it('turns the demo away at every one, before it reaches through', () => {
    const open = found.filter((d) => d.why !== null).map((d) => `src/${d.file}:${d.line} reaches ${d.door}: ${d.why}`);
    expect(open).toEqual([]);
  });
});

describe('the door sweep, shown code written to fool it', () => {
  // The matcher is worth only what it can tell apart, so it is shown the
  // shapes that look guarded and are not, beside the ones that are.
  const verdict = (text: string) => doors('planted.ts', text).map((d) => d.why === null);

  it('refuses a door with nothing in front of it', () => {
    expect(verdict(`export function f() { localStorage.setItem('kept.v1', '[]'); }`)).toEqual([false]);
  });

  it('accepts one the demo is turned away from first', () => {
    expect(verdict(`export function f() { if (embedded()) return; localStorage.setItem('kept.v1', '[]'); }`)).toEqual([true]);
  });

  it('refuses a check that comes after the reach', () => {
    expect(verdict(`export function f() { localStorage.setItem('k', 'v'); if (embedded()) return; }`)).toEqual([false]);
  });

  it('refuses a check that lets the demo through on a phone', () => {
    expect(verdict(`export function f() { if (embedded() && !isNative()) return; localStorage.clear(); }`)).toEqual([false]);
  });

  it('refuses a check that turns everybody away', () => {
    expect(verdict(`export function f() { if (embedded() || true) return; localStorage.clear(); }`)).toEqual([false]);
  });

  it('does not count a check made by a caller, which is how the demo erased a library', () => {
    const planted = `function wipe() { localStorage.removeItem('kept.v1'); }
      export function onWipe() { if (embedded()) return; wipe(); }`;
    expect(verdict(planted)).toEqual([false]);
  });

  it('refuses a store plugin imported where nothing can stand in front of it', () => {
    expect(verdict(`import { Preferences } from '@capacitor/preferences';`)).toEqual([false]);
  });

  it('accepts a door in a branch the demo cannot take', () => {
    expect(verdict(`if (!embedded()) { navigator.serviceWorker.register('/sw.js'); }`)).toEqual([true]);
    expect(verdict(`const s = embedded() ? null : window.localStorage;`)).toEqual([true]);
    expect(verdict(`if (embedded()) { show(); } else { localStorage.clear(); }`)).toEqual([true]);
  });

  it('accepts the check the effects make, read off React state', () => {
    expect(verdict(`useEffect(() => { if (state.embedded || isNative()) return; void navigator.storage.persist(); }, []);`))
      .toEqual([true]);
  });

  it('says so when a check mentions the demo but cannot be read', () => {
    const [door] = doors('planted.ts', `export function f() { if (embedded() || ready) return; localStorage.clear(); }`);
    expect(door.why).toMatch(/cannot be read/);
  });
});

/**
 * The receipt reader's own cache.
 *
 * tesseract keeps the model it downloads in this origin's IndexedDB, and that
 * write happens inside the library, so the sweep above cannot see it: no line
 * of `src` names IndexedDB. Measured on the built app: one scan in the demo
 * left `./eng.traineddata` in the visitor's IndexedDB. So the option scan.ts
 * hands the reader is read off the source and evaluated, like the guards.
 */
describe('the receipt reader’s own cache', () => {
  const cacheOption = (): string | null => {
    const file = join(SRC, 'app', 'scan.ts');
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    let found: string | null = null;
    const walk = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'createWorker') {
        const options = n.arguments[2];
        if (options && ts.isObjectLiteralExpression(options)) {
          for (const p of options.properties) {
            if (ts.isPropertyAssignment(p) && p.name.getText() === 'cacheMethod') found = p.initializer.getText();
          }
        }
      }
      ts.forEachChild(n, walk);
    };
    walk(sf);
    return found;
  };
  const cacheFor = (demo: boolean): unknown =>
    (new Function('embedded', `return ${cacheOption()};`) as (embedded: () => boolean) => unknown)(() => demo);

  it('finds the option it is meant to be reading', () => {
    expect(cacheOption(), 'scan.ts does not tell the reader what it may keep').not.toBeNull();
  });

  it('keeps nothing from the demo, and still keeps the model for the app', () => {
    expect(cacheFor(true), 'the demo writes the model to the visitor’s device').toBe('none');
    expect(cacheFor(false), 'the app re-downloads the model for every scan').not.toBe('none');
  });
});
