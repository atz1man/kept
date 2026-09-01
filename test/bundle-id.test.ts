import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error - a small JS helper, run as `npm run bundle-id`
import { PLACEHOLDER, bundleIdProblem, sites } from '../scripts/set-bundle-id.mjs';

/**
 * The identifier lives in four places, and this is the thing that keeps them
 * one thing.
 *
 * `capacitor.config.ts` is the one a person thinks of; `project.pbxproj`
 * carries it twice, once for Debug and once for Release; and
 * `ios/App/App/capacitor.config.json` is the copy `cap sync` leaves in the
 * bundle. The Capacitor CLI writes the pbxproj pair from `cap add` only, so
 * `cap sync` will not bring them into line afterwards.
 *
 * `ios-identity.test.ts` fails while they disagree. This covers the tool that
 * stops them disagreeing — including running it, because a rename script that
 * has never been run is a rename script that does not work.
 */
const ROOT = join(__dirname, '..');

/**
 * A throwaway checkout. `generated` decides whether the bundle's own
 * capacitor.config.json is there — it is gitignored, so a fresh clone and CI
 * do NOT have it, and a machine that has run `cap sync ios` does. The first
 * draft of these tests copied it unconditionally and passed here while failing
 * on CI, which is the same defect as the script's, arriving through the door
 * the test was meant to be watching.
 */
function checkout({ generated }: { generated: boolean }): string {
  const dir = mkdtempSync(join(tmpdir(), 'kept-bundle-'));
  mkdirSync(join(dir, 'scripts'));
  mkdirSync(join(dir, 'ios/App/App.xcodeproj'), { recursive: true });
  mkdirSync(join(dir, 'ios/App/App'), { recursive: true });
  cpSync(join(ROOT, 'scripts/set-bundle-id.mjs'), join(dir, 'scripts/set-bundle-id.mjs'));
  cpSync(join(ROOT, 'capacitor.config.ts'), join(dir, 'capacitor.config.ts'));
  cpSync(join(ROOT, 'ios/App/App.xcodeproj/project.pbxproj'), join(dir, 'ios/App/App.xcodeproj/project.pbxproj'));
  if (generated) {
    writeFileSync(
      join(dir, 'ios/App/App/capacitor.config.json'),
      `${JSON.stringify({ appId: PLACEHOLDER, appName: 'kept' }, null, 2)}\n`,
    );
  }
  return dir;
}

const run = (dir: string, id: string) =>
  execFileSync('node', [join(dir, 'scripts/set-bundle-id.mjs'), id], { stdio: 'pipe' }).toString();

describe('what it refuses', () => {
  it('refuses the placeholder this repository ships', () => {
    // The whole point: replacing it, not re-writing it.
    expect(bundleIdProblem(PLACEHOLDER)).toMatch(/placeholder/);
  });

  it('refuses an underscore, which is the one people reach for', () => {
    // Apple allows letters, digits, hyphens and periods, and nothing else.
    expect(bundleIdProblem('uk.co.my_company.kept')).toMatch(/underscore/);
  });

  it('refuses a single segment, which the tools accept and App Store Connect does not', () => {
    expect(bundleIdProblem('kept')).toMatch(/two segments/);
  });

  it('refuses a doubled or trailing period', () => {
    expect(bundleIdProblem('uk..co.kept')).toMatch(/empty segment/);
    expect(bundleIdProblem('uk.co.kept.')).toMatch(/empty segment/);
  });

  it('refuses nothing at all', () => {
    expect(bundleIdProblem(undefined)).toMatch(/give an identifier/);
    expect(bundleIdProblem('')).toMatch(/give an identifier/);
  });

  it('accepts an ordinary one', () => {
    // The guard rail: a validator that refused everything would satisfy every
    // test above and be useless.
    expect(bundleIdProblem('uk.co.apnexus.kept')).toBeNull();
    expect(bundleIdProblem('com.example-co.kept2')).toBeNull();
  });
});

describe('what it writes', () => {
  it('names every file the identifier is written into', () => {
    // Three files, four identifiers — the pbxproj carries two. Drop one and
    // the rename goes back to being partial, which is the state this exists to
    // prevent.
    const files: string[] = sites().map((s: { file: string }) => s.file.replace(`${ROOT}/`, ''));
    expect(files).toEqual([
      'capacitor.config.ts',
      'ios/App/App/capacitor.config.json',
      'ios/App/App.xcodeproj/project.pbxproj',
    ]);
    expect(sites().find((s: { expect?: number }) => s.expect === 2)).toBeDefined();
  });

  it('marks the generated copy optional, and only that one', () => {
    /*
     * `ios/.gitignore` lists it under "Generated Config files", so it is absent
     * from a fresh clone. Read from that file rather than asserted from
     * memory: if it ever starts being committed, the reason for the optional
     * flag has gone and this says so.
     */
    const ignored = readFileSync(join(ROOT, 'ios/.gitignore'), 'utf8');
    const optional = sites().filter((s: { optional?: boolean }) => s.optional);
    expect(optional).toHaveLength(1);
    expect(optional[0].file).toContain('capacitor.config.json');
    expect(ignored).toContain('App/App/capacitor.config.json');
  });

  it('replaces it in all four places on a machine that has synced', () => {
    const dir = checkout({ generated: true });
    run(dir, 'uk.co.apnexus.kept');

    const read = (rel: string) => readFileSync(join(dir, rel), 'utf8');
    expect(read('capacitor.config.ts')).toContain("appId: 'uk.co.apnexus.kept'");
    expect(read('ios/App/App/capacitor.config.json')).toContain('"appId": "uk.co.apnexus.kept"');

    const ids = [...read('ios/App/App.xcodeproj/project.pbxproj').matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map(
      (m) => m[1],
    );
    // Both configurations, which is the pair `cap sync` will not fix.
    expect(ids).toEqual(['uk.co.apnexus.kept', 'uk.co.apnexus.kept']);

    for (const rel of ['capacitor.config.ts', 'ios/App/App/capacitor.config.json', 'ios/App/App.xcodeproj/project.pbxproj']) {
      expect(read(rel), rel).not.toContain(PLACEHOLDER);
    }
  });

  it('works on a fresh clone, where the generated copy is not there yet', () => {
    /*
     * THE case CI hit and this machine could not: I have run `cap sync`, so the
     * file exists here and the script's requiring it was invisible. On a clean
     * checkout it exited 1 and renamed nothing.
     */
    const dir = checkout({ generated: false });
    const out = run(dir, 'uk.co.apnexus.kept');

    expect(out).toContain('cap sync writes it');
    expect(readFileSync(join(dir, 'capacitor.config.ts'), 'utf8')).toContain("appId: 'uk.co.apnexus.kept'");
    const ids = [
      ...readFileSync(join(dir, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8').matchAll(
        /PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g,
      ),
    ].map((m) => m[1]);
    expect(ids).toEqual(['uk.co.apnexus.kept', 'uk.co.apnexus.kept']);
  });

  it('writes nothing when a file does not hold what it expects', () => {
    /*
     * A partial rename is the exact state this script exists to prevent, so it
     * refuses before writing anything rather than getting halfway. Driven by
     * emptying the pbxproj, which is the file carrying two.
     */
    const dir = checkout({ generated: true });
    writeFileSync(join(dir, 'ios/App/App.xcodeproj/project.pbxproj'), 'nothing here\n');

    expect(() => run(dir, 'uk.co.apnexus.kept')).toThrow();

    // The files before it in the list are untouched: it refused before writing
    // any of them.
    expect(readFileSync(join(dir, 'capacitor.config.ts'), 'utf8')).toContain(PLACEHOLDER);
    expect(readFileSync(join(dir, 'ios/App/App/capacitor.config.json'), 'utf8')).toContain(PLACEHOLDER);
  });
});
