import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WIDGET_ROWS, widgetSnapshot, type WidgetDeadline } from '../src/lib/widget-snapshot';
import { addDays, fromISODate, toISODate } from '../src/lib/dates';
import { derive } from '../src/lib/receipts';
import { findStore } from '../src/lib/stores';
import type { Receipt } from '../src/lib/types';

/*
 * The Home Screen widget. Its Swift cannot be compiled in this repository's
 * CI (no Mac), so what CAN go wrong here is checked here: what the app tells
 * it, that both halves agree on where and in what shape, and that the target
 * is in the project the way it has to be to ship.
 */
const ROOT = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const TODAY = fromISODate('2026-11-03');

const receipt = (over: Partial<Receipt>): Receipt => {
  const shop = findStore(over.store ?? 'Argos')!;
  return {
    id: over.id ?? Math.random().toString(36).slice(2), store: shop.name, item: 'Kettle', cat: 'kitchen',
    amount: 2500 as Receipt['amount'], purchasedOn: '2026-11-01', windowDays: shop.windowDays,
    policy: shop.policy, distance: false, status: 'active', ...over,
  } as Receipt;
};

describe('what the app tells the widget', () => {
  it('gives the deadline as a date, the same one every other screen states', () => {
    const r = receipt({ store: 'Argos', purchasedOn: '2026-11-01' });
    const [row] = widgetSnapshot([r], TODAY).next;
    expect(row.deadline).toBe(toISODate(derive(r, TODAY).deadline));
    expect(row).toEqual({ store: 'Argos', item: 'Kettle', deadline: row.deadline, pence: 2500, atLeast: false });
  });

  it('soonest first, at most four, and says how many more there are', () => {
    const many = Array.from({ length: 7 }, (_, i) => receipt({ id: `r${i}`, purchasedOn: toISODate(addDays(TODAY, -i)) }));
    const s = widgetSnapshot(many, TODAY);
    expect(s.next).toHaveLength(WIDGET_ROWS);
    expect(s.more).toBe(3);
    const dates = s.next.map((n) => n.deadline);
    expect([...dates].sort()).toEqual(dates);
  });

  it('leaves out what has gone back, been kept, or is already past its date', () => {
    const s = widgetSnapshot([
      receipt({ id: 'a', status: 'returned' }),
      receipt({ id: 'b', status: 'kept' }),
      receipt({ id: 'c', purchasedOn: '2026-01-01' }),
      receipt({ id: 'd' }),
    ], TODAY);
    expect(s.next.map((n) => n.store)).toHaveLength(1);
    expect(s.more).toBe(0);
  });

  it('marks a date counted from the order, for a shop that counts from delivery, as "at least"', () => {
    // ASOS counts from delivery; with no arrival given, the date is the earliest it can close.
    const [row] = widgetSnapshot([receipt({ store: 'ASOS', distance: true, purchasedOn: '2026-11-02' })], TODAY).next;
    expect(row.atLeast).toBe(true);
  });

  it('carries a shop’s Christmas date, because derive does', () => {
    // Dunelm, bought 1 December: 28 days would be 29 December; Dunelm says 31 January.
    const [row] = widgetSnapshot([receipt({ store: 'Dunelm', purchasedOn: '2026-12-01' })], fromISODate('2026-12-01')).next;
    expect(row.deadline).toBe('2027-01-31');
  });

  it('says nothing about a library with nothing open', () => {
    expect(widgetSnapshot([], TODAY)).toEqual({ version: 1, next: [], more: 0 });
  });
});

describe('both halves agree', () => {
  const widget = read('ios/App/QuidsInWidget/QuidsInWidget.swift');
  const bridge = read('packages/widget-bridge/ios/Sources/WidgetBridgePlugin/WidgetBridgePlugin.swift');

  it('on the key the snapshot is kept under', () => {
    const key = (src: string) => /snapshotKey = "([^"]+)"/.exec(src)?.[1];
    expect(key(bridge)).toBeTruthy();
    expect(key(widget)).toBe(key(bridge));
  });

  it('on the plugin name the app calls', () => {
    expect(bridge).toContain('jsName = "WidgetBridge"');
    expect(read('src/app/widget-native.ts')).toContain("registerPlugin<WidgetBridgePlugin>('WidgetBridge')");
  });

  it('on every field and its type', () => {
    // The Swift struct decodes exactly what the TypeScript interface writes; a
    // renamed field fails decoding and the widget shows "open the app" for ever.
    const fields: Record<keyof WidgetDeadline, string> = { store: 'String', item: 'String', deadline: 'String', pence: 'Int', atLeast: 'Bool' };
    const swift = /struct WidgetDeadline: Codable, Hashable \{([\s\S]*?)\n\}/.exec(widget)![1];
    const declared = Object.fromEntries([...swift.matchAll(/let (\w+): (\w+)/g)].map((m) => [m[1], m[2]]));
    expect(declared).toEqual(fields);
    expect(widget).toMatch(/let version: Int\s+let next: \[WidgetDeadline\]\s+let more: Int/);
    expect(widget).toContain('snapshot.version == 1');
  });

  it('on where the App Group is named: one build setting, read by both', () => {
    for (const plist of ['ios/App/App/Info.plist', 'ios/App/QuidsInWidget/Info.plist']) {
      expect(read(plist), plist).toMatch(/<key>KeptAppGroup<\/key>\s*<string>\$\(KEPT_APP_GROUP\)<\/string>/);
    }
    for (const ent of ['ios/App/App/App.entitlements', 'ios/App/QuidsInWidget/QuidsInWidget.entitlements']) {
      expect(read(ent), ent).toMatch(/com\.apple\.security\.application-groups<\/key>\s*<array>\s*<string>\$\(KEPT_APP_GROUP\)<\/string>/);
    }
    expect(widget).toContain('forInfoDictionaryKey: "KeptAppGroup"');
    expect(bridge).toContain('forInfoDictionaryKey: "KeptAppGroup"');
  });

  it('and nothing in either reaches the network', () => {
    for (const src of [widget, bridge]) expect(src).not.toMatch(/URLSession|URLRequest|http/);
  });
});

describe('the widget is in the app', () => {
  const pbx = read('ios/App/App.xcodeproj/project.pbxproj');

  it('as a WidgetKit extension target, built from the widget source', () => {
    expect(pbx).toMatch(/\/\* QuidsInWidget \*\/ = \{\s*isa = PBXNativeTarget;[\s\S]*?productType = "com\.apple\.product-type\.app-extension";/);
    expect(pbx).toContain('QuidsInWidget.swift in Sources');
    expect(read('ios/App/QuidsInWidget/Info.plist')).toContain('<string>com.apple.widgetkit-extension</string>');
  });

  it('embedded in the app, so it installs with it', () => {
    expect(pbx).toMatch(/Embed App Extensions[\s\S]*?QuidsInWidget\.appex in Embed App Extensions/);
    expect(pbx).toMatch(/dstSubfolderSpec = 13;/);
  });

  it('with its entitlements and its own privacy manifest', () => {
    expect(pbx).toContain('CODE_SIGN_ENTITLEMENTS = QuidsInWidget/QuidsInWidget.entitlements;');
    expect(pbx).toContain('CODE_SIGN_ENTITLEMENTS = App/App.entitlements;');
    expect(read('ios/App/QuidsInWidget/PrivacyInfo.xcprivacy')).toContain('<string>1C8F.1</string>');
  });

  it('on iOS 16 or later, where the Lock Screen sizes it offers exist', () => {
    const widgetConfigs = [...pbx.matchAll(/buildSettings = \{([^}]*?QuidsInWidget\/Info\.plist[^}]*?)\}/g)].map((m) => m[1]);
    expect(widgetConfigs).toHaveLength(2);
    for (const c of widgetConfigs) expect(c).toContain('IPHONEOS_DEPLOYMENT_TARGET = 16.0;');
  });
});
