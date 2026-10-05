import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every browser sweep CI runs is on the UK clock before it reads any clock.
 *
 * The app's "today" is London's day (`ukDay`). The sweeps used the machine's,
 * and a CI runner is on UTC, so for the hour each night of British Summer Time
 * between midnight in London and midnight UTC the sweep and the app were a day
 * apart — measured on 5 October at 23:04 UTC, `smoke` failed on main and on a
 * pull request alike. `scripts/uk-clock.mjs` sets TZ; this holds every sweep
 * to importing it, and to importing it FIRST, so that nothing above it can
 * read the clock while it is still the runner's.
 *
 * It walks the REAL workflow, like `sweeps-report.test.ts`: the browser job's
 * `npm run` steps, resolved through package.json to the scripts they execute,
 * keeping the ones that launch a browser.
 */
const ROOT = join(__dirname, '..');
const WORKFLOW = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
const SCRIPTS = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts as Record<string, string>;
const source = (file: string) => readFileSync(join(ROOT, 'scripts', file), 'utf8');

const sweeps = (): string[] => {
  const job = WORKFLOW.slice(WORKFLOW.indexOf('\n  browser:'));
  const scripts = [...new Set([...job.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]))];
  return [...new Set(scripts.flatMap((s) => [...(SCRIPTS[s] ?? '').matchAll(/scripts\/([\w-]+\.mjs)/g)].map((m) => m[1])))]
    .filter((file) => source(file).includes('chromium.launch'));
};

/** Why a sweep's source is not on the UK clock first, or null when it is. */
export function clockProblem(text: string): string | null {
  const first = text.match(/^import\b[^\n]*$/m)?.[0];
  if (!first) return 'imports nothing';
  if (!/from\s+'\.\/uk-clock\.mjs'|^import\s+'\.\/uk-clock\.mjs'/.test(first)) {
    return /^import\b[^\n]*'\.\/uk-clock\.mjs'/m.test(text) ? `imports uk-clock.mjs, but not first (first is: ${first})` : 'never imports uk-clock.mjs';
  }
  return null;
}

describe('the browser sweeps keep the UK clock', () => {
  it('finds the sweeps it is meant to be checking', () => {
    const found = sweeps();
    for (const sweep of ['smoke.mjs', 'contrast.mjs', 'a11y.mjs', 'layout.mjs', 'agreement.mjs', 'freshness.mjs', 'ios-bundle.mjs', 'feed-wiring.mjs']) {
      expect(found, `${sweep} is no longer found among the browser job's sweeps`).toContain(sweep);
    }
  });

  it('every one imports uk-clock.mjs before anything else', () => {
    const off = sweeps()
      .map((file) => [file, clockProblem(source(file))] as const)
      .filter(([, why]) => why !== null)
      .map(([file, why]) => `${file}: ${why}`);
    expect(off).toEqual([]);
  });

  it('and uk-clock.mjs puts the process on London time', () => {
    const clock = source('uk-clock.mjs');
    expect(clock).toMatch(/process\.env\.TZ\s*=\s*'Europe\/London'/);
    expect(clock).toMatch(/export const UK_TIME_ZONE\s*=\s*'Europe\/London'/);
  });

  it('and no sweep turns a local date into a day through UTC', () => {
    /*
     * `toISOString()` is UTC. A date the sweep moved in local time — now, or
     * ten days ago — read through it is the day BEFORE between midnight and
     * 1am in London all summer, so a receipt meant to close today closed
     * yesterday. Found as the one check still failing once TZ was set. A date
     * made at local noon cannot cross midnight, so those stay.
     */
    const utcDays = sweeps().flatMap((file) =>
      source(file)
        .split('\n')
        .map((line, i) => ({ file, line: i + 1, text: line }))
        .filter(({ text }) => /toISOString\(\)\.slice\(0,\s*10\)/.test(text) && !/T12:00/.test(text))
        .map(({ file, line }) => `${file}:${line}`),
    );
    expect(utcDays).toEqual([]);
  });

  it('would say so of a sweep that left it out, or put it second', () => {
    const smoke = source('smoke.mjs');
    const without = smoke.replace(/^import \{ UK_TIME_ZONE \} from '\.\/uk-clock\.mjs';\n/m, '');
    expect(without).not.toBe(smoke);
    expect(clockProblem(without)).toBe('never imports uk-clock.mjs');

    const second = `import { chromium } from 'playwright';\n${smoke}`;
    expect(clockProblem(second)).toMatch(/^imports uk-clock\.mjs, but not first/);

    expect(clockProblem("import './uk-clock.mjs';\nimport { chromium } from 'playwright';\n")).toBeNull();
  });
});
