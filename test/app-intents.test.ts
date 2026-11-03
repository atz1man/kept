import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { intentStart } from '../src/lib/share-inbox';
import { reducer, type AppState } from '../src/app/state';
import type { WidgetDeadline } from '../src/lib/widget-snapshot';

/*
 * Siri and Shortcuts (ios/App/App/QuidsInIntents.swift). There is no Swift
 * compiler in CI, so this holds what can drift without one: the actions read
 * the snapshot the widget reads, under the same key and in the same shape;
 * the actions that open the app leave a word the app understands; and the
 * files are compiled into the app. The wording itself lives in
 * QuidsInIntentsCore.swift, which imports only Foundation so it can be
 * compiled and run on Linux — see the commit that added it.
 */
const ROOT = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const core = read('ios/App/App/QuidsInIntentsCore.swift');
const intents = read('ios/App/App/QuidsInIntents.swift');
const bridge = read('packages/widget-bridge/ios/Sources/WidgetBridgePlugin/WidgetBridgePlugin.swift');
const inbox = read('packages/share-inbox/ios/Sources/ShareInboxPlugin/ShareInboxPlugin.swift');
const key = (src: string, name: string) => new RegExp(`static let ${name} = "([^"]+)"`).exec(src)?.[1];

describe('Siri reads what the widget reads', () => {
  it('under the same key', () => {
    expect(key(core, 'snapshotKey')).toBeTruthy();
    expect(key(core, 'snapshotKey')).toBe(key(bridge, 'snapshotKey'));
  });

  it('in the same shape, field for field', () => {
    const fields: Record<keyof WidgetDeadline, string> = { store: 'String', item: 'String', deadline: 'String', pence: 'Int', atLeast: 'Bool' };
    const swift = /struct DueItem: Codable \{([\s\S]*?)\n\}/.exec(core)![1];
    expect(Object.fromEntries([...swift.matchAll(/let (\w+): (\w+)/g)].map((m) => [m[1], m[2]]))).toEqual(fields);
    expect(core).toContain('snapshot.version == 1');
  });

  it('and never says "last day" for a date counted from the order', () => {
    // The rule the widget and every reminder keep: a floor is "at least".
    expect(core).toMatch(/atLeast && left > 0 \? "at least \\\(core\)" : core/);
  });

  it('without the network or the app having to open', () => {
    for (const src of [core, intents]) expect(src).not.toMatch(/URLSession|URLRequest|https?:/);
    expect(intents).toMatch(/struct WhatsDueIntent: AppIntent \{[\s\S]*?openAppWhenRun = false/);
  });
});

describe('the actions that open the app', () => {
  it('leave a word under the key the app collects it from', () => {
    expect(key(core, 'openKey')).toBeTruthy();
    expect(key(inbox, 'openKey')).toBe(key(core, 'openKey'));
  });

  it('ask only for what the app understands, and the app starts Add that way', () => {
    const asked = [...intents.matchAll(/DueSummary\.request\("(\w+)"/g)].map((m) => m[1]).sort();
    expect(asked).toEqual(['add', 'scan']);
    expect(intentStart('add')).toBe('paste');
    expect(intentStart('scan')).toBe('scan');
    expect(intentStart('delete-everything')).toBeNull();
    expect(intentStart(null)).toBeNull();
  });

  it('open Add with the camera when asked to scan, once', () => {
    const base = { screen: 'home', sharedText: null, receipts: [] } as unknown as AppState;
    const opened = reducer(base, { type: 'incoming', start: 'scan' }, new Date());
    expect(opened.screen).toBe('add');
    expect(opened.intentStart).toBe('scan');
    expect(reducer(opened, { type: 'intent-started' }, new Date()).intentStart).toBeUndefined();
  });

  it('are offered as App Shortcuts that name the app, as Siri requires', () => {
    const phrases = [...intents.matchAll(/"([^"]*\\\(\.applicationName\)[^"]*)"/g)].map((m) => m[1]);
    expect(phrases.length).toBeGreaterThanOrEqual(3);
    for (const p of phrases) expect(p).toContain('\\(.applicationName)');
    for (const name of ['WhatsDueIntent', 'AddReceiptIntent', 'ScanReceiptIntent']) expect(intents).toContain(`intent: ${name}()`);
  });
});

describe('the actions are in the app', () => {
  const pbx = read('ios/App/App.xcodeproj/project.pbxproj');

  it('compiled into the App target', () => {
    expect(pbx).toContain('QuidsInIntentsCore.swift in Sources');
    expect(pbx).toContain('QuidsInIntents.swift in Sources');
  });

  it('only from iOS 16, with AppIntents weakly linked so the app still opens on 13', () => {
    for (const decl of intents.matchAll(/\nstruct (\w+): (AppIntent|AppShortcutsProvider)/g)) {
      const before = intents.slice(0, decl.index);
      expect(before.trimEnd().endsWith('@available(iOS 16.0, *)'), decl[1]).toBe(true);
    }
    const appLinks = [...pbx.matchAll(/OTHER_LDFLAGS = \(([\s\S]*?)\n\s*\);/g)].map((m) => m[1]);
    expect(appLinks.length).toBeGreaterThanOrEqual(2);
    for (const flags of appLinks) expect(flags).toMatch(/"-weak_framework",\s*AppIntents/);
  });
});
