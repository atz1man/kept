/**
 * Set the bundle identifier everywhere it is written down, in one go.
 *
 *   npm run bundle-id -- uk.co.yourcompany.kept
 *
 * It lives in FOUR places, which is why this exists. `capacitor.config.ts` is
 * the one a person thinks of; `project.pbxproj` carries it twice, once for
 * Debug and once for Release; and `ios/App/App/capacitor.config.json` is the
 * copy `npx cap sync ios` leaves in the app bundle. The Capacitor CLI writes
 * the pbxproj pair from `cap add` ONLY — measured — so `cap sync` will not
 * bring them into line afterwards, and someone changing the identifier by hand
 * gets a project that builds under one configuration and not the other, or an
 * app whose bridge and whose binary disagree about who it is.
 *
 * `test/ios-identity.test.ts` fails while any of them disagree. This is the
 * thing to run so that they do not.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

/** The placeholder this repository ships, deliberately obvious. */
export const PLACEHOLDER = 'uk.co.kept.REPLACE_ME';

/**
 * Apple allows letters, digits, hyphens and periods, and nothing else — not
 * underscores, which is the one people reach for. At least two segments,
 * because a single-segment identifier is accepted by the tools and rejected by
 * App Store Connect, which is the worst moment to find out.
 */
export function bundleIdProblem(id) {
  if (typeof id !== 'string' || id.length === 0) return 'give an identifier: npm run bundle-id -- uk.co.you.kept';
  if (id === PLACEHOLDER) return `${PLACEHOLDER} is the placeholder — it is what this replaces`;
  if (!/^[A-Za-z0-9.-]+$/.test(id)) return 'only letters, digits, hyphens and periods are allowed — no underscores';
  const parts = id.split('.');
  if (parts.length < 2) return 'needs at least two segments, like uk.co.you.kept';
  if (parts.some((p) => p.length === 0)) return 'has an empty segment — check for a doubled or trailing period';
  if (/^[0-9-]/.test(parts[0])) return 'the first segment cannot start with a digit or a hyphen';
  return null;
}

/**
 * Every file the identifier is written into, and how to find it in each.
 *
 * The bundle copy is OPTIONAL, and getting that wrong is what this comment is
 * for. `ios/App/App/capacitor.config.json` is generated — `ios/.gitignore`
 * lists it under "Generated Config files" — so it is absent from a fresh
 * clone and present on any machine that has run `cap sync ios`. The first
 * draft of this script required it, which made it exit 1 on CI and on anyone
 * else's first checkout. It is rewritten when it is there, so a stale copy in
 * a working tree does not sit disagreeing with the config it came from, and
 * skipped when it is not, because `cap sync` will write it correctly from
 * `capacitor.config.ts` either way.
 */
const SITES = [
  { file: join(ROOT, 'capacitor.config.ts'), find: /appId: '([^']+)'/g, write: (id) => `appId: '${id}'` },
  {
    file: join(ROOT, 'ios/App/App/capacitor.config.json'),
    find: /"appId": "([^"]+)"/g,
    write: (id) => `"appId": "${id}"`,
    optional: true,
  },
  {
    file: join(ROOT, 'ios/App/App.xcodeproj/project.pbxproj'),
    find: /PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g,
    write: (id) => `PRODUCT_BUNDLE_IDENTIFIER = ${id};`,
    expect: 2,
  },
];

export function sites() {
  return SITES;
}

function main() {
  const id = process.argv[2];
  const problem = bundleIdProblem(id);
  if (problem) {
    console.error(`✗ ${problem}`);
    process.exit(1);
  }

  const changes = [];
  const skipped = [];
  for (const site of SITES) {
    if (site.optional && !existsSync(site.file)) {
      skipped.push(site);
      continue;
    }
    const before = readFileSync(site.file, 'utf8');
    const found = [...before.matchAll(site.find)];
    if (found.length !== (site.expect ?? 1)) {
      // Refuse rather than half-write: a partial rename is the state this
      // script exists to prevent.
      console.error(`✗ ${site.file} holds ${found.length} identifiers, expected ${site.expect ?? 1} — nothing written`);
      process.exit(1);
    }
    changes.push({ site, before, was: [...new Set(found.map((m) => m[1]))] });
  }

  for (const { site, before } of changes) {
    writeFileSync(site.file, before.replace(site.find, () => site.write(id)));
  }

  console.log(`✓ bundle identifier set to ${id}`);
  for (const { site, was } of changes) {
    console.log(`    ${site.file.replace(ROOT, '')} — was ${was.join(', ')}`);
  }
  for (const site of skipped) {
    console.log(`    ${site.file.replace(ROOT, '')} — not here yet, cap sync writes it`);
  }
  console.log('  Now run: npx cap sync ios');
}

// Only when run, not when imported by the test.
if (process.argv[1] && process.argv[1].endsWith('set-bundle-id.mjs')) main();
