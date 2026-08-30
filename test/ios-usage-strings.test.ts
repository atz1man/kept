import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Info.plist has to satisfy the camera plugin, not my memory of it.
 *
 * `@capacitor/camera` checks its usage-description keys in `getPhoto`, BEFORE
 * it dispatches on source — all three of them, unconditionally, even though
 * kept only ever asks for a new photograph and never opens the library. A
 * missing key does not crash and does not warn: it REJECTS the call. Caught in
 * `take()`, that used to be indistinguishable from a tap on Cancel, so the
 * whole feature would have been a button that did nothing, on every device,
 * with nothing anywhere saying why.
 *
 * Nothing in this repository runs on iOS, so this is a guard a reader can
 * check rather than a runner — the same shape as `safe-area.test.ts`, and for
 * the same reason. It reads the list out of the PLUGIN's own source, so a key
 * added by an upgrade is caught on the day the upgrade lands rather than on the
 * day someone opens the camera.
 */
const PLUGIN = join(
  __dirname, '..', 'node_modules', '@capacitor', 'camera',
  'ios', 'Sources', 'CameraPlugin', 'CameraTypes.swift',
);
const PLIST = join(__dirname, '..', 'ios', 'App', 'App', 'Info.plist');

const requiredKeys = (): string[] => {
  const swift = readFileSync(PLUGIN, 'utf8');
  const block = swift.match(/enum CameraPropertyListKeys[^}]*?\n\n/s)?.[0] ?? '';
  return [...block.matchAll(/case \w+ = "(NS\w+)"/g)].map((m) => m[1]);
};

const plistValue = (key: string): string | null => {
  const plist = readFileSync(PLIST, 'utf8');
  const m = plist.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`));
  return m ? m[1] : null;
};

describe('the iOS usage descriptions', () => {
  it('finds the keys it is meant to be checking', () => {
    // A sweep over an empty list passes silently, reporting success for a
    // question it never asked — and this one reads a third party's file, which
    // is exactly the kind that can quietly start returning nothing.
    expect(requiredKeys()).toContain('NSCameraUsageDescription');
    expect(requiredKeys().length).toBeGreaterThanOrEqual(3);
  });

  it('are all present in Info.plist, and none is empty', () => {
    const missing = requiredKeys().filter((k) => !plistValue(k)?.trim());
    expect(missing).toEqual([]);
  });

  it('say something a person could act on, not a placeholder', () => {
    // Apple rejects a purpose string that does not explain the purpose, and so
    // should this: the string is shown to somebody deciding whether to trust
    // the app with a camera.
    for (const key of requiredKeys()) {
      expect(plistValue(key)!.length).toBeGreaterThan(40);
      expect(plistValue(key)!.toLowerCase()).toContain('kept');
    }
  });

  it('do not claim more than the app does', () => {
    /*
     * Two of the three strings say kept never opens the photo library. That is
     * true only while the camera is asked for a NEW photograph — change the
     * source to Photos or Prompt and both sentences become false, in a file
     * nobody would think to reopen. So the claim is held to the code.
     */
    const source = readFileSync(
      join(__dirname, '..', 'src', 'app', 'components', 'ReceiptPhoto.tsx'), 'utf8',
    );
    expect(source).toContain('source: CameraSource.Camera');
    expect(source).not.toMatch(/CameraSource\.(Photos|Prompt)/);
    expect(source).not.toMatch(/saveToGallery:\s*true/);
    expect(plistValue('NSPhotoLibraryUsageDescription')!.toLowerCase()).toContain('never');
  });
});
