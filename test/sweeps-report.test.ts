import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every sweep CI runs says what it learned, even when it does not finish.
 *
 * `crash-report.mjs` exists because a sweep that THREW printed nothing at all —
 * not the crash in a form anyone could act on, and not the forty checks that
 * had already run, one of which named the defect exactly. Seven sweeps install
 * it. The eighth, `feed:wiring`, was written months later by someone who did
 * not know to (me), and became a CI gate without it — so the failure most
 * likely in a sandbox, a Chromium the pinned Playwright does not have, would
 * have printed a raw stack trace and nothing else. That reads as the feature
 * being broken rather than the environment being wrong.
 *
 * The README claims the reporter is in all of them. A claim with nothing
 * enforcing it is how it came to be false, so this enforces it.
 *
 * It walks the REAL workflow: the browser job's `npm run` steps, resolved
 * through package.json to the scripts they execute — not a list kept here,
 * which would have been written on the day of the mistake with the same gap.
 * Only the ones that drive a browser are asked; a build step has nothing to
 * report.
 */
const ROOT = join(__dirname, '..');
const WORKFLOW = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
const SCRIPTS = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts as Record<string, string>;

/** The npm scripts the browser job runs, in order. */
const browserJobScripts = (): string[] => {
  const job = WORKFLOW.slice(WORKFLOW.indexOf('\n  browser:'));
  return [...new Set([...job.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]))];
};

/** The .mjs files an npm script actually executes. */
const filesFor = (script: string): string[] =>
  [...(SCRIPTS[script] ?? '').matchAll(/scripts\/([\w-]+\.mjs)/g)].map((m) => m[1]);

const source = (file: string) => readFileSync(join(ROOT, 'scripts', file), 'utf8');

const sweeps = (): string[] =>
  browserJobScripts()
    .flatMap(filesFor)
    .filter((file) => source(file).includes('chromium.launch'));

describe('the sweeps CI runs', () => {
  it('finds the ones it is meant to be checking', () => {
    // A sweep over an empty list passes silently — and this one reads a
    // workflow file whose job name or step wording could change under it.
    expect(browserJobScripts()).toContain('smoke');
    expect(sweeps().length).toBeGreaterThanOrEqual(6);
  });

  it('every one reports what it found when it crashes', () => {
    const silent = sweeps().filter((file) => !source(file).includes('reportOnCrash('));
    expect(
      silent,
      `these would print a bare stack trace and lose their findings: ${silent.join(', ')}`,
    ).toEqual([]);
  });

  it('and prints the crash under those findings rather than only logging it', () => {
    // reportOnCrash without sayCrash reports the checks and never says why the
    // run stopped, which is the same silence one layer along.
    const quiet = sweeps().filter((file) => !source(file).includes('sayCrash('));
    expect(quiet, `these never say the run was cut short: ${quiet.join(', ')}`).toEqual([]);
  });

  it('installs the handler before the work that can throw', () => {
    /*
     * Registering it late is the version of this bug I wrote first: the handler
     * went in after two `build()` calls, so a failure in either — the likeliest
     * one in a sandbox — still escaped it. "Before the first await or call that
     * can throw" is hard to check mechanically, so this asks the weaker
     * question it can: the reporter is installed above the halfway point of the
     * file, which every current sweep satisfies comfortably and the late
     * version did not.
     */
    for (const file of sweeps()) {
      const text = source(file);
      const at = text.indexOf('reportOnCrash(');
      expect(at / text.length, `${file} installs its crash reporter late`).toBeLessThan(0.5);
    }
  });
});
