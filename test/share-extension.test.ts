import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INBOX_TYPES, incomingFrom } from '../src/lib/share-inbox';
import { reducer, type AppState } from '../src/app/state';

/*
 * The iPhone share extension (ios/App/QuidsInShare) and the app collecting what
 * it leaves (packages/share-inbox). The Swift cannot be built here (no Mac),
 * so this holds what can go wrong without a compiler: the two halves naming
 * the same files and kinds, what the app makes of each, and the target being
 * in the project the way it must be to ship.
 */
const ROOT = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

describe('what the app makes of a shared item', () => {
  it('puts shared text in the paste box', () => {
    expect(incomingFrom({ name: 'order.txt', mime: 'text/plain', base64: b64('  Thanks for your ASOS order £32.00 ') })).toEqual({
      text: 'Thanks for your ASOS order £32.00',
    });
  });

  it('hands a PDF, a picture or a saved email to the file reader, bytes intact', async () => {
    const out = incomingFrom({ name: 'order.pdf', mime: 'application/pdf', base64: b64('%PDF-1.4 hello') });
    expect(out && 'file' in out).toBe(true);
    const file = (out as { file: File }).file;
    expect(file.name).toBe('order.pdf');
    expect(file.type).toBe('application/pdf');
    expect(await file.text()).toBe('%PDF-1.4 hello');
  });

  it('refuses what it cannot read rather than offering an empty Add screen', () => {
    expect(incomingFrom(null)).toBeNull();
    expect(incomingFrom({ name: 'x.zip', mime: 'application/zip', base64: b64('zip') })).toBeNull();
    expect(incomingFrom({ name: 'x.txt', mime: 'text/plain', base64: b64('   ') })).toBeNull();
    expect(incomingFrom({ name: 'x.pdf', mime: 'application/pdf', base64: '' })).toBeNull();
    expect(incomingFrom({ name: 'x.pdf', mime: 'application/pdf', base64: '%%%not base64' })).toBeNull();
  });

  it('opens Add with it, and a second share starts Add afresh', () => {
    const base = { screen: 'home', sharedText: null, receipts: [] } as unknown as AppState;
    const one = reducer(base, { type: 'incoming', text: 'order one' }, new Date());
    expect(one.screen).toBe('add');
    expect(one.sharedText).toBe('order one');
    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    const two = reducer(one, { type: 'incoming', file }, new Date());
    expect(two.sharedFile).toBe(file);
    expect(two.sharedText).toBeNull();
    expect(two.shareId).toBe((one.shareId ?? 0) + 1);
  });
});

describe('both halves agree', () => {
  const ext = read('ios/App/QuidsInShare/ShareViewController.swift');
  const plugin = read('packages/share-inbox/ios/Sources/ShareInboxPlugin/ShareInboxPlugin.swift');
  const name = (src: string, key: string) => new RegExp(`static let ${key} = "([^"]+)"`).exec(src)?.[1];

  it('on the inbox folder and the two file names', () => {
    for (const key of ['inboxFolder', 'noteName', 'dataName']) {
      expect(name(plugin, key), key).toBeTruthy();
      expect(name(ext, key), key).toBe(name(plugin, key));
    }
  });

  it('on the kinds: every one the extension writes, the app reads', () => {
    const written = [...ext.matchAll(/\(\.\w+, "([^"]+)", "\w+"\)/g)].map((m) => m[1]);
    expect(written.length).toBeGreaterThan(5);
    expect([...written].sort()).toEqual([...INBOX_TYPES].sort());
  });

  it('on the plugin name the app calls', () => {
    expect(plugin).toContain('jsName = "ShareInbox"');
    expect(read('src/app/share-inbox-native.ts')).toContain("registerPlugin<ShareInboxPlugin>('ShareInbox')");
  });

  it('writes the note last and empties the inbox when taken, so an order is offered once and never half-read', () => {
    expect(ext.indexOf('dataName), options: .atomic')).toBeLessThan(ext.indexOf('noteName), options: .atomic'));
    expect(plugin).toMatch(/defer \{\s*try\? FileManager\.default\.removeItem\(at: noteURL\)\s*try\? FileManager\.default\.removeItem\(at: dataURL\)/);
  });

  it('and neither reaches the network', () => {
    for (const src of [ext, plugin]) expect(src).not.toMatch(/URLSession|URLRequest|https?:/);
  });
});

describe('the share extension is in the app', () => {
  const pbx = read('ios/App/App.xcodeproj/project.pbxproj');
  const plist = read('ios/App/QuidsInShare/Info.plist');

  it('as a share-services extension, embedded in the app', () => {
    expect(pbx).toMatch(/\/\* QuidsInShare \*\/ = \{\s*isa = PBXNativeTarget;[\s\S]*?productType = "com\.apple\.product-type\.app-extension";/);
    expect(pbx).toContain('ShareViewController.swift in Sources');
    expect(pbx).toContain('QuidsInShare.appex in Embed App Extensions');
    expect(plist).toContain('<string>com.apple.share-services</string>');
    expect(plist).toContain('<string>$(PRODUCT_MODULE_NAME).ShareViewController</string>');
  });

  it('offered for one item at a time: a file, a picture or text', () => {
    expect(plist).toMatch(/NSExtensionActivationSupportsFileWithMaxCount<\/key>\s*<integer>1<\/integer>/);
    expect(plist).toMatch(/NSExtensionActivationSupportsImageWithMaxCount<\/key>\s*<integer>1<\/integer>/);
    expect(plist).toMatch(/NSExtensionActivationSupportsText<\/key>\s*<true\/>/);
  });

  it('in the same App Group as the app, with its own privacy manifest', () => {
    expect(plist).toMatch(/<key>KeptAppGroup<\/key>\s*<string>\$\(KEPT_APP_GROUP\)<\/string>/);
    expect(read('ios/App/QuidsInShare/QuidsInShare.entitlements')).toContain('<string>$(KEPT_APP_GROUP)</string>');
    expect(pbx).toContain('CODE_SIGN_ENTITLEMENTS = QuidsInShare/QuidsInShare.entitlements;');
    expect(read('ios/App/QuidsInShare/PrivacyInfo.xcprivacy')).toMatch(/NSPrivacyCollectedDataTypes<\/key>\s*<array\/>/);
  });
});
