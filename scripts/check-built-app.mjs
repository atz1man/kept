#!/usr/bin/env node
/**
 * Read the .app that xcodebuild produced and check what review will read.
 *
 *   node scripts/check-built-app.mjs <path to App.app>
 *
 * `test/ios-privacy-manifest.test.ts` checks that the privacy manifests are
 * REGISTERED in project.pbxproj, which is what makes Xcode copy them. Whether
 * Xcode then did copy them is a fact about the build, and only a build can
 * answer it — so CI's ios job runs this over the bundle it has just compiled.
 *
 * What it checks, each because it fails silently otherwise:
 *  - a PrivacyInfo.xcprivacy in the app and in both extensions, identical to
 *    the file in the repository (an unregistered or stale manifest looks
 *    finished and review never sees the right one);
 *  - both extensions embedded under PlugIns (a target that is not embedded
 *    builds green and simply never appears on the phone);
 *  - every bundle identifier is the app's, or the app's plus a suffix, as
 *    App Store Connect requires of an extension;
 *  - every KeptAppGroup is `group.<app id>` and was resolved, not left as
 *    `$(KEPT_APP_GROUP)`: the widget, the share extension and the app find
 *    each other's files through it, and a wrong one is an empty widget;
 *  - the web bundle is inside the app, or the app opens on a blank page.
 *
 * Info.plist inside a built bundle is binary; plutil (on every Mac) turns it
 * into XML. An XML plist is read as it is, which is what the tests feed it.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

export const EXTENSIONS = [
  { name: 'QuidsInWidget', suffix: '.widget' },
  { name: 'QuidsInShare', suffix: '.share' },
];

export function appIdFromConfig(root = ROOT) {
  const config = readFileSync(join(root, 'capacitor.config.ts'), 'utf8');
  const m = config.match(/appId:\s*'([^']+)'/);
  if (!m) throw new Error('capacitor.config.ts names no appId');
  return m[1];
}

function plistXml(path) {
  const raw = readFileSync(path);
  if (raw.subarray(0, 6).toString('latin1') === 'bplist') {
    return execFileSync('plutil', ['-convert', 'xml1', '-o', '-', path], { encoding: 'utf8' });
  }
  return raw.toString('utf8');
}

/** The string under a top-level key, or null. */
export function plistString(xml, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = xml.match(new RegExp(`<key>${escaped}</key>\\s*<string>([^<]*)</string>`));
  return m ? m[1] : null;
}

/** Every problem with the bundle at `app`, as sentences; empty when it is right. */
export function checkBuiltApp(app, { root = ROOT, appId = appIdFromConfig(root) } = {}) {
  const problems = [];
  if (!existsSync(app)) return [`there is no bundle at ${app}`];
  const group = `group.${appId}`;

  const bundles = [
    { label: 'the app', dir: app, source: join(root, 'ios', 'App', 'App'), id: appId },
    ...EXTENSIONS.map((e) => ({
      label: e.name,
      dir: join(app, 'PlugIns', `${e.name}.appex`),
      source: join(root, 'ios', 'App', e.name),
      id: appId + e.suffix,
    })),
  ];

  for (const b of bundles) {
    if (!existsSync(b.dir)) {
      problems.push(`${b.label} is not embedded: no ${b.dir}`);
      continue;
    }
    const manifest = join(b.dir, 'PrivacyInfo.xcprivacy');
    if (!existsSync(manifest)) {
      problems.push(`${b.label} carries no PrivacyInfo.xcprivacy`);
    } else if (!readFileSync(manifest).equals(readFileSync(join(b.source, 'PrivacyInfo.xcprivacy')))) {
      problems.push(`${b.label}'s PrivacyInfo.xcprivacy is not the one in the repository`);
    }
    const info = join(b.dir, 'Info.plist');
    if (!existsSync(info)) {
      problems.push(`${b.label} has no Info.plist`);
      continue;
    }
    const xml = plistXml(info);
    const id = plistString(xml, 'CFBundleIdentifier');
    if (id !== b.id) problems.push(`${b.label}'s bundle identifier is ${id ?? 'missing'}, not ${b.id}`);
    const g = plistString(xml, 'KeptAppGroup');
    if (g !== group) problems.push(`${b.label}'s KeptAppGroup is ${g ?? 'missing'}, not ${group}`);
  }

  if (!existsSync(join(app, 'public', 'index.html'))) {
    problems.push('the web bundle is not inside the app: no public/index.html');
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const app = process.argv[2];
  if (!app) {
    console.error('usage: node scripts/check-built-app.mjs <path to App.app>');
    process.exit(2);
  }
  const problems = checkBuiltApp(app);
  if (problems.length) {
    for (const p of problems) console.error(`✗ ${p}`);
    process.exit(1);
  }
  console.log(`✓ ${app}: three privacy manifests as committed, both extensions embedded, ids and App Group right, web bundle present`);
}
