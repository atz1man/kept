import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The privacy manifest, and the four edits that make it more than a file.
 *
 * Apple requires an app to declare why it calls certain APIs, and a manifest
 * that is not registered in `project.pbxproj` does nothing at all — it is not
 * copied into the bundle, and review never sees it. That is why this was left
 * unwritten for so long: an unregistered manifest is worse than none, because
 * it looks finished.
 *
 * Nothing here compiles anything and nobody can open the project, so the file
 * is checked from both ends: the CONTENT is re-derived from the code that
 * actually ships, and the REGISTRATION is checked by walking the project file
 * the way Xcode reads it.
 */
const ROOT = join(__dirname, '..');
const MANIFEST = readFileSync(join(ROOT, 'ios', 'App', 'App', 'PrivacyInfo.xcprivacy'), 'utf8');
const PBXPROJ = readFileSync(join(ROOT, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'), 'utf8');

/**
 * Apple's required-reason categories, by the symbols that give them away.
 *
 * A plugin that ships its own PrivacyInfo.xcprivacy answers for itself —
 * @capacitor/ios does, and declares that it accesses nothing. These three ship
 * none, so whatever they touch is the APP's to declare, and that is the
 * boundary walked below.
 */
const CATEGORIES: { category: string; symbols: RegExp[] }[] = [
  {
    category: 'NSPrivacyAccessedAPICategoryFileTimestamp',
    symbols: [/\.creationDate\b/, /\.modificationDate\b/, /attributesOfItem/, /ContentModificationDateKey/, /\bgetattrlist\b/],
  },
  { category: 'NSPrivacyAccessedAPICategorySystemBootTime', symbols: [/systemUptime/, /mach_absolute_time/] },
  { category: 'NSPrivacyAccessedAPICategoryDiskSpace', symbols: [/volumeAvailableCapacity/, /systemFreeSize/, /\bstatfs\b/] },
  { category: 'NSPrivacyAccessedAPICategoryActiveKeyboards', symbols: [/activeInputModes/] },
  { category: 'NSPrivacyAccessedAPICategoryUserDefaults', symbols: [/\bUserDefaults\b/, /NSUserDefaults/] },
];

/** The plugins with no manifest of their own, plus kept's own Swift. */
const UNDECLARED_SOURCES = [
  join(ROOT, 'node_modules', '@capacitor', 'camera', 'ios'),
  join(ROOT, 'node_modules', '@capacitor', 'filesystem', 'ios'),
  join(ROOT, 'node_modules', '@capacitor', 'local-notifications', 'ios'),
  join(ROOT, 'ios', 'App', 'App'),
];

function swiftUnder(dir: string): string[] {
  let out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out = out.concat(swiftUnder(full));
    else if (name.endsWith('.swift')) out.push(full);
  }
  return out;
}

const shippingSwift = (): string[] => UNDECLARED_SOURCES.flatMap(swiftUnder);

/** Which categories the code actually reaches. */
const reached = (): string[] => {
  const text = shippingSwift().map((f) => readFileSync(f, 'utf8')).join('\n');
  return CATEGORIES.filter((c) => c.symbols.some((re) => re.test(text))).map((c) => c.category);
};

describe('what the manifest declares', () => {
  it('finds the sources it is meant to be reading', () => {
    // A sweep over no files passes silently, reporting success for a question
    // it never asked — and this one reads a third party's tree, which is
    // exactly the kind that can quietly start returning nothing.
    expect(shippingSwift().length).toBeGreaterThan(5);
  });

  it('declares every required-reason category the shipping code reaches', () => {
    // Under-declaring is the failure that matters: it is what review rejects,
    // and it is what a plugin upgrade introduces silently.
    for (const category of reached()) {
      expect(MANIFEST, category).toContain(category);
    }
  });

  it('reaches file timestamps, which is the whole reason this file exists', () => {
    /*
     * Not a tautology of the test above: if the symbol table ever stopped
     * matching, `reached()` would return nothing and that test would pass over
     * an empty list. @capacitor/filesystem calls `attributesOfItem` and reads
     * `.creationDate` and `.modificationDate` to answer `stat` and `readdir`,
     * which kept reaches for the mirror, the photographs and an export.
     */
    expect(reached()).toContain('NSPrivacyAccessedAPICategoryFileTimestamp');
  });

  it('claims the container reason, not one of the three for files outside it', () => {
    // C617.1 is "files inside the app container". kept never touches anything
    // else, and the wider reasons would be a claim it cannot support.
    expect(MANIFEST).toContain('<string>C617.1</string>');
  });

  it('declares no category the code does not reach', () => {
    // Over-declaring is not rejected, but it is a claim about behaviour that
    // is not true — the same fault as understating it, pointing the other way.
    const found = reached();
    for (const { category } of CATEGORIES) {
      if (!found.includes(category)) expect(MANIFEST, category).not.toContain(category);
    }
  });

  it('says the app tracks nobody and collects nothing', () => {
    // The claim Settings, the onboarding and the landing page all make.
    expect(MANIFEST).toMatch(/<key>NSPrivacyTracking<\/key>\s*<false\/>/);
    expect(MANIFEST).toMatch(/<key>NSPrivacyTrackingDomains<\/key>\s*<array\/>/);
    expect(MANIFEST).toMatch(/<key>NSPrivacyCollectedDataTypes<\/key>\s*<array\/>/);
  });
});

describe('the four edits that make it ship', () => {
  const fileRef = (): string | null =>
    (PBXPROJ.match(/([0-9A-F]{24}) \/\* PrivacyInfo\.xcprivacy \*\/ = \{isa = PBXFileReference/) ?? [])[1] ?? null;
  const buildFile = (): string | null =>
    (PBXPROJ.match(/([0-9A-F]{24}) \/\* PrivacyInfo\.xcprivacy in Resources \*\/ = \{isa = PBXBuildFile/) ?? [])[1] ?? null;

  const section = (name: string): string => {
    const start = PBXPROJ.indexOf(`/* Begin ${name} section */`);
    const end = PBXPROJ.indexOf(`/* End ${name} section */`);
    expect(start, name).toBeGreaterThan(-1);
    return PBXPROJ.slice(start, end);
  };

  it('has a file reference', () => {
    expect(fileRef()).not.toBeNull();
  });

  it('sits in the App group, so Xcode shows it where it is on disk', () => {
    const group = PBXPROJ.slice(PBXPROJ.indexOf('/* App */ = {\n\t\t\tisa = PBXGroup;'));
    expect(group.slice(0, group.indexOf('};'))).toContain(fileRef()!);
  });

  it('has a build file pointing at that reference', () => {
    const line = section('PBXBuildFile')
      .split('\n')
      .find((l) => l.includes('PrivacyInfo.xcprivacy'));
    expect(line).toBeDefined();
    expect(line).toContain(`fileRef = ${fileRef()}`);
  });

  it('is in the Resources phase, without which the file ships nowhere', () => {
    /*
     * THE edit. The other three make Xcode display it; only this one copies it
     * into the bundle. A manifest in the repository and not in the app is the
     * failure this whole file was written to prevent.
     */
    expect(section('PBXResourcesBuildPhase')).toContain(buildFile()!);
  });
});

describe('the project file is still a project file', () => {
  /*
   * Those four edits were made by hand, in a container with no Xcode to open
   * the result. A malformed pbxproj does not degrade — it fails the build
   * outright, and the person who finds out is whoever next opens the project.
   * So the structure is checked here rather than trusted.
   */
  it('has balanced braces', () => {
    const open = (PBXPROJ.match(/\{/g) ?? []).length;
    const close = (PBXPROJ.match(/\}/g) ?? []).length;
    expect(open).toBe(close);
  });

  it('gives every object a unique id', () => {
    const ids = [...PBXPROJ.matchAll(/^\t\t([0-9A-F]{24}) \/\* .* \*\/ = \{/gm)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(20);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never points a build file at a reference that does not exist', () => {
    /*
     * The dangling-pointer failure: Xcode opens, the file is listed, and the
     * build cannot find it.
     *
     * Two things the first two drafts of this got wrong, both on the untouched
     * template rather than on anything I edited — which is the check earning
     * its place before it had a defect to find. A `fileRef` may point at a
     * PBXVariantGroup as well as a PBXFileReference: a localised storyboard is
     * one, and `Main.storyboard` here is. And objects come in TWO forms in
     * this format — single-line, and multi-line with `isa` on the line after
     * the brace — so a pattern that assumes one silently sees half the file.
     */
    const declared = new Map(
      [...PBXPROJ.matchAll(/^\t\t([0-9A-F]{24}) \/\*.*?\*\/ = \{\s*isa = (\w+)/gm)].map(
        (m) => [m[1], m[2]] as const,
      ),
    );
    const referenced = [...PBXPROJ.matchAll(/fileRef = ([0-9A-F]{24})/g)].map((m) => m[1]);
    expect(referenced.length).toBeGreaterThan(5);
    expect(declared.size).toBeGreaterThan(20);
    for (const id of referenced) {
      expect([...declared.keys()], id).toContain(id);
      expect(['PBXFileReference', 'PBXVariantGroup'], id).toContain(declared.get(id));
    }
  });

  it('closes every section it opens', () => {
    const begins = [...PBXPROJ.matchAll(/\/\* Begin (\w+) section \*\//g)].map((m) => m[1]);
    const ends = [...PBXPROJ.matchAll(/\/\* End (\w+) section \*\//g)].map((m) => m[1]);
    expect(begins.length).toBeGreaterThan(5);
    expect(begins).toEqual(ends);
  });
});
