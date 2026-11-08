import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error - a small JS helper, run by CI's ios job on the real bundle
import { checkBuiltApp, plistString } from '../scripts/check-built-app.mjs';

/**
 * CI's ios job compiles the app and hands the bundle to
 * `scripts/check-built-app.mjs`. Linux has no xcodebuild, so this builds the
 * bundle Xcode would — from the repository's own manifests and Info.plists,
 * with the build settings substituted — and then breaks it one way at a time.
 * Each break is a real way a build goes green and ships the wrong thing.
 */
const ROOT = join(__dirname, '..');
const APP_ID = 'uk.co.getquidsin.app';
const dirs: string[] = [];

function resolved(path: string, id: string): string {
  return readFileSync(path, 'utf8')
    .replaceAll('$(PRODUCT_BUNDLE_IDENTIFIER)', id)
    .replaceAll('$(KEPT_APP_GROUP)', `group.${APP_ID}`);
}

function buildLikeXcode(): string {
  const app = join(mkdtempSync(join(tmpdir(), 'built-app-')), 'App.app');
  dirs.push(app);
  const put = (dir: string, source: string, id: string) => {
    mkdirSync(dir, { recursive: true });
    cpSync(join(ROOT, 'ios', 'App', source, 'PrivacyInfo.xcprivacy'), join(dir, 'PrivacyInfo.xcprivacy'));
    writeFileSync(join(dir, 'Info.plist'), resolved(join(ROOT, 'ios', 'App', source, 'Info.plist'), id));
  };
  put(app, 'App', APP_ID);
  put(join(app, 'PlugIns', 'QuidsInWidget.appex'), 'QuidsInWidget', `${APP_ID}.widget`);
  put(join(app, 'PlugIns', 'QuidsInShare.appex'), 'QuidsInShare', `${APP_ID}.share`);
  mkdirSync(join(app, 'public'));
  writeFileSync(join(app, 'public', 'index.html'), '<!doctype html>');
  return app;
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(join(d, '..'), { recursive: true, force: true });
});

describe('the built-app check', () => {
  it('passes the bundle Xcode builds from this repository', () => {
    expect(checkBuiltApp(buildLikeXcode())).toEqual([]);
  });

  it('reads the bundle identifier from the committed config, not a copy', () => {
    const config = readFileSync(join(ROOT, 'capacitor.config.ts'), 'utf8');
    expect(config).toContain(`appId: '${APP_ID}'`);
  });

  it('names a missing manifest in the app or either extension', () => {
    for (const where of ['', 'PlugIns/QuidsInWidget.appex', 'PlugIns/QuidsInShare.appex']) {
      const app = buildLikeXcode();
      rmSync(join(app, where, 'PrivacyInfo.xcprivacy'));
      expect(checkBuiltApp(app).join('\n')).toMatch(/carries no PrivacyInfo\.xcprivacy/);
    }
  });

  it('names a manifest that is not the committed one', () => {
    const app = buildLikeXcode();
    writeFileSync(join(app, 'PlugIns', 'QuidsInWidget.appex', 'PrivacyInfo.xcprivacy'), '<plist/>');
    expect(checkBuiltApp(app)).toEqual(["QuidsInWidget's PrivacyInfo.xcprivacy is not the one in the repository"]);
  });

  it('names an extension that was built but not embedded', () => {
    const app = buildLikeXcode();
    rmSync(join(app, 'PlugIns', 'QuidsInShare.appex'), { recursive: true });
    expect(checkBuiltApp(app).join('\n')).toMatch(/QuidsInShare is not embedded/);
  });

  it('names an App Group left unresolved, which is an empty widget', () => {
    const app = buildLikeXcode();
    const info = join(app, 'PlugIns', 'QuidsInWidget.appex', 'Info.plist');
    writeFileSync(info, readFileSync(info, 'utf8').replace(`group.${APP_ID}`, '$(KEPT_APP_GROUP)'));
    expect(checkBuiltApp(app)).toEqual([
      `QuidsInWidget's KeptAppGroup is $(KEPT_APP_GROUP), not group.${APP_ID}`,
    ]);
  });

  it('names an extension id that is not the app id plus its suffix', () => {
    const app = buildLikeXcode();
    const info = join(app, 'PlugIns', 'QuidsInShare.appex', 'Info.plist');
    writeFileSync(info, readFileSync(info, 'utf8').replace(`${APP_ID}.share`, 'uk.co.kept.REPLACE_ME.share'));
    expect(checkBuiltApp(app)).toEqual([
      `QuidsInShare's bundle identifier is uk.co.kept.REPLACE_ME.share, not ${APP_ID}.share`,
    ]);
  });

  it('names an app with no web bundle inside it', () => {
    const app = buildLikeXcode();
    rmSync(join(app, 'public'), { recursive: true });
    expect(checkBuiltApp(app)).toEqual(['the web bundle is not inside the app: no public/index.html']);
  });

  it('reads a key only at its own name', () => {
    const xml = '<key>KeptAppGroupX</key><string>no</string><key>KeptAppGroup</key><string>yes</string>';
    expect(plistString(xml, 'KeptAppGroup')).toBe('yes');
  });
});
